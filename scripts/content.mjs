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
    source: typeof meta.source === 'string' ? meta.source : '', category: String(meta.category || meta.tag || 'Noticias')
  };
  if (Object.keys(meta).some(key => /^(?:lat|lng|lon|latitude|longitude|coordinates|location|address)$/i.test(key))) throw new Error(`${filename}: no se admite ubicación puntual`);
  const precision = requiredString(meta, 'public_precision', filename);
  if (!['none', 'city', 'locality', 'region'].includes(precision)) throw new Error(`${filename}: precisión pública no válida`);
  const materials = (meta.materials || []).map(material => {
    const url = safeUrl(material.url);
    if (!url) throw new Error(`${filename}: URL de material no permitida`);
    return { label: requiredString(material, 'label', filename), url, credit: typeof material.credit === 'string' ? material.credit : '' };
  });
  const milestones = (meta.milestones || []).map(item => ({ label: requiredString(item, 'label', filename), date: documentedDate(requiredString(item, 'date', filename), filename) }));
  return {
    ...record, initiative: requiredString(meta, 'initiative', filename), territory: requiredString(meta, 'territory', filename),
    source: requiredString(meta, 'source', filename), reviewed_at: isoDate(meta.reviewed_at, filename, true),
    event_date: documentedDate(meta.event_date, filename), public_precision: precision, materials, milestones
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
