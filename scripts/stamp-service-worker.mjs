import { readFile, writeFile } from 'node:fs/promises';

const swPath = new URL('../dist/sw.js', import.meta.url);
const deploymentVersion = (
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  process.env.COMMIT_SHA ||
  `local-${Date.now()}`
).slice(0, 16);

const source = await readFile(swPath, 'utf8');
const pattern = /const CACHE_NAME = 'tasks-calendar-[^']+';/;

if (!pattern.test(source)) {
  throw new Error('Service worker CACHE_NAME marker not found');
}

const stamped = source.replace(
  pattern,
  `const CACHE_NAME = 'tasks-calendar-${deploymentVersion}';`,
);

await writeFile(swPath, stamped);
console.log(`Stamped service worker: tasks-calendar-${deploymentVersion}`);
