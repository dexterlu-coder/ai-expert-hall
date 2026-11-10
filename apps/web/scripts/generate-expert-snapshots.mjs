/**
 * Build-time方案 B generator.
 *
 * The eight business Skill directories are the only prose source. This script
 * emits reviewable expert package documents and immutable digest metadata; it
 * never installs a Skill or calls a model.
 */
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const skillRoot = join(projectRoot, 'packages/plugins/skills/resources/skills');
const outputPath = join(projectRoot, 'packages/plugins/experts/resources/generated/expert-packages.json');
const buildVersion = 'workdsh-expert-snapshot/1';
const slugs = [
  'ai-learning-coach',
  'business-operations-analysis',
  'enterprise-knowledge-extraction-assistant',
  'exam-evaluator',
  'idp-development-plan-generator',
  'llm-wiki',
  'training-course-designer',
  'training-needs-diagnosis',
];
const display = {
  'ai-learning-coach': ['AI学习教练', '帮助用户制定学习计划、练习、复习并跟踪进度。'],
  'business-operations-analysis': ['经营数据分析', '根据经营数据生成指标、趋势、异常与结论建议。'],
  'enterprise-knowledge-extraction-assistant': ['企业知识库萃取助手', '把制度、流程和项目素材整理为可检索的结构化知识。'],
  'exam-evaluator': ['试卷与题库质量评估', '评估试卷与题库的内容、结构、难度和规范性。'],
  'idp-development-plan-generator': ['个人发展计划生成器', '根据能力差距与目标岗位生成个人发展计划。'],
  'llm-wiki': ['个人知识库管理', '增量建立和维护结构化个人知识库。'],
  'training-course-designer': ['培训课程设计', '设计企业培训课程、工作坊和配套材料。'],
  'training-needs-diagnosis': ['培训需求诊断', '诊断组织培训现状和能力差距并给出实施建议。'],
};

const digest = rows => createHash('sha256').update(rows.map(row => `${row.path}\0${row.bytes.toString('base64')}\0`).join('')).digest('hex');
const isSafeRelative = path => path && !path.startsWith('/') && !/^[a-z]:/iu.test(path) && !path.split('/').some(part => !part || part === '.' || part === '..');

async function collect(root, current = root) {
  const rows = [];
  for (const name of (await readdir(current)).sort((a, b) => a.localeCompare(b))) {
    const absolute = join(current, name);
    const info = await lstat(absolute);
    if (info.isSymbolicLink()) throw new Error(`skill snapshot refuses symlink: ${absolute}`);
    if (info.isDirectory()) rows.push(...await collect(root, absolute));
    else if (info.isFile()) {
      const path = relative(root, absolute).replaceAll('\\', '/');
      if (!isSafeRelative(path)) throw new Error(`skill snapshot invalid path: ${path}`);
      rows.push({ path, bytes: await readFile(absolute) });
    } else throw new Error(`skill snapshot unsupported entry: ${absolute}`);
  }
  return rows;
}

function expertDocument(slug, name, description) {
  return `---\nformat: workdsh-expert-document\nversion: 1\nname: expert\ndescription: ${description}\nrole: ${name}\nmethodology: 读取并遵循 ${slug} 的固定 Skill 快照，先核对输入与边界，再按 Skill 交付。\nboundaries: 只使用本专家包内固定 Skill；缺少资料、权限或能力时明确说明，不自动发送任务。\ndeliverables: 按 Skill 约定输出可审阅的草稿、过程说明和交付物。\ntags: [业务专家]\nexamples: []\nskillRequirements: [{ name: ${slug} }]\nfutureRequirements: []\n---\n\n<!-- workdsh:role -->\n## 身份与专业职责\n\n你是${name}，负责围绕用户目标执行固定方法。\n\n<!-- workdsh:methodology -->\n## 专业方法与场景\n\n先读取用户材料，再读取本包内的 Skill 与引用资源；不凭空补齐未知事实。\n\n<!-- workdsh:boundaries -->\n## 能力与协作边界\n\n这是发布时固定的 Skill 快照。需要更新时重新构建专家包，并保留旧任务绑定。\n\n<!-- workdsh:deliverables -->\n## 成果与交付标准\n\n输出可复查结果，标注输入依据、未验证项和需要人工确认的边界。\n`;
}

async function buildOne(slug) {
  const source = join(skillRoot, slug);
  const rows = await collect(source);
  if (!rows.some(row => row.path === 'SKILL.md')) throw new Error(`missing SKILL.md: ${slug}`);
  const [name, description] = display[slug];
  const sourceDigest = digest(rows);
  const resourceRows = rows.map(row => ({ path: `skills/${slug}/${row.path}`, bytes: row.bytes }));
  const snapshotDigest = digest(resourceRows);
  const docs = Object.fromEntries(resourceRows.map(row => [row.path, row.bytes.toString('utf8')]));
  const embedded = {
    slug,
    sourceDigest,
    snapshotDigest,
    buildVersion,
    resourcesRoot: `skills/${slug}`,
    readiness: 'ready',
    resourceClosure: rows.map(row => `skills/${slug}/${row.path}`),
  };
  docs['agents/expert.md'] = expertDocument(slug, name, description);
  docs['README.md'] = `# ${name}\n\n${description}\n\n这是由 ${buildVersion} 生成的发布时固定 Skill 快照。更新来源后重新构建；旧任务继续绑定旧快照。\n`;
  docs['.workdsh-expert/plugin.json'] = JSON.stringify({
    schemaVersion: 1,
    name: `${slug}-expert`,
    displayName: { zh: name, en: slug },
    displayDescription: { zh: description, en: description },
    tags: ['业务专家'],
    quickPrompts: [`请使用${name}帮我处理以下任务：`],
    skills: [`skills/${slug}`],
    agents: ['agents/expert.md'],
    agentName: 'expert',
    expertType: 'agent',
    buildVersion,
    embeddedSkills: [embedded],
  }, null, 2) + '\n';
  return {
    expertId: `${slug}-expert`,
    skillSlug: slug,
    sourceDigest,
    snapshotDigest,
    buildVersion,
    resourcesRoot: `skills/${slug}`,
    resourceClosure: embedded.resourceClosure,
    packageDocuments: Object.fromEntries(Object.entries(docs).sort(([a], [b]) => a.localeCompare(b))),
  };
}

const packages = [];
for (const slug of slugs) packages.push(await buildOne(slug));
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify({ schemaVersion: 1, buildVersion, generatedFrom: 'packages/plugins/skills/resources/skills', packages }, null, 2) + '\n', 'utf8');
console.log(`Generated ${packages.length} expert snapshots at ${outputPath}`);

