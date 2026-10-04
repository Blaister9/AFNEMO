/* Browser regression checks. No real messages are sent to the chat provider.
 * NODE_PATH=<runtime node_modules> node tests/interactions.cjs
 * Serve the site first. Optional: AFNEMO_BASE_URL (default http://127.0.0.1:4173),
 * AFNEMO_EVIDENCE_DIR=<screenshots directory>.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const evidence = process.env.AFNEMO_EVIDENCE_DIR;

async function screenshot(page, name) {
  if (!evidence) return;
  fs.mkdirSync(evidence, { recursive: true });
  await page.screenshot({ path: path.join(evidence, name + '.png') });
}

(async () => {
  const origin = new URL(process.env.AFNEMO_BASE_URL || 'http://127.0.0.1:4173').origin;
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    let mode = 'reply';
    let requests = 0;
    let release;
    const payloads = [];
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === origin) return route.continue();
      if (url.hostname !== 'summer-wildflower-8156.santiagopazbedoya.workers.dev') return route.abort();
      requests += 1;
      payloads.push(route.request().postDataJSON());
      if (mode === 'network') return route.abort('failed');
      if (mode === 'hold') await new Promise(resolve => { release = resolve; });
      if (mode === 'timeout') return; // Aborted by the browser's AbortController.
      if (mode === 'http') return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ reply: 'No debe mostrarse' }) });
      if (mode === 'invalid') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reply: { html: '<img>' } }) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reply: '<img src=x onerror="window.replyInjected=true"> Respuesta de prueba' }) });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin, { waitUntil: 'domcontentloaded' });

    const hamburger = page.locator('.nav-hamburger');
    const menu = page.locator('#mobile-navigation');
    await hamburger.click();
    assert.equal(await hamburger.getAttribute('aria-expanded'), 'true');
    assert.equal(await page.locator('.nav-mobile-close').evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await menu.locator('a').last().evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('.nav-mobile-close').evaluate(el => el === document.activeElement), true);
    assert.equal(await page.locator('#chat-bubble').isVisible(), false);
    await screenshot(page, 'mobile-menu-390');
    await page.keyboard.press('Escape');
    assert.equal(await menu.isVisible(), false);
    assert.equal(await hamburger.evaluate(el => el === document.activeElement), true);
    await hamburger.click();
    await menu.locator('a[href="#programs"]').click();
    assert.equal(await menu.isVisible(), false);
    assert.equal(await page.locator('#programs').evaluate(el => el === document.activeElement), true);
    await hamburger.click();
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.waitForFunction(() => document.getElementById('mobile-navigation').hidden);
    assert.equal(await page.locator('body').evaluate(el => el.style.overflow), '');
    assert.equal(await page.locator('[inert]').count(), 0);
    assert.equal(await page.locator('#mainNav .nav-links a').first().evaluate(el => el === document.activeElement), true);
    console.log('PASS menu: cloned links, dialog focus, keyboard loop, Escape, link focus, resize cleanup');

    await page.setViewportSize({ width: 320, height: 568 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await hamburger.click();
    const close = page.locator('.nav-mobile-close');
    assert.equal(await close.evaluate(el => { const r = el.getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === el; }), true);
    await close.click();
    assert.equal(await menu.isVisible(), false);
    assert.equal(await page.locator('.hero-actions').evaluate(el => { const a = el.getBoundingClientRect(); const hero = el.closest('.hero').getBoundingClientRect(); return a.bottom <= hero.bottom && a.top >= hero.top; }), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await screenshot(page, 'mobile-home-320');
    console.log('PASS mobile 320px: close button on top, no horizontal overflow, hero actions inside section');

    await page.locator('#chat-bubble').click();
    assert.equal(await page.locator('#chat-input').evaluate(el => el === document.activeElement), true);
    assert.equal(await page.locator('.chat-header-info').innerText().then(text => text.includes('En línea')), false);
    const maliciousText = '<img src=x onerror="window.userInjected=true">';
    await page.locator('#chat-input').fill(maliciousText);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('.chat-msg.bot:last-child')?.textContent.includes('Respuesta de prueba'));
    assert.equal(await page.locator('#chat-messages img, #chat-messages script').count(), 0);
    assert.equal(await page.locator('.chat-msg.user .chat-msg-bubble').last().textContent(), maliciousText);
    assert.equal(await page.evaluate(() => Boolean(window.userInjected || window.replyInjected)), false);
    assert.equal(payloads[0].message, maliciousText);
    assert.equal(Array.isArray(payloads[0].history), true);
    assert.equal(typeof payloads[0].system, 'string');
    await screenshot(page, 'chat-text-safe-320');
    const chatRect = await page.locator('#chat-window').boundingBox();
    assert.ok(chatRect.x >= 0 && chatRect.x + chatRect.width <= 320 && chatRect.y >= 0 && chatRect.y + chatRect.height <= 568);
    console.log('PASS chat: input and provider HTML displayed as text, same provider/payload, viewport fit');

    mode = 'hold';
    const previousRequests = requests;
    await page.locator('#chat-input').fill('Primera consulta');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.getElementById('chat-send').disabled);
    await page.locator('#chat-input').fill('Borrador posterior');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    assert.equal(requests, previousRequests + 1);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#chat-window').isVisible(), false);
    assert.equal(await page.locator('#chat-bubble').evaluate(el => el === document.activeElement), true);
    mode = 'reply';
    release();
    await page.waitForFunction(() => !document.getElementById('chat-send').disabled);
    assert.equal(await page.locator('#chat-bubble').evaluate(el => el === document.activeElement), true);
    assert.equal(await page.locator('#chat-input').inputValue(), 'Borrador posterior');
    console.log('PASS chat concurrency: one request despite Enter twice; reply preserves focus and draft after close');

    await page.locator('#chat-bubble').click();
    for (const failure of ['http', 'network', 'invalid']) {
      mode = failure;
      await page.locator('#chat-input').fill('Prueba ' + failure);
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelector('.chat-msg:last-child')?.textContent.includes('No fue posible'));
      assert.equal(await page.locator('#chat-input').inputValue(), 'Prueba ' + failure);
      assert.equal(await page.locator('#chat-send').isEnabled(), true);
      assert.equal(await page.locator('#typing-indicator').count(), 0);
    }
    mode = 'timeout';
    // Advance only this page's 20 s request timer, keeping production timing unchanged.
    await page.clock.install();
    await page.locator('#chat-input').fill('Prueba timeout');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.getElementById('chat-send').disabled);
    await page.clock.fastForward(20001);
    await page.waitForFunction(() => document.querySelector('.chat-msg:last-child')?.textContent.includes('tardó demasiado'));
    assert.equal(await page.locator('#chat-send').isEnabled(), true);
    assert.equal(await page.locator('#typing-indicator').count(), 0);
    assert.equal(await page.locator('#chat-input').inputValue(), 'Prueba timeout');
    await screenshot(page, 'chat-timeout-320');
    console.log('PASS chat failures: HTTP 500, network failure, invalid reply, timeout, controls recover');
    assert.deepEqual(errors, []);

    const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 568 } });
    await noJs.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const fallback = await noJs.newPage();
    await fallback.goto(origin, { waitUntil: 'domcontentloaded' });
    assert.equal(await fallback.locator('#mainNav .nav-links').isVisible(), true);
    assert.equal(await fallback.locator('#mainNav .nav-links a[href="#programs"]').isVisible(), true);
    assert.equal(await fallback.locator('#chat-bubble').isVisible(), false);
    await screenshot(fallback, 'mobile-no-js-320');
    await noJs.close();

    const noObserver = await context.newPage();
    await noObserver.emulateMedia({ reducedMotion: 'no-preference' });
    await noObserver.addInitScript(() => { delete window.IntersectionObserver; });
    await noObserver.goto(origin, { waitUntil: 'domcontentloaded' });
    assert.equal(await noObserver.locator('#chat-bubble').isVisible(), true);
    assert.equal(await noObserver.locator('.program-card').first().evaluate(el => getComputedStyle(el).opacity), '1');
    await noObserver.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await noObserver.locator('.hero h1').evaluate(el => getComputedStyle(el).animationName), 'none');
    console.log('PASS progressive enhancement: navigation without JS; content and chat without IntersectionObserver; reduced motion');
    await context.close();
    console.log('All interaction checks passed. External services were mocked or blocked.');
  } finally {
    if (browser) await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
