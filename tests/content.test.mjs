import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { parseContent, normalizeContent, renderMarkdown, safeUrl, formatDate, documentedDate, isoDate, validImageBytes, inspectImage } from '../scripts/content.mjs';
import { build } from '../scripts/build.mjs';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const news = `---\ntitle: "Una noticia: documentada"\ndate: 2026-04-09T10:51:00.000-05:00\nexcerpt: >-\n  Primera línea con dos puntos:\n  segunda línea del resumen.\npublished: true\n---\n## Relato\n\nTexto **documentado** con [enlace](/experiencias/).`;
const experience = { id: 'caso-documentado', title: 'Caso documentado', excerpt: 'Resumen', initiative: 'Iniciativa', territory: 'Bogotá', reviewed: true, reviewed_at: '2026-10-02', source: 'Fuente documental', status: 'published', public_precision: 'city', milestones: [{ label: 'Año documentado', date: '2014' }] };

test('YAML real conserva multilineales, fechas y booleanos del CMS', () => {
  const parsed = parseContent(news, 'noticia.md');
  assert.equal(parsed.meta.excerpt, 'Primera línea con dos puntos: segunda línea del resumen.');
  assert.equal(parsed.meta.date, '2026-04-09T10:51:00.000-05:00');
  assert.equal(parsed.meta.published, true);
  assert.match(normalizeContent(parsed, 'una-noticia.md', 'noticias').html, /<strong>documentado<\/strong>/);
  assert.equal(normalizeContent(parsed, 'una-noticia.md', 'noticias').historical, false);
  assert.equal(normalizeContent({ ...parsed, meta: { ...parsed.meta, historical: true } }, 'una-noticia.md', 'noticias').historical, true);
  assert.throws(() => parseContent('---\ntitle: uno\ntitle: dos\n---\ncuerpo'), /unique|duplic/i);
});

test('Markdown evita HTML ejecutable, URLs peligrosas e imágenes sin autorización', () => {
  const html = renderMarkdown('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[Mal](javascript:alert%281%29)\n\n![privado](/assets/images/pendiente.jpg)\n\n[URL mala](//evil.example)\n\n[Bien](https://example.com/publico)');
  assert.doesNotMatch(html, /<script|<img|href="javascript:|href="\/\/|href=""/i);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /href="https:\/\/example.com\/publico"/);
  assert.match(html, /rel="noopener noreferrer"/);
  for (const url of ['javascript:alert(1)', 'data:text/html,hello', '//evil.example', '/content/secreto.md', '/assets/images/../secreto.jpg', 'https://user:pass@example.com', 'https://example.com\\evil']) assert.equal(safeUrl(url), '');
});

test('Solo published true y experiencias revisadas entran; no se confunden con privacidad', () => {
  const parsed = parseContent(news);
  assert.equal(normalizeContent({ ...parsed, meta: { ...parsed.meta, published: 'true' } }, 'slug.md', 'noticias'), null);
  assert.equal(normalizeContent({ meta: { status: 'published', reviewed: false }, body: '' }, 'draft.md', 'experiencias'), null);
  const record = normalizeContent({ meta: experience, body: 'Relato' }, 'case.md', 'experiencias');
  assert.equal(record.url, '/experiencias/caso-documentado/');
  assert.equal(record.milestones[0].date, '2014');
  assert.throws(() => normalizeContent({ meta: { ...experience, coordinates: [1, 2] }, body: 'Relato' }, 'case.md', 'experiencias'), /ubicación/);
  assert.throws(() => normalizeContent({ meta: { ...experience, reviewed_at: '' }, body: 'Relato' }, 'case.md', 'experiencias'), /fecha/);
});

test('Fechas históricas conservan precisión sin inventar días; fecha inexistente falla', () => {
  assert.equal(documentedDate('2014', 'caso'), '2014');
  assert.equal(formatDate('2014'), '2014');
  assert.match(formatDate('2023-05'), /mayo.*2023/);
  assert.throws(() => documentedDate('2023-13', 'caso'), /fecha/);
  assert.throws(() => isoDate('2026-02-30', 'caso'), /fecha/);
  assert.match(formatDate('2026-04-09T23:30:00-05:00'), /9 de abril/);
});

test('Imágenes requieren autorización, texto alternativo, crédito y decodificación real', async () => {
  const parsed = parseContent(news);
  const noPermission = normalizeContent({ ...parsed, meta: { ...parsed.meta, image: '/assets/images/privada.jpg' } }, 'slug.md', 'noticias');
  assert.equal(noPermission.image, '');
  assert.throws(() => normalizeContent({ ...parsed, meta: { ...parsed.meta, image: '/assets/images/foto.jpg', image_authorized: true } }, 'slug.md', 'noticias'), /image_alt/);
  assert.equal(validImageBytes(Buffer.from('<html>error</html>'), 'photo.jpg'), false);
  assert.equal(validImageBytes(Buffer.from('RIFFxxxxWEBPxxxx'), 'photo.webp'), true);
  assert.equal(safeUrl('../secreto.jpg', { image: true }), '');
  await assert.rejects(inspectImage(Buffer.from([255, 216, 255]), 'fake.jpg'), /decodificar/);
  await assert.rejects(inspectImage(Buffer.from('RIFFxxxxWEBPxxxx'), 'fake.webp'), /decodificar/);
  const real = await inspectImage(await fs.readFile(path.join(project, 'assets/images/hero-image.webp')), 'hero-image.webp');
  assert.ok(real.width > 0 && real.height > 0);
});

test('Build genera rutas directas, feed propio, hashes y excluye originales, borradores e imágenes no aprobadas', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'afnemo-content-'));
  t.after(async () => {
    if (path.dirname(root) !== os.tmpdir() || !path.basename(root).startsWith('afnemo-content-')) throw new Error('Directorio temporal no válido');
    await fs.rm(root, { recursive: true, force: true });
  });
  for (const directory of ['assets/css', 'assets/js', 'admin']) await fs.cp(path.join(project, directory), path.join(root, directory), { recursive: true });
  for (const directory of ['content/noticias', 'content/experiencias', 'content/institucional', 'assets/images/noticias', '.claude', 'docs']) await fs.mkdir(path.join(root, directory), { recursive: true });
  await fs.writeFile(path.join(root, 'index.html'), '<html><head><link rel="stylesheet" href="assets/css/main.css"></head><body><nav id="mainNav"><a href="#about">Inicio</a></nav><main id="about">AFNEMO</main><footer><a href="#about">Inicio</a></footer><script src="assets/js/news.js"></script></body></html>');
  await fs.writeFile(path.join(root, '_redirects'), '/admin /admin/index.html 200');
  await fs.writeFile(path.join(root, 'CNAME'), 'afnemo.co');
  await fs.writeFile(path.join(root, 'content/noticias/publicada.md'), news);
  const institutional = '---\ntitle: Historia de la asociación\nexcerpt: Memoria documentada\nsource: Archivo institucional\nreviewed_at: 2026-10-02\npublished: true\n---\n## Historia & comunidad\n\nRelato [documentado](/experiencias/).\n\n<script>alert(1)</script>';
  await fs.writeFile(path.join(root, 'content/institucional/asociacion.md'), institutional);
  await fs.appendFile(path.join(root, 'index.html'), '<a data-institutional href="/asociacion/">Trayectoria</a>');
  await fs.writeFile(path.join(root, 'content/noticias/draft.md'), news.replace('published: true', 'published: false\nimage: /assets/images/noticias/draft.jpg'));
  await fs.writeFile(path.join(root, 'content/noticias/sin-permiso.md'), news.replace('published: true', 'published: true\nimage: /assets/images/noticias/no-autorizada.jpg'));
  await fs.writeFile(path.join(root, 'assets/images/noticias/draft.jpg'), 'No publicar');
  await fs.writeFile(path.join(root, 'assets/images/noticias/no-autorizada.jpg'), 'No publicar');
  await fs.writeFile(path.join(root, '.claude/settings.local.json'), '{"privado":true}');
  await fs.writeFile(path.join(root, 'docs/original.docx'), 'No publicar');
  await fs.writeFile(path.join(root, 'fuentes.zip'), 'No publicar');
  await fs.writeFile(path.join(root, 'content/experiencias/caso.md'), '---\n' + Object.entries(experience).filter(([key]) => key !== 'milestones').map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n') + '\n---\nRelato documentado');
  const result = await build(root);
  assert.equal(result.news, 2);
  assert.equal(result.experiences, 1);
  const files = (await fs.readdir(path.join(root, 'dist'), { recursive: true })).map(file => file.replaceAll('\\', '/'));
  assert.ok(files.includes('noticias/publicada/index.html'));
  assert.ok(files.includes('experiencias/caso-documentado/index.html'));
  assert.ok(files.includes('asociacion/index.html'));
  assert.ok(files.includes('admin/guia.html'));
  assert.ok(files.includes('admin/guia.css'));
  const institutionPage = await fs.readFile(path.join(root, 'dist/asociacion/index.html'), 'utf8');
  assert.match(institutionPage, /href="#seccion-1">Historia &amp; comunidad/);
  assert.match(institutionPage, /<h2 id="seccion-1">Historia &amp; comunidad/);
  assert.doesNotMatch(institutionPage, /<script>alert\(1\)/);
  assert.match(await fs.readFile(path.join(root, 'dist/sitemap.xml'), 'utf8'), /https:\/\/afnemo.co\/asociacion\//);
  for (const prefix of ['content', '.claude', 'docs', 'fuentes.zip', 'noticias/draft', 'assets/images/noticias']) assert.equal(files.some(file => file === prefix || file.startsWith(prefix + '/')), false, prefix);
  assert.ok(files.some(file => /assets\/css\/main\.[a-f0-9]{12}\.css/.test(file)));
  assert.equal(files.includes('assets/css/main.css'), false);
  const detail = await fs.readFile(path.join(root, 'dist/noticias/publicada/index.html'), 'utf8');
  assert.match(detail, /href="\/noticias\/"/);
  assert.match(detail, /href="\/#about"/);
  const feed = JSON.parse(await fs.readFile(path.join(root, 'dist/data/noticias.json'), 'utf8'));
  assert.deepEqual(feed.map(record => record.image), ['', '']);
  assert.ok(feed.every(record => !('html' in record) && !('published' in record)));
  const before = files.find(file => /assets\/css\/main\.[a-f0-9]{12}\.css/.test(file));
  await fs.appendFile(path.join(root, 'assets/css/main.css'), '\n/* nueva versión */');
  await fs.writeFile(path.join(root, 'content/institucional/asociacion.md'), institutional.replace('published: true', 'published: false'));
  await build(root);
  await assert.rejects(fs.access(path.join(root, 'dist/asociacion/index.html')));
  assert.doesNotMatch(await fs.readFile(path.join(root, 'dist/index.html'), 'utf8'), /data-institutional/);
  const after = await fs.readdir(path.join(root, 'dist/assets/css'));
  assert.equal(after.includes(path.basename(before)), false, 'Cada cambio CSS cambia la URL pública');
});

test('Decap conserva git-gateway/main y campos compatibles con las tres colecciones', async () => {
  const config = parseYaml(await fs.readFile(path.join(project, 'admin/config.yml'), 'utf8'));
  assert.equal(config.backend.name, 'git-gateway');
  assert.equal(config.backend.branch, 'main');
  assert.equal(config.slug.encoding, 'ascii');
  assert.equal(config.slug.clean_accents, true);
  assert.equal(config.collections.find(collection => collection.name === 'noticias').fields.find(field => field.name === 'published').default, false);
  assert.equal(config.collections.find(collection => collection.name === 'noticias').fields.find(field => field.name === 'historical').default, false);
  const institutional = config.collections.find(collection => collection.name === 'institucional').files[0];
  assert.equal(institutional.file, 'content/institucional/asociacion.md');
  for (const field of ['title', 'excerpt', 'source', 'reviewed_at', 'body', 'published']) assert.ok(institutional.fields.some(candidate => candidate.name === field));
  for (const field of ['id', 'source', 'reviewed_at', 'materials', 'milestones', 'public_precision', 'status']) assert.ok(config.collections.find(collection => collection.name === 'experiencias').fields.some(candidate => candidate.name === field));
  const preview = await fs.readFile(path.join(project, 'admin/preview.js'), 'utf8');
  assert.match(preview, /this\.props\.entry/);
  assert.doesNotMatch(preview, /fetch\(|raw\.githubusercontent|api\.github/);
});


test('Vista previa usa la entrada abierta y los cambios sin guardar, sin peticiones a main', async () => {
  const templates = {};
  const runtime = {
    CMS: { registerPreviewTemplate: (name, template) => { templates[name] = template; }, registerPreviewStyle: () => {} },
    createClass: definition => definition,
    h: (tag, props, ...children) => ({ tag, props, children })
  };
  vm.runInNewContext(await fs.readFile(path.join(project, 'admin/preview.js'), 'utf8'), { window: runtime });
  assert.deepEqual(Object.keys(templates).sort(), ['asociacion', 'experiencias', 'institucional', 'noticias']);
  for (const name of Object.keys(templates)) {
    const current = { title: 'Edición de esta rama', excerpt: 'Resumen sin guardar', body: 'Relato en edición' };
    const props = { entry: { get: () => name, getIn: keys => current[keys[1]] }, widgetFor: field => current[field] };
    const first = JSON.stringify(templates[name].render.call({ props }));
    assert.match(first, /Edición de esta rama/);
    assert.match(first, /Relato en edición/);
    current.title = 'Cambio aún sin guardar';
    const next = JSON.stringify(templates[name].render.call({ props }));
    assert.match(next, /Cambio aún sin guardar/);
    assert.doesNotMatch(next, /Edición de esta rama/);
  }
});
