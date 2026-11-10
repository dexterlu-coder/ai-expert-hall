import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const source = async path => readFile(new URL(path, root), 'utf8');

test('P2 policy has one ordinary default and two trusted exception markers', async () => {
  const policy = await source('packages/contracts/src/session-policy.ts');
  assert.match(policy, /preset === 'standard'/);
  assert.match(policy, /\^wd-exp-\[a-z0-9-\]\+\$/);
  assert.match(policy, /preset === 'cordis'/);
  assert.match(policy, /Symbol\('workdsh\.session-source'\)/);
  assert.match(policy, /enumerable: false/);
  assert.match(policy, /session\/preset-source-denied/);
});

test('P2 boundary is called by the Host bridge and trusted callers mark exceptions', async () => {
  const access = await source('packages/plugins/access/src/index.ts');
  const experts = await source('packages/plugins/experts/src/services/experts-manager.ts');
  const workbench = await source('packages/plugins/workbenches/src/runtime/create-development-session.ts');
  const fresh = await source('packages/bundle/src/client/harness/fresh-session.ts');
  assert.match(access, /assertSessionPresetAdmission\(request\)/);
  assert.match(experts, /withExpertSessionSource\(/);
  assert.match(workbench, /withWorkbenchSessionSource\(/);
  assert.match(fresh, /agentPreset: 'standard'/);
});

test('ordinary preset controls are removed from hero and settings surfaces', async () => {
  const menu = await source('packages/plugins/experts/src/client/PresetMenu.tsx');
  assert.match(menu, /install\('conversation\.hero\.agentPreset'\)/);
  assert.match(menu, /settings\.section/);
  assert.match(menu, /priority: -1000/);
});

