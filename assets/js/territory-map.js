/* The external iframe has no health API. Its load event is never proof that the map works. */
(function () {
  'use strict';
  var region = document.getElementById('territory-map');
  if (!region) return;
  var frame = document.getElementById('map-frame');
  var intro = document.getElementById('map-intro');
  var open = document.getElementById('map-load');
  var retry = document.getElementById('map-retry');
  var close = document.getElementById('map-close');
  var status = document.getElementById('map-status');
  var timer;
  function state(value, message) {
    region.dataset.state = value;
    status.textContent = message;
  }
  function load() {
    clearTimeout(timer);
    state('loading', 'Abriendo el visor de Bogotá. Puedes seguir explorando las experiencias mientras carga.');
    intro.hidden = true;
    open.hidden = true;
    frame.hidden = false;
    retry.hidden = close.hidden = false;
    frame.src = frame.dataset.src;
    // Keep keyboard focus on an available control, outside the third-party document.
    close.focus({ preventScroll: true });
    timer = setTimeout(function () {
      state('delayed', 'El visor está tardando en responder. Puedes reintentarlo o seguir con las experiencias de AFNEMO.');
    }, 12000);
  }
  frame.addEventListener('load', function () {
    if (frame.hidden) return;
    clearTimeout(timer);
    state('opened', 'Si el visor no muestra el mapa, usa el enlace al portal o sigue con las experiencias de AFNEMO.');
  });
  frame.addEventListener('error', function () {
    if (frame.hidden) return;
    clearTimeout(timer);
    state('unavailable', 'No se pudo abrir el visor. Puedes reintentarlo o explorar las experiencias de AFNEMO.');
  });
  close.addEventListener('click', function () {
    clearTimeout(timer);
    frame.hidden = true;
    frame.removeAttribute('src');
    intro.hidden = false;
    open.hidden = false;
    retry.hidden = close.hidden = true;
    state('idle', 'Mapa cerrado. Las experiencias de AFNEMO siguen disponibles debajo.');
    open.focus({ preventScroll: true });
  });
  open.hidden = false;
  open.addEventListener('click', load);
  retry.addEventListener('click', load);
})();
