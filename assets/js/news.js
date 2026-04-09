/* ============================================
   AFNEMO – news.js
   Carga dinámica de noticias desde GitHub API.
   Parsea frontmatter manualmente (sin librerías).
   ============================================ */

(function () {
  'use strict';

  /* ── Configuración ───────────────────────────────────────────────────── */
  var GITHUB_OWNER  = 'Blaister9';
  var GITHUB_REPO   = 'AFNEMO';
  var GITHUB_BRANCH = 'main';
  var NOTICIAS_PATH = 'content/noticias';
  var MAX_NOTICIAS  = 3;

  var API_DIR  = 'https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO
               + '/contents/' + NOTICIAS_PATH;
  var RAW_BASE = 'https://raw.githubusercontent.com/' + GITHUB_OWNER + '/' + GITHUB_REPO
               + '/' + GITHUB_BRANCH + '/' + NOTICIAS_PATH;

  /* ── Skeleton placeholder ────────────────────────────────────────────── */
  function renderSkeletons(container) {
    container.innerHTML = '';
    for (var i = 0; i < MAX_NOTICIAS; i++) {
      var card = document.createElement('div');
      card.className = 'news-card news-skeleton';
      card.setAttribute('aria-hidden', 'true');
      card.innerHTML =
        '<div class="news-card-img news-skeleton-block"></div>' +
        '<div class="news-card-body">' +
          '<div class="news-skeleton-line" style="width:35%;height:11px;margin-bottom:.85rem"></div>' +
          '<div class="news-skeleton-line" style="width:92%;height:19px;margin-bottom:.4rem"></div>' +
          '<div class="news-skeleton-line" style="width:68%;height:19px;margin-bottom:.85rem"></div>' +
          '<div class="news-skeleton-line" style="width:100%;height:13px;margin-bottom:.35rem"></div>' +
          '<div class="news-skeleton-line" style="width:80%;height:13px;margin-bottom:1.1rem"></div>' +
          '<div class="news-skeleton-line" style="width:28%;height:11px"></div>' +
        '</div>';
      container.appendChild(card);
    }
  }

  /* ── Parseo manual de frontmatter YAML ──────────────────────────────── */
  // Soporta: strings (con o sin comillas), booleans, fechas ISO.
  // No soporta: arrays, objetos anidados (no necesarios aquí).
  function parseFrontmatter(raw) {
    var fenceRe = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
    var m = raw.match(fenceRe);
    if (!m) return { meta: {}, body: raw.trim() };

    var meta = {};
    var lines = m[1].split('\n');

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var ci = line.indexOf(':');
      if (ci === -1) continue;

      var key = line.slice(0, ci).trim();
      var val = line.slice(ci + 1).trim();

      // Eliminar comillas dobles o simples envolventes
      if (
        (val.charAt(0) === '"'  && val.charAt(val.length - 1) === '"') ||
        (val.charAt(0) === "'"  && val.charAt(val.length - 1) === "'")
      ) {
        val = val.slice(1, -1);
      }

      // Booleanos
      if (val === 'true')       val = true;
      else if (val === 'false') val = false;

      if (key) meta[key] = val;
    }

    var body = raw.slice(m[0].length).trim();
    return { meta: meta, body: body };
  }

  /* ── Formateador de fecha ────────────────────────────────────────────── */
  function formatDate(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString('es-CO', {
      day:   'numeric',
      month: 'short',
      year:  'numeric'
    });
  }

  /* ── Escape HTML para evitar XSS ────────────────────────────────────── */
  function escHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#39;');
  }

  /* ── Construye una tarjeta de noticia ───────────────────────────────── */
  function buildCard(noticia, index) {
    var meta    = noticia.meta;
    var title   = meta.title    || 'Sin título';
    var dateStr = meta.date     || '';
    var excerpt = meta.excerpt  || noticia.body.slice(0, 180) || '';
    var image   = meta.image    || '';
    // 'tag' es campo opcional; si no existe se usa 'Noticias'
    var cardTag = meta.tag || meta.category || 'Noticias';

    var card = document.createElement('div');
    card.className = 'news-card';

    /* — Imagen — */
    var imgDiv = document.createElement('div');
    imgDiv.className = 'news-card-img';

    if (image) {
      // Si la ruta no empieza con '/' se asume relativa a /assets/images/noticias/
      var src = image.charAt(0) === '/'
        ? image
        : '/assets/images/noticias/' + image;

      // Clase CSS que oculta el ::before placeholder via sections.css
      imgDiv.classList.add('has-image');

      var img = document.createElement('img');
      img.src      = src;
      img.alt      = title;
      img.loading  = 'lazy';
      // z-index:1 garantiza estar por encima del ::before (z-index:0)
      img.style.cssText =
        'position:absolute;inset:0;width:100%;height:100%;' +
        'object-fit:cover;display:block;z-index:1;';
      imgDiv.appendChild(img);
    }

    /* — Cuerpo de la tarjeta — */
    var bodyDiv = document.createElement('div');
    bodyDiv.className = 'news-card-body';

    var dateLabel = formatDate(dateStr);

    bodyDiv.innerHTML =
      '<div class="news-card-tag">' + escHtml(cardTag) + '</div>' +
      '<h3>' + escHtml(title) + '</h3>' +
      (excerpt ? '<p>' + escHtml(excerpt) + '</p>' : '') +
      '<div class="news-card-meta">' +
        (dateLabel ? '<span>' + escHtml(dateLabel) + '</span>' : '') +
      '</div>';

    card.appendChild(imgDiv);
    card.appendChild(bodyDiv);

    /* — Animación de entrada con stagger — */
    card.style.opacity   = '0';
    card.style.transform = 'translateY(22px)';
    setTimeout(function () {
      card.style.transition = 'opacity 0.55s ease, transform 0.55s ease';
      card.style.opacity    = '1';
      card.style.transform  = 'translateY(0)';
    }, index * 80);

    return card;
  }

  /* ── Oculta la sección si no hay noticias / hay error ───────────────── */
  function hideSectionNews(container) {
    container.innerHTML = '';
    var section = container.closest('section.news');
    if (section) section.style.display = 'none';
  }

  /* ── Lógica principal ────────────────────────────────────────────────── */
  function loadNoticias() {
    var container = document.getElementById('noticias-container');
    if (!container) return;

    /* 1. Mostrar skeletons mientras carga */
    renderSkeletons(container);

    /* 2. Listar archivos .md en content/noticias/ via GitHub API */
    fetch(API_DIR, {
      mode: 'cors',
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    })
    .then(function (res) {
      if (!res.ok) throw new Error('GitHub API error ' + res.status);
      return res.json();
    })
    .then(function (files) {
      if (!Array.isArray(files)) throw new Error('Unexpected API response');

      var mdFiles = files.filter(function (f) {
        return f.type === 'file' && f.name.slice(-3) === '.md';
      });

      if (!mdFiles.length) {
        hideSectionNews(container);
        return Promise.resolve([]);
      }

      /* 3. Descargar todos los .md en paralelo */
      var promises = mdFiles.map(function (f) {
        return fetch(RAW_BASE + '/' + encodeURIComponent(f.name), { mode: 'cors' })
          .then(function (r) { return r.ok ? r.text() : null; })
          .then(function (text) {
            if (!text) return null;
            var parsed = parseFrontmatter(text);
            parsed.filename = f.name;
            return parsed;
          })
          .catch(function (err) {
            console.warn('[AFNEMO news] No se pudo descargar ' + f.name + ':', err);
            return null;
          });
      });

      return Promise.all(promises);
    })
    .then(function (results) {
      if (!results || !results.length) return;

      /* 4. Filtrar published: true y ordenar por fecha descendente */
      var noticias = results
        .filter(function (n) {
          return n && n.meta && n.meta.published === true;
        })
        .sort(function (a, b) {
          return new Date(b.meta.date) - new Date(a.meta.date);
        })
        .slice(0, MAX_NOTICIAS);

      /* 5. Renderizar o esconder */
      container.innerHTML = '';

      if (!noticias.length) {
        hideSectionNews(container);
        return;
      }

      noticias.forEach(function (noticia, i) {
        container.appendChild(buildCard(noticia, i));
      });
    })
    .catch(function () {
      /* Error silencioso: ocultar la sección de noticias */
      hideSectionNews(container);
    });
  }

  /* ── Arrancar cuando el DOM esté listo ──────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadNoticias);
  } else {
    // Con defer el DOM ya está disponible al ejecutarse
    loadNoticias();
  }

})();
