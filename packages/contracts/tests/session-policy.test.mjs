import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertSessionPresetAdmission,
  withExpertSessionSource,
  withWorkbenchSessionSource,
} from '../dist/session-policy.js';

test('ordinary requests are standard-only', () => {
  assert.equal(assertSessionPresetAdmission({}), 'standard');
  assert.equal(assertSessionPresetAdmission({ agentPreset: 'standard' }), 'standard');
  assert.throws(() => assertSessionPresetAdmission({ agentPreset: 'cordis' }), /session\/preset-source-denied/);
  assert.throws(() => assertSessionPresetAdmission({ agentPreset: 'wd-exp-demo-123' }), /session\/preset-source-denied/);
});

test('trusted expert and workbench markers admit only their own exception', () => {
  assert.equal(assertSessionPresetAdmission(withExpertSessionSource({ agentPreset: 'wd-exp-demo-123' })), 'wd-exp-demo-123');
  assert.equal(assertSessionPresetAdmission(withWorkbenchSessionSource({ agentPreset: 'cordis' })), 'cordis');
  assert.throws(() => assertSessionPresetAdmission(withExpertSessionSource({ agentPreset: 'cordis' })), /session\/preset-source-denied/);
  assert.throws(() => assertSessionPresetAdmission(withWorkbenchSessionSource({ agentPreset: 'wd-exp-demo-123' })), /session\/preset-source-denied/);
});

test('markers are not serializable client fields', () => {
  const request = withExpertSessionSource({ agentPreset: 'wd-exp-demo-123' });
  assert.deepEqual(JSON.parse(JSON.stringify(request)), { agentPreset: 'wd-exp-demo-123' });
});

