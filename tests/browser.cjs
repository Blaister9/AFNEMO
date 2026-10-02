const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const base = process.env.AFNEMO_BASE_URL || 'http://127.0.0.1:4173';
const evidence = process.env.AFNEMO_EVIDENCE || path.resolve('test-results');
fs.mkdirSync(evidence, { recursive: true });
const csp = fs.readFileSync('netlify.toml', 'utf8').match(/Content-Security-Policy = "([^"]+)"/)[1];
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
 assert.equal(news.length, 1); assert.equal(experiences.length, 5);
 const routes = ['/', '/noticias/', '/experiencias/', ...news.map(x => x.url), ...experiences.map(x => x.url)];
 const links = new Set(), captures = [];
 for (const [screen, width, height] of [['desktop',1440,1000], ['mobile',390,844], ['small',320,568]]) {
  await page.setViewportSize({width,height});
  for (const route of routes) {
   assert.equal((await page.goto(base + route, { waitUntil: 'domcontentloaded' })).status(), 200);
   if(route === '/') await page.waitForSelector('#noticias-container a');
   assert.equal(await page.locator('h1').count(), 1, `${route}: one h1`);
   assert.equal(await page.locator('main').count(), 1, `${route}: one main`);
   assert.equal(await page.locator('a[href="#"],a[href=""]').count(), 0, `${route}: no empty links`);
   const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
   assert.equal(overflow, false, `${route}: ${screen} overflow`);
   const invalidImages = await page.locator('img').evaluateAll(imgs => imgs.filter(i => i.complete && !i.naturalWidth).map(i => i.src));
   assert.deepEqual(invalidImages, [], `${route}: broken images`);
   for (const href of await page.locator('a[href]').evaluateAll(a => a.map(x => x.href))) if(href.startsWith(base)) links.add(href);
   if(screen !== 'small' && ['/', '/experiencias/', '/experiencias/museo-viernes-negro/', '/noticias/'+news[0].slug+'/'].includes(route)) {
    const label = route==='/'?'home':route.split('/').filter(Boolean).join('-');
    const filename=`after-${screen}-${label}.png`;
    await page.screenshot({path:path.join(evidence,filename)}); captures.push(filename);
   }
  }
 }
 for (const link of links) {
  const url = new URL(link); const hash = decodeURIComponent(url.hash.slice(1)); url.hash='';
  assert.equal((await context.request.get(url.href)).status(),200,`broken destination ${link}`);
  if(hash){ await page.goto(url.href); assert.equal(await page.locator(`[id="${hash}"]`).count(),1,`missing fragment ${link}`); }
 }
 // Persisted filters, empty state, reset, detail and direct reload.
 await page.goto(base+'/experiencias/?territory=Bogot%C3%A1');
 assert.equal(await page.locator('[data-experience]:visible').count(),4);
 await page.locator('#experience-query').fill('inexistente-zz');
 await page.waitForTimeout(100);
 assert.equal(await page.locator('[data-experience]:visible').count(),0);
 assert.equal(await page.locator('#experience-empty').isVisible(),true);
 await page.locator('button[type="reset"]').click();
 await page.waitForFunction(() => document.querySelectorAll('[data-experience]:not([hidden])').length === 5);
 assert.equal(await page.locator('[data-experience]:visible').count(),5);
 await page.locator('#experience-initiative').selectOption('Ruta Libertaria');
 await page.reload();
 assert.equal(await page.locator('[data-experience]:visible').count(),1);
 await page.locator('[data-experience]:visible h2 a').click();
 await page.reload();
 assert.match(await page.locator('h1').innerText(),/Ruta Libertaria/);
 await page.locator('.content-back').first().click();
 assert.equal(new URL(page.url()).pathname,'/experiencias/');
 // Public output and direct URLs cannot expose raw drafts or source configuration.
 for(const route of ['/content/noticias/2026-04-09-prueba.md','/assets/images/noticias/logo_andje_2026.png','/content/experiencias/kilombo-yumma.md','/.claude/settings.local.json','/README.md','/package.json','/noticias/no-existe/']) {
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
 assert.equal(await staticPage.locator('[data-experience]:visible').count(),5);
 assert.equal(await staticPage.locator('.nav-links').isVisible(),true);
 await noJS.close();
 fs.writeFileSync(path.join(evidence,'browser-results.json'),JSON.stringify({routes:routes.length,viewports:3,localLinks:links.size,pageErrors:errors,githubRequests:0,captures,externalServices:'Map failure simulated; CMS login and Worker backend not authenticated or exercised.'},null,2));
 console.log(`PASS browser: ${routes.length} routes × 3 viewports, ${links.size} internal links, filters, reload, drafts, CSP, news retry, no-JS, keyboard; 0 page errors.`);
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
