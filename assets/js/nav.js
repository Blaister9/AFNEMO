/* AFNEMO: navigation progressively enhanced with an accessible mobile dialog. */
(function () {
  'use strict';

  function init() {
    var nav = document.getElementById('mainNav');
    var links = nav && nav.querySelector('.nav-links');
    if (!nav || !links) return;

    function updateScroll() {
      nav.classList.toggle('scrolled', window.scrollY > 100);
    }
    updateScroll();
    window.addEventListener('scroll', updateScroll, { passive: true });

    var hamburger = document.createElement('button');
    hamburger.type = 'button';
    hamburger.className = 'nav-hamburger';
    hamburger.setAttribute('aria-label', 'Abrir menú');
    hamburger.setAttribute('aria-expanded', 'false');
    hamburger.setAttribute('aria-controls', 'mobile-navigation');
    hamburger.setAttribute('aria-haspopup', 'dialog');
    for (var i = 0; i < 3; i += 1) {
      var bar = document.createElement('span');
      bar.setAttribute('aria-hidden', 'true');
      hamburger.appendChild(bar);
    }
    nav.appendChild(hamburger);

    var mobileMenu = document.createElement('div');
    mobileMenu.id = 'mobile-navigation';
    mobileMenu.className = 'nav-mobile-menu';
    mobileMenu.hidden = true;
    mobileMenu.setAttribute('role', 'dialog');
    mobileMenu.setAttribute('aria-modal', 'true');
    mobileMenu.setAttribute('aria-label', 'Menú principal');

    var closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'nav-mobile-close';
    closeButton.setAttribute('aria-label', 'Cerrar menú');
    closeButton.textContent = 'Cerrar ✕';
    mobileMenu.appendChild(closeButton);

    // The desktop list remains the single source for destinations and labels.
    var mobileLinks = links.cloneNode(true);
    mobileLinks.className = 'nav-mobile-links';
    mobileLinks.removeAttribute('id');
    mobileLinks.querySelectorAll('[id]').forEach(function (element) { element.removeAttribute('id'); });
    mobileMenu.appendChild(mobileLinks);
    document.body.appendChild(mobileMenu);
    nav.classList.add('nav-enhanced');

    var open = false;
    var previousOverflow = '';
    var inertElements = [];
    var mobileViewport = window.matchMedia('(max-width: 1180px)');

    function setOpen(nextOpen, restoreFocus) {
      if (open === nextOpen) return;
      open = nextOpen;
      hamburger.setAttribute('aria-expanded', String(open));
      hamburger.classList.toggle('open', open);
      hamburger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      mobileMenu.hidden = !open;
      mobileMenu.classList.toggle('open', open);
      document.body.classList.toggle('mobile-menu-open', open);

      if (open) {
        document.dispatchEvent(new CustomEvent('afnemo:menuopen'));
        previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        inertElements = Array.from(document.body.children).filter(function (element) {
          return element !== mobileMenu && !element.inert;
        });
        inertElements.forEach(function (element) { element.inert = true; });
        closeButton.focus();
      } else {
        document.body.style.overflow = previousOverflow;
        inertElements.forEach(function (element) { element.inert = false; });
        inertElements = [];
        if (restoreFocus) {
          var target = mobileViewport.matches ? hamburger : links.querySelector('a');
          if (target) target.focus();
        }
      }
    }

    hamburger.addEventListener('click', function () { setOpen(!open, true); });
    closeButton.addEventListener('click', function () { setOpen(false, true); });
    mobileMenu.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false, true);
      } else if (event.key === 'Tab') {
        var focusable = Array.from(mobileMenu.querySelectorAll('a[href], button:not([disabled])'));
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });
    mobileLinks.addEventListener('click', function (event) {
      var link = event.target.closest('a[href]');
      if (!link) return;
      setOpen(false, false);
      var href = link.getAttribute('href');
      var target = href.charAt(0) === '#' && document.getElementById(href.slice(1));
      if (target) {
        var hadTabindex = target.hasAttribute('tabindex');
        if (!hadTabindex) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
        if (!hadTabindex) target.addEventListener('blur', function () { target.removeAttribute('tabindex'); }, { once: true });
      } else {
        hamburger.focus();
      }
    });
    mobileViewport.addEventListener('change', function () {
      if (!mobileViewport.matches) setOpen(false, true);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
