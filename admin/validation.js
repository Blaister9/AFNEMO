/* Local editorial checks. The build remains the authority for public content.
 * Decap preSave runs before entry persistence and reports thrown errors in the UI.
 * https://decapcms.org/docs/registering-events/
 * Uploading directly to the media library is a separate, immediate operation.
 */
(function () {
  'use strict';
  function text(value) { return typeof value === 'string' ? value.trim() : ''; }
  function plain(value) { return value && typeof value.toJS === 'function' ? value.toJS() : value; }
  function validDate(value, partial) {
    if (typeof value !== 'string') return false;
    if (partial && /^\d{4}(?:-(?:0[1-9]|1[0-2]))?$/.test(value)) return true;
    if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) || Number.isNaN(Date.parse(value))) return false;
    return new Date(value.slice(0, 10) + 'T12:00:00Z').toISOString().slice(0, 10) === value.slice(0, 10);
  }
  function imagePath(value) {
    if (typeof value !== 'string' || /[\s\\\u0000-\u001f]/.test(value)) return '';
    var path = value.startsWith('/') ? value : '/assets/images/noticias/' + value;
    return /^\/assets\/images\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.(?:png|jpe?g|webp|avif)$/i.test(path) && !path.includes('..') ? path : '';
  }
  function linkUrl(value) {
    if (typeof value !== 'string' || /[\s\\\u0000-\u001f]/.test(value)) return '';
    if (/^#[a-zA-Z0-9_-]+$/.test(value) || /^\/asociacion\/(?:#[a-zA-Z0-9_-]+)?$/.test(value) || /^\/(?:noticias|experiencias)\/(?:[a-z0-9-]+\/)?(?:#[a-zA-Z0-9_-]+)?$/.test(value) || /^\/#(?:[a-zA-Z0-9_-]+)$/.test(value) || value === '/') return value;
    try { var parsed = new URL(value); return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? parsed.href : ''; } catch (error) { return ''; }
  }
  function validate(collection, value) {
    if (['noticias', 'experiencias', 'institucional', 'asociacion'].indexOf(collection) === -1) return [];
    var data = plain(value) || {};
    var issues = [];
    var isExperience = collection === 'experiencias';
    function required(field, label, record) {
      if (!text((record || data)[field])) issues.push('Completa ' + label + '.');
    }
    function date(field, label, partial, mandatory) {
      if ((mandatory || data[field] != null && data[field] !== '') && !validDate(data[field], partial)) issues.push(label + ': escribe una fecha que exista, respetando la precisión documentada.');
    }
    function list(field, label, check) {
      var items = plain(data[field]);
      if (items == null) return;
      if (!Array.isArray(items)) { issues.push(label + ': usa la lista del formulario.'); return; }
      items.forEach(function (value, index) {
        var item = plain(value);
        var itemLabel = label + ' ' + (index + 1);
        if (!item || typeof item !== 'object' || Array.isArray(item)) issues.push(itemLabel + ': completa los campos.');
        else check(item, itemLabel);
      });
    }
    function image(record, label, mandatory) {
      if (!text(record.image)) { if (mandatory) issues.push(label + ': elige una fotografía.'); return; }
      if (!imagePath(record.image)) issues.push(label + ': elige una imagen JPG, PNG, WebP o AVIF de la biblioteca, sin espacios ni tildes.');
      if (record.image_authorized !== true) issues.push(label + ': confirma el permiso de publicación antes de guardar.');
      required('image_alt', 'la descripción accesible de ' + label.toLowerCase(), record);
      required('image_credit', 'el crédito y la autorización de ' + label.toLowerCase(), record);
    }
    function link(record, label, optional) {
      required('label', 'el título de ' + label.toLowerCase(), record);
      if ((!optional || record.url != null && record.url !== '') && !linkUrl(record.url)) issues.push(label + ': usa un enlace HTTPS sin credenciales o una página local válida del sitio.');
    }
    required('title', 'el título');
    required('excerpt', 'el resumen');
    required('body', 'el relato');
    if (collection === 'noticias') {
      date('date', 'Fecha de publicación', false, true);
      date('event_date', 'Fecha del evento', false, false);
      date('updated_at', 'Actualización', false, false);
      date('source_date', 'Fecha de la fuente', true, false);
    } else {
      required('source', 'la fuente documental');
      date('reviewed_at', 'Fecha de revisión documental', false, true);
    }
    if (collection === 'noticias' || isExperience) image(data, 'Imagen principal', false);
    if (isExperience) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(text(data.id))) issues.push('Nombre corto del enlace: usa minúsculas sin tildes, números y guiones.');
      required('initiative', 'la iniciativa documentada');
      if (['draft', 'published'].indexOf(data.status) === -1) issues.push('Elige Borrador o Publicado en Estado editorial.');
      if (data.status === 'published' && data.reviewed !== true) issues.push('Confirma la revisión documental antes de publicar la experiencia.');
      if (data.location_type && ['exact', 'approximate', 'territorial', 'unpublished'].indexOf(data.location_type) === -1) issues.push('Elige un tipo de ubicación de la lista.');
      date('event_date', 'Fecha documentada', true, false);
      list('milestones', 'Hito', function (item, label) {
        required('label', 'el nombre de ' + label.toLowerCase(), item);
        if (!validDate(item.date, true)) issues.push(label + ': escribe una fecha que exista, sin inventar el día o el mes.');
      });
      list('gallery', 'Fotografía', function (item, label) { image(item, label, true); });
      list('sources', 'Fuente', function (item, label) { link(item, label, true); });
      list('materials', 'Material', function (item, label) { link(item, label, false); });
      list('videos', 'Video', function (item, label) { link(item, label, false); });
      var related = plain(data.related_initiative);
      if (related != null) {
        if (!related || typeof related !== 'object' || Array.isArray(related)) issues.push('Iniciativa relacionada: completa el nombre y el enlace.');
        else if (Object.keys(related).some(function (key) { return text(related[key]); })) link(related, 'Iniciativa relacionada', false);
      }
    }
    return issues;
  }
  window.AfnemoEditorial = { validate: validate, validDate: validDate, imagePath: imagePath, linkUrl: linkUrl };
  if (!window.CMS || !window.CMS.registerEventListener) return;
  window.CMS.registerEventListener({
    name: 'preSave',
    handler: function (event) {
      var entry = event.entry;
      var data = entry.get('data');
      var issues = validate(entry.get('collection'), data);
      if (issues.length) throw new Error('Antes de guardar: ' + issues.join(' '));
      return data;
    }
  });
})();
