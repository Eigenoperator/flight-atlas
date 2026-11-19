import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const privateArchiveCopy = resolve(
  'dist',
  'client',
  'data',
  'local-flight-data.json',
);

await rm(privateArchiveCopy, { force: true });
console.log('Removed private local flight archive from the deployment output.');
