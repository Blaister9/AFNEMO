import fs from 'node:fs/promises';
import path from 'node:path';
import { parseDocument } from 'yaml';
import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';
import sharp from 'sharp';

export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const markdown = new MarkdownIt({ html: false, linkify: false, typographer: false });
markdown.core.ruler.push('article-headings', state => {
  for (const token of state.tokens) if ((token.type === 'heading_open' || token.type === 'heading_close') && token.tag === 'h1') token.tag = 'h2';
});

export function safeUrl(value, { image = false } = {}) {
  if (typeof value !== 'string' || /[\s\\\u0000-\u001f]/.test(value)) return '';
  if (image) {
    const imagePath = value.startsWith('/') ? value : `/assets/images/noticias/${value}`;
    return /^\/assets\/images\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.(?:png|jpe?g|webp|avif)$/i.test(imagePath) && !imagePath.includes('..') ? imagePath : '';
  }
  if (/^#[a-zA-Z0-9_-]+$/.test(value)) return value;
  if (/^\/asociacion\/(?:#[a-zA-Z0-9_-]+)?$/.test(value)) return value;
  if (/^\/(?:noticias|experiencias)\/(?:[a-z0-9-]+\/)?(?:#[a-zA-Z0-9_-]+)?$/.test(value)) return value;
  if (/^\/#(?:[a-zA-Z0-9_-]+)$/.test(value) || value === '/') return value;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

export function renderMarkdown(body) {
  // Images are editorial assets: render only the separately authorized image fields.
  return sanitizeHtml(markdown.render(body), {
    allowedTags: ['p', 'br', 'hr', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'ul', 'ol', 'li', 'strong', 'em', 's', 'a', 'code', 'pre', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
    allowedAttributes: { a: ['href', 'title', 'rel'], ol: ['start'], th: ['align'], td: ['align'] },
    allowedSchemes: ['https'],
    allowProtocolRelative: false,
    transformTags: { a: (tagName, attribs) => {
      const href = safeUrl(attribs.href);
      return href ? { tagName, attribs: { ...attribs, href, rel: 'noopener noreferrer' } } : { tagName: 'span', attribs: {} };
    } }
  });
}

export function parseContent(raw, filename = 'contenido') {
  if (Buffer.byteLength(raw, 'utf8') > 262144) throw new Error(`${filename}: contenido demasiado grande`);
  const match = raw.replace(/^\uFEFF/, '').match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)([\s\S]*)$/);
  if (!match) throw new Error(`${filename}: falta frontmatter YAML`);
  const document = parseDocument(match[1], { uniqueKeys: true, strict: true });
  if (document.errors.length) throw new Error(`${filename}: ${document.errors[0].message}`);
  const meta = document.toJS({ maxAliasCount: 30 });
  if (!meta || Array.isArray(meta) || typeof meta !== 'object') throw new Error(`${filename}: YAML debe ser un objeto`);
  return { meta, body: match[2].trim() };
}

function requiredString(meta, field, filename) {
  if (typeof meta[field] !== 'string' || !meta[field].trim()) throw new Error(`${filename}: falta ${field}`);
  return meta[field].trim();
}

function optionalString(meta, field, filename) {
  if (meta[field] == null) return '';
  if (typeof meta[field] !== 'string') throw new Error(`${filename}: ${field} debe ser texto`);
  return meta[field].trim();
}

function optionalList(meta, field, filename) {
  if (meta[field] == null) return [];
  if (!Array.isArray(meta[field])) throw new Error(`${filename}: ${field} debe ser una lista`);
  return meta[field].map(item => {
    if (!item || Array.isArray(item) || typeof item !== 'object') throw new Error(`${filename}: elemento de ${field} no válido`);
    return item;
  });
}

function rejectPointLocations(value, filename, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  for (const [key, item] of Object.entries(value)) {
    if (/^(?:lat|lng|lon|latitude|longitude|coordinates|location|address|latitud|longitud|coordenadas|direcci[oó]n)$/i.test(key)) throw new Error(`${filename}: no se admite ubicación puntual`);
    rejectPointLocations(item, filename, seen);
  }
}

function linkedItem(item, filename, field, { optionalUrl = false, credit = false } = {}) {
  const label = requiredString(item, 'label', filename);
  const rawUrl = optionalString(item, 'url', filename);
  const url = safeUrl(rawUrl);
  if ((!optionalUrl || rawUrl) && !url) throw new Error(`${filename}: URL de ${field} no permitida`);
  return { label, url, ...(credit ? { credit: optionalString(item, 'credit', filename) } : {}) };
}

export function isoDate(value, filename, required = false) {
  if (!value && !required) return '';
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) || Number.isNaN(Date.parse(value))) throw new Error(`${filename}: fecha ISO inválida`);
  const day = value.slice(0, 10);
  if (new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) !== day) throw new Error(`${filename}: fecha inexistente`);
  return value;
}

export function formatDate(value) {
  if (/^\d{4}$/.test(value)) return value;
  if (/^\d{4}-\d{2}$/.test(value)) return new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}-01T12:00:00Z`));
  return value ? new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`)) : '';
}

export function documentedDate(value, filename) {
  if (typeof value === 'string' && (/^\d{4}$/.test(value) || /^\d{4}-(?:0[1-9]|1[0-2])$/.test(value))) return value;
  return isoDate(value, filename);
}

export function validImageBytes(bytes, filename) {
  const extension = path.extname(filename).toLowerCase();
  if (extension === '.png') return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (extension === '.jpg' || extension === '.jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (extension === '.webp') return bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  if (extension === '.avif') return bytes.subarray(4, 8).toString() === 'ftyp' && /avif|avis/.test(bytes.subarray(8, 32).toString());
  return false;
}

export async function inspectImage(bytes, filename) {
  if (bytes.length > 20 * 1024 * 1024 || !validImageBytes(bytes, filename)) throw new Error(`Imagen inválida o demasiado grande: ${filename}`);
  try {
    const image = sharp(bytes, { limitInputPixels: 40000000, failOn: 'warning' });
    const metadata = await image.metadata();
    await image.stats(); // Force pixel decoding: a matching header alone is insufficient.
    if (!metadata.width || !metadata.height) throw new Error('Sin dimensiones');
    return { width: metadata.width, height: metadata.height };
  } catch { throw new Error(`No se pudo decodificar la imagen: ${filename}`); }
}

function imageFields(meta, filename) {
  if (meta.image_authorized !== true || !meta.image) return { image: '', image_alt: '', image_credit: '' };
  const image = safeUrl(meta.image, { image: true });
  if (!image) throw new Error(`${filename}: ruta de imagen no permitida`);
  return { image, image_alt: requiredString(meta, 'image_alt', filename), image_credit: requiredString(meta, 'image_credit', filename) };
}

export function normalizeContent(parsed, filename, collection) {
  const { meta, body } = parsed;
  // Explicit true is intentional; drafts never need complete publication fields.
  if (collection === 'noticias' ? meta.published !== true : meta.status !== 'published' || meta.reviewed !== true) return null;
  const slug = collection === 'noticias' ? filename.replace(/\.md$/i, '') : requiredString(meta, 'id', filename);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`${filename}: identificador no válido`);
  const record = {
    slug, title: requiredString(meta, 'title', filename), excerpt: requiredString(meta, 'excerpt', filename),
    url: `/${collection}/${slug}/`, html: renderMarkdown(body), ...imageFields(meta, filename)
  };
  if (!body) throw new Error(`${filename}: relato vacío`);
  if (collection === 'noticias') return {
    ...record, date: isoDate(meta.date, filename, true), event_date: isoDate(meta.event_date, filename),
    updated_at: isoDate(meta.updated_at, filename), source_date: documentedDate(meta.source_date, filename),
    source: typeof meta.source === 'string' ? meta.source : '', historical: meta.historical === true,
    category: String(meta.category || meta.tag || 'Noticias')
  };
  rejectPointLocations(meta, filename);
  const precision = optionalString(meta, 'public_precision', filename);
  if (precision && !['none', 'city', 'locality', 'region'].includes(precision)) throw new Error(`${filename}: precisión pública no válida`);
  const locationType = optionalString(meta, 'location_type', filename) || (precision && precision !== 'none' ? 'territorial' : 'unpublished');
  if (!['exact', 'approximate', 'territorial', 'unpublished'].includes(locationType)) throw new Error(`${filename}: tipo de ubicación no válido`);
  const materials = optionalList(meta, 'materials', filename).map(item => linkedItem(item, filename, 'material', { credit: true }));
  const videos = optionalList(meta, 'videos', filename).map(item => linkedItem(item, filename, 'video', { credit: true }));
  const sources = optionalList(meta, 'sources', filename).map(item => linkedItem(item, filename, 'fuente', { optionalUrl: true }));
  const seenImages = new Set(record.image ? [record.image] : []);
  const gallery = optionalList(meta, 'gallery', filename).map(item => imageFields(item, filename)).filter(item => {
    if (!item.image || seenImages.has(item.image)) return false;
    seenImages.add(item.image);
    return true;
  });
  const milestones = optionalList(meta, 'milestones', filename).map(item => ({
    label: requiredString(item, 'label', filename), date: documentedDate(requiredString(item, 'date', filename), filename),
    description: optionalString(item, 'description', filename)
  }));
  let relatedInitiative = null;
  if (meta.related_initiative != null) {
    if (Array.isArray(meta.related_initiative) || typeof meta.related_initiative !== 'object') throw new Error(`${filename}: iniciativa relacionada no válida`);
    // Decap can save an unused optional object with empty child fields.
    if (Object.values(meta.related_initiative).some(value => value != null && value !== '')) relatedInitiative = linkedItem(meta.related_initiative, filename, 'iniciativa relacionada');
  }
  // Apply the publication choice before cards, filters or the public feed receive these fields.
  const geography = Object.fromEntries(['territory', 'municipality', 'department', 'country'].map(field => [
    field, locationType === 'unpublished' ? '' : optionalString(meta, field, filename)
  ]));
  return {
    ...record, initiative: requiredString(meta, 'initiative', filename), ...geography, location_type: locationType,
    context: optionalString(meta, 'context', filename), period: optionalString(meta, 'period', filename),
    source: requiredString(meta, 'source', filename), reviewed_at: isoDate(meta.reviewed_at, filename, true),
    event_date: documentedDate(meta.event_date, filename), event_label: optionalString(meta, 'event_label', filename),
    related_initiative: relatedInitiative, public_precision: precision, materials, milestones, gallery, videos, sources
  };
}

export async function loadCollection(root, collection) {
  const directory = path.join(root, 'content', collection);
  let files;
  try { files = await fs.readdir(directory); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const records = [];
  for (const filename of files.filter(name => name.endsWith('.md')).sort()) {
    const record = normalizeContent(parseContent(await fs.readFile(path.join(directory, filename), 'utf8'), filename), filename, collection);
    if (record) records.push(record);
  }
  if (new Set(records.map(record => record.slug)).size !== records.length) throw new Error(`${collection}: identificadores duplicados`);
  return records.sort((a, b) => String(b.date || b.event_date).localeCompare(String(a.date || a.event_date)) || a.title.localeCompare(b.title, 'es'));
}

export async function loadInstitutional(root) {
  const filename = 'content/institucional/asociacion.md';
  let raw;
  try { raw = await fs.readFile(path.join(root, filename), 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  const { meta, body } = parseContent(raw, filename);
  if (meta.published !== true) return null;
  if (!body) throw new Error(`${filename}: contenido vacío`);
  return {
    title: requiredString(meta, 'title', filename), excerpt: requiredString(meta, 'excerpt', filename),
    source: requiredString(meta, 'source', filename), reviewed_at: isoDate(meta.reviewed_at, filename, true),
    url: '/asociacion/', html: renderMarkdown(body)
  };
}
