import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCollection, normalizeContent } from '../scripts/content.mjs';
import { experienceDetail, experiencesList, experienceExplorer } from '../scripts/pages.mjs';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = {
  id: 'historia-documentada', title: 'Historia documentada', excerpt: 'Una memoria comunitaria',
  initiative: 'Iniciativa documentada', status: 'published', reviewed: true,
  reviewed_at: '2026-10-02', source: 'Archivo de AFNEMO'
};
const normalize = fields => normalizeContent({ meta: { ...base, ...fields }, body: 'Relato documentado.' }, 'historia.md', 'experiencias');

test('Una experiencia se publica sin forzar territorio, fechas ni colecciones vacías', () => {
  const record = normalize({ gallery: null, videos: null, sources: null, materials: null, milestones: null });
  for (const field of ['territory', 'municipality', 'department', 'country', 'context', 'period', 'event_date', 'event_label']) assert.equal(record[field], '', field);
  for (const field of ['gallery', 'videos', 'sources', 'materials', 'milestones']) assert.deepEqual(record[field], [], field);
  assert.equal(record.related_initiative, null);
  assert.equal(record.location_type, 'unpublished');
  assert.equal(normalize({ related_initiative: { label: '', url: '' } }).related_initiative, null);
  assert.throws(() => normalize({ source: '' }), /source/);
  assert.throws(() => normalize({ reviewed_at: '' }), /fecha/);
});

test('El tipo de ubicación conserva las fichas legacy sin deducir coordenadas', () => {
  for (const public_precision of ['city', 'locality', 'region']) assert.equal(normalize({ public_precision }).location_type, 'territorial');
  assert.equal(normalize({ public_precision: 'none' }).location_type, 'unpublished');
  for (const location_type of ['exact', 'approximate', 'territorial', 'unpublished']) {
    const record = normalize({ location_type, public_precision: 'city' });
    assert.equal(record.location_type, location_type);
    assert.equal(record.public_precision, 'city');
    assert.ok(!('coordinates' in record));
  }
  assert.throws(() => normalize({ location_type: 'inventada' }), /tipo de ubicación/);
  assert.throws(() => normalize({ public_precision: 'street' }), /precisión/);
});

test('Se rechazan ubicaciones puntuales incluso anidadas en los nuevos campos', () => {
  for (const field of ['coordinates', 'latitude', 'longitude', 'address', 'dirección']) {
    assert.throws(() => normalize({ [field]: 'dato no publicable' }), /ubicación puntual/);
    assert.throws(() => normalize({ milestones: [{ label: 'Hito', date: '2023', details: { [field]: 'dato no publicable' } }] }), /ubicación puntual/);
    assert.throws(() => normalize({ related_initiative: { label: 'Otra', url: '/experiencias/otra/', [field]: 'dato no publicable' } }), /ubicación puntual/);
  }
});

test('No publicada retira los metadatos territoriales de fichas, filtros y datos públicos', () => {
  const fields = { territory: 'Territorio reservado', municipality: 'Ciudad reservada', department: 'Departamento reservado', country: 'País reservado' };
  const record = normalize({ ...fields, location_type: 'unpublished', context: 'Contexto que sí puede publicarse.' });
  const { html, ...feedRecord } = record;
  const output = JSON.stringify(feedRecord) + experienceDetail(record) + experiencesList([record]) + experienceExplorer([record], { compact: true });
  for (const [field, value] of Object.entries(fields)) {
    assert.equal(record[field], '');
    assert.ok(!output.includes(value), `${field} no debe aparecer en las superficies públicas`);
  }
  assert.equal(record.context, 'Contexto que sí puede publicarse.');
  assert.ok(html.includes('Relato documentado.'));
});

test('El modelo conserva contexto, periodo, iniciativa, fuentes e hitos sin exigir fechas más precisas', () => {
  const record = normalize({
    territory: 'Territorio documentado', municipality: 'Ciudad documentada', department: 'Departamento documentado', country: 'País documentado', location_type: 'territorial',
    context: 'Contexto territorial.', period: 'Periodo documentado en el archivo', event_date: '2023', event_label: 'Primera versión',
    related_initiative: { label: 'Iniciativa vinculada', url: '/experiencias/iniciativa-vinculada/' },
    sources: [{ label: 'Archivo impreso' }, { label: 'Documento público', url: 'https://example.com/fuente' }],
    milestones: [{ label: 'Inicio', date: '2023', description: 'Primera versión documentada.' }, { label: 'Encuentro posterior', date: '2024-08' }]
  });
  assert.equal(record.municipality, 'Ciudad documentada');
  assert.equal(record.department, 'Departamento documentado');
  assert.equal(record.country, 'País documentado');
  assert.equal(record.context, 'Contexto territorial.');
  assert.equal(record.period, 'Periodo documentado en el archivo');
  assert.equal(record.event_date, '2023');
  assert.equal(record.event_label, 'Primera versión');
  assert.deepEqual(record.related_initiative, { label: 'Iniciativa vinculada', url: '/experiencias/iniciativa-vinculada/' });
  assert.deepEqual(record.sources[0], { label: 'Archivo impreso', url: '' });
  assert.deepEqual(record.milestones.map(item => item.date), ['2023', '2024-08']);
  assert.equal(record.milestones[0].description, 'Primera versión documentada.');
  assert.equal(record.milestones[1].description, '');
});

test('Galería aplica autorización, rutas locales, texto alternativo y crédito de la imagen principal', () => {
  const image = { image: '/assets/images/experiencias/foto.webp', image_authorized: true, image_alt: 'Encuentro cultural', image_credit: 'AFNEMO' };
  const record = normalize({ gallery: [image, { ...image, image_authorized: false }] });
  assert.deepEqual(record.gallery, [{ image: image.image, image_alt: image.image_alt, image_credit: image.image_credit }]);
  assert.throws(() => normalize({ gallery: [{ ...image, image: 'https://example.com/foto.webp' }] }), /ruta de imagen/);
  assert.throws(() => normalize({ gallery: [{ ...image, image_alt: '' }] }), /image_alt/);
  assert.throws(() => normalize({ gallery: [{ ...image, image_credit: '' }] }), /image_credit/);
  const second = { ...image, image: '/assets/images/noticias/segunda.webp' };
  const unique = normalize({ ...image, gallery: [image, second, { ...second, image: 'segunda.webp' }] });
  assert.deepEqual(unique.gallery.map(item => item.image), [second.image], 'omite la principal y duplicados de una misma ruta normalizada');
  assert.deepEqual(normalize({ ...image, gallery: [image] }).gallery, [], 'una galería sin fotografías nuevas no crea una sección vacía');
});

test('Videos y enlaces editoriales rechazan URLs inseguras y estructuras inválidas', () => {
  const record = normalize({ videos: [{ label: 'Crónica audiovisual', url: 'https://www.youtube.com/watch?v=video', credit: 'Canal documental' }] });
  assert.equal(record.videos[0].credit, 'Canal documental');
  for (const field of ['materials', 'videos', 'sources']) {
    assert.throws(() => normalize({ [field]: [{ label: 'Enlace', url: 'javascript:alert(1)' }] }), /URL/);
    assert.throws(() => normalize({ [field]: {} }), /lista/);
    assert.throws(() => normalize({ [field]: [null] }), /elemento/);
  }
  assert.throws(() => normalize({ related_initiative: { label: 'Otra', url: '//example.com' } }), /URL/);
  assert.throws(() => normalize({ milestones: [{ label: 'Fecha inválida', date: '2023-13' }] }), /fecha/);
});

test('Las cinco fichas distinguen archivo histórico y fuentes públicas fechadas', async () => {
  const records = await loadCollection(project, 'experiencias');
  assert.equal(records.length, 5);
  const get = slug => records.find(record => record.slug === slug);
  const route = get('ruta-libertaria');
  assert.equal(route.territory, 'San Basilio de Palenque');
  for (const field of ['municipality', 'department', 'country']) assert.equal(route[field], '');
  assert.equal(route.event_date, '2023');
  assert.equal(route.event_label, 'Primera versión documentada');
  assert.equal(get('kilombo-yumma').event_date, '2014');
  assert.equal(get('kilombo-yumma').territory, 'Antonio Nariño y San Cristóbal, Bogotá');
  assert.equal(get('kilomboapp').territory, 'Bogotá');
  assert.equal(get('kilomboapp').location_type, 'territorial');
  assert.equal(get('kilomboapp').event_date, '2023');
  assert.match(get('kilomboapp').event_label, /no es la fecha exacta de lanzamiento/);
  assert.match(get('kilomboapp').context, /herramienta digital/);
  assert.equal(get('kilombo-yumma').related_initiative.url, get('kilomboapp').url);
  assert.equal(get('kilomboapp').related_initiative.url, get('kilombo-yumma').url);
  for (const slug of ['museo-viernes-negro', 'catedra-benkos-bioho']) {
    assert.equal(get(slug).territory, 'Antonio Nariño, Bogotá');
    assert.equal(get(slug).municipality, 'Bogotá');
    assert.match(get(slug).event_label, /Publicación/);
  }
  assert.equal(get('museo-viernes-negro').videos.length, 2);
  assert.match(get('museo-viernes-negro').image_credit, /Imagen suministrada por AFNEMO/);
  assert.deepEqual(route.milestones.map(item => item.date), ['2023', '2025-11-28', '2026-09-25']);
  assert.ok(route.milestones.slice(1).every(item => item.label.startsWith('Firma del contrato')));
  assert.match(get('museo-viernes-negro').html, /Ubicación pública actual/);
  assert.match(get('museo-viernes-negro').html, /25 de abril de 2025/);
  for (const record of records) {
    if (record.slug !== 'ruta-libertaria') assert.deepEqual(record.milestones, [], `${record.slug}: un único año o fecha no crea una cronología`);
    assert.deepEqual(record.gallery, []);
    assert.doesNotMatch(record.html, /<h2>Fuente y materiales<\/h2>|Revisión editorial:/);
    assert.doesNotMatch(JSON.stringify(record), /"(?:coordinates|latitude|longitude|address)":/);
  }
});
