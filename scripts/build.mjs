import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadCollection, loadInstitutional, inspectImage } from './content.mjs';
import { createPageRenderer, newsList, newsDetail, experiencesList, experienceDetail, institutionalDetail } from './pages.mjs';

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Explicit public source list: no recursive repository copy, raw content or source documents.
const codeAssets = [
  'assets/css/main.css', 'assets/css/nav.css', 'assets/css/hero.css', 'assets/css/sections.css', 'assets/css/responsive.css', 'assets/css/content.css',
  'assets/js/nav.js', 'assets/js/animations.js', 'assets/js/news.js', 'assets/js/experiences.js'
];
const staticFiles = ['admin/index.html', 'admin/config.yml', 'admin/preview.js', 'admin/guia.html', 'admin/guia.css', '_redirects', 'CNAME'];
const existingPublicImages = new Set(['/assets/images/hero-image.webp']);

export async function build(root = sourceRoot) {
  root = path.resolve(root);
  const out = path.resolve(root, 'dist');
  if (path.dirname(out) !== root || path.basename(out) !== 'dist') throw new Error('Directorio de salida no válido');
  try { if ((await fs.lstat(out)).isSymbolicLink()) throw new Error('dist no debe ser un enlace simbólico'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  let index = await fs.readFile(path.join(root, 'index.html'), 'utf8');
  const [news, experiences, institutional] = await Promise.all([loadCollection(root, 'noticias'), loadCollection(root, 'experiencias'), loadInstitutional(root)]);
  if (!institutional) index = index.replace(/<a\b[^>]*data-institutional[^>]*>[\s\S]*?<\/a>/g, '');
  const imageCache = new Map();
  const readImage = async image => {
    if (imageCache.has(image)) return imageCache.get(image);
    const resolved = await fs.realpath(path.join(root, image.slice(1)));
    if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error('Imagen fuera del proyecto');
    const bytes = await fs.readFile(resolved);
    const dimensions = await inspectImage(bytes, image);
    const result = { bytes, ...dimensions };
    imageCache.set(image, result);
    return result;
  };
  for (const record of [...news, ...experiences]) {
    if (!record.image) continue;
    const dimensions = await readImage(record.image);
    record.image_width = dimensions.width;
    record.image_height = dimensions.height;
  }
  const page = createPageRenderer(index);
  const pages = new Map([
    ['index.html', index],
    ['noticias/index.html', page({ title: 'Noticias', description: 'Noticias y eventos publicados por AFNEMO.', url: '/noticias/', content: newsList(news) })],
    ['experiencias/index.html', page({ title: 'Experiencias', description: 'Iniciativas y experiencias documentadas de AFNEMO en sus territorios.', url: '/experiencias/', content: experiencesList(experiences), script: '/assets/js/experiences.js' })],
    ['404.html', page({ title: 'Página no encontrada', description: 'El contenido solicitado no está disponible.', url: '/404.html', noindex: true, content: '<header class="content-heading"><p class="section-tag">404</p><h1>No encontramos esta página</h1><p>El contenido puede haber cambiado de dirección o no estar publicado.</p><a href="/">Volver al inicio →</a></header>' })]
  ]);
  for (const record of news) pages.set(`noticias/${record.slug}/index.html`, page({ title: record.title, description: record.excerpt, url: record.url, content: newsDetail(record) }));
  for (const record of experiences) pages.set(`experiencias/${record.slug}/index.html`, page({ title: record.title, description: record.excerpt, url: record.url, content: experienceDetail(record) }));
  if (institutional) pages.set('asociacion/index.html', page({ title: institutional.title, description: institutional.excerpt, url: institutional.url, content: institutionalDetail(institutional) }));
  const publicAssets = new Map();
  const versions = new Map();
  for (const asset of codeAssets) {
    const bytes = await fs.readFile(path.join(root, asset));
    const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
    const versioned = asset.replace(/\.(css|js)$/, `.${hash}.$1`);
    versions.set(asset, versioned);
    publicAssets.set(versioned, bytes);
  }
  const allowedImages = new Set([...existingPublicImages, ...[...news, ...experiences].map(record => record.image).filter(Boolean)]);
  const referencedImages = new Set();
  for (const [filename, html] of pages) {
    const versioned = html.replace(/((?:src|href)=")\/?(assets\/(?:css|js)\/[^"?]+)(?:\?[^"\s]*)?"/g, (match, prefix, asset) => {
      if (!versions.has(asset)) throw new Error(`${filename}: recurso no incluido en lista pública: ${asset}`);
      return `${prefix}/${versions.get(asset)}"`;
    });
    for (const match of versioned.matchAll(/(?:src|content)="(?:https:\/\/afnemo\.co)?\/?(assets\/images\/[^"\s]+)"/g)) {
      const image = `/${match[1]}`;
      if (!allowedImages.has(image)) throw new Error(`${filename}: imagen no autorizada: ${image}`);
      referencedImages.add(image);
    }
    pages.set(filename, versioned);
  }
  for (const image of referencedImages) {
    publicAssets.set(image.slice(1), (await readImage(image)).bytes);
  }
  for (const file of staticFiles) publicAssets.set(file, await fs.readFile(path.join(root, file)));
  // Validate everything before replacing the previous local output.
  await fs.rm(out, { recursive: true, force: true });
  const write = async (file, content) => {
    const target = path.join(out, file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content);
  };
  for (const [file, content] of [...pages, ...publicAssets]) await write(file, content);
  await write('data/noticias.json', JSON.stringify(news.map(({ html, ...record }) => record), null, 2) + '\n');
  await write('data/experiencias.json', JSON.stringify(experiences.map(({ html, ...record }) => record), null, 2) + '\n');
  await write('robots.txt', 'User-agent: *\nDisallow: /admin/\nSitemap: https://afnemo.co/sitemap.xml\n');
  const urls = ['/', '/noticias/', '/experiencias/', ...(institutional ? [institutional.url] : []), ...news.map(record => record.url), ...experiences.map(record => record.url)];
  await write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url => `<url><loc>https://afnemo.co${url}</loc></url>`).join('')}</urlset>\n`);
  return { out, news: news.length, experiences: experiences.length, pages: pages.size, images: referencedImages.size };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build().then(result => console.log(`Build listo: ${result.pages} páginas, ${result.news} noticias, ${result.experiences} experiencias, ${result.images} imágenes en dist/`)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
