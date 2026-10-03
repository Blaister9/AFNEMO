/* Noticias de la misma versión publicada: nunca consulta main ni GitHub. */
(function () {
  'use strict';
  var container = document.getElementById('noticias-container');
  if (!container) return;
  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }
  function message(title, description, retry) {
    container.replaceChildren();
    var box = element('div', 'news-state');
    box.append(element('h3', '', title), element('p', '', description));
    if (retry) {
      var button = element('button', 'btn-primary', 'Reintentar');
      button.type = 'button';
      button.addEventListener('click', load);
      box.appendChild(button);
    }
    container.appendChild(box);
  }
  function validRecord(record) {
    return record && typeof record.title === 'string' && typeof record.excerpt === 'string' &&
      /^\/noticias\/[a-z0-9]+(?:-[a-z0-9]+)*\/$/.test(record.url) &&
      typeof record.date === 'string' && !Number.isNaN(Date.parse(record.date));
  }
  function card(record) {
    var article = element('article', 'news-card');
    if (record.image && /^\/assets\/images\/[a-zA-Z0-9_./-]+\.(png|jpe?g|webp|avif)$/i.test(record.image) && !record.image.includes('..')) {
      var figure = element('figure', 'news-card-img has-image');
      var img = element('img');
      img.src = record.image;
      img.alt = record.image_alt || '';
      img.loading = 'lazy';
      img.decoding = 'async';
      if (Number.isInteger(record.image_width) && Number.isInteger(record.image_height)) {
        img.width = record.image_width;
        img.height = record.image_height;
      }
      figure.appendChild(img);
      if (record.image_credit) figure.appendChild(element('figcaption', 'news-image-credit', record.image_credit));
      article.appendChild(figure);
    }
    var body = element('div', 'news-card-body');
    body.appendChild(element('div', 'news-card-tag', record.category || 'Noticias'));
    var heading = element('h3');
    var link = element('a', '', record.title);
    link.href = record.url;
    heading.appendChild(link);
    body.append(heading, element('p', '', record.excerpt));
    var date = element('time');
    date.dateTime = record.date;
    date.textContent = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(record.date.slice(0, 10) + 'T12:00:00Z'));
    var meta = element('div', 'news-card-meta');
    meta.appendChild(document.createTextNode(record.historical ? 'Publicación original: ' : 'Publicación: '));
    meta.appendChild(date);
    var read = element('a', 'news-read-link', 'Leer noticia →');
    read.href = record.url;
    read.setAttribute('aria-label', 'Leer noticia: ' + record.title);
    body.append(meta, read);
    article.appendChild(body);
    return article;
  }
  async function load() {
    var retrying = document.activeElement && container.contains(document.activeElement);
    container.setAttribute('aria-busy', 'true');
    message('Cargando noticias…', 'Consultando las publicaciones de AFNEMO.');
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 12000);
    try {
      var response = await fetch('/data/noticias.json', { signal: controller.signal, cache: 'no-cache', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('Noticias no disponibles');
      var records = await response.json();
      if (!Array.isArray(records) || !records.every(validRecord)) throw new Error('Formato de noticias no válido');
      if (!records.length) message('Aún no hay noticias publicadas', 'Pronto compartiremos novedades de la asociación. Puedes explorar las experiencias documentadas.');
      else container.replaceChildren.apply(container, records.slice(0, 3).map(card));
    } catch {
      message('No pudimos cargar las noticias', 'Puedes volver a intentarlo o consultar el listado completo de noticias.', true);
    } finally {
      clearTimeout(timeout);
      container.setAttribute('aria-busy', 'false');
      if (retrying) {
        var focusTarget = container.querySelector('a, button') || container;
        if (focusTarget === container) container.tabIndex = -1;
        focusTarget.focus();
      }
    }
  }
  load();
})();
