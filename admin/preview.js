/* The preview reads the open entry. It does not save, publish or fetch main. */
(function () {
  'use strict';
  if (!window.CMS || !window.createClass || !window.h) return;
  var h = window.h;
  function text(value) { return value === null || value === undefined ? '' : String(value).trim(); }
  function object(value) { return value && typeof value.toJS === 'function' ? value.toJS() : value || {}; }
  function list(value) { var items = object(value); return Array.isArray(items) ? items : []; }
  function uniqueText(values) { return values.filter(function (value, index) { return value && values.indexOf(value) === index; }); }
  function imageFile(value) { var path = text(value); return path.startsWith('/') ? path : '/assets/images/noticias/' + path; }
  function linkUrl(value) {
    var url = text(value);
    if (/[\s\\\u0000-\u001f]/.test(url)) return '';
    if (/^#[a-zA-Z0-9_-]+$/.test(url) || /^\/asociacion\/(?:#[a-zA-Z0-9_-]+)?$/.test(url) || /^\/(?:noticias|experiencias)\/(?:[a-z0-9-]+\/)?(?:#[a-zA-Z0-9_-]+)?$/.test(url) || /^\/#(?:[a-zA-Z0-9_-]+)$/.test(url) || url === '/') return url;
    try { var parsed = new URL(url); return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? parsed.href : ''; } catch (error) { return ''; }
  }
  function linkedLabel(item) { return item.url ? h('a', { href: item.url, rel: 'noopener noreferrer' }, item.label) : item.label; }
  function validDate(value, partial) {
    var date = text(value);
    if (partial && /^\d{4}$/.test(date)) return true;
    if (partial && /^\d{4}-(0[1-9]|1[0-2])$/.test(date)) return true;
    if (!/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(date) || Number.isNaN(Date.parse(date))) return false;
    return new Date(date.slice(0, 10) + 'T12:00:00Z').toISOString().slice(0, 10) === date.slice(0, 10);
  }
  function showDate(value) {
    var date = text(value);
    if (/^\d{4}$/.test(date)) return date;
    if (/^\d{4}-\d{2}$/.test(date)) return new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(date + '-01T12:00:00Z'));
    return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(date.slice(0, 10) + 'T12:00:00Z'));
  }
  var Preview = window.createClass({
    render: function () {
      var entry = this.props.entry;
      var get = function (field) { return entry.getIn(['data', field]); };
      var collection = text(entry.get('collection'));
      var isExperience = collection === 'experiencias' || Boolean(get('initiative'));
      var isInstitutional = collection === 'institucional' || collection === 'asociacion';
      var issues = [];
      var self = this;
      var excerpt = text(get('excerpt'));
      var body = text(get('body'));
      var context = isExperience ? text(get('context')) : '';
      ['title', 'excerpt', 'body'].forEach(function (field) {
        if (!text(get(field))) issues.push('Completa ' + ({ title: 'el título', excerpt: 'el resumen', body: 'el relato' }[field]) + '.');
      });
      if (isExperience) {
        if (!text(get('id')) || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(text(get('id')))) issues.push('El identificador necesita letras minúsculas sin tildes, números y guiones.');
        if (!text(get('initiative'))) issues.push('Indica la iniciativa documentada.');
        if (get('status') === 'published' && get('reviewed') !== true) issues.push('Marca la revisión documental antes de publicar la ficha.');
      }
      if (isExperience || isInstitutional) {
        if (!text(get('source'))) issues.push('Identifica la fuente documental.');
        if (!validDate(get('reviewed_at'), false)) issues.push('Completa una fecha de revisión documental válida.');
      } else if (!validDate(get('date'), false)) issues.push('Completa una fecha de publicación válida.');
      var dates = [];
      [['date', get('historical') === true ? 'Publicación original' : 'Publicación', false], ['event_date', isExperience ? text(get('event_label')) || 'Fecha documentada' : 'Evento documentado', isExperience], ['source_date', 'Fecha de la fuente', true], ['updated_at', 'Actualización', false]].forEach(function (item) {
        var value = get(item[0]);
        if (!text(value)) return;
        if (!validDate(value, item[2])) issues.push('Revisa la fecha del campo «' + item[1] + '». No completes el día o el mes por suposición.');
        else dates.push(h('p', { key: item[0], className: 'afnemo-preview-meta' }, item[1] + ': ', h('time', { dateTime: text(value) }, showDate(value))));
      });
      var period = isExperience ? text(get('period')) : '';
      var locationType = text(get('location_type')) || (get('public_precision') && get('public_precision') !== 'none' ? 'territorial' : 'unpublished');
      var locationLabels = { exact: 'Exacta', approximate: 'Aproximada', territorial: 'Únicamente territorial', unpublished: 'No publicada' };
      if (isExperience && !locationLabels[locationType]) issues.push('Elige un tipo de ubicación válido.');
      var territory = locationType !== 'unpublished' ? uniqueText(['territory', 'municipality', 'department', 'country'].map(function (field) { return text(get(field)); })).join(' · ') : '';
      function makeImage(value, key, label) {
        var record = object(value);
        var imagePath = text(record.image);
        var alt = text(record.image_alt);
        var credit = text(record.image_credit);
        if (!imagePath) return null;
        if (record.image_authorized !== true) { issues.push(label + ': falta confirmar el permiso de publicación. No guardes material sin autorización en la biblioteca.'); return null; }
        if (!alt || !credit) { issues.push(label + ': completa la descripción accesible y el crédito.'); return null; }
        var normalizedPath = imageFile(imagePath);
        if (!/^\/assets\/images\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.(png|jpe?g|webp|avif)$/i.test(normalizedPath) || normalizedPath.includes('..')) { issues.push(label + ': usa una imagen JPG, PNG, WebP o AVIF de la biblioteca, sin espacios ni tildes.'); return null; }
        try {
          var asset = self.props.getAsset(imagePath);
          var source = asset && (asset.url || String(asset));
          if (source && /^(\/[^/]|blob:|data:image\/(png|jpeg|webp|avif);|https:\/\/)/i.test(source)) return h('figure', { key: key }, h('img', { src: source, alt: alt }), h('figcaption', {}, credit));
          issues.push(label + ': el archivo todavía no está disponible en la vista previa.');
        } catch (error) { issues.push(label + ': no se pudo previsualizar el archivo seleccionado.'); }
        return null;
      }
      var image = makeImage({ image: get('image'), image_authorized: get('image_authorized'), image_alt: get('image_alt'), image_credit: get('image_credit') }, 'principal', 'Imagen principal');
      var seenImages = image ? [imageFile(get('image'))] : [];
      var gallery = isExperience ? list(get('gallery')).map(function (value, index) {
        var record = object(value);
        var imagePath = imageFile(record.image);
        if (seenImages.indexOf(imagePath) !== -1) return null;
        var figure = makeImage(record, 'gallery-' + index, 'Fotografía ' + (index + 1));
        if (figure) seenImages.push(imagePath);
        return figure;
      }).filter(Boolean) : [];
      function links(field, optionalUrl) {
        var seen = [];
        return list(get(field)).map(function (value, index) {
          var record = object(value);
          var label = text(record.label);
          var url = linkUrl(record.url);
          if (!label || ((!optionalUrl || text(record.url)) && !url)) { issues.push('Revisa el título y el enlace de ' + field + ' (' + (index + 1) + '). Usa un enlace HTTPS o una página local.'); return null; }
          var key = url || label;
          if (seen.indexOf(key) !== -1) return null;
          seen.push(key);
          return { label: label, url: url, credit: text(record.credit) };
        }).filter(Boolean);
      }
      var videos = isExperience ? links('videos', false) : [];
      var related = isExperience ? object(get('related_initiative')) : {};
      var relatedUrl = linkUrl(related.url);
      if ((text(related.label) || text(related.url)) && (!text(related.label) || !relatedUrl)) issues.push('La iniciativa relacionada necesita un nombre y un enlace público válido.');
      var materials = isExperience ? links('materials', false).filter(function (item) { return !videos.some(function (video) { return video.url === item.url; }) && item.url !== relatedUrl; }) : [];
      var source = text(get('source'));
      var sources = isExperience ? links('sources', true).filter(function (item) { return item.label !== source; }) : [];
      var milestones = isExperience ? list(get('milestones')).map(function (value, index) {
        var record = object(value);
        if (!text(record.label) || !validDate(record.date, true)) { issues.push('Revisa el título y la fecha del hito ' + (index + 1) + '.'); return null; }
        return { label: text(record.label), date: text(record.date), description: text(record.description) };
      }).filter(Boolean).sort(function (a, b) { return a.date.localeCompare(b.date); }) : [];
      var singleMilestone = null;
      if (milestones.length === 1) {
        var milestone = milestones[0];
        var sameHeader = !text(get('event_date')) || (milestone.date === text(get('event_date')) && milestone.label === (text(get('event_label')) || 'Fecha documentada'));
        if (!text(get('event_date'))) {
          dates.push(h('p', { key: 'single-milestone', className: 'afnemo-preview-meta' }, milestone.label + ': ', h('time', { dateTime: milestone.date }, showDate(milestone.date))));
        }
        if (!sameHeader) singleMilestone = h('p', { className: 'afnemo-preview-meta' }, milestone.label + ': ', h('time', { dateTime: milestone.date }, showDate(milestone.date)), milestone.description ? ' · ' + milestone.description : null);
        else if (milestone.description) singleMilestone = h('p', {}, milestone.description);
      }
      if (period && period !== text(get('event_date')) && !(milestones.length === 1 && !text(get('event_date')) && period === milestones[0].date)) dates.unshift(h('p', { key: 'period', className: 'afnemo-preview-meta' }, 'Periodo documentado: ' + period));
      function linkSection(title, items) {
        return items.length ? h('section', {}, h('h2', {}, title), h('ul', {}, items.map(function (item, index) { return h('li', { key: index }, linkedLabel(item), item.credit ? h('p', { className: 'afnemo-preview-meta' }, item.credit) : null); }))) : null;
      }
      var published = isExperience ? get('status') === 'published' && get('reviewed') === true : get('published') === true;
      return h('article', { className: 'afnemo-preview' },
        h('aside', { className: 'afnemo-preview-notice' },
          h('strong', {}, 'Vista previa de tu entrada'),
          h('p', {}, 'Esta vista no guarda ni publica. Comprueba la versión generada después de guardar en el editor.'),
          h('a', { href: '/admin/guia.html', target: '_blank', rel: 'noopener noreferrer' }, 'Consultar la guía para publicar ↗')
        ),
        h('p', { className: 'afnemo-preview-meta' }, published ? 'Seleccionada para mostrarse después de guardar y generar el sitio.' : 'Borrador: no se mostrará en el sitio generado. El contenido guardado sigue en un repositorio público.'),
        issues.length ? h('aside', { className: 'afnemo-preview-checks' }, h('h2', {}, 'Antes de guardar, revisa…'), h('ul', {}, issues.map(function (issue, index) { return h('li', { key: index }, issue); }))) : null,
        h('h1', {}, text(get('title')) || 'Tu título aparecerá aquí'),
        isExperience && territory ? h('p', { className: 'afnemo-preview-meta' }, 'Territorio público: ' + territory) : null,
        isExperience && territory && locationLabels[locationType] ? h('p', { className: 'afnemo-preview-meta' }, 'Tipo de ubicación: ' + locationLabels[locationType]) : null,
        isExperience && text(get('initiative')) && text(get('initiative')) !== text(get('title')) ? h('p', { className: 'afnemo-preview-meta' }, 'Iniciativa: ' + text(get('initiative'))) : null,
        dates,
        excerpt && excerpt !== body ? h('p', { className: 'afnemo-preview-lead' }, excerpt) : null,
        image,
        context && context !== excerpt && context !== body ? h('section', {}, h('h2', {}, 'Contexto territorial'), h('p', { className: 'afnemo-preview-context' }, context)) : null,
        body ? h('div', { className: 'afnemo-preview-body' }, this.props.widgetFor('body')) : null,
        singleMilestone,
        milestones.length > 1 ? h('section', {}, h('h2', {}, 'Hitos documentados'), h('ol', { className: 'afnemo-preview-milestones' }, milestones.map(function (milestone, index) { return h('li', { key: index }, h('time', { dateTime: milestone.date }, showDate(milestone.date)), h('h3', {}, milestone.label), milestone.description ? h('p', {}, milestone.description) : null); }))) : null,
        gallery.length ? h('section', {}, h('h2', {}, 'Fotografías'), h('div', { className: 'afnemo-preview-gallery' }, gallery)) : null,
        linkSection('Videos', videos),
        linkSection('Materiales relacionados', materials),
        text(related.label) && relatedUrl ? h('section', {}, h('h2', {}, 'Iniciativa relacionada'), h('p', {}, linkedLabel({ label: text(related.label), url: relatedUrl }))) : null,
        source || sources.length ? h('aside', {}, h('h2', {}, 'Fuentes documentales'), source ? h('p', {}, source) : null, sources.length ? h('ul', {}, sources.map(function (item, index) { return h('li', { key: index }, linkedLabel(item)); })) : null) : null,
        validDate(get('reviewed_at'), false) ? h('p', { className: 'afnemo-preview-meta' }, 'Revisión documental: ', h('time', { dateTime: text(get('reviewed_at')) }, showDate(get('reviewed_at')))) : null,
        isExperience || isInstitutional ? h('p', { className: 'afnemo-preview-notice' }, 'La revisión documental no confirma actividad, servicios, contactos o alianzas actuales.') : null
      );
    }
  });
  window.CMS.registerPreviewStyle('/admin/guia.css');
  window.CMS.registerPreviewTemplate('noticias', Preview);
  window.CMS.registerPreviewTemplate('experiencias', Preview);
  window.CMS.registerPreviewTemplate('institucional', Preview);
  window.CMS.registerPreviewTemplate('asociacion', Preview);
})();
