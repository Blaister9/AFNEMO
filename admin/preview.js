/* The preview reads the open entry. It does not save, publish or fetch main. */
(function () {
  'use strict';
  if (!window.CMS || !window.createClass || !window.h) return;
  var h = window.h;
  function text(value) { return value === null || value === undefined ? '' : String(value).trim(); }
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
      ['title', 'excerpt', 'body'].forEach(function (field) {
        if (!text(get(field))) issues.push('Completa ' + ({ title: 'el título', excerpt: 'el resumen', body: 'el relato' }[field]) + '.');
      });
      if (isExperience) {
        if (!text(get('id')) || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(text(get('id')))) issues.push('El identificador necesita letras minúsculas sin tildes, números y guiones.');
        if (!text(get('initiative')) || !text(get('territory'))) issues.push('Indica la iniciativa y su territorio documentado.');
        if (get('status') === 'published' && get('reviewed') !== true) issues.push('Marca la revisión documental antes de publicar la ficha.');
      }
      if (isExperience || isInstitutional) {
        if (!text(get('source'))) issues.push('Identifica la fuente documental.');
        if (!validDate(get('reviewed_at'), false)) issues.push('Completa una fecha de revisión documental válida.');
      } else if (!validDate(get('date'), false)) issues.push('Completa una fecha de publicación válida.');
      var dates = [];
      [['date', get('historical') === true ? 'Publicación original' : 'Publicación', false], ['event_date', 'Evento documentado', isExperience], ['source_date', 'Fecha de la fuente', true], ['updated_at', 'Actualización', false], ['reviewed_at', 'Revisión documental', false]].forEach(function (item) {
        var value = get(item[0]);
        if (!text(value)) return;
        if (!validDate(value, item[2])) issues.push('Revisa la fecha del campo «' + item[1] + '». No completes el día o el mes por suposición.');
        else dates.push(h('p', { key: item[0], className: 'afnemo-preview-meta' }, item[1] + ': ', h('time', { dateTime: text(value) }, showDate(value))));
      });
      var image = null;
      var imagePath = text(get('image'));
      var alt = text(get('image_alt'));
      var credit = text(get('image_credit'));
      if (imagePath) {
        if (get('image_authorized') !== true) issues.push('La imagen no aparecerá: falta confirmar su permiso de publicación. No guardes material sin autorización en la biblioteca.');
        else if (!alt || !credit) issues.push('La imagen autorizada necesita descripción accesible y crédito para publicarse.');
        else if (!/^\/?(?:assets\/images\/)?[a-zA-Z0-9_./-]+\.(png|jpe?g|webp|avif)$/i.test(imagePath) || imagePath.includes('..')) issues.push('Usa una imagen JPG, PNG, WebP o AVIF de la biblioteca, con nombre sin espacios ni tildes.');
        else {
          try {
            var asset = this.props.getAsset(imagePath);
            var source = asset && (asset.url || String(asset));
            if (source && /^(\/[^/]|blob:|data:image\/(png|jpeg|webp|avif);|https:\/\/)/i.test(source)) image = h('figure', {}, h('img', { src: source, alt: alt }), h('figcaption', {}, credit));
            else issues.push('La imagen todavía no está disponible en la vista previa. Comprueba el archivo seleccionado.');
          } catch (error) { issues.push('No se pudo previsualizar la imagen seleccionada. Comprueba el archivo.'); }
        }
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
        h('p', {}, text(get('excerpt'))),
        isExperience ? h('p', { className: 'afnemo-preview-meta' }, text(get('initiative')) + ' · ' + text(get('territory'))) : null,
        dates,
        isExperience || isInstitutional ? h('p', { className: 'afnemo-preview-notice' }, 'La revisión documental no confirma actividad, servicios, contactos o alianzas actuales.') : null,
        image,
        h('div', { className: 'afnemo-preview-body' }, this.props.widgetFor('body')),
        text(get('source')) ? h('aside', {}, h('h2', {}, 'Fuente documental'), h('p', {}, text(get('source')))) : null
      );
    }
  });
  window.CMS.registerPreviewStyle('/admin/guia.css');
  window.CMS.registerPreviewTemplate('noticias', Preview);
  window.CMS.registerPreviewTemplate('experiencias', Preview);
  window.CMS.registerPreviewTemplate('institucional', Preview);
  window.CMS.registerPreviewTemplate('asociacion', Preview);
})();
