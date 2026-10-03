/* Progressive filters: the complete accessible list is rendered at build time. */
(function () {
  'use strict';
  var form = document.getElementById('experience-filters');
  if (!form) return;
  var cards = Array.from(document.querySelectorAll('[data-experience]'));
  var count = document.getElementById('experience-count');
  var empty = document.getElementById('experience-empty');
  function fold(value) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  function value(name) { return form.elements[name] ? form.elements[name].value : ''; }
  function readUrl() {
    var params = new URLSearchParams(window.location.search);
    ['q', 'initiative', 'territory'].forEach(function (name) { if (form.elements[name]) form.elements[name].value = params.get(name) || ''; });
  }
  function filter(updateUrl) {
    var query = value('q').trim();
    var initiative = value('initiative');
    var territory = value('territory');
    var visible = 0;
    cards.forEach(function (card) {
      card.hidden = !((!query || fold(card.dataset.title).includes(fold(query))) &&
        (!initiative || card.dataset.initiative === initiative) && (!territory || card.dataset.territory === territory));
      if (!card.hidden) visible++;
    });
    count.textContent = visible + (visible === 1 ? ' experiencia' : ' experiencias');
    empty.hidden = visible !== 0;
    if (updateUrl) {
      var url = new URL(window.location.href);
      [['q', query], ['initiative', initiative], ['territory', territory]].forEach(function (item) { if (item[1]) url.searchParams.set(item[0], item[1]); else url.searchParams.delete(item[0]); });
      window.history.replaceState(null, '', url);
    }
  }
  form.hidden = false;
  readUrl();
  filter(false);
  form.addEventListener('submit', function (event) { event.preventDefault(); filter(true); });
  form.addEventListener('input', function () { filter(true); });
  form.addEventListener('change', function () { filter(true); });
  form.addEventListener('reset', function () { setTimeout(function () { filter(true); }, 0); });
  window.addEventListener('popstate', function () { readUrl(); filter(false); });
})();
