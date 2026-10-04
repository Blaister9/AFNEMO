import fs from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'yaml';
import { documentedDate, isoDate, parseContent, safeUrl } from '../scripts/content.mjs';

const code = await fs.readFile(new URL('../admin/validation.js', import.meta.url), 'utf8');
const config = parse(await fs.readFile(new URL('../admin/config.yml', import.meta.url), 'utf8'));
const listeners = {};
const runtime = { CMS: { registerEventListener: ({ name, handler }) => { listeners[name] = handler; } } };
vm.runInNewContext(code, { window: runtime, URL });
const checks = runtime.AfnemoEditorial;
const common = { title: 'Una memoria documentada', excerpt: 'Resumen para la tarjeta.', body: 'Relato de la experiencia.' };
const news = { ...common, date: '2024-06-18', published: false };
const experience = { ...common, id: 'memoria-documentada', initiative: 'Iniciativa documentada', source: 'Archivo AFNEMO', reviewed_at: '2026-10-02', status: 'draft' };
const institution = { ...common, source: 'Archivo institucional', reviewed_at: '2026-10-02', published: false };
const photograph = { image: '/assets/images/noticias/memoria.webp', image_authorized: true, image_alt: 'Personas reunidas en un encuentro.', image_credit: 'Archivo AFNEMO, autorización comprobada.' };

function save(collection, data) {
  const immutableData = { toJS: () => data };
  const result = listeners.preSave({ entry: { get: key => key === 'collection' ? collection : immutableData } });
  assert.equal(result, immutableData, 'El hook conserva los datos de la entrada sin reescribir fechas ni contenido');
}

test('El hook preSave permite guardar las tres colecciones con los campos opcionales vacíos', () => {
  for (const [collection, data] of [['noticias', news], ['experiencias', experience], ['institucional', institution]]) save(collection, data);
  save('experiencias', { ...experience, related_initiative: { label: '', url: '' }, gallery: [], milestones: [], sources: [], videos: [], materials: [] });
  save('experiencias', { ...experience, status: 'published', reviewed: true });
});

test('El hook bloquea espacios como requeridos y una experiencia publicada sin revisión', () => {
  for (const [collection, base] of [['noticias', news], ['experiencias', experience], ['institucional', institution]]) {
    for (const field of ['title', 'excerpt', 'body']) assert.throws(() => save(collection, { ...base, [field]: ' \n ' }), /Completa/);
  }
  assert.throws(() => save('experiencias', { ...experience, status: 'published' }), /revisión documental/);
  assert.throws(() => save('experiencias', { ...experience, status: 'otro' }), /Estado editorial/);
  assert.throws(() => save('experiencias', { ...experience, id: '../otra' }), /Nombre corto/);
});

test('Fechas históricas conservan precisión y el editor rechaza días o meses inexistentes antes de guardar', () => {
  for (const value of ['2023', '2024-02', '2024-02-29']) {
    save('experiencias', { ...experience, event_date: value, milestones: [{ label: 'Edición documentada', date: value }] });
    save('noticias', { ...news, historical: true, source_date: value });
    assert.equal(checks.validDate(value, true), Boolean(documentedDate(value, 'test')));
  }
  for (const value of ['2023-02-29', '2024-04-31', '2024-00', '2024-13', '18/06/2024', '2024-02-30', '2024-2-2']) {
    assert.throws(() => save('experiencias', { ...experience, event_date: value }), /Fecha documentada/);
    assert.throws(() => save('noticias', { ...news, source_date: value }), /Fecha de la fuente/);
  }
  for (const value of ['2024-06-18', '2024-06-18T23:15:00-05:00']) {
    save('noticias', { ...news, date: value, event_date: value, updated_at: value });
    assert.equal(checks.validDate(value, false), Boolean(isoDate(value, 'test', true)));
  }
  assert.throws(() => save('noticias', { ...news, date: '2024' }), /Fecha de publicación/);
  assert.throws(() => save('institucional', { ...institution, reviewed_at: '2023-02-29' }), /Fecha de revisión/);
});

test('Cada imagen exige autorización, descripción y crédito incluso cuando la entrada es borrador', () => {
  save('noticias', { ...news, ...photograph });
  save('experiencias', { ...experience, ...photograph, gallery: [photograph] });
  for (const [field, missing, message] of [['image_authorized', false, /permiso/], ['image_alt', '', /descripción accesible/], ['image_credit', '', /crédito/]]) {
    assert.throws(() => save('noticias', { ...news, ...photograph, [field]: missing }), message);
    assert.throws(() => save('experiencias', { ...experience, gallery: [{ ...photograph, [field]: missing }] }), message);
  }
  assert.throws(() => save('experiencias', { ...experience, gallery: [{}] }), /elige una fotografía/);
});

test('Las rutas de imagen y enlaces del formulario coinciden con la política del sitio generado', () => {
  for (const image of ['foto.JPG', '/assets/images/experiencias/foto.webp', '/assets/images/noticias/foto.avif', '../foto.png', 'file:///private/foto.png', '/assets/images/foto.svg', '/assets/images/foto con espacio.png', '//example.org/foto.jpg']) {
    assert.equal(checks.imagePath(image), safeUrl(image, { image: true }), image);
    if (!safeUrl(image, { image: true })) assert.throws(() => save('noticias', { ...news, ...photograph, image }), /biblioteca/);
  }
  for (const url of ['https://example.org/video', '/experiencias/kilombo-yumma/', '/noticias/', '/asociacion/', '/#about', '#fuentes', 'http://example.org/', 'javascript:alert(1)', '//example.org/', 'https://user:password@example.org/', '/admin/', '/experiencias/../', 'https://example.org/ con espacio']) {
    assert.equal(checks.linkUrl(url), safeUrl(url), url);
    if (safeUrl(url)) save('experiencias', { ...experience, materials: [{ label: 'Material', url }] });
    else assert.throws(() => save('experiencias', { ...experience, videos: [{ label: 'Video', url }] }), /enlace HTTPS/);
  }
});

test('Los grupos opcionales no generan entradas vacías y exigen título y enlace al usarlos', () => {
  save('experiencias', { ...experience, sources: [{ label: 'Fuente impresa sin enlace' }] });
  save('experiencias', { ...experience, related_initiative: { label: 'Ficha', url: '/experiencias/kilombo-yumma/' } });
  assert.throws(() => save('experiencias', { ...experience, related_initiative: { label: 'Ficha' } }), /Iniciativa relacionada/);
  assert.throws(() => save('experiencias', { ...experience, materials: [{ url: 'https://example.org/' }] }), /título/);
  assert.throws(() => save('experiencias', { ...experience, milestones: [{ label: 'Hito' }] }), /Hito 1/);
  assert.throws(() => save('experiencias', { ...experience, location_type: 'direccion' }), /tipo de ubicación/);
});

test('Todas las entradas publicadas existentes pasan el nuevo formulario editorial', async () => {
  for (const collection of ['noticias', 'experiencias', 'institucional']) {
    const folder = new URL(`../content/${collection}/`, import.meta.url);
    for (const file of (await fs.readdir(folder)).filter(name => name.endsWith('.md'))) {
      const { meta, body } = parseContent(await fs.readFile(new URL(file, folder), 'utf8'), file);
      if (meta.published === true || meta.status === 'published') {
        assert.equal(checks.validate(collection, { ...meta, body }).length, 0, file);
        save(collection, { ...meta, body });
      }
    }
  }
});

test('Decap conserva backend definitivo y presenta restricciones compatibles con imágenes y texto públicos', () => {
  assert.deepEqual(config.backend, { name: 'git-gateway', branch: 'main' });
  assert.equal(config.publish_mode, 'simple');
  assert.equal(config.local_backend, undefined);
  assert.equal(config.media_folder, 'assets/images/noticias');
  assert.equal(config.public_folder, '/assets/images/noticias');
  assert.equal(config.media_library, undefined, 'La configuración global se reserva para bibliotecas externas con nombre registrado');
  function fields(items) { return items.flatMap(item => [item, ...fields(item.fields || [])]); }
  const allFields = config.collections.flatMap(collection => fields(collection.fields || collection.files.flatMap(file => file.fields)));
  for (const field of allFields) {
    if (field.widget === 'image') {
      assert.equal(field.choose_url, false);
      assert.equal(field.media_library.name, undefined);
      assert.equal(field.media_library.config.max_file_size, 20 * 1024 * 1024);
      const pattern = new RegExp(field.pattern[0]);
      assert.ok(pattern.test(photograph.image));
      assert.ok(pattern.test('/assets/images/noticias/foto.JPEG'));
      for (const unsafe of ['https://example.org/foto.jpg', '../foto.png', '/assets/images/foto.svg', '/assets/images/foto con espacio.png']) assert.ok(!pattern.test(unsafe), unsafe);
    }
    if (field.widget === 'markdown') {
      assert.equal(field.sanitize_preview, true);
      assert.deepEqual(field.editor_components, []);
    }
    if (field.widget === 'list' || field.widget === 'object') assert.equal(field.collapsed, true);
  }
  const experienceFields = config.collections.find(collection => collection.name === 'experiencias').fields;
  assert.deepEqual(experienceFields.find(field => field.name === 'gallery').default, [], 'Una experiencia nueva sin fotos no debe crear una fila de galería incompleta por el booleano anidado');
  assert.ok(experienceFields.find(field => field.name === 'related_initiative').fields.every(field => field.required === false));
  for (const field of allFields.filter(field => field.pattern && field.pattern[0].startsWith('^\\d{4}'))) {
    const pattern = new RegExp(field.pattern[0]);
    for (const value of ['2024', '2024-02', '2024-02-29']) assert.ok(pattern.test(value), value);
    for (const value of ['2024-13', '2024-02-32']) assert.ok(!pattern.test(value), value);
  }
});

test('El administrador carga las validaciones antes de la vista previa', async () => {
  const html = await fs.readFile(new URL('../admin/index.html', import.meta.url), 'utf8');
  const validationIndex = html.indexOf('src="/admin/validation.js"');
  assert.ok(validationIndex > html.indexOf('decap-cms.js'));
  assert.ok(validationIndex < html.indexOf('src="/admin/preview.js"'));
});
