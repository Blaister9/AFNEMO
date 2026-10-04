/* ============================================
   AFNEMO - animations.js
   IntersectionObserver scroll animations,
   counter animations, chatbot widget
   ============================================ */

(function () {
  'use strict';

  function initAnimations() {
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reducedMotion.matches || typeof window.IntersectionObserver !== 'function') return;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          if (!reducedMotion.matches) entry.target.style.animation = 'fadeUp 0.6s ease';
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    // Content stays visible even if the observer never delivers an entry.
    document.querySelectorAll('.stat-item, .program-card, .news-card').forEach(function (el) {
      observer.observe(el);
    });
  }

  // ─── Chatbot ───
  // Existing provider and request contract are deliberately preserved.
  var WORKER_URL = 'https://summer-wildflower-8156.santiagopazbedoya.workers.dev';

  var SYSTEM_PROMPT = 'Eres Neftalí, el asistente virtual especializado de AFNEMO (Asociación Afrocultural Neftalí Mosquera).\n\n' +
    'IDIOMA: Responde SIEMPRE en español, sin excepción, sin importar en qué idioma te escriban.\n\n' +
    'TU ESPECIALIDAD: Eres experto en el marco jurídico y normativo afrocolombiano. Conoces a profundidad:\n' +
    '- Ley 70 de 1993 (derechos de comunidades negras, territorios colectivos, identidad cultural)\n' +
    '- Decreto 1745 de 1995 (titulación colectiva de tierras)\n' +
    '- Decreto 804 de 1995 (etnoeducación afrocolombiana)\n' +
    '- Artículos 7, 13, 55 transitorio de la Constitución Política de Colombia\n' +
    '- Convenio 169 de la OIT (pueblos indígenas y tribales)\n' +
    '- Política pública para comunidades negras, afrocolombianas, raizales y palenqueras\n' +
    '- Decreto 1066 de 2015 (sector interior, comunidades étnicas)\n' +
    '- Ley 1482 de 2011 (antidiscriminación)\n' +
    '- Autos y sentencias de la Corte Constitucional sobre derechos afro\n' +
    '- Programas y misión de AFNEMO\n\n' +
    'COMPORTAMIENTO:\n' +
    '- Responde SIEMPRE en español sin importar el idioma del usuario\n' +
    '- Si te preguntan algo fuera de tu especialidad, di: "Ese tema está fuera de mi especialidad. Soy Neftalí, asistente especializado en derechos y normativa afrocolombiana. ¿Te puedo ayudar con alguna ley, decreto o programa de AFNEMO?"\n' +
    '- Si recibes texto sin sentido o sin pregunta clara, pide amablemente que reformulen su consulta\n' +
    '- Respuestas claras y precisas, máximo 4 oraciones salvo que pidan más detalle\n' +
    '- Cita siempre el artículo o decreto específico cuando sea relevante\n' +
    '- FORMATO: Nunca uses markdown (sin #, sin **, sin ---, sin tablas con |). Escribe en texto plano con saltos de línea simples. Usa emojis para organizar si es necesario y bullets point.';

  var chatHistory = [];
  var chatOpen = false;
  var welcomeShown = false;
  var requestPending = false;
  var REQUEST_TIMEOUT_MS = 20000;

  function initChatbot() {
    var bubble = document.getElementById('chat-bubble');
    var closeBtn = document.getElementById('chat-close');
    var sendBtn = document.getElementById('chat-send');
    var chatInput = document.getElementById('chat-input');
    var win = document.getElementById('chat-window');
    var messages = document.getElementById('chat-messages');
    if (!bubble || !closeBtn || !sendBtn || !chatInput || !win || !messages) return;

    bubble.hidden = false;
    bubble.type = closeBtn.type = sendBtn.type = 'button';
    bubble.setAttribute('aria-label', 'Abrir asistente Neftalí');
    bubble.setAttribute('aria-controls', 'chat-window');
    bubble.setAttribute('aria-expanded', 'false');
    closeBtn.setAttribute('aria-label', 'Cerrar asistente');
    sendBtn.setAttribute('aria-label', 'Enviar mensaje');
    chatInput.setAttribute('aria-label', 'Mensaje para Neftalí');
    chatInput.maxLength = 2000;
    win.setAttribute('role', 'dialog');
    win.setAttribute('aria-label', 'Asistente virtual Neftalí');
    win.hidden = true;
    win.classList.remove('open');
    messages.setAttribute('role', 'log');
    messages.setAttribute('aria-live', 'polite');
    messages.setAttribute('aria-relevant', 'additions text');
    messages.setAttribute('aria-label', 'Conversación con Neftalí');
    setStatus('Asistente automatizado');

    bubble.addEventListener('click', toggleChat);
    closeBtn.addEventListener('click', function () { closeChat(true); });
    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keydown', handleKey);
    win.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeChat(true);
      }
    });
    document.addEventListener('afnemo:menuopen', function () { closeChat(false); });
  }

  function setStatus(text) {
    var status = document.querySelector('.chat-header-info > span');
    if (status) {
      status.setAttribute('role', 'status');
      status.textContent = text;
    }
  }

  function closeChat(restoreFocus) {
    var win = document.getElementById('chat-window');
    if (!win) return;
    chatOpen = false;
    win.hidden = true;
    win.classList.remove('open');
    var bubble = document.getElementById('chat-bubble');
    if (bubble) {
      bubble.setAttribute('aria-expanded', 'false');
      bubble.setAttribute('aria-label', 'Abrir asistente Neftalí');
      if (restoreFocus) bubble.focus();
    }
  }

  function toggleChat() {
    if (chatOpen) return closeChat(true);
    var win = document.getElementById('chat-window');
    if (!win) return;
    chatOpen = true;
    win.hidden = false;
    win.classList.add('open');
    var bubble = document.getElementById('chat-bubble');
    if (bubble) {
      bubble.setAttribute('aria-expanded', 'true');
      bubble.setAttribute('aria-label', 'Cerrar asistente Neftalí');
    }
    if (!welcomeShown) {
      welcomeShown = true;
      appendMessage('bot', '¡Hola! Soy Neftalí, el asistente automatizado de AFNEMO. Puedo ofrecer orientación general sobre la asociación y derechos afrocolombianos. Mis respuestas pueden contener errores; confirma los datos y servicios vigentes con la organización. No compartas información personal sensible.');
    }
    var input = document.getElementById('chat-input');
    if (input) input.focus();
  }

  function appendMessage(role, text) {
    var msgs = document.getElementById('chat-messages');
    if (!msgs) return;
    var div = document.createElement('div');
    div.className = 'chat-msg ' + role;
    var avatar = document.createElement('div');
    avatar.className = 'chat-msg-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = role === 'bot' ? '🌍' : '👤';
    var message = document.createElement('div');
    message.className = 'chat-msg-bubble';
    // Treat both user input and remote replies as untrusted plain text.
    message.textContent = text;
    div.append(avatar, message);
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function showTyping() {
    var msgs = document.getElementById('chat-messages');
    if (!msgs) return;
    var div = document.createElement('div');
    div.className = 'chat-msg bot';
    div.id = 'typing-indicator';
    var message = document.createElement('div');
    message.className = 'chat-msg-bubble';
    message.textContent = 'Consultando al asistente…';
    div.appendChild(message);
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function removeTyping() {
    var t = document.getElementById('typing-indicator');
    if (t) t.remove();
  }

  async function sendMessage() {
    var input = document.getElementById('chat-input');
    var sendBtn = document.getElementById('chat-send');
    if (!input || requestPending) return;
    var text = input.value.trim();
    if (!text) return;

    requestPending = true;
    input.value = '';
    if (sendBtn) sendBtn.disabled = true;
    appendMessage('user', text);
    var userMessage = { role: 'user', content: text };
    chatHistory.push(userMessage);
    setStatus('Consultando…');
    showTyping();
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, REQUEST_TIMEOUT_MS);

    try {
      var res = await fetch(WORKER_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: chatHistory.slice(-10),
          system: SYSTEM_PROMPT
        })
      });

      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      if (!data || typeof data.reply !== 'string' || !data.reply.trim()) throw new Error('Invalid reply');
      removeTyping();
      appendMessage('bot', data.reply);
      chatHistory.push({ role: 'assistant', content: data.reply });
      setStatus('Asistente automatizado');
    } catch (err) {
      removeTyping();
      chatHistory = chatHistory.filter(function (message) { return message !== userMessage; });
      appendMessage('bot', controller.signal.aborted
        ? 'La consulta tardó demasiado y se canceló. Puedes volver a enviar el mensaje.'
        : 'No fue posible obtener una respuesta del asistente. Puedes volver a intentarlo más tarde.');
      setStatus('Respuesta no disponible');
      // Restore the failed message unless the user has already written another.
      if (!input.value) input.value = text;
    } finally {
      clearTimeout(timeout);
      requestPending = false;
      if (sendBtn) sendBtn.disabled = false;
    }
    // A reply never moves focus: the user may have closed the chat or left it.
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      sendMessage();
    }
  }

  function init() {
    initAnimations();
    initChatbot();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
