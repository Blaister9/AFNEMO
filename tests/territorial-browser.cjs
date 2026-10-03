/* Territorial exploration is independent of the third-party ArcGIS resource.
 * External responses below are test fixtures, never a check of the remote service.
 * In particular an iframe load event cannot establish cross-origin map health.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('yaml');
const { chromium } = require('playwright');

const base = process.env.AFNEMO_BASE_URL || 'http://127.0.0.1:4173';
const origin = new URL(base).origin;
const evidence = process.env.AFNEMO_EVIDENCE || process.env.AFNEMO_EVIDENCE_DIR || path.resolve('test-results');
const mapUrl = 'https://mapas.gobiernobogota.gov.co/waportal/apps/mapviewer/index.html?webmap=a9e507d5218647efb0d83119272b7338';
const csp = fs.readFileSync('netlify.toml', 'utf8').match(/Content-Security-Policy = "([^"]+)"/)[1];
const captures = [];
const results = [];
fs.mkdirSync(evidence, { recursive: true });

async function capture(page, locator, filename) {
  await locator.scrollIntoViewIfNeeded();
  // A section can be taller than the viewport. Fixed page chrome would otherwise
  // be composited through its middle when Playwright captures the whole section.
  await locator.screenshot({ path: path.join(evidence, filename), style: '#mainNav, .skip-link, #chat-bubble { visibility: hidden !important; }' });
  captures.push(filename);
}

async function waitForCount(page, count) {
  await page.waitForFunction(expected => document.querySelectorAll('[data-experience]:not([hidden])').length === expected, count);
  assert.equal(await page.locator('[data-experience]:visible').count(), count);
}

async function assertKeyboardFocus(locator) {
  assert.equal(await locator.evaluate(element => element === document.activeElement), true, 'the expected control receives keyboard focus');
  assert.equal(await locator.evaluate(element => {
    const style = getComputedStyle(element);
    return (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== 'none';
  }), true, 'keyboard focus has a visible outline or shadow');
}

async function assertFilters(page, experiences) {
  const form = page.locator('#experience-filters');
  assert.equal(await form.isVisible(), true);
  for (const name of ['q', 'initiative', 'territory']) {
    const field = form.locator(`[name="${name}"]`);
    const id = await field.getAttribute('id');
    assert.ok((await form.locator(`label[for="${id}"]`).innerText()).trim(), `${name}: an explicit label`);
  }
  for (const name of ['initiative', 'territory']) {
    const options = await form.locator(`[name="${name}"] option`).evaluateAll(elements => elements.map(element => element.value).filter(Boolean));
    assert.deepEqual(options.sort(), [...new Set(experiences.map(record => record[name]))].sort(), `${name}: filters use documented data`);
    assert.ok(options.length > 1, `${name}: no empty or single-option filter`);
  }
  const query = form.locator('[name="q"]');
  await query.focus();
  await page.keyboard.type('catedra');
  await waitForCount(page, 1);
  assert.match(await page.locator('[data-experience]:visible').innerText(), /Cátedra/);
  assert.equal(new URL(page.url()).searchParams.get('q'), 'catedra');
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('inexistente-zz');
  await waitForCount(page, 0);
  assert.equal(await page.locator('#experience-empty').isVisible(), true);
  assert.match(await page.locator('#experience-empty').innerText(), /filtros|término/);
  assert.equal(await page.locator('#experience-count').getAttribute('role'), 'status');
  await page.keyboard.press('Tab');
  await assertKeyboardFocus(form.locator('[name="territory"]'));
  await page.keyboard.press('Tab');
  await assertKeyboardFocus(form.locator('[name="initiative"]'));
  await page.keyboard.press('Tab');
  await assertKeyboardFocus(form.locator('[type="reset"]'));
  await page.keyboard.press('Enter');
  await waitForCount(page, experiences.length);
  assert.equal(new URL(page.url()).search, '', 'keyboard reset clears persisted filters');

  // Select a meaningful territory using only the keyboard.
  const territory = form.locator('[name="territory"]');
  await territory.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  const chosen = await territory.inputValue();
  assert.ok(chosen, 'keyboard selection chooses a territory');
  await waitForCount(page, experiences.filter(record => record.territory === chosen).length);
  await page.reload({ waitUntil: 'domcontentloaded' });
  assert.equal(await territory.inputValue(), chosen, 'territory survives reload');
  await waitForCount(page, experiences.filter(record => record.territory === chosen).length);

  const destination = await page.locator('[data-experience]:visible a').first().getAttribute('href');
  const filteredUrl = page.url();
  await page.locator('[data-experience]:visible a').first().click();
  await page.reload({ waitUntil: 'domcontentloaded' });
  assert.equal(new URL(page.url()).pathname, destination);
  await page.goBack({ waitUntil: 'domcontentloaded' });
  assert.equal(page.url(), filteredUrl, 'browser Back restores the filtered exploration');
  await waitForCount(page, experiences.filter(record => record.territory === chosen).length);
  await form.locator('[type="reset"]').click();
  await waitForCount(page, experiences.length);
}

async function contextWithFixtures(browser, options = {}, handler) {
  const context = await browser.newContext({ reducedMotion: 'reduce', ...options });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === origin) {
      // CSP belongs to the document. Proxying every image creates a second request
      // that can outlive navigation/teardown and race with an already handled route.
      if (route.request().resourceType() !== 'document') return route.continue();
      const response = await route.fetch();
      return route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': csp } });
    }
    if (url.hostname === 'mapas.gobiernobogota.gov.co' && handler) return handler(route);
    if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    if (url.hostname === 'identity.netlify.com') return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
    return route.abort();
  });
  return context;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await contextWithFixtures(browser, { viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const experiences = await (await context.request.get(base + '/data/experiencias.json')).json();
    const documentedTerritories = {
      'kilombo-yumma': 'Bogotá',
      'kilomboapp': 'Bogotá',
      'museo-viernes-negro': 'Antonio Nariño, Bogotá',
      'catedra-benkos-bioho': 'Antonio Nariño, Bogotá',
      'ruta-libertaria': 'San Basilio de Palenque'
    };
    assert.equal(experiences.length, 5);
    for (const record of experiences) {
      assert.equal(record.territory, documentedTerritories[record.slug], `${record.slug}: only documented territory`);
      assert.equal(record.location_type, 'territorial', `${record.slug}: no point location is asserted`);
      assert.doesNotMatch(JSON.stringify(record), /"(?:coordinates|latitude|longitude|lat|lng|lon|geo|address)"\s*:/i, `${record.slug}: no coordinates or address are invented`);
    }
    const ruta = experiences.find(record => record.slug === 'ruta-libertaria');
    assert.equal(ruta.event_date, '2023');
    for (const field of ['municipality', 'department', 'country']) assert.equal(ruta[field], '', `Ruta: no inferred ${field}`);
    assert.deepEqual(ruta.milestones, [], 'one documented year does not become a fabricated timeline');

    await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
    const section = page.locator('#mapa-institucional');
    assert.match(await section.locator('h2').innerText(), /Territorios y experiencias/);
    assert.match(await section.innerText(), /emprendimientos afrocolombianos en Bogotá/i);
    assert.match(await section.innerText(), /Secretaría Distrital de Gobierno/);
    assert.match(await section.innerText(), /independiente|distinto|no representan|no son|no corresponden/i, 'the two datasets are distinguished');
    assert.match(await section.innerText(), /puntos\s+no (?:representan|son|corresponden a)\s+sedes.*AFNEMO/i, 'map points are explicitly distinguished from AFNEMO sites and experiences');
    const headingLevels = await section.locator('h1,h2,h3,h4,h5,h6').evaluateAll(headings => headings.map(heading => Number(heading.tagName.slice(1))));
    assert.equal(headingLevels[0], 2);
    assert.equal(headingLevels.every((level, index) => index === 0 || level <= headingLevels[index - 1] + 1), true, 'territorial headings do not skip hierarchy levels');
    assert.equal(await section.locator('#experiencias-relacionadas [data-experience]').count(), 5);
    assert.equal(await section.locator('#map-frame').getAttribute('title'), 'Visor externo: emprendimientos afrocolombianos en Bogotá');
    assert.equal(await section.locator('#map-frame').getAttribute('data-src'), mapUrl);
    assert.equal(await section.locator('#map-frame').getAttribute('src'), null, 'external map starts only on request');
    const external = section.locator(`a[href="${mapUrl}"]`).first();
    assert.equal(await external.isVisible(), true);
    assert.match(await external.innerText(), /mapa|visor|portal/i);
    assert.equal(await external.getAttribute('target'), '_blank');
    assert.match(await external.getAttribute('rel'), /noopener/);
    for (const route of ['/', '/experiencias/']) {
      await page.goto(base + route, { waitUntil: 'domcontentloaded' });
      await assertFilters(page, experiences);
    }
    for (const record of experiences) {
      await page.goto(base + record.url, { waitUntil: 'domcontentloaded' });
      await page.reload({ waitUntil: 'domcontentloaded' });
      assert.equal(await page.locator('h1').innerText(), record.title);
      assert.ok((await page.title()).includes(record.title));
      assert.ok((await page.locator('meta[name="description"]').getAttribute('content')).trim());
      assert.match(await page.locator('main').innerText(), new RegExp(record.territory));
      assert.equal(await page.locator('main iframe').count(), 0, 'experience has no invented map marker');
      assert.equal(await page.locator('main h2, main h3').evaluateAll(headings => headings.every(heading => heading.textContent.trim().length)), true);
      assert.match(await page.locator('main').innerText(), /[Ff]uente|[Rr]evisión/);
      if (record.slug === 'ruta-libertaria') {
        assert.match(await page.locator('main').innerText(), /2023/);
        assert.equal(await page.getByRole('heading', { name: /Hitos documentados/ }).count(), 0);
      }
      await page.locator('.content-back').first().click();
      assert.equal(new URL(page.url()).pathname, '/experiencias/');
      await waitForCount(page, experiences.length);
    }

    const cms = parse(await (await context.request.get(base + '/admin/config.yml')).text());
    const fields = cms.collections.find(collection => collection.name === 'experiencias').fields;
    for (const name of ['territory', 'municipality', 'department', 'country', 'location_type', 'context', 'period', 'event_date', 'related_initiative', 'milestones', 'gallery', 'videos', 'sources', 'reviewed_at']) {
      const field = fields.find(item => item.name === name);
      assert.ok(field && field.label, `${name}: editable and labelled in Decap`);
    }
    assert.match(fields.find(field => field.name === 'territory').label, /Territorio público/);
    const location = fields.find(field => field.name === 'location_type');
    assert.deepEqual(location.options.map(option => typeof option === 'string' ? option : option.value).sort(), ['approximate', 'exact', 'territorial', 'unpublished']);
    assert.doesNotMatch(JSON.stringify(fields), /"name":"(?:coordinates|latitude|longitude|lat|lng)"/, 'editors are not asked for unnecessary coordinates');
    await page.goto(base + '/admin/guia.html', { waitUntil: 'domcontentloaded' });
    const guide = await page.locator('main').innerText();
    assert.match(guide, /[Tt]erritorio público/);
    assert.match(guide, /[Uu]bicación exacta/);
    assert.match(guide, /coordenadas/);
    assert.match(guide, /hitos/i);
    assert.match(guide, /San Basilio de Palenque/);
    assert.deepEqual(errors, []);
    await context.unrouteAll({ behavior: 'wait' });
    await context.close();

    // A successful HTML load, HTTP error page, network abort and delayed response
    // all keep the independent AFNEMO exploration available.
    for (const [screen, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844], ['small', 320, 568]]) {
      for (const scenario of ['html', 'http-error', 'network-error', 'delayed']) {
        let requests = 0;
        let release;
        const pending = new Promise(resolve => { release = resolve; });
        const current = await contextWithFixtures(browser, { viewport: { width, height } }, async route => {
          requests++;
          if (scenario === 'network-error') return route.abort('failed');
          if (scenario === 'delayed') await pending;
          return route.fulfill({ status: scenario === 'http-error' ? 503 : 200, contentType: 'text/html', body: '<!doctype html><html lang="es"><body><p>Recurso externo simulado para pruebas de integración.</p></body></html>' });
        });
        const target = await current.newPage();
        const pageErrors = [];
        target.on('pageerror', error => pageErrors.push(error.message));
        await target.goto(base + '/', { waitUntil: 'domcontentloaded' });
        const map = target.locator('#territory-map');
        const frame = target.locator('#map-frame');
        const load = target.locator('#map-load');
        assert.equal(requests, 0, 'reading AFNEMO stories does not request ArcGIS');
        assert.equal(await map.getAttribute('data-state'), 'idle');
        assert.equal(await target.locator('#map-status').getAttribute('role'), 'status');
        if (screen !== 'small' && scenario === 'html') {
          await capture(target, target.locator('#mapa-institucional'), `territorial-${screen}-overview-idle.png`);
        }
        if (scenario === 'delayed') await target.clock.install();
        const firstRequest = target.waitForRequest(mapUrl);
        await load.focus();
        await target.keyboard.press('Enter');
        await firstRequest;
        assert.equal(await frame.getAttribute('src'), mapUrl);
        assert.equal(await frame.isVisible(), true);
        if (scenario === 'delayed') {
          assert.equal(await map.getAttribute('data-state'), 'loading');
          await target.clock.fastForward(12001);
          await target.waitForFunction(() => document.getElementById('territory-map').dataset.state === 'delayed');
          assert.match(await target.locator('#map-status').innerText(), /tard|esper|respon|carg/i);
        } else {
          await target.waitForFunction(() => ['opened', 'unavailable'].includes(document.getElementById('territory-map').dataset.state));
        }
        const observedState = await map.getAttribute('data-state');
        assert.doesNotMatch(await target.locator('#map-status').innerText(), /(?:mapa|visor) (?:cargado|listo)|cargado correctamente|carga(?:do)? con éxito/i, 'iframe events never promise a healthy cross-origin map');
        await frame.scrollIntoViewIfNeeded();
        const rect = await frame.boundingBox();
        assert.ok(rect && rect.width > 250 && rect.height >= 280, `${screen}: useful map dimensions`);
        assert.ok(rect.x >= 0 && rect.x + rect.width <= width + 1, `${screen}: iframe fits viewport`);
        assert.equal(await target.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${screen}: no horizontal overflow`);
        const cards = target.locator('#experiencias-relacionadas [data-experience]');
        assert.equal(await cards.count(), experiences.length);
        await target.locator('#experience-territory').selectOption('San Basilio de Palenque');
        await waitForCount(target, 1);
        assert.match(await cards.filter({ visible: true }).innerText(), /Ruta Libertaria/);
        await target.locator('#experience-filters [type="reset"]').click();
        await waitForCount(target, experiences.length);
        assert.equal(await target.locator(`a[href="${mapUrl}"]`).first().isVisible(), true);
        if (screen !== 'small' && (scenario === 'html' || scenario === 'delayed')) {
          await capture(target, target.locator('#territory-map'), `territorial-${screen}-map-${scenario}.png`);
          await capture(target, target.locator('#experiencias-relacionadas'), `territorial-${screen}-stories-${scenario}.png`);
        }
        if (scenario === 'delayed') release();
        const beforeRetry = requests;
        const retryRequest = target.waitForRequest(mapUrl);
        await target.locator('#map-retry').click();
        await retryRequest;
        assert.ok(requests > beforeRetry, 'retry requests the external resource again');
        await target.locator('#map-close').click();
        assert.equal(await frame.isVisible(), false);
        assert.equal(await frame.getAttribute('src'), null);
        assert.equal(await load.evaluate(element => element === document.activeElement), true, 'closing the mobile map returns focus to its load control');
        assert.equal(await map.getAttribute('data-state'), 'idle');
        assert.equal(await target.evaluate(() => getComputedStyle(document.body).overflow !== 'hidden'), true, 'map does not trap page scrolling');
        await cards.first().locator('a').first().click();
        assert.equal(new URL(target.url()).pathname.startsWith('/experiencias/'), true, 'stories still navigate after external failure');
        assert.deepEqual(pageErrors, []);
        results.push({ screen, scenario, observedState, externalRequests: requests, pageErrors });
        await current.unrouteAll({ behavior: 'wait' });
        await current.close();
      }
    }

    const noJS = await contextWithFixtures(browser, { javaScriptEnabled: false, viewport: { width: 320, height: 568 } });
    const fallback = await noJS.newPage();
    for (const route of ['/', '/experiencias/']) {
      await fallback.goto(base + route, { waitUntil: 'domcontentloaded' });
      assert.equal(await fallback.locator('[data-experience]:visible').count(), experiences.length, `${route}: all static stories work without JavaScript`);
      assert.equal(await fallback.locator('#experience-filters').isVisible(), false, `${route}: nonfunctional filters are not displayed`);
      assert.equal(await fallback.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      if (route === '/') {
        assert.equal(await fallback.locator('#map-frame').getAttribute('src'), null);
        assert.equal(await fallback.locator(`a[href="${mapUrl}"]`).first().isVisible(), true);
        await capture(fallback, fallback.locator('#experiencias-relacionadas'), 'territorial-mobile-no-js-stories.png');
      }
      await fallback.locator('[data-experience] a').first().click();
      assert.equal(await fallback.locator('h1').count(), 1);
      await fallback.locator('.content-back').first().click();
      assert.equal(new URL(fallback.url()).pathname, '/experiencias/');
    }
    // Back navigation can still be fetching an image when assertions finish.
    // Drain route callbacks before disposing their request context.
    await noJS.unrouteAll({ behavior: 'wait' });
    await noJS.close();
    fs.writeFileSync(path.join(evidence, 'territorial-browser-results.json'), JSON.stringify({ experiences: experiences.length, documentedTerritories, scenarios: results, captures, externalServices: 'All ArcGIS responses were fixtures. HTTP 200/503 and network failure are not remote availability checks; iframe load cannot establish cross-origin map health. No CMS login, remote map edit or dataset copy was performed.' }, null, 2));
    console.log('PASS territorial: five experiences with documented territories; independent keyboard filters, empty state, reload/Back, static details, CMS/guide, 3 widths × 4 simulated external scenarios, responsive iframe, retry/close and no-JS; 0 page errors.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
