import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { stringify } from 'yaml';
import { normalizeContent } from '../scripts/content.mjs';
import { experienceDetail, experienceExplorer } from '../scripts/pages.mjs';
import { build } from '../scripts/build.mjs';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const meta = { id: 'memoria', title: 'Memoria', excerpt: 'Resumen propio', initiative: 'Iniciativa', source: 'Archivo', reviewed: true, reviewed_at: '2026-10-02', status: 'published' };
const record = extra => normalizeContent({ meta: { ...meta, ...extra }, body: 'Relato diferente al resumen.' }, 'memoria.md', 'experiencias');

test('Ficha sin campos opcionales no produce secciones vacías ni repite su resumen', () => {
  const html = experienceDetail(record({}));
  assert.doesNotMatch(html, /<h2>(?:Territorio y contexto|Galería|Hitos documentados|Memoria audiovisual|Materiales relacionados|Iniciativa relacionada)<\/h2>/);
  assert.doesNotMatch(html, /<dl class="content-facts">|undefined/);
  assert.equal(html.split('Resumen propio').length - 1, 1);
  assert.match(html, /Fuentes y revisión/);
});

test('Un hito conserva fecha, etiqueta y descripción sin falsear una cronología ni la fecha de publicación', () => {
  const milestones = [{ label: 'Encuentro documentado', date: '2023', description: 'Memoria del encuentro.' }];
  const single = experienceDetail(record({ milestones }));
  assert.doesNotMatch(single, /Hitos documentados|experience-milestones/);
  assert.match(single, /Encuentro documentado/);
  assert.match(single, /Memoria del encuentro\./);
  assert.equal(single.split('datetime="2023"').length - 1, 1);
  const withPublication = experienceDetail(record({ event_date: '2024', milestones }));
  assert.match(withPublication, /<dt>Fecha documentada<\/dt><dd><time datetime="2024">/);
  assert.match(withPublication, /Encuentro documentado: <time datetime="2023">/);
  assert.match(withPublication, /Memoria del encuentro\./);
  assert.doesNotMatch(withPublication, /Hitos documentados/);
  const multiple = experienceDetail(record({ milestones: [...milestones, { label: 'Otro encuentro', date: '2024-08', description: 'Otra memoria.' }] }));
  assert.match(multiple, /Hitos documentados/);
  assert.match(multiple, /datetime="2024-08">agosto de 2024/);
  assert.match(multiple, /Otra memoria\./);
});

test('Filtros omiten dimensiones con una sola opción y el listado permanece estático', () => {
  const html = experienceExplorer([record({ territory: 'Bogotá', location_type: 'territorial' })]);
  assert.doesNotMatch(html, /<select/);
  assert.match(html, /data-experience/);
  assert.match(html, /href="\/experiencias\/memoria\/"/);
  assert.match(html, /<noscript>/);
  assert.doesNotMatch(experienceExplorer([]), /experience-filters/);
});

test('Build publica imágenes de galería con dimensiones reales y excluye las no autorizadas', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'afnemo-gallery-'));
  t.after(async () => {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('afnemo-gallery-'));
    await fs.rm(root, { recursive: true, force: true });
  });
  for (const directory of ['assets/css', 'assets/js', 'admin']) await fs.cp(path.join(project, directory), path.join(root, directory), { recursive: true });
  await fs.copyFile(path.join(project, 'assets/favicon.svg'), path.join(root, 'assets/favicon.svg'));
  await fs.mkdir(path.join(root, 'content/experiencias'), { recursive: true });
  await fs.mkdir(path.join(root, 'assets/images/experiencias'), { recursive: true });
  await fs.copyFile(path.join(project, 'assets/images/experiencias/museo-viernes-negro.webp'), path.join(root, 'assets/images/experiencias/galeria.webp'));
  await fs.writeFile(path.join(root, 'index.html'), '<html><head><link rel="stylesheet" href="assets/css/main.css"><link rel="stylesheet" href="assets/css/content.css"></head><body><nav id="mainNav"></nav><main><!-- EXPERIENCE_EXPLORER --></main><footer></footer></body></html>');
  for (const file of ['_redirects', 'CNAME']) await fs.copyFile(path.join(project, file), path.join(root, file));
  const gallery = [
    { image: '/assets/images/experiencias/galeria.webp', image_authorized: true, image_alt: 'Escena documentada', image_credit: 'Imagen suministrada por AFNEMO' },
    { image: '/assets/images/experiencias/no-publicar.webp', image_authorized: false }
  ];
  await fs.writeFile(path.join(root, 'content/experiencias/memoria.md'), `---\n${stringify({ ...meta, gallery })}---\nRelato.`);
  const result = await build(root);
  assert.equal(result.images, 1);
  const html = await fs.readFile(path.join(root, 'dist/experiencias/memoria/index.html'), 'utf8');
  assert.match(html, /<h2>Galería<\/h2>/);
  assert.match(html, /width="1440" height="960"/);
  assert.doesNotMatch(html, /no-publicar|undefined/);
  const feed = JSON.parse(await fs.readFile(path.join(root, 'dist/data/experiencias.json'), 'utf8'));
  assert.equal(feed[0].gallery[0].image_width, 1440);
  await fs.access(path.join(root, 'dist/assets/images/experiencias/galeria.webp'));
  await assert.rejects(fs.access(path.join(root, 'dist/assets/images/experiencias/no-publicar.webp')));
});
