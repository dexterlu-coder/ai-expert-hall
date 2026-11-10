import {composeInstalledEnterprisePlugins,installedEnterprisePlugins} from './enterprise-plugins.ts'
/** AI专家办事大厅的 Electron 外壳，承载固定版本的本机运行服务。 */

import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { connectionEntryHtml, enterpriseLoginHtml, connectionLoadingHtml } from './connection-entry.ts'
import { connectionPartition, enterpriseConnection, type DesktopConnection } from './connection-mode.ts'
import { parseDeploymentConfig } from './deployment-config.ts'
import { EnterpriseLogin, startEnterpriseAuthority, type Authority } from './enterprise-auth.ts'
import { desktopEnterprisePatch, enterpriseEnvironment, enterpriseSpace, materializeRuntimeProfile, markProfileUpdated, officialLauncher, officialHostLauncher } from './local-runtime.ts'
import { manageCommand } from './command-management.ts'
import { createRuntimeOutputRedactor, redactRuntimeOutput, runtimeFailureDetail, runtimeFailureLog } from './runtime-diagnostics.ts'
import { stopOwnedProcess, trackOwnedProcess } from './owned-process.ts'
import { prepareRuntimePort, runtimePortConflict } from './runtime-port.ts'
import { runOfficialCommand } from './official-command.ts'

const PROFILE_NAME = 'workdsh'
const PRODUCT_NAME = 'AI专家办事大厅'
const READY_PATTERN = /dsh web:\s+(http:\/\/127\.0\.0\.1:\d+\/?\?token=[^\s]+)/u
// The packaged Host can spend roughly 97 seconds loading the fixed Profile
// and its bundled services on a cold Windows start. Keep the desktop window
// alive long enough for that legitimate first start to complete.
const HOST_STARTUP_TIMEOUT_MS = 180_000

let runtime: ChildProcess | undefined
let runtimeStarting = false
let window: BrowserWindow | undefined
let quitting = false
let switching = false
let quitRequested = false
let quitPromise: Promise<void> | undefined
let workspaceCleanup: Promise<void> | undefined
let switchEnded: (() => void) | undefined
let relaunchRequested = false
let recoveryRequested = false
let closingForTransition = false
let returnRequested = false
let installer: ChildProcess | undefined
const enterpriseWindows = new Set<BrowserWindow>()
let enterprisePortal = process.env.WORKDSH_ENTERPRISE_PORTAL ?? ''
let managedBackend: string | undefined
let entrySurface = false
let pendingConnection: ReturnType<typeof enterpriseConnection> | undefined
let enterprise: { login: EnterpriseLogin, root: string, home: string, deviceId: string, authority?: Authority, authFile?: string } | undefined
let verifyTimer: ReturnType<typeof setInterval> | undefined
let verifying = false

/** Metadata only: never log runtime URLs, command arguments or user content. */
function lifecycle(event: string, reason: string): void {
  try {
    const directory = join(app.getPath('userData'), 'logs')
    mkdirSync(directory, { recursive: true })
    appendFileSync(join(directory, 'lifecycle.log'), JSON.stringify({ utc: new Date().toISOString(), event, reason,
      hostPid: runtime?.pid, runtimeStarting, window: window !== undefined, switching, quitRequested, quitting }) + '\n', { mode: 0o600 })
  } catch { /* Diagnostics must not bypass cleanup or expose runtime output. */ }
}

function requestQuit(reason: string, relaunch = false): Promise<void> | undefined {
  if (quitting) return quitPromise
  if (!quitRequested) relaunchRequested = relaunch
  quitRequested = true
  lifecycle('quit-requested', reason)
  if (quitPromise) return quitPromise
  // Cancel an owned installer promptly, then let the switching chain hand back
  // the workspace. Every event still receives this same in-flight promise.
  const switched = switching ? new Promise<void>(resolve => { switchEnded = resolve }) : Promise.resolve()
  quitPromise = Promise.resolve().then(async () => {
    lifecycle('cleanup-started', reason)
    if (installer) await stopOwnedProcess(installer)
    await switched
    await leaveWorkspace()
    lifecycle('cleanup-succeeded', reason)
    if (relaunchRequested) app.relaunch()
    quitting = true
    app.quit()
  }).catch(error => {
    lifecycle('cleanup-failed', reason)
    quitRequested = false; relaunchRequested = false
    dialog.showErrorBox('暂时无法退出', error instanceof Error ? redactRuntimeOutput(error.message) : '请稍后重试')
  }).finally(() => { quitPromise = undefined })
  return quitPromise
}

function recoverMissingWindow(reason: string): void {
  if (quitting || quitRequested) return
  if (switching || runtimeStarting || installer) {
    recoveryRequested = true
    lifecycle('recovery-deferred', reason)
    return
  }
  recoveryRequested = false
  if (window === undefined) void requestQuit(reason, true)
}

function bundledProfileDirectory(): string {
  const overridden = process.env.WORKDSH_BUNDLED_PROFILE
  if (overridden !== undefined && overridden.length > 0) return overridden
  return join(process.resourcesPath, 'workdsh-runtime', 'profiles', PROFILE_NAME)
}

function runtimeHome(): string {
  const overridden = process.env.WORKDSH_DSH_HOME
  if (overridden !== undefined && overridden.length > 0) return overridden
  return join(app.getPath('userData'), 'dsh-home')
}

function bundledNodeExecutable(): string {
  const overridden = process.env.WORKDSH_NODE_EXECUTABLE
  if (overridden !== undefined && overridden.length > 0) return overridden
  return join(
    bundledPrimaryRuntime(),
    'dependencies',
    'node',
    'bin',
    process.platform === 'win32' ? 'node.exe' : 'node',
  )
}

function bundledPrimaryRuntime(): string {
  const overridden = process.env.WORKDSH_PRIMARY_RUNTIME
  if (overridden !== undefined && overridden.length > 0) return overridden
  return join(process.resourcesPath, 'workdsh-runtime', 'primary-runtime')
}

/**
 * Windows command resolution is process-wide and can select a machine-level
 * Corepack shim when a child invokes a bare `dsh`, `pnpm`, or `corepack`.
 * Keep the packaged runtime's command surface ahead of the inherited PATH.
 * The directory lives below the writable DSH home so an installed app never
 * needs to modify Program Files or the user's global Node installation.
 */
function runtimeCommandDirectory(home: string): string | undefined {
  if (process.platform !== 'win32') return undefined
  const directory = join(home, '.workdsh-bin')
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  const node = bundledNodeExecutable()
  const dsh = join(bundledProfileDirectory(), 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
  const pnpm = join(bundledPrimaryRuntime(), 'dependencies', 'pnpm', 'bin', 'pnpm.cjs')
  const writeShim = (name: string, target: string): void => {
    const file = join(directory, name)
    const content = `@echo off\r\n"${node}" "${target}" %*\r\nexit /b %errorlevel%\r\n`
    if (!existsSync(file) || readFileSync(file, 'utf8') !== content) writeFileSync(file, content, { mode: 0o700 })
  }
  writeShim('dsh.cmd', dsh)
  writeShim('pnpm.cmd', pnpm)
  // The bundled Node runtime intentionally has no Corepack distribution. This
  // no-op satisfies the legacy "corepack enable pnpm" probe; the pnpm shim
  // above is the actual package manager used by the application.
  const corepack = join(directory, 'corepack.cmd')
  const corepackContent = '@echo off\r\nif /I "%~1"=="enable" exit /b 0\r\n>&2 echo AI Expert Hall uses its bundled pnpm; Corepack is unavailable in the packaged runtime.\r\nexit /b 1\r\n'
  if (!existsSync(corepack) || readFileSync(corepack, 'utf8') !== corepackContent) writeFileSync(corepack, corepackContent, { mode: 0o700 })
  return directory
}

function browserWorkerRequest(): { port: number, profile: string } | undefined {
  const portArg = process.argv.find(arg => arg.startsWith('--workdsh-browser-worker-port='))
  if (portArg === undefined) return undefined
  const port = Number(portArg.slice('--workdsh-browser-worker-port='.length))
  const profile = process.argv.find(arg => arg.startsWith('--workdsh-browser-worker-profile='))
    ?.slice('--workdsh-browser-worker-profile='.length)
  if (!Number.isInteger(port) || port < 1024 || port > 65535 || !profile || !isAbsolute(profile) || !existsSync(profile)) {
    throw new Error('Invalid browser worker arguments')
  }
  return { port, profile }
}

function startBrowserWorker(request: { port: number, profile: string }): void {
  // Set this before Electron becomes ready: hiding the Dock afterwards briefly
  // registers every task's browser worker as another foreground application.
  // Accessory permits the hidden browser window without a Dock icon or menu bar.
  if (process.platform === 'darwin') app.setActivationPolicy('accessory')
  app.setPath('userData', request.profile)
  app.commandLine.appendSwitch('remote-debugging-address', '127.0.0.1')
  app.commandLine.appendSwitch('remote-debugging-port', String(request.port))
  void app.whenReady().then(async () => {
    const page = new BrowserWindow({
      show: false,
      width: 1280,
      height: 800,
      webPreferences: {
        offscreen: true,
        backgroundThrottling: false,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
      },
    })
    page.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    await page.loadURL('about:blank')
    process.stdout.write('WORKDSH_BROWSER_WORKER_READY\n')
  }).catch(error => {
    process.stderr.write(`${PRODUCT_NAME}浏览器工作进程失败：${String(error)}\n`)
    app.exit(1)
  })
}

function openWindow(url: string, connection: DesktopConnection = { mode: 'personal' }, carrier = false): void {
  const previous = window
  const previousEntrySurface = entrySurface
  const icon = fileURLToPath(new URL('../build/app-icon.png', import.meta.url))
  window = new BrowserWindow({
    width: 1440,
    height: 960,
    ...(previous && typeof previous.getBounds === 'function' ? previous.getBounds() : {}),
    minWidth: 960,
    minHeight: 640,
    title: PRODUCT_NAME,
    icon,
    backgroundColor: '#111113',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      ...(carrier ? { preload: fileURLToPath(new URL('./connection-preload.cjs', import.meta.url)) } : {}),
      ...(connectionPartition(connection) === undefined ? {} : { partition: connectionPartition(connection)! }),
    },
  })
  const page = window
  entrySurface = carrier
  window.on('page-title-updated', event => {
    event.preventDefault()
    page.setTitle(PRODUCT_NAME)
  })
  if (connection.mode === 'enterprise') enterpriseWindows.add(page)
  window.webContents.setWindowOpenHandler(({ url: target }) => {
    if (target.startsWith('https://') || target.startsWith('http://')) void shell.openExternal(target)
    return { action: 'deny' }
  })
  if (!carrier) {
    const origin = new URL(url).origin
    page.webContents.on('will-navigate', (event, target) => {
      if (target === 'workdsh://entry' && window === page && !switching) {
        event.preventDefault()
        if (!enterprisePluginAvailable()) { dialog.showErrorBox('企业插件不可用', '请先安装兼容的企业账号插件。'); return }
        void returnToEntry()
        return
      }
      try { if (new URL(target).origin === origin) return } catch { /* invalid navigation is refused */ }
      event.preventDefault()
    })
  }
  void page.loadURL(url).then(() => {
    if (page.isDestroyed() || window !== page || quitRequested) return
    recoveryRequested = false
    page.show()
    if (previous && !previous.isDestroyed()) previous.destroy()
  }).catch(() => {
    if (previous && !previous.isDestroyed()) { window = previous; entrySurface = previousEntrySurface }
    closingForTransition = true
    try { if (!page.isDestroyed()) page.destroy() }
    finally { closingForTransition = false }
    lifecycle('window-load-failed', 'window-load-failed')
    dialog.showErrorBox('无法打开工作区', '请检查企业地址、网络或本地运行状态。')
    if (runtime) void returnToEntry('window-load-failed')
    else if (window === undefined) void requestQuit('window-load-failed')
  })
  page.on('closed', () => {
    enterpriseWindows.delete(page)
    if (window !== page) return
    window = undefined
    lifecycle('window-closed', closingForTransition ? 'transition-window-closed' : 'window-closed')
    if (!closingForTransition && process.platform !== 'darwin') void requestQuit('window-closed')
  })
}

function runtimeEnvironment(home: string): NodeJS.ProcessEnv {
  const parent = enterprise ? enterpriseEnvironment(enterprise.root, bundledNodeExecutable(), process.env) : process.env
  const delimiter = process.platform === 'win32' ? ';' : ':'
  const bundledNodeDirectory = dirname(bundledNodeExecutable())
  const bundledProfileBin = join(bundledProfileDirectory(), 'node_modules', '.bin')
  const commandDirectory = runtimeCommandDirectory(home)
  return {
    ...parent,
    // dsh-market's generic launcher resolves `dsh` through PATH on Windows.
    // Put the packaged CLI and its Node runtime first so skill installs never
    // fall through to a machine-wide Corepack shim.
    PATH: [commandDirectory, bundledNodeDirectory, bundledProfileBin, parent.PATH].filter(Boolean).join(delimiter),
    DSH_HOME: home,
    DSH_AGENTS_HOME: enterprise ? join(enterprise.root, 'agents') : join(home, 'agents'),
    DSH_BUNDLED_PRIMARY_RUNTIME: bundledPrimaryRuntime(),
    DSH_ELECTRON_EXECUTABLE: process.execPath,
    WORKDSH_ELECTRON_APP: app.isPackaged ? undefined : app.getAppPath(),
    ELECTRON_RUN_AS_NODE: undefined,
  }
}

async function officialCommand(home: string, args: string[], timeoutMs = 240_000): Promise<void> {
  const executable = bundledNodeExecutable()
  const launcher = officialLauncher(bundledProfileDirectory(), home, executable, join(bundledPrimaryRuntime(), 'dependencies', 'pnpm', 'bin', 'pnpm.cjs'))
  await runOfficialCommand({ executable, launcher, args, home, env: runtimeEnvironment(home), timeoutMs,
    logDirectory: join(app.getPath('userData'), 'logs'), cancelled: () => quitRequested,
    onProcess: child => { installer = child },
  })
}

async function prepareProfile(home: string): Promise<{ profile: string, existingHome: boolean }> {
  // Capture this before materialization creates the new Home's Profile files.
  const existingHome = [join(home, 'profiles', PROFILE_NAME, 'package.json'), join(home, 'profiles', PROFILE_NAME, 'cordis.yml'), join(home, 'cordis.yml'), join(home, '.workdsh-host.mjs')].some(existsSync)
  const source = bundledProfileDirectory()
  const result = materializeRuntimeProfile(source, home)
  if (result.changed) {
    const entry = window
    if (entry && !entry.isDestroyed()) await entry.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(connectionLoadingHtml('正在更新工作区插件依赖')))
    await officialCommand(home, ['plugin', '--profile', PROFILE_NAME, 'install'])
    markProfileUpdated(source, result.profile)
    if (entry && !entry.isDestroyed()) await entry.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(connectionLoadingHtml(enterprise ? '正在启动企业工作区' : '正在启动个人工作区')))
  }
  officialLauncher(source, home, bundledNodeExecutable(), join(bundledPrimaryRuntime(), 'dependencies', 'pnpm', 'bin', 'pnpm.cjs'))
  return { profile: result.profile, existingHome }
}

function rememberCommandSpace(home?: string): void {
  const active = home ? { mode: enterprise ? 'enterprise' : 'personal', home, ...(enterprise ? { root: enterprise.root } : {}), label: enterprise ? `${enterprise.login.actor.organizationName ?? '企业'} / ${enterprise.login.actor.displayName}` : '个人工作区' } : undefined
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(join(app.getPath('userData'), 'command-context.json'), JSON.stringify({ personalHome: runtimeHome(), active }), { mode: 0o600 })
}

async function startRuntime(home: string, connection: DesktopConnection, patches: string[] = [], existingHome = false): Promise<void> {
  rememberCommandSpace(home)
  if (quitRequested) throw new Error('启动已取消')
  const executable = bundledNodeExecutable()
  if (!existsSync(executable)) throw new Error(`Bundled Node.js runtime is missing: ${executable}`)
  const basePatch = join(bundledProfileDirectory(), 'cordis.patch.yml')
  const port = await prepareRuntimePort(home, [join(home, 'profiles', PROFILE_NAME, 'cordis.yml'), join(home, 'profiles', PROFILE_NAME, 'cordis.patch.yml'), join(home, 'cordis.yml'), join(home, 'cordis.patch.yml'), ...patches], { existingHome })
  if (quitRequested) throw new Error('启动已取消')
  const layers = [...(existsSync(basePatch) ? [basePatch] : []), ...patches, ...(port.managed ? [port.patch] : [])]
  const launcher = officialHostLauncher(bundledProfileDirectory(), home, executable, join(bundledPrimaryRuntime(), 'dependencies', 'pnpm', 'bin', 'pnpm.cjs'), layers)
  const startedAt = Date.now()
  const child = spawn(executable, [launcher, '--no-open'], {
    env: runtimeEnvironment(home),
    cwd: enterprise ? join(enterprise.root, 'workspace') : home,
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  trackOwnedProcess(child, startedAt)
  runtime = child
  runtimeStarting = true
  let ready = false
  let output = ''
  let diagnosticOutput = ''
  const recordOutput = (safe: string): void => {
    diagnosticOutput = `${diagnosticOutput}${safe}`.slice(-16_384)
    process.stderr.write(safe)
  }
  const stdoutRedactor = createRuntimeOutputRedactor(recordOutput)
  const stderrRedactor = createRuntimeOutputRedactor(recordOutput)
  const consume = (chunk: Buffer): void => {
    const text = chunk.toString('utf8')
    stdoutRedactor.push(chunk)
    if (ready || switching || quitRequested || runtime !== child) return
    output = `${output}${text}`.slice(-16_384)
    const match = READY_PATTERN.exec(output)
    if (match?.[1] !== undefined) {
      ready = true
      runtimeStarting = false
      openWindow(match[1], connection)
    }
  }
  const failureDetail = (code: number | null, cleanupFailed = false): string => {
    const detail = [!ready ? runtimePortConflict(port, diagnosticOutput) : undefined, runtimeFailureDetail(ready, code, diagnosticOutput, cleanupFailed)].filter(Boolean).join('\n\n')
    try {
      const directory = join(app.getPath('userData'), 'logs')
      mkdirSync(directory, { recursive: true })
      const path = join(directory, 'runtime-failure.log')
      writeFileSync(path, runtimeFailureLog(ready, code, diagnosticOutput, cleanupFailed), { mode: 0o600 })
      return `${detail}\n\n错误记录：${path}`
    } catch { return detail }
  }
  child.stdout.on('data', consume)
  child.stdout.once('end', () => stdoutRedactor.end())
  child.stderr.on('data', chunk => stderrRedactor.push(chunk))
  child.stderr.once('end', () => stderrRedactor.end())
  child.once('error', cause => {
    if (!quitting && !quitRequested && runtime === child) { runtimeStarting = false; dialog.showErrorBox('启动失败', redactRuntimeOutput(cause.message)); void returnToEntry('runtime-start-failed') }
  })
  child.once('exit', code => {
    if (runtime !== child || quitting || quitRequested || workspaceCleanup) return
    runtimeStarting = false
    dialog.showErrorBox('本机运行已停止', failureDetail(code))
    void returnToEntry('runtime-exit')
  })
  const readyTimeout = setTimeout(() => { if (!ready && !quitRequested && runtime === child) { dialog.showErrorBox('启动超时', '官方 DSH 尚未就绪，正在清理本机进程。'); void returnToEntry('startup-timeout') } }, HOST_STARTUP_TIMEOUT_MS)
  child.once('exit', () => clearTimeout(readyTimeout))
}

function leaveWorkspace(): Promise<void> {
  if (workspaceCleanup) return workspaceCleanup
  workspaceCleanup = Promise.resolve().then(cleanWorkspace).finally(() => { workspaceCleanup = undefined })
  return workspaceCleanup
}

async function cleanWorkspace(): Promise<void> {
  const page = window
  if (verifyTimer) { clearInterval(verifyTimer); verifyTimer = undefined }
  const session = enterprise
  // Shut admission before waiting for any graceful process exit.
  await session?.authority?.close()
  session?.login.cancelRequests()
  const child = runtime
  if (child) { await stopOwnedProcess(child); if (runtime === child) { runtime = undefined; runtimeStarting = false } }
  enterprise = undefined
  rememberCommandSpace()
  if (session) {
    if (session.authFile) rmSync(session.authFile, { force: true })
    const revoked = await session.login.logout()
    if (!revoked) dialog.showErrorBox('本机已退出', '本机企业运行和登录已停止；后台连接失败，远端撤销尚未确认。')
    if (page && !page.isDestroyed()) {
      await page.webContents.session.closeAllConnections()
      await page.webContents.session.clearStorageData()
      await page.webContents.session.clearCache()
    }
  }
  closingForTransition = true
  try {
    for (const enterprisePage of [...enterpriseWindows]) if (!enterprisePage.isDestroyed()) enterprisePage.destroy()
    enterpriseWindows.clear()
    if (page && !page.isDestroyed()) page.destroy()
  } finally { closingForTransition = false }
  pendingConnection = undefined; entrySurface = false
}

async function returnToEntry(reason = 'switch-to-entry'): Promise<void> {
  if (quitting) return
  lifecycle('return-to-entry', reason)
  if (quitRequested) { void requestQuit(reason); return }
  if (switching) { returnRequested = true; return }
  switching = true
  try { await leaveWorkspace(); if (!quitRequested) showConnectionEntry() }
  catch (error) { lifecycle('cleanup-failed', reason); dialog.showErrorBox('暂时无法切换', error instanceof Error ? redactRuntimeOutput(error.message) : '请稍后重试') }
  finally { endSwitch() }
}

function endSwitch(): void {
  switching = false
  const finish = switchEnded
  switchEnded = undefined
  finish?.()
  if (quitRequested) void requestQuit('switch-finished')
  else if (returnRequested) { returnRequested = false; void returnToEntry() }
  else if (recoveryRequested) recoverMissingWindow('deferred-second-instance')
}

function savedBackendFile(): string { return join(app.getPath('userData'), 'enterprise-backend.json') }
function rememberBackend(backend: string): void {
  if (managedBackend) return
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(savedBackendFile(), JSON.stringify({ backend }), { mode: 0o600 })
}

function showConnectionEntry(): void {
  openWindow('data:text/html;charset=utf-8,' + encodeURIComponent(connectionEntryHtml(enterprisePortal, managedBackend !== undefined, enterprisePluginAvailable())), { mode: 'personal' }, true)
  connectEntryNavigation(window!)
}

function connectEntryNavigation(entry: BrowserWindow): void {
  entry.webContents.on('will-navigate', (event, target) => {
    event.preventDefault()
    if (switching || quitRequested || quitting || window !== entry || !entrySurface) return
    void (async () => {
      switching = true
      try {
        const command = new URL(target)
        if (command.protocol !== 'workdsh:') return
        if (command.hostname === 'enterprise') {
          if (enterprise) throw new Error('请先退出当前企业账号再修改后台地址')
          const connection = enterpriseConnection(managedBackend ?? command.searchParams.get('portal') ?? '')
          pendingConnection = connection
          enterprisePortal = connection.portalOrigin
          rememberBackend(enterprisePortal)
          openWindow('data:text/html;charset=utf-8,' + encodeURIComponent(enterpriseLoginHtml(enterprisePortal)), { mode: 'personal' }, true)
          connectEntryNavigation(window!)
        } else if (command.hostname === 'personal') {
          if (enterprise) await leaveWorkspace()
          const home = runtimeHome()
          await entry.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(connectionLoadingHtml('正在启动个人工作区')))
          const prepared = await prepareProfile(home)
          entrySurface = false
          await startRuntime(home, { mode: 'personal' }, [], prepared.existingHome)
        } else if (command.hostname === 'entry') {
          await leaveWorkspace(); showConnectionEntry()
        }
      } catch (error) {
        dialog.showErrorBox('无法进入', error instanceof Error ? error.message : '请检查入口配置')
        if (!quitRequested) showConnectionEntry()
      } finally { endSwitch() }
    })()
  })
}

function enterprisePluginAvailable():boolean {
 try{return installedEnterprisePlugins(join(runtimeHome(),'profiles',PROFILE_NAME),JSON.parse(readFileSync(join(bundledProfileDirectory(),'node_modules','@deepseek-ai','dsh','package.json'),'utf8')).version).includes('workdsh-provider-identity-enterprise')}
 catch{return false}
}

async function activateEnterprise(existingHome: boolean): Promise<void> {
  const session = enterprise
  if (!session) throw new Error('请重新登录企业账号')
  await session.login.verify()
  if (quitRequested) throw new Error('启动已取消')
  const pluginNames=await composeInstalledEnterprisePlugins(join(runtimeHome(),'profiles',PROFILE_NAME),join(session.home,'profiles',PROFILE_NAME),JSON.parse(readFileSync(join(bundledProfileDirectory(),'node_modules','@deepseek-ai','dsh','package.json'),'utf8')).version,bundledNodeExecutable(),join(bundledPrimaryRuntime(),'dependencies','pnpm','bin','pnpm.cjs'))
  if(quitRequested||enterprise!==session)throw new Error('企业启动已取消')
  const manifest = join(session.home, 'profiles', PROFILE_NAME, 'package.json')
  const selected = JSON.parse(readFileSync(manifest, 'utf8')) as { dsh?: { profile?: { bundles?: string[] } } }
  selected.dsh ??= {}; selected.dsh.profile ??= {}; selected.dsh.profile.bundles ??= []
  const bundles = selected.dsh.profile.bundles
  // Disable personal identity at composition, rather than allow an identity fallback.
  selected.dsh.profile.bundles = bundles.filter(name => name !== 'workdsh-provider-identity-local')
  for (const name of pluginNames) {
    if (!selected.dsh.profile.bundles.includes(name)) selected.dsh.profile.bundles.push(name)
  }
  writeFileSync(manifest, JSON.stringify(selected, null, 2) + '\n', { mode: 0o600 })
  session.authority = await startEnterpriseAuthority(session.login, session.deviceId, () => { void returnToEntry() }, () => { void returnToEntry() })
  // Record before writing either file, so a partial patch failure is also cleaned.
  session.authFile = join(session.home, 'enterprise-auth.json')
  const patch = desktopEnterprisePatch(session.home, session.authority, session.login.actor, session.login.backendUrl, session.deviceId, pluginNames.includes('workdsh-plugin-enterprise-collaboration'))
  session.authFile = patch.authFile
  const connection: DesktopConnection = { mode: 'enterprise', portalOrigin: session.login.backendUrl, organizationId: session.login.actor.organizationId, principalId: session.login.actor.id }
  if (window) await window.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(connectionLoadingHtml('正在启动企业工作区')))
  entrySurface = false
  await startRuntime(session.home, connection, [patch.patch], existingHome)
  verifyTimer = setInterval(() => {
    if (verifying || switching) return
    verifying = true
    void session.login.verify().then(()=>{
      const current=installedEnterprisePlugins(join(runtimeHome(),'profiles',PROFILE_NAME),JSON.parse(readFileSync(join(bundledProfileDirectory(),'node_modules','@deepseek-ai','dsh','package.json'),'utf8')).version)
      if(pluginNames.some(name=>!current.includes(name)))throw new Error('企业插件已卸载，请重新安装后登录')
    }).catch(() => {
      dialog.showErrorBox('企业认证不可用', '企业账号已过期、被撤销、后台不可达或企业插件已卸载。本机企业运行将停止，请检查后重新登录。')
      void returnToEntry()
    }).finally(() => { verifying = false })
  }, 30_000)
}

function installLoginHandlers(): void {
  ipcMain.handle('workdsh:enterprise-login', async (event, input: unknown) => {
    if (!entrySurface || event.sender !== window?.webContents || switching || quitRequested || quitting || !pendingConnection || enterprise) return { error: '此页面不能发起企业登录' }
    switching = true
    let admittedLogin: EnterpriseLogin | undefined
    try {
      const value = input as { account?: unknown, password?: unknown }
      if (!value || typeof value.account !== 'string' || typeof value.password !== 'string') throw new Error('请输入账号和密码')
      const login = await EnterpriseLogin.login(pendingConnection.portalOrigin, value.account, value.password)
      admittedLogin = login
      const space = enterpriseSpace(app.getPath('userData'), login.backendUrl, login.actor)
      enterprise = { login, ...space }
      const prepared = await prepareProfile(space.home)
      await activateEnterprise(prepared.existingHome)
      return {}
    } catch (error) {
      const message = error instanceof Error ? error.message : '企业登录失败'
      if (enterprise) { await leaveWorkspace(); showConnectionEntry(); dialog.showErrorBox('无法进入企业', message) }
      else if (admittedLogin && !await admittedLogin.logout()) dialog.showErrorBox('企业启动未完成', '本机未进入企业运行；后台连接失败，远端登录撤销尚未确认。')
      return { error: message }
    } finally { endSwitch() }
  })
}

function installConnectionMenu(): void {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' as const }] : []),
    { label: '工作区', submenu: [{ label: '切换使用方式／退出企业', click: () => { void returnToEntry() } }] },
    { label: '工具', submenu: [{ label: '终端命令 dsh（可选）…', click: () => { void manageCommand(join(process.resourcesPath, 'workdsh-runtime'), enterprise ? `${enterprise.login.actor.organizationName ?? '企业'} / ${enterprise.login.actor.displayName}` : '个人工作区') } }] },
    { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' },
  ]))
}

const worker = browserWorkerRequest()
if (worker !== undefined) {
  startBrowserWorker(worker)
} else {
// The native bundle starts without a Dock icon so spawned browser workers cannot
// flash one before JavaScript runs. Only the primary application becomes foreground.
if (process.platform === 'darwin') app.setActivationPolicy('regular')
const desktopUserData = process.env.WORKDSH_DESKTOP_USER_DATA
if (desktopUserData) {
  if (!isAbsolute(desktopUserData)) throw new Error('Desktop user data override must be absolute')
  app.setPath('userData', desktopUserData)
}
app.setName(PRODUCT_NAME)
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (quitRequested || quitting) return
    if (window === undefined) { recoverMissingWindow('second-instance'); return }
    if (window.isMinimized()) window.restore()
    window.focus()
  })
  app.on('before-quit', event => {
    if (quitting) return
    event.preventDefault()
    void requestQuit('before-quit')
  })
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' && !closingForTransition) void requestQuit('window-all-closed')
  })
  app.on('activate', () => {
    // The entry closes before the official Host is ready. Activating the app
    // during that window must not relaunch and cancel the pending workspace.
    if (switching || runtimeStarting || installer || quitting || quitRequested) return
    if (window === undefined) {
      // A healthy runtime always owns a window. Relaunching keeps the profile
      // lifecycle simple after the last macOS window was closed.
      recoverMissingWindow('activate')
    }
  })
  void app.whenReady().then(() => {
    const deploymentFile = join(process.resourcesPath ?? '', 'workdsh-config.json')
    if (existsSync(deploymentFile)) {
      managedBackend = parseDeploymentConfig(JSON.parse(readFileSync(deploymentFile, 'utf8'))).enterprise?.backendUrl
      if (managedBackend) enterprisePortal = managedBackend
    }
    if (!enterprisePortal && existsSync(savedBackendFile())) {
      try { enterprisePortal = enterpriseConnection(JSON.parse(readFileSync(savedBackendFile(), 'utf8')).backend).portalOrigin } catch { /* stale invalid preference is not trusted */ }
    }
    installConnectionMenu()
    installLoginHandlers()
    showConnectionEntry()
  }).catch(cause => {
    process.stderr.write(`${PRODUCT_NAME}启动失败：${cause instanceof Error ? cause.stack ?? cause.message : String(cause)}\n`)
    app.quit()
  })
}
}
