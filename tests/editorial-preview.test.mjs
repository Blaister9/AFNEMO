import fs from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'yaml';

const configPath = new URL('../admin/config.yml', import.meta.url);
const previewCode = await fs.readFile(new URL('../admin/preview.js', import.meta.url), 'utf8');

function preview(data) {
  const templates = {};
  const runtime = {
    CMS: { registerPreviewTemplate: (name, component) => { templates[name] = component; }, registerPreviewStyle() {} },
    createClass: component => component,
    h: (tag, props, ...children) => ({ tag, props, children })
  };
  vm.runInNewContext(previewCode, { window: runtime, URL });
  return templates.experiencias.render.call({ props: {
    entry: { get: () => 'experiencias', getIn: keys => data[keys[1]] },
    widgetFor: key => data[key],
    getAsset: image => ({ url: image.startsWith('/') ? image : `/assets/images/noticias/${image}` })
  } });
}

function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...tree.children.flatMap(nodes)];
}

const base = {
  id: 'experiencia-documentada', title: 'Experiencia documentada', excerpt: 'Resumen breve',
  body: 'Relato que amplía el resumen.', initiative: 'Proceso comunitario', source: 'Archivo documental',
  reviewed: true, reviewed_at: '2026-10-02', status: 'published'
};

test('Decap permite niveles territoriales y recursos opcionales sin pedir coordenadas', async () => {
  const config = parse(await fs.readFile(configPath, 'utf8'));
  assert.deepEqual(config.backend, { name: 'git-gateway', branch: 'main' });
  const fields = config.collections.find(collection => collection.name === 'experiencias').fields;
  for (const name of ['territory', 'municipality', 'department', 'country', 'location_type', 'context', 'period', 'event_label', 'related_initiative', 'gallery', 'videos', 'sources']) {
    assert.equal(fields.find(field => field.name === name)?.required, false, name);
  }
  assert.equal(fields.find(field => field.name === 'territory').label, 'Territorio público');
  assert.deepEqual(fields.find(field => field.name === 'location_type').options.map(option => option.value), ['exact', 'approximate', 'territorial', 'unpublished']);
  assert.ok(fields.find(field => field.name === 'milestones').fields.some(field => field.name === 'description' && field.required === false));
  assert.ok(!fields.some(field => /coordinates|latitude|longitude|address/.test(field.name)));
});

test('La vista previa lee los nuevos campos y listas de la entrada, incluidos valores Immutable', () => {
  const record = { ...base, territory: 'San Basilio de Palenque', location_type: 'territorial', country: 'Colombia',
    event_date: '2023', event_label: 'Primera versión documentada', period: 'Primera etapa',
    context: 'Contexto territorial documentado',
    related_initiative: { toJS: () => ({ label: 'Ficha relacionada', url: '/experiencias/otra-ficha/' }) },
    videos: { toJS: () => [{ label: 'Memoria audiovisual', url: 'https://example.org/video', credit: 'Archivo AFNEMO' }] },
    sources: [{ label: base.source }, { label: 'Fuente adicional', url: 'https://example.org/fuente' }],
    image: '/assets/images/noticias/principal.webp', image_authorized: true, image_alt: 'Escena principal', image_credit: 'AFNEMO',
    gallery: [{ image: 'principal.webp', image_authorized: true, image_alt: 'Duplicada', image_credit: 'AFNEMO' },
      { image: '/assets/images/noticias/galeria.webp', image_authorized: true, image_alt: 'Otra escena', image_credit: 'AFNEMO' }],
    materials: [{ label: 'Video repetido', url: 'https://example.org/video' }]
  };
  const tree = preview(record);
  const serialized = JSON.stringify(tree);
  for (const value of ['San Basilio de Palenque', 'Colombia', 'Primera versión documentada', 'Primera etapa', record.context, record.body, 'Ficha relacionada', 'Memoria audiovisual', 'Fuente adicional']) assert.ok(serialized.includes(value), value);
  assert.equal(nodes(tree).filter(node => node.tag === 'img').length, 2);
  assert.equal((serialized.match(/Archivo documental/g) || []).length, 1);
  assert.ok(!serialized.includes('Video repetido'));
});

test('La vista previa omite ubicación no publicada y secciones sin contenido utilizable', () => {
  const tree = preview({ ...base, territory: 'Territorio reservado', municipality: 'Municipio reservado', department: 'Departamento reservado', country: 'País reservado', location_type: 'unpublished',
    gallery: [{ image: '/assets/images/noticias/pendiente.webp', image_authorized: false }],
    videos: [{ label: 'Enlace no válido', url: 'javascript:alert(1)' }]
  });
  const serialized = JSON.stringify(tree);
  for (const word of ['Territorio reservado', 'Municipio reservado', 'Departamento reservado', 'País reservado', 'javascript:alert']) assert.ok(!serialized.includes(word));
  const headings = nodes(tree).filter(node => node.tag === 'h2').flatMap(node => node.children);
  for (const heading of ['Contexto territorial', 'Fotografías', 'Videos', 'Hitos documentados', 'Iniciativa relacionada', 'Materiales relacionados']) assert.ok(!headings.includes(heading), heading);
  assert.equal(nodes(tree).filter(node => node.tag === 'img').length, 0);
});

test('Un solo hito conserva fecha, nombre y descripción sin formar una cronología', () => {
  const milestone = { label: 'Primera edición', date: '2023', description: 'Descripción del acontecimiento' };
  for (const metadata of [{}, { event_date: '2023', event_label: milestone.label }, { event_date: '2024', event_label: 'Fecha de publicación' }]) {
    const tree = preview({ ...base, ...metadata, milestones: [milestone] });
    const serialized = JSON.stringify(tree);
    for (const value of [milestone.label, milestone.date, milestone.description]) assert.ok(serialized.includes(value), value);
    assert.ok(!serialized.includes('Hitos documentados'));
    const times = nodes(tree).filter(node => node.tag === 'time');
    assert.equal(times.filter(node => node.props.dateTime === '2023').length, 1);
    if (metadata.event_date === '2024') {
      assert.ok(serialized.includes('Fecha de publicación'));
      assert.ok(times.some(node => node.props.dateTime === '2024'));
    }
  }
});

test('Dos hitos documentados forman una cronología, conservando sus descripciones', () => {
  const tree = preview({ ...base, milestones: [
    { label: 'Segunda edición', date: '2024', description: 'Segundo acontecimiento' },
    { label: 'Primera edición', date: '2023', description: 'Primer acontecimiento' }
  ] });
  const serialized = JSON.stringify(tree);
  assert.ok(serialized.includes('Hitos documentados'));
  assert.ok(serialized.indexOf('Primera edición') < serialized.indexOf('Segunda edición'));
  assert.ok(serialized.includes('Primer acontecimiento'));
  assert.ok(serialized.includes('Segundo acontecimiento'));
});
