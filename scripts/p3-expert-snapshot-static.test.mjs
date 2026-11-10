import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('packages/plugins/experts/resources/generated/expert-packages.json', root), 'utf8'));
const expected = new Set([
  'ai-learning-coach',
  'business-operations-analysis',
  'enterprise-knowledge-extraction-assistant',
  'exam-evaluator',
  'idp-development-plan-generator',
  'llm-wiki',
  'training-course-designer',
  'training-needs-diagnosis',
]);

function digest(rows) {
  return createHash('sha256').update(rows.map(([path, value]) => `${path}\0${Buffer.from(value).toString('base64')}\0`).join('')).digest('hex');
}

test('generator emits exactly the frozen eight expert snapshots', () => {
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.buildVersion, 'workdsh-expert-snapshot/1');
  assert.deepEqual(new Set(manifest.packages.map(row => row.skillSlug)), expected);
});

for (const entry of manifest.packages) {
  test(`snapshot ${entry.skillSlug} has a valid package closure and digests`, () => {
    const docs = entry.packageDocuments;
    assert.ok(docs['.workdsh-expert/plugin.json']);
    assert.ok(docs['agents/expert.md']);
    assert.ok(docs['README.md']);
    assert.ok(docs[`skills/${entry.skillSlug}/SKILL.md`]);
    const plugin = JSON.parse(docs['.workdsh-expert/plugin.json']);
    assert.equal(plugin.schemaVersion, 1);
    assert.deepEqual(plugin.skills, [`skills/${entry.skillSlug}`]);
    assert.deepEqual(plugin.embeddedSkills[0].resourceClosure.sort(), entry.resourceClosure.slice().sort());
    assert.equal(plugin.embeddedSkills[0].snapshotDigest, entry.snapshotDigest);
    assert.equal(digest(entry.resourceClosure.map(path => [path, docs[path]])), entry.snapshotDigest);
    for (const path of Object.keys(docs)) {
      assert.ok(!path.startsWith('/') && !/^[a-z]:/iu.test(path));
      assert.equal(path.includes('\\'), false);
      assert.equal(path.split('/').includes('..'), false);
    }
  });
}

test('compiler source pins the provider parent-root contract', async () => {
  const source = await readFile(new URL('packages/plugins/experts/src/runtime/preset-compiler.ts', root), 'utf8');
  assert.match(source, /packageSkillRoots/);
  assert.match(source, /expert-package', 'skills'/);
  assert.match(source, /includeDefaultRoots/);
  assert.match(source, /includeDefaultSkillRoots === false/);
});

