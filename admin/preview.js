/* Decap preview reads the open editor entry, never main or a remote content feed. */
(function () {
  'use strict';
  if (!window.CMS || !window.createClass || !window.h) return;
  var Preview = window.createClass({
    render: function () {
      var entry = this.props.entry;
      var get = function (field) { return entry.getIn(['data', field]); };
      return window.h('article', { style: { fontFamily: 'sans-serif', lineHeight: 1.7, padding: '24px', color: '#1c0a00' } },
        window.h('p', { style: { background: '#fff2c4', padding: '12px' } }, 'Vista previa del contenido en edición. El sitio público se genera después de guardar y compilar. Borrador no significa privado: no incluyas materiales sin permiso.'),
        window.h('h1', {}, get('title') || 'Sin título'),
        window.h('p', {}, get('excerpt') || ''),
        get('initiative') ? window.h('p', {}, String(get('initiative')) + ' · ' + String(get('territory') || '')) : null,
        get('status') ? window.h('p', {}, 'Experiencia documentada. Su operación actual requiere validación institucional.') : null,
        this.props.widgetFor('body'),
        get('source') ? window.h('p', {}, 'Fuente: ' + String(get('source'))) : null
      );
    }
  });
  window.CMS.registerPreviewTemplate('noticias', Preview);
  window.CMS.registerPreviewTemplate('experiencias', Preview);
})();
