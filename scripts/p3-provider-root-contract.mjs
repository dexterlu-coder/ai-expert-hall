/**
 * Runtime contract probe for the pinned dsh-skill-filesystem provider.
 * Exit 2 means BLOCKED_BY_ENVIRONMENT: dependencies were intentionally not
 * installed in this candidate tree, so no provider result may be inferred.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
try {
  const packagePath = require.resolve('@deepseek-ai/dsh-skill-filesystem/package.json');
  console.log(JSON.stringify({ status: 'ready-to-run', provider: packagePath, expectedVersion: '0.2.1-rc.5' }));
  console.error('Provider fixture execution is intentionally deferred to an environment with immutable dependencies.');
  process.exitCode = 2;
} catch (error) {
  console.error(JSON.stringify({ status: 'blocked', code: 'PROVIDER_PACKAGE_MISSING', message: String(error) }));
  process.exitCode = 2;
}

