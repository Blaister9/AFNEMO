const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const base = process.env.AFNEMO_BASE_URL || 'http://127.0.0.1:4173';
const evidence = process.env.AFNEMO_EVIDENCE || process.env.AFNEMO_EVIDENCE_DIR || path.resolve('test-results');
fs.mkdirSync(evidence, { recursive: true });
const csp = fs.readFileSync('netlify.toml', 'utf8').match(/Content-Security-Policy = "([^"]+)"/)[1];
async function verifyImages(page, route) {
 // Request lazy images too: checking only already-complete images can miss failures.
 const results = await page.locator('img').evaluateAll(async images => Promise.all(images.map(async image => {
  image.loading = 'eager';
  let timeout;
  try {
   await Promise.race([
    image.decode(),
    new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Image decode timed out')), 10000); })
   ]);
   return { src: image.currentSrc || image.src, loaded: image.complete && image.naturalWidth > 0 && image.naturalHeight > 0, hasAlt: image.hasAttribute('alt') };
  } catch (error) {
   return { src: image.currentSrc || image.src, loaded: false, error: error.message };
  } finally { clearTimeout(timeout); }
 })));
 assert.deepEqual(results.filter(image => !image.loaded), [], `${route}: all images must load and decode`);
 assert.deepEqual(results.filter(image => !image.hasAlt), [], `${route}: all images have alt attributes`);
}
(async () => {
 const browser = await chromium.launch({ headless: true });
 const context = await browser.newContext({ reducedMotion: 'reduce' });
 // Apply exactly the repository's production CSP, while isolating external availability.
 await context.route(base + '/**', async route => {
  const response = await route.fetch();
  await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': csp } });
 });
 await context.route('https://mapas.gobiernobogota.gov.co/**', r => r.fulfill({ status: 503, contentType: 'text/html', body: '<p>Visor externo no disponible (prueba de fallo).</p>' }));
 await context.route('https://identity.netlify.com/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
 await context.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
 const page = await context.newPage();
 const errors = [], requests = [], ownConsoleErrors = [];
 page.on('pageerror', e => errors.push(e.message));
 page.on('console', m => { if(m.type()==='error' && (m.location().url||'').startsWith(base)) ownConsoleErrors.push(m.text()); });
 page.on('request', r => requests.push(r.url()));
 const news = await (await context.request.get(base + '/data/noticias.json')).json();
 const experiences = await (await context.request.get(base + '/data/experiencias.json')).json();
 const expectedNewsDates = {
  '2024-07-25-afnemo-cop16': '2024-07-25',
  '2024-11-26-saberes-ancestrales-biodiversidad': '2024-11-26',
  '2026-10-02-memoria-museo': '2024-06-18'
 };
 assert.deepEqual(news.map(record => record.slug).sort(), Object.keys(expectedNewsDates).sort(), 'exactly the three reviewed historical news entries');
 assert.deepEqual(experiences.map(record => record.slug).sort(), ['catedra-benkos-bioho', 'kilombo-yumma', 'kilomboapp', 'museo-viernes-negro', 'ruta-libertaria'].sort(), 'exactly the five reviewed initiatives');
 for (const record of news) {
  assert.equal(record.date.slice(0, 10), expectedNewsDates[record.slug], `${record.slug}: preserve original publication date`);
  assert.equal(record.historical, true, `${record.slug}: historical label`);
 }
 const museum = experiences.find(record => record.slug === 'museo-viernes-negro');
 assert.equal(museum.image, '/assets/images/experiencias/museo-viernes-negro.webp', 'the approved original museum photograph is integrated');
 assert.ok(museum.image_width > 0 && museum.image_height > 0 && museum.image_alt && museum.image_credit, 'museum image has dimensions, description and credit');
 const routes = ['/', '/noticias/', '/experiencias/', '/asociacion/', '/admin/guia.html', ...news.map(x => x.url), ...experiences.map(x => x.url)];
 const recordsByUrl = new Map([...news, ...experiences].map(record => [record.url, record]));
 const captureRoutes = new Set(['/', '/noticias/', '/experiencias/', '/asociacion/', '/admin/guia.html', museum.url, ...news.map(record => record.url)]);
 const links = new Set(), captures = [];
 for (const [screen, width, height] of [['desktop',1440,1000], ['mobile',390,844], ['small',320,568]]) {
  await page.setViewportSize({width,height});
  for (const route of routes) {
   assert.equal((await page.goto(base + route, { waitUntil: 'domcontentloaded' })).status(), 200);
   if(route === '/') {
    await page.waitForSelector('#noticias-container a');
    assert.equal(await page.locator('#noticias-container .news-card').count(), Math.min(3, news.length));
   }
   assert.equal(await page.locator('h1').count(), 1, `${route}: one h1`);
   assert.equal(await page.locator('main').count(), 1, `${route}: one main`);
   assert.equal(await page.locator('a[href="#"],a[href=""]').count(), 0, `${route}: no empty links`);
   const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
   assert.equal(overflow, false, `${route}: ${screen} overflow`);
   await verifyImages(page, route);
   if (recordsByUrl.has(route)) assert.equal(await page.locator('h1').innerText(), recordsByUrl.get(route).title, `${route}: own detail content`);
   if (route === '/noticias/') assert.equal(await page.locator('.content-card').count(), news.length, 'all news entries are available in the listing');
   if (route === '/asociacion/') {
    assert.ok(await page.locator('.institutional-contents a').count() >= 7, 'institutional sections have a usable contents list');
    assert.match(await page.locator('.content-notice').innerText(), /históricas.*confirmación/s);
   }
   if (route === '/admin/guia.html') {
    assert.equal(await page.locator('.guide-toc a').count(), 5, 'all five editorial guide steps are linked');
    assert.equal(await page.locator('a[href^="/admin/#/collections/"]').count(), 3, 'guide links to the existing CMS collections');
   }
   for (const href of await page.locator('a[href]').evaluateAll(a => a.map(x => x.href))) if(href.startsWith(base)) links.add(href);
   if(screen !== 'small' && captureRoutes.has(route)) {
    const label = route==='/'?'home':route.split('/').filter(Boolean).join('-').replace(/\.html$/, '');
    const filename=`after-${screen}-${label}.png`;
    await page.screenshot({path:path.join(evidence,filename)}); captures.push(filename);
    if (route === museum.url) {
     const figure = page.locator('.content-figure');
     assert.equal(await figure.count(), 1, 'museum detail contains its photograph');
     assert.equal(await figure.locator('figcaption').innerText(), museum.image_credit);
     const photoCapture = `after-${screen}-museo-fotografia.png`;
     await figure.screenshot({ path: path.join(evidence, photoCapture) }); captures.push(photoCapture);
    }
   }
  }
 }
 for (const link of links) {
  const url = new URL(link); const hash = decodeURIComponent(url.hash.slice(1)); url.hash='';
  assert.equal((await context.request.get(url.href)).status(),200,`broken destination ${link}`);
  // Decap uses a hash router; these fragments identify editor routes, not DOM ids.
  if(hash && url.pathname !== '/admin/') {
   await page.goto(url.href);
   assert.equal(await page.evaluate(id => Boolean(document.getElementById(id)), hash), true, `missing fragment ${link}`);
  }
 }
 // Each direct news URL survives a reload and returns to the complete listing.
 for (const record of news) {
  await page.goto(base + record.url);
  await page.reload();
  assert.equal(await page.locator('h1').innerText(), record.title);
  assert.equal(await page.locator(`.content-heading time[datetime="${record.date}"]`).count(), 1);
  await page.locator('.content-back').first().click();
  assert.equal(new URL(page.url()).pathname, '/noticias/');
  assert.equal(await page.locator('.content-card').count(), news.length);
 }
 // Persisted filters, empty state, reset, detail and direct reload.
 await page.goto(base+'/experiencias/?territory=Bogot%C3%A1');
 assert.equal(await page.locator('[data-experience]:visible').count(), experiences.filter(record => record.territory === 'Bogotá').length);
 await page.locator('#experience-query').fill('inexistente-zz');
 await page.waitForTimeout(100);
 assert.equal(await page.locator('[data-experience]:visible').count(),0);
 assert.equal(await page.locator('#experience-empty').isVisible(),true);
 await page.locator('button[type="reset"]').click();
 await page.waitForFunction(count => document.querySelectorAll('[data-experience]:not([hidden])').length === count, experiences.length);
 assert.equal(await page.locator('[data-experience]:visible').count(), experiences.length);
 await page.locator('#experience-initiative').selectOption('Ruta Libertaria');
 await page.reload();
 assert.equal(await page.locator('[data-experience]:visible').count(),1);
 await page.locator('[data-experience]:visible h2 a').click();
 await page.reload();
 assert.match(await page.locator('h1').innerText(),/Ruta Libertaria/);
 await page.locator('.content-back').first().click();
 assert.equal(new URL(page.url()).pathname,'/experiencias/');
 // Public output and direct URLs cannot expose raw drafts or source configuration.
 for(const route of ['/content/noticias/2026-04-09-prueba.md','/assets/images/noticias/logo_andje_2026.png','/content/experiencias/kilombo-yumma.md','/content/institucional/asociacion.md','/.claude/settings.local.json','/README.md','/package.json','/noticias/no-existe/']) {
  assert.equal((await context.request.get(base+route)).status(),404,route);
 }
 assert.deepEqual(ownConsoleErrors, [], "No site console errors before intentional failures");
 // Failed news request visibly offers a retry and recovers.
 await page.route('**/data/noticias.json', r=>r.fulfill({status:503,body:'unavailable'}));
 await page.goto(base+'/');
 await page.waitForSelector('#noticias-container button');
 assert.match(await page.locator('#noticias-container').innerText(),/no|problema|cargar/i);
 await page.unroute('**/data/noticias.json');
 await page.locator('#noticias-container button').click();
 await page.waitForSelector('#noticias-container a');
 assert.equal(await page.locator('iframe').getAttribute('title'),'Visor externo: emprendimientos afrocolombianos en Bogotá');
 await page.locator('#mapa-institucional').scrollIntoViewIfNeeded();
 assert.equal(await page.locator('#experiencias-relacionadas a').count(),3);
 // Keyboard skip navigation.
 await page.goto(base+'/'); await page.keyboard.press('Tab');
 assert.equal(await page.locator('.skip-link').evaluate(e=>document.activeElement===e),true);
 await page.keyboard.press('Enter'); assert.equal(await page.locator('main').evaluate(e=>document.activeElement===e),true);
 assert.equal(requests.some(x=>x.includes('api.github.com')||x.includes('raw.githubusercontent.com')),false);
 assert.deepEqual(errors,[]);
 const noJS = await browser.newContext({ javaScriptEnabled:false,viewport:{width:390,height:844} });
 const staticPage = await noJS.newPage();
 await staticPage.goto(base+'/experiencias/');
 assert.equal(await staticPage.locator('[data-experience]:visible').count(), experiences.length);
 assert.equal(await staticPage.locator('.nav-links').isVisible(),true);
 await noJS.close();
 fs.writeFileSync(path.join(evidence,'browser-results.json'),JSON.stringify({routes:routes.length,viewports:3,news:news.length,experiences:experiences.length,localLinks:links.size,pageErrors:errors,githubRequests:0,captures,externalServices:'Map failure simulated; CMS collection links checked as routes only. CMS login and Worker backend not authenticated or exercised.'},null,2));
 console.log(`PASS browser: ${routes.length} routes × 3 viewports, ${news.length} news, ${experiences.length} experiences, ${links.size} internal links, institution, editorial guide, decoded images, filters, reload, drafts, CSP, news retry, no-JS, keyboard; 0 page errors.`);
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
