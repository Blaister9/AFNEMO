import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { prepareCmsConfig } from '../scripts/cms-config.mjs';
import { build } from '../scripts/build.mjs';

const source = await fs.readFile(new URL('../admin/config.yml', import.meta.url), 'utf8');
const preview = { CONTEXT: 'deploy-preview', HEAD: 'codex/mejoras-contenido-recorridos', DEPLOY_PRIME_URL: 'https://deploy-preview-1--spectacular-daifuku-0575d9.netlify.app' };

test('CMS production/local configuration remains byte-identical and targets main', () => {
  for (const env of [{}, { CONTEXT: 'production', HEAD: 'main' }]) assert.equal(prepareCmsConfig(source, env), source);
  assert.equal(YAML.parse(source).backend.branch, 'main');
  assert.equal(YAML.parse(source).local_backend, undefined);
});

test('Netlify review output targets its own branch without changing providers or collections', () => {
  for (const CONTEXT of ['deploy-preview', 'branch-deploy']) {
    const output = YAML.parse(prepareCmsConfig(source, { ...preview, CONTEXT }));
    assert.equal(output.backend.branch, preview.HEAD);
    assert.equal(output.backend.name, 'git-gateway');
    assert.equal(output.display_url, preview.DEPLOY_PRIME_URL);
    assert.deepEqual(output.collections, YAML.parse(source).collections);
  }
});

test('preview build refuses a missing/production branch or unsafe preview URL', () => {
  for (const HEAD of [undefined, '', 'main', 'refs/../main', 'branch\nmain']) {
    assert.throws(() => prepareCmsConfig(source, { ...preview, HEAD }));
  }
  for (const DEPLOY_PRIME_URL of [undefined, 'http://localhost:4173', 'https://afnemo.co', 'https://user:pass@example.netlify.app']) {
    assert.throws(() => prepareCmsConfig(source, { ...preview, DEPLOY_PRIME_URL }));
  }
});

test('actual preview build isolates the backend and subsequent production build restores main', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'afnemo-cms-deploy-'));
  t.after(async () => {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('afnemo-cms-deploy-'));
    await fs.rm(root, { recursive: true, force: true });
  });
  const project = fileURLToPath(new URL('../', import.meta.url));
  for (const item of ['assets', 'admin', 'content', 'index.html', 'CNAME', '_redirects']) {
    await fs.cp(path.join(project, item), path.join(root, item), { recursive: true });
  }
  const config = () => fs.readFile(path.join(root, 'dist/admin/config.yml'), 'utf8');
  await build(root, { env: preview });
  const previewOutput = await config();
  assert.equal(YAML.parse(previewOutput).backend.branch, preview.HEAD);
  assert.match(await fs.readFile(path.join(root, 'dist/admin/index.html'), 'utf8'), /Entorno de revisión/);
  await assert.rejects(build(root, { env: { ...preview, HEAD: 'main' } }), /rama de revisión/);
  assert.equal(await config(), previewOutput, 'invalid preview preserves the last validated output');
  assert.equal(await fs.readFile(path.join(root, 'admin/config.yml'), 'utf8'), source);
  await build(root, { env: { CONTEXT: 'production', HEAD: 'main' } });
  assert.equal(await config(), source, 'production build contains no preview backend');
  assert.match(await fs.readFile(path.join(root, 'dist/admin/index.html'), 'utf8'), /Acceso de publicación/);
});
