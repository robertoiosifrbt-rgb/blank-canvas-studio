import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('ACHU import contains the full backlog and all modules', async () => {
  const source = await readFile(new URL('../src/data/achuBacklog.ts', import.meta.url), 'utf8');
  assert.match(source, /"items":1661/);
  assert.match(source, /"groups":53/);
});

test('PWA has update, offline and push handlers', async () => {
  const worker = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
  for (const event of ['install', 'activate', 'fetch', 'message', 'push', 'notificationclick']) assert.match(worker, new RegExp(`addEventListener\\('${event}'`));
});

test('push alarm synchronization uses the recursive stored-data path', async () => {
  const push = await readFile(new URL('../src/push.ts', import.meta.url), 'utf8');
  assert.match(push, /syncAllStoredAlarms/);
  assert.match(push, /item\.children/);
});
