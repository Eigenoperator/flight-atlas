import { cp, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const clientOutput = resolve('dist', 'client');
const serverOutput = resolve('dist', 'server');
const pagesOutput = resolve('dist', 'cloudflare-pages');
const workerOutput = resolve(pagesOutput, '_worker.js');

await rm(pagesOutput, { recursive: true, force: true });
await mkdir(workerOutput, { recursive: true });
await cp(clientOutput, pagesOutput, { recursive: true });
await cp(serverOutput, workerOutput, { recursive: true });
await rename(
  resolve(workerOutput, 'index.js'),
  resolve(workerOutput, 'vinext-worker.js'),
);

await writeFile(
  resolve(workerOutput, 'index.js'),
  `import vinextWorker from './vinext-worker.js';

export default {
  async fetch(request, env, context) {
    if (request.method === 'GET' || request.method === 'HEAD') {
      const assetResponse = await env.ASSETS.fetch(request);

      if (assetResponse.status !== 404) {
        return assetResponse;
      }
    }

    return vinextWorker.fetch(request, env, context);
  },
};
`,
  'utf8',
);

console.log(`Prepared Cloudflare Pages output at ${pagesOutput}`);
