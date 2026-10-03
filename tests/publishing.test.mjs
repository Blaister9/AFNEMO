import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { stringify } from 'yaml';
import { build } from '../scripts/build.mjs';
import { parseContent, loadCollection, loadInstitutional, safeUrl, inspectImage } from '../scripts/content.mjs';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serialize = (meta, body) => `---\n${stringify(meta)}---\n\n${body}\n`;
const article = {
  title: 'Memoria para verificar la publicación', excerpt: 'Resumen documentado de la memoria',
  date: '2024-02-29', source_date: '2014', historical: true, published: true,
  source: 'Archivo de prueba aislado', category: 'Memoria cultural'
};
const experience = {
  id: 'ensayo-publicacion', title: 'Experiencia para verificar la publicación', excerpt: 'Una memoria documentada',
  initiative: 'Iniciativa de verificación', status: 'published', reviewed: true,
  reviewed_at: '2026-10-03', source: 'Archivo de prueba aislado'
};

async function isolatedProject(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'afnemo-publishing-'));
  t.after(async () => {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('afnemo-publishing-'));
    await fs.rm(root, { recursive: true, force: true });
  });
  for (const directory of ['assets', 'admin', 'content']) {
    await fs.cp(path.join(project, directory), path.join(root, directory), { recursive: true });
  }
  for (const file of ['index.html', 'CNAME', '_redirects']) await fs.copyFile(path.join(project, file), path.join(root, file));
  return root;
}

const read = (root, file) => fs.readFile(path.join(root, file), 'utf8');
const write = (root, file, value) => fs.writeFile(path.join(root, file), value);
const feed = async (root, collection) => JSON.parse(await read(root, `dist/data/${collection}.json`));

async function publicSnapshot(root) {
  const snapshot = {};
  const out = path.join(root, 'dist');
  for (const file of (await fs.readdir(out, { recursive: true })).sort()) {
    const target = path.join(out, file);
    if ((await fs.stat(target)).isFile()) snapshot[file.replaceAll('\\', '/')] = createHash('sha256').update(await fs.readFile(target)).digest('hex');
  }
  return snapshot;
}

test('Todos los archivos editoriales se parsean; los slugs publicados son únicos y sus medios existen', async () => {
  const counts = {};
  for (const collection of ['noticias', 'experiencias', 'institucional']) {
    const directory = path.join(project, 'content', collection);
    const files = (await fs.readdir(directory)).filter(file => file.endsWith('.md'));
    assert.ok(files.length > 0, collection);
    for (const file of files) {
      const parsed = parseContent(await fs.readFile(path.join(directory, file), 'utf8'), file);
      assert.equal(typeof parsed.meta.title, 'string', `${collection}/${file}`);
      assert.equal(typeof parsed.body, 'string');
      for (const item of [parsed.meta, ...(parsed.meta.gallery || [])]) {
        if (!item.image) continue;
        const image = safeUrl(item.image, { image: true });
        assert.ok(image, `${collection}/${file}: ruta de imagen`);
        const bytes = await fs.readFile(path.join(project, image.slice(1)));
        const dimensions = await inspectImage(bytes, image);
        assert.ok(dimensions.width > 0 && dimensions.height > 0, image);
      }
    }
    counts[collection] = files.length;
  }
  for (const collection of ['noticias', 'experiencias']) {
    const records = await loadCollection(project, collection);
    assert.equal(new Set(records.map(record => record.slug)).size, records.length);
    assert.ok(records.length <= counts[collection]);
    for (const record of records) assert.match(record.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  }
  assert.ok(await loadInstitutional(project));
});

test('El repositorio genera todas las rutas y enlaces internos con recursos servidos desde su propio build', async t => {
  const root = await isolatedProject(t);
  const result = await build(root);
  const snapshot = await publicSnapshot(root);
  assert.equal(result.experiences, 5);
  assert.ok('admin/validation.js' in snapshot);
  for (const collection of ['noticias', 'experiencias']) {
    for (const record of await feed(root, collection)) {
      assert.ok(`${record.url.slice(1)}index.html` in snapshot, record.url);
      assert.match(await read(root, `dist/${record.url.slice(1)}index.html`), /<h1>/);
    }
  }
  for (const file of Object.keys(snapshot).filter(file => file.endsWith('.html') && !file.startsWith('admin/'))) {
    const html = await read(root, `dist/${file}`);
    const origin = new URL(file, 'https://afnemo.co/');
    for (const match of html.matchAll(/\b(href|src)="([^"]+)"/g)) {
      const url = new URL(match[2].replaceAll('&amp;', '&'), origin);
      if (url.origin !== origin.origin) continue;
      const target = url.pathname.endsWith('/') ? `${url.pathname.slice(1)}index.html` : url.pathname.slice(1);
      assert.ok(target in snapshot, `${file}: ${match[2]}`);
      if (url.hash && target.endsWith('.html')) {
        const ids = Array.from((await read(root, `dist/${target}`)).matchAll(/\bid="([^"]+)"/g), item => item[1]);
        assert.ok(ids.includes(decodeURIComponent(url.hash.slice(1))), `${file}: ${match[2]}`);
      }
    }
  }
  const publicScripts = Object.keys(snapshot).filter(file => file.startsWith('assets/js/'));
  for (const file of publicScripts) assert.doesNotMatch(await read(root, `dist/${file}`), /api\.github\.com|raw\.githubusercontent\.com/);
  assert.ok(publicScripts.some(file => /^assets\/js\/news\./.test(file)));
});

test('Crear, editar, volver a editar y eliminar contenido reconstruye fichas, listados, filtros y medios sin residuos', async t => {
  const root = await isolatedProject(t);
  await build(root);
  const originalOutput = await publicSnapshot(root);
  const newsFile = 'content/noticias/ensayo-publicacion.md';
  const experienceFile = 'content/experiencias/ensayo-publicacion.md';
  const existingFile = 'content/noticias/2024-07-25-afnemo-cop16.md';
  const institutionFile = 'content/institucional/asociacion.md';
  const originalNews = await read(root, existingFile);
  const originalInstitution = await read(root, institutionFile);
  const photo = '/assets/images/noticias/ensayo-publicacion.webp';
  const galleryPhoto = '/assets/images/noticias/ensayo-galeria.webp';
  for (const image of [photo, galleryPhoto]) await fs.copyFile(path.join(root, 'assets/images/experiencias/museo-viernes-negro.webp'), path.join(root, image.slice(1)));
  const image = { image: photo, image_authorized: true, image_alt: 'Escena con <personas> y cultura', image_credit: 'Permiso y crédito documentados' };
  await write(root, newsFile, serialize({ ...article, ...image }, '## Relato\n\nMemoria **editada**. [Experiencia](/experiencias/ensayo-publicacion/).\n\n<script>alert(1)</script>\n\n[Inseguro](javascript:alert%281%29)'));
  await write(root, experienceFile, serialize({ ...experience,
    event_date: '2014', event_label: 'Origen documentado', location_type: 'territorial', territory: 'Territorio de verificación',
    gallery: [{ ...image, image: galleryPhoto }],
    milestones: [{ date: '2014', label: 'Origen' }, { date: '2014-09', label: 'Encuentro documentado' }],
    videos: [{ label: 'Memoria audiovisual', url: 'https://example.org/memoria', credit: 'Archivo' }],
    sources: [{ label: 'Fuente sin versión pública' }],
    related_initiative: { label: 'Noticia documentada', url: '/noticias/ensayo-publicacion/' }
  }, 'Relato documentado para la experiencia.'));
  const existing = parseContent(originalNews);
  await write(root, existingFile, serialize({ ...existing.meta, title: 'Noticia existente revisada temporalmente' }, `${existing.body}\n\nTexto corregido.`));
  const institution = parseContent(originalInstitution);
  await write(root, institutionFile, serialize({ ...institution.meta, title: 'Asociación revisada temporalmente' }, `${institution.body}\n\n## Nuevo capítulo\n\nMemoria revisada.`));
  await build(root);
  const news = (await feed(root, 'noticias')).find(item => item.slug === 'ensayo-publicacion');
  const experiences = (await feed(root, 'experiencias')).find(item => item.slug === 'ensayo-publicacion');
  assert.equal(news.image, photo);
  assert.equal(news.image_width, 1440);
  assert.equal(news.image_height, 960);
  assert.equal(news.source_date, '2014');
  assert.equal(news.historical, true);
  assert.equal(experiences.event_date, '2014');
  assert.equal(experiences.milestones[1].date, '2014-09');
  for (const optional of ['municipality', 'department', 'country']) assert.equal(experiences[optional], '');
  const newsHtml = await read(root, 'dist/noticias/ensayo-publicacion/index.html');
  assert.match(newsHtml, /<strong>editada<\/strong>/);
  assert.match(newsHtml, /Publicación original/);
  assert.match(newsHtml, /datetime="2014">2014/);
  assert.match(newsHtml, /alt="Escena con &lt;personas&gt; y cultura" width="1440" height="960" loading="lazy" decoding="async"/);
  assert.doesNotMatch(newsHtml, /<script>alert|href="javascript:|<img[^>]+onerror/);
  assert.match(await read(root, 'dist/noticias/index.html'), /Noticia existente revisada temporalmente/);
  const institutionalHtml = await read(root, 'dist/asociacion/index.html');
  assert.match(institutionalHtml, /Asociación revisada temporalmente/);
  assert.match(institutionalHtml, /Nuevo capítulo/);
  assert.match(await read(root, 'dist/experiencias/index.html'), /<option value="Territorio de verificación">/);
  assert.match(await read(root, 'dist/index.html'), /Experiencia para verificar la publicación/);
  const experienceHtml = await read(root, 'dist/experiencias/ensayo-publicacion/index.html');
  for (const value of ['ensayo-galeria.webp', 'Memoria audiovisual', 'Fuente sin versión pública']) assert.ok(experienceHtml.includes(value), value);
  for (const image of [photo, galleryPhoto]) assert.deepEqual(await fs.readFile(path.join(root, `dist${image}`)), await fs.readFile(path.join(root, image.slice(1))));

  await write(root, newsFile, serialize({ ...article, title: 'Segunda edición sin fotografía' }, 'Texto corregido por segunda vez.'));
  await write(root, experienceFile, serialize({ ...experience, title: 'Experiencia revisada sin ubicación' }, 'Relato corregido por segunda vez.'));
  await build(root);
  const revisedNews = await read(root, 'dist/noticias/ensayo-publicacion/index.html');
  assert.match(revisedNews, /Segunda edición sin fotografía/);
  assert.match(revisedNews, /Texto corregido por segunda vez/);
  assert.doesNotMatch(revisedNews, /<figure|ensayo-publicacion\.webp/);
  const revisedExperience = await read(root, 'dist/experiencias/ensayo-publicacion/index.html');
  assert.match(revisedExperience, /Experiencia revisada sin ubicación/);
  assert.doesNotMatch(revisedExperience, /Territorio de verificación|<h2>Galería|<h2>Hitos documentados/);
  for (const image of [photo, galleryPhoto]) await assert.rejects(fs.access(path.join(root, `dist${image}`)), { code: 'ENOENT' });

  for (const file of [newsFile, experienceFile, photo.slice(1), galleryPhoto.slice(1)]) await fs.unlink(path.join(root, file));
  await write(root, existingFile, originalNews);
  await write(root, institutionFile, originalInstitution);
  await build(root);
  assert.deepEqual(await publicSnapshot(root), originalOutput, 'Eliminar las pruebas y restaurar las ediciones produce exactamente el sitio original');
});

test('Publicaciones inválidas y enlaces a contenido eliminado fallan antes de sustituir la última salida válida', async t => {
  const root = await isolatedProject(t);
  await build(root);
  const originalOutput = await publicSnapshot(root);
  const file = 'content/noticias/ensayo-publicacion.md';
  for (const url of ['/experiencias/no-publicada/', '/#ancla-inexistente', '/asociacion/#seccion-inexistente']) {
    await write(root, file, serialize(article, `[Enlace editorial](${url})`));
    await assert.rejects(build(root), /enlace interno sin página publicada|ancla interna inexistente/);
  }
  const image = { image_authorized: true, image_alt: 'Escena documentada', image_credit: 'AFNEMO' };
  for (const imagePath of ['/assets/images/noticias/no-existe.webp', '/assets/images/noticias/../foto.webp', '/assets/images/noticias/foto.svg', 'file:///foto.jpg', '/assets/images/noticias/foto%20uno.webp']) {
    await write(root, file, serialize({ ...article, ...image, image: imagePath }, 'Relato.'));
    await assert.rejects(build(root), /ENOENT|ruta de imagen/);
  }
  await write(root, 'assets/images/noticias/truncada.webp', 'RIFFxxxxWEBPxxxx');
  await write(root, file, serialize({ ...article, ...image, image: '/assets/images/noticias/truncada.webp' }, 'Relato.'));
  await assert.rejects(build(root), /decodificar/);
  await fs.unlink(path.join(root, file));
  await write(root, 'content/experiencias/duplicada.md', serialize({ ...experience, id: 'kilombo-yumma' }, 'Relato.'));
  await assert.rejects(build(root), /identificadores duplicados/);
  await fs.unlink(path.join(root, 'content/experiencias/duplicada.md'));
  await fs.unlink(path.join(root, 'content/experiencias/kilombo-yumma.md'));
  await assert.rejects(build(root), /enlace interno sin página publicada.*kilombo-yumma/);
  assert.deepEqual(await publicSnapshot(root), originalOutput);
});
