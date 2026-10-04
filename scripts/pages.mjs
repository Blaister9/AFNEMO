import { escapeHtml as esc, formatDate } from './content.mjs';

const dateLabel = (label, date) => date ? `<p class="content-date">${label}: <time datetime="${esc(date)}">${esc(formatDate(date))}</time></p>` : '';
export const imageMarkup = record => record.image ? `<figure class="content-figure"><img src="${esc(record.image)}" alt="${esc(record.image_alt)}" width="${record.image_width}" height="${record.image_height}" loading="lazy" decoding="async"><figcaption>${esc(record.image_credit)}</figcaption></figure>` : '';
export function contentCard(record, experience = false) {
  return `<article class="content-card"${experience ? experienceAttributes(record) : ''}>${imageMarkup(record)}<div class="content-card-body">${experience ? (record.territory ? `<p class="content-territory">${esc(record.territory)}</p>` : '') : `<p class="section-tag">${esc(record.category)}</p>`}<h2><a href="${esc(record.url)}">${esc(record.title)}</a></h2><p>${esc(record.excerpt)}</p>${experience ? '' : dateLabel(record.historical ? 'Publicación original' : 'Publicación', record.date)}<a class="content-read" href="${esc(record.url)}">${experience ? 'Leer experiencia' : 'Leer noticia'} <span aria-hidden="true">→</span><span class="sr-only">: ${esc(record.title)}</span></a></div></article>`;
}

const experienceAttributes = record => ` data-experience data-title="${esc(record.title + ' ' + record.excerpt)}" data-initiative="${esc(record.initiative)}" data-territory="${esc(record.territory)}"`;

export function experienceExplorer(records, { compact = false } = {}) {
  if (!records.length) return '<p class="content-notice">Las experiencias documentadas estarán disponibles después de su revisión editorial.</p>';
  const select = (field, label, all) => {
    const values = [...new Set(records.map(record => record[field]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
    return values.length > 1 ? `<div><label for="experience-${field}">${label}</label><select id="experience-${field}" name="${field}"><option value="">${all}</option>${values.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join('')}</select></div>` : '';
  };
  const cards = compact ? records.map(record => `<article class="territory-story"${experienceAttributes(record)}>${record.territory ? `<p class="content-territory">${esc(record.territory)}</p>` : ''}<h4><a href="${esc(record.url)}">${esc(record.title)} <span aria-hidden="true">→</span></a></h4><p>${esc(record.excerpt)}</p></article>`).join('') : records.map(record => contentCard(record, true)).join('');
  return `<form class="experience-filters" id="experience-filters" role="search" aria-label="Filtrar experiencias de AFNEMO" hidden><div><label for="experience-query">Buscar en las experiencias</label><input type="search" id="experience-query" name="q" placeholder="Título o resumen"></div>${select('territory', 'Territorio', 'Todos los territorios')}${select('initiative', 'Iniciativa', 'Todas las iniciativas')}<button type="reset" class="content-reset">Limpiar filtros</button></form><p id="experience-count" class="content-count" role="status">${records.length} experiencias</p><div class="${compact ? 'territory-story-grid' : 'content-grid'}">${cards}</div><p id="experience-empty" class="content-notice" hidden>No hay experiencias con estos filtros. Prueba otro término o limpia los filtros.</p><noscript><p class="content-notice">Se muestran todas las experiencias. Activa JavaScript para usar los filtros.</p></noscript>`;
}

export function createPageRenderer(index) {
  const nav = index.match(/<nav\b[^>]*id="mainNav"[\s\S]*?<\/nav>/)?.[0];
  const footer = index.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/)?.[0];
  if (!nav || !footer) throw new Error('index.html debe contener nav#mainNav y footer compartidos');
  const normalize = html => html.replace(/href="#([^"\s]+)"/g, 'href="/#$1"').replace(/(?:src|href)="(assets\/[^"\s]+)"/g, (match, resource) => match.replace(resource, `/${resource}`));
  const css = Array.from(index.matchAll(/<link\b[^>]*href="(?:\/)?assets\/css\/[^"\s]+"[^>]*>/g)).map(match => normalize(match[0])).join('\n');
  const fonts = Array.from(index.matchAll(/<link\b[^>]*href="https:\/\/fonts\.[^"\s]+"[^>]*>/g)).map(match => match[0]).join('\n');
  return ({ title, description, url, content, script = '', noindex = false }) => `<!DOCTYPE html>
<html lang="es"><head><link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)} | AFNEMO</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="https://afnemo.co${esc(url)}"><meta property="og:title" content="${esc(title)} | AFNEMO"><meta property="og:description" content="${esc(description)}"><meta property="og:type" content="website"><meta property="og:url" content="https://afnemo.co${esc(url)}">${noindex ? '<meta name="robots" content="noindex">' : ''}${fonts}${css}</head>
<body class="content-page"><a class="skip-link" href="#main-content">Saltar al contenido</a>${normalize(nav)}<main id="main-content" tabindex="-1" class="content-main">${content}</main>${normalize(footer)}<script src="/assets/js/nav.js" defer></script>${script ? `<script src="${script}" defer></script>` : ''}</body></html>`;
}

export function newsList(records) {
  return `<header class="content-heading"><a class="content-back" href="/">← Inicio</a><p class="section-tag">Noticias y eventos</p><h1>Noticias de AFNEMO</h1><p>Actualidad y relatos publicados por la asociación.</p></header>${records.length ? `<div class="content-grid">${records.map(record => contentCard(record)).join('')}</div>` : '<div class="content-notice"><h2>Aún no hay noticias publicadas</h2><p>Este espacio reunirá las próximas publicaciones de AFNEMO.</p><a href="/experiencias/">Explorar experiencias documentadas →</a></div>'}`;
}

export function newsDetail(record) {
  return `<article class="content-article"><header class="content-heading"><a class="content-back" href="/noticias/">← Todas las noticias</a><p class="section-tag">${esc(record.category)}</p><h1>${esc(record.title)}</h1><p class="content-lead">${esc(record.excerpt)}</p>${dateLabel(record.historical ? 'Publicación original' : 'Publicación', record.date)}${dateLabel('Fecha del evento', record.event_date)}${dateLabel('Actualización', record.updated_at)}</header>${imageMarkup(record)}<div class="prose">${record.html}</div>${record.source ? `<section class="content-sources"><h2>Fuente documental</h2><p>${esc(record.source)}</p>${dateLabel('Fecha de la fuente', record.source_date)}</section>` : ''}<a class="content-back" href="/noticias/">← Volver a noticias</a></article>`;
}

export function experiencesList(records) {
  return `<header class="content-heading"><a class="content-back" href="/#mapa-institucional">← Territorios y experiencias</a><p class="section-tag">Archivo de la organización</p><h1>Experiencias de AFNEMO</h1><p>Saberes, memoria y procesos comunitarios contados desde sus territorios. Cada historia reúne el contexto y los materiales que ha sido posible documentar.</p><p class="experience-scope">Cada ficha distingue la memoria histórica de los datos recientes respaldados por fuentes fechadas. Las condiciones actuales de atención se precisan en el relato.</p><a href="/#territory-map">Consultar también el mapa de emprendimientos afrocolombianos en Bogotá →</a></header>${experienceExplorer(records)}`;
}

export function experienceDetail(record) {
  const locationLabels = { exact: 'Ubicación exacta documentada', approximate: 'Ubicación aproximada', territorial: 'Referencia territorial', unpublished: 'Ubicación no publicada' };
  const singleMilestone = record.milestones.length === 1 ? record.milestones[0] : null;
  const eventDate = record.event_date || singleMilestone?.date;
  const eventLabel = record.event_date ? (record.event_label || 'Fecha documentada') : singleMilestone?.label;
  const singleInHeader = singleMilestone && eventDate === singleMilestone.date && eventLabel === singleMilestone.label;
  const singleMarkup = singleMilestone && (!singleInHeader || singleMilestone.description) ? `<div class="experience-single-date">${!singleInHeader ? dateLabel(singleMilestone.label, singleMilestone.date) : ''}${singleMilestone.description ? `<p>${esc(singleMilestone.description)}</p>` : ''}</div>` : '';
  const linkList = items => `<ul>${items.map(item => `<li>${item.url ? `<a href="${esc(item.url)}" rel="noopener noreferrer">${esc(item.label)}</a>` : esc(item.label)}${item.credit ? `<p class="material-credit">${esc(item.credit)}</p>` : ''}</li>`).join('')}</ul>`;
  const geography = [['Municipio / ciudad', record.municipality], ['Departamento', record.department], ['País', record.country]].filter(([, value]) => value && value !== record.territory);
  return `<article class="content-article experience-article"><header class="content-heading"><a class="content-back" href="/experiencias/">← Todas las experiencias</a><p class="section-tag">Experiencias AFNEMO</p><h1>${esc(record.title)}</h1>${record.territory || eventDate || record.period ? `<dl class="content-facts">${record.territory ? `<div><dt>Territorio documentado</dt><dd>${esc(record.territory)}</dd></div>` : ''}${eventDate ? `<div><dt>${esc(eventLabel)}</dt><dd><time datetime="${esc(eventDate)}">${esc(formatDate(eventDate))}</time></dd></div>` : ''}${record.period ? `<div><dt>Periodo</dt><dd>${esc(record.period)}</dd></div>` : ''}</dl>` : ''}<p class="content-lead">${esc(record.excerpt)}</p></header>${record.context ? `<section class="experience-context"><h2>Territorio y contexto</h2><p>${esc(record.context)}</p></section>` : ''}${imageMarkup(record)}<div class="prose">${record.html}</div>${singleMarkup}${record.milestones.length > 1 ? `<section class="experience-milestones"><h2>Hitos documentados</h2><ol>${record.milestones.map(item => `<li><time datetime="${esc(item.date)}">${esc(formatDate(item.date))}</time><h3>${esc(item.label)}</h3>${item.description ? `<p>${esc(item.description)}</p>` : ''}</li>`).join('')}</ol></section>` : ''}${record.gallery?.length ? `<section class="experience-gallery"><h2>Galería</h2>${record.gallery.map(imageMarkup).join('')}</section>` : ''}${record.videos?.length ? `<section class="content-sources"><h2>Memoria audiovisual</h2>${linkList(record.videos)}</section>` : ''}${record.materials.length ? `<section class="content-sources"><h2>Materiales relacionados</h2>${linkList(record.materials)}</section>` : ''}${record.related_initiative ? `<section class="experience-related"><h2>Iniciativa relacionada</h2><a href="${esc(record.related_initiative.url)}">${esc(record.related_initiative.label)} →</a></section>` : ''}<section class="content-sources"><h2>Fuentes y revisión</h2><p>${esc(record.source)}</p>${record.sources?.length ? linkList(record.sources) : ''}${dateLabel('Revisión documental', record.reviewed_at)}${geography.length ? `<dl class="content-facts">${geography.map(([label, value]) => `<div><dt>${label}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>` : ''}<p>${locationLabels[record.location_type] || 'Referencia territorial'}. Consulta el relato y sus fuentes para distinguir el contexto histórico, los datos recientes y las condiciones de atención.</p></section><a class="content-back" href="/experiencias/">← Volver a experiencias</a></article>`;
}


export function institutionalDetail(record) {
  const chapters = [];
  const html = record.html.replace(/<h2>([\s\S]*?)<\/h2>/g, (_match, heading) => {
    const id = `seccion-${chapters.length + 1}`;
    chapters.push({ id, title: heading.replace(/<[^>]+>/g, '') });
    return `<h2 id="${id}">${heading}</h2>`;
  });
  const contents = chapters.map(chapter => `<li><a href="#${chapter.id}">${chapter.title}</a></li>`).join('');
  return `<article class="content-article institutional-article"><header class="content-heading"><a class="content-back" href="/">← Inicio</a><p class="section-tag">Asociación y trayectoria</p><h1>${esc(record.title)}</h1><p class="content-lead">${esc(record.excerpt)}</p></header><p class="content-notice">Una lectura del archivo institucional compilado el 19 de febrero de 2025, complementada con fuentes públicas fechadas. Las fechas acompañan a cada sección; las colaboraciones, servicios e invitaciones históricas requieren confirmación para considerarse vigentes.</p><div class="institutional-contents" role="navigation" aria-label="En esta página"><h2>En esta página</h2><ol>${contents}</ol></div><div class="prose">${html}</div><section class="content-sources"><h2>Fuente y revisión</h2><p>${esc(record.source)}</p>${dateLabel('Revisión documental', record.reviewed_at)}</section><a class="content-back" href="/#about">← Volver a la presentación de AFNEMO</a></article>`;
}
