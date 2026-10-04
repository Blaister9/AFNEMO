/* Real Decap UI + official filesystem proxy, confined to a disposable copy.
 * This proves local editing/serialization/build, never remote Identity/Git Gateway.
 * Run: npm run test:cms (requires internet for the site's Decap CDN assets).
 */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { parse, stringify } = require('yaml');

const project = path.resolve(__dirname, '..');
const evidence = path.resolve(process.env.AFNEMO_EVIDENCE || process.env.AFNEMO_EVIDENCE_DIR || path.join(project, 'test-results'));
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.yml': 'text/yaml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg' };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(check, description) {
  for (let i = 0; i < 100; i++) { if (await check()) return; await delay(100); }
  throw new Error(`Timed out: ${description}`);
}
async function freePort() {
  const server = http.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'afnemo-cms-e2e-'));
  let browser, server, proxy, page, context;
  const result = { completed: false, backend: 'official Decap local filesystem proxy', remoteAuthentication: 'not validated', operations: [], pageErrors: [], expectedValidationErrors: [], consoleErrors: [], externalFailures: [], requestsToRemoteContentBackends: [] };
  let phase = 'normal';
  try {
    await fs.mkdir(evidence, { recursive: true });
    // A strict allowlist omits .git, credentials, documents and all developer state.
    for (const item of ['content', 'assets', 'admin', 'index.html', '_redirects', 'CNAME']) await fs.cp(path.join(project, item), path.join(root, item), { recursive: true });
    const { build } = await import(pathToFileURL(path.join(project, 'scripts/build.mjs')));
    const { parseContent } = await import(pathToFileURL(path.join(project, 'scripts/content.mjs')));
    await build(root);
    const proxyPort = await freePort();
    const proxyScript = require.resolve('decap-server/dist/index.js');
    proxy = spawn(process.execPath, [proxyScript], { cwd: root, env: { ...process.env, MODE: 'fs', GIT_REPO_DIRECTORY: root, PORT: String(proxyPort), BIND_HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let proxyOutput = '';
    proxy.stdout.on('data', chunk => { proxyOutput += chunk; });
    proxy.stderr.on('data', chunk => { proxyOutput += chunk; });
    const proxyUrl = `http://127.0.0.1:${proxyPort}/api/v1`;
    await waitFor(async () => {
      if (proxy.exitCode !== null) throw new Error(`Decap proxy exited: ${proxyOutput}`);
      try { return (await fetch(proxyUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"action":"info"}' })).ok; } catch { return false; }
    }, 'official proxy start');
    const cms = parse(await fs.readFile(path.join(root, 'admin/config.yml'), 'utf8'));
    server = http.createServer(async (req, res) => {
      try {
        const pathname = new URL(req.url, 'http://localhost').pathname;
        if (pathname === '/cms-proxy/api/v1') {
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const response = await fetch(proxyUrl, { method: req.method, headers: { 'Content-Type': 'application/json' }, body: Buffer.concat(chunks) });
          res.writeHead(response.status, { 'Content-Type': response.headers.get('content-type') || 'application/json' });
          res.end(Buffer.from(await response.arrayBuffer()));
          return;
        }
        if (pathname === '/admin/config.yml') {
          res.writeHead(200, { 'Content-Type': 'text/yaml' });
          res.end(stringify({ ...cms, local_backend: { url: `${base}/cms-proxy/api/v1` } }));
          return;
        }
        const output = path.join(root, 'dist');
        let filename = path.resolve(output, `.${decodeURIComponent(pathname)}`);
        if (!filename.startsWith(output + path.sep) && filename !== output) throw new Error('Invalid path');
        // The CMS dev preview needs its newly saved source media before a build.
        // Public pages still read only dist, including the post-build assertions.
        if (pathname.startsWith('/assets/images/') && (req.headers.referer || '').includes('/admin/')) {
          const sourceImage = path.resolve(root, `.${decodeURIComponent(pathname)}`);
          if (!sourceImage.startsWith(path.join(root, 'assets/images') + path.sep)) throw new Error('Invalid media path');
          for (let attempt = 0; attempt < 20 && !await fs.stat(sourceImage).catch(() => null); attempt++) await delay(50);
          if (await fs.stat(sourceImage).catch(() => null)) filename = sourceImage;
        }
        if ((await fs.stat(filename)).isDirectory()) filename = path.join(filename, 'index.html');
        res.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream' });
        res.end(await fs.readFile(filename));
      } catch { res.writeHead(404); res.end('Not found'); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    // A local reverse proxy keeps the production CSP unchanged (connect-src self).
    const csp = (await fs.readFile(path.join(project, 'netlify.toml'), 'utf8')).match(/Content-Security-Policy = "([^"]+)"/)[1];
    await context.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin === base) {
        if (request.resourceType() !== 'document') return route.continue();
        const response = await route.fetch();
        return route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': csp } });
      }
      if (url.hostname === 'unpkg.com' || url.hostname === 'identity.netlify.com') return route.continue();
      if (/github|netlify/.test(url.hostname)) result.requestsToRemoteContentBackends.push(url.origin + url.pathname);
      if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
      return route.abort();
    });
    page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on('dialog', async dialog => {
      if (phase === 'delete-test-content' && dialog.type() === 'confirm') await dialog.accept();
      else await dialog.dismiss();
    });
    page.on('pageerror', error => {
      if (phase.endsWith('-validation') && /^Uncaught \(in promise\) (undefined|#<Object>)$/.test(error.message)) result.expectedValidationErrors.push({ provider: 'Decap CMS', message: error.message, phase, reason: 'invalid entry intentionally submitted; UI visibly rejects save' });
      else result.pageErrors.push(error.message);
    });
    page.on('console', message => { if (message.type() === 'error') result.consoleErrors.push({ phase, url: message.location().url || '', message: message.text() }); });
    page.on('requestfailed', request => { if (!request.url().startsWith(base)) result.externalFailures.push({ url: new URL(request.url()).origin + new URL(request.url()).pathname, error: request.failure()?.errorText }); });
    await page.goto(base + '/admin/', { waitUntil: 'domcontentloaded' });
    await waitFor(async () => { if (result.pageErrors.length) throw new Error(result.pageErrors.join('; ')); return await page.getByRole('button').count() || (await page.locator('body').innerText()).includes('Errores de configuración'); }, 'Decap configuration and login');
    assert.doesNotMatch(await page.locator('body').innerText(), /Errores de configuración/, 'real Decap accepts the configuration');
    await page.getByRole('button', { name: /login|iniciar|acceder/i }).click();
    await page.getByRole('link', { name: 'Noticias y memoria', exact: true }).waitFor();
    result.operations.push('local proxy session opened (no remote authentication)');
    await page.getByRole('link', { name: 'Noticias y memoria', exact: true }).click();
    await page.getByText('AFNEMO en la COP16: un video del archivo', { exact: true }).click();
    const field = name => page.locator(`[id^="${name}-field-"]`);
    assert.equal(await field('title').inputValue(), 'AFNEMO en la COP16: un video del archivo');
    result.operations.push('read/open existing historical news');
    await page.goto(base + '/admin/#/collections/noticias');
    await page.getByText('＋ Noticia', { exact: true }).click();
    async function publish() {
      await page.getByRole('button', { name: 'Publicar', exact: true }).click();
      await page.getByText('Publicar ahora', { exact: true }).click();
    }
    const settledSave = () => page.getByRole('button', { name: 'Publicado', exact: true }).waitFor();
    const originalNews = await fs.readdir(path.join(root, 'content/noticias'));
    phase = 'required-field-validation';
    await publish();
    await page.getByText(/obligatorio|requerid|complet/i).first().waitFor();
    phase = 'normal';
    assert.deepEqual(await fs.readdir(path.join(root, 'content/noticias')), originalNews, 'invalid empty entry is not saved');
    result.operations.push('required-field validation prevents empty save');
    await field('title').fill('Prueba CMS aislada');
    await field('date').fill('2026-10-03T10:00');
    await field('excerpt').fill('Resumen de la prueba local del flujo editorial.');
    await field('source').fill('Prueba automatizada aislada, sin publicación remota.');
    await page.locator('[contenteditable="true"]').fill('Relato documentado de prueba local.');
    await field('published').click();
    await page.getByRole('button', { name: 'Elige una imagen', exact: true }).click();
    await page.locator('input[type="file"]').setInputFiles({ name: 'Foto CMS Áislada.webp', mimeType: 'image/webp', buffer: await fs.readFile(path.join(root, 'assets/images/experiencias/museo-viernes-negro.webp')) });
    await page.getByText('foto-cms-aislada.webp', { exact: true }).waitFor();
    if (!await page.getByRole('button', { name: 'Confirmar selección', exact: true }).isEnabled()) await page.getByText('foto-cms-aislada.webp', { exact: true }).click();
    await page.getByRole('button', { name: 'Confirmar selección', exact: true }).click();
    await field('image_authorized').click();
    phase = 'image-metadata-validation';
    await publish();
    await page.getByText(/Antes de guardar: Completa la descripción accesible de imagen principal\. Completa el crédito y la autorización de imagen principal\./).first().waitFor();
    assert.deepEqual(await fs.readdir(path.join(root, 'content/noticias')), originalNews, 'preSave image metadata validation prevents persistence');
    phase = 'normal';
    result.operations.push('real preSave blocks image publication without description/credit');
    await field('image_alt').fill('Fotografía autorizada del museo usada en una prueba local.');
    await field('image_credit').fill('Archivo AFNEMO; copia local de fotografía previamente autorizada.');
    await publish();
    await waitFor(async () => (await fs.readdir(path.join(root, 'content/noticias'))).length === originalNews.length + 1, 'news file written by CMS');
    await settledSave();
    const created = (await fs.readdir(path.join(root, 'content/noticias'))).find(name => !originalNews.includes(name));
    const newsFile = path.join(root, 'content/noticias', created);
    const newsData = parseContent(await fs.readFile(newsFile, 'utf8'));
    assert.equal(created, '2026-10-03-prueba-cms-aislada.md');
    assert.equal(newsData.meta.image, '/assets/images/noticias/foto-cms-aislada.webp');
    assert.equal(newsData.meta.published, true);
    assert.match(newsData.body, /Relato documentado/);
    assert.ok((await fs.stat(path.join(root, newsData.meta.image.slice(1)))).size > 0);
    result.operations.push('create/save news and upload/select image with safe normalized filename');
    await page.goto(base + '/admin/#/collections/noticias/entries/' + created.replace(/\.md$/, ''));
    assert.equal(await field('title').inputValue(), 'Prueba CMS aislada');
    assert.equal(await field('image_alt').inputValue(), newsData.meta.image_alt);
    await field('title').fill('Prueba CMS aislada corregida');
    await publish();
    await waitFor(async () => parseContent(await fs.readFile(newsFile, 'utf8')).meta.title.endsWith('corregida'), 'edited news saved');
    await settledSave();
    result.operations.push('reopen/edit/save news while keeping its permanent slug');
    await build(root);
    const publicPage = await context.newPage();
    publicPage.on('pageerror', error => result.pageErrors.push(error.message));
    publicPage.on('console', message => { if (message.type() === 'error') result.consoleErrors.push({ phase: 'public-page', url: message.location().url || '', message: message.text() }); });
    const newsRoute = '/noticias/' + created.replace(/\.md$/, '') + '/';
    await publicPage.goto(base + newsRoute);
    await publicPage.reload();
    assert.equal(await publicPage.locator('h1').innerText(), 'Prueba CMS aislada corregida');
    const photo = publicPage.locator('.content-figure img');
    await photo.evaluate(image => image.decode());
    assert.equal(await photo.getAttribute('alt'), newsData.meta.image_alt);
    assert.equal(await photo.getAttribute('loading'), 'lazy');
    assert.ok(Number(await photo.getAttribute('width')) > 0 && Number(await photo.getAttribute('height')) > 0);
    for (const [screen, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
      await publicPage.setViewportSize({ width, height });
      assert.equal(await publicPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await publicPage.screenshot({ path: path.join(evidence, `cms-local-${screen}-saved-news.png`) });
    }
    await publicPage.goto(base + '/noticias/');
    assert.equal(await publicPage.getByRole('link', { name: 'Prueba CMS aislada corregida', exact: true }).count(), 1);
    result.operations.push('build generated news, list and decoded responsive image; direct URL survives reload');
    await page.reload();
    await field('title').waitFor();
    await page.screenshot({ path: path.join(evidence, 'cms-local-saved-editor.png') });
    phase = 'delete-test-content';
    await page.getByRole('button', { name: 'Eliminar entrada', exact: true }).click();
    await waitFor(async () => !await fs.stat(newsFile).catch(() => null), 'news deleted through CMS');
    phase = 'normal';
    result.operations.push('delete test news through CMS');
    await page.goto(base + '/admin/#/collections/experiencias/new');
    await field('id').fill('experiencia-cms-aislada');
    await field('title').fill('Experiencia CMS aislada');
    await field('excerpt').fill('Resumen de experiencia temporal para probar el editor.');
    await field('initiative').fill('Prueba CMS local');
    await field('source').fill('Prueba automatizada local sin publicación remota.');
    await field('reviewed_at').fill('2026-10-03');
    await field('reviewed').click();
    await page.locator('[contenteditable="true"]').fill('Relato de la experiencia temporal.');
    await field('status').fill('Publicado');
    await field('status').press('Enter');
    await publish();
    const experienceFile = path.join(root, 'content/experiencias/experiencia-cms-aislada.md');
    await waitFor(async () => !!await fs.stat(experienceFile).catch(() => null), 'experience saved without image or territory');
    await settledSave();
    const experienceData = parseContent(await fs.readFile(experienceFile, 'utf8'));
    assert.equal(experienceData.meta.status, 'published');
    assert.equal(experienceData.meta.reviewed, true);
    result.operations.push('create/save experience without optional image or territory');
    await page.goto(base + '/admin/#/collections/experiencias/entries/experiencia-cms-aislada');
    await field('territory').fill('Bogotá');
    await field('location_type').fill('Únicamente territorial');
    await field('location_type').press('Enter');
    await publish();
    await waitFor(async () => parseContent(await fs.readFile(experienceFile, 'utf8')).meta.territory === 'Bogotá', 'edited experience saved');
    await settledSave();
    await build(root);
    await publicPage.goto(base + '/experiencias/experiencia-cms-aislada/');
    assert.equal(await publicPage.locator('h1').innerText(), 'Experiencia CMS aislada');
    assert.match(await publicPage.locator('main').innerText(), /Bogotá/);
    await publicPage.goto(base + '/experiencias/?q=Experiencia%20CMS%20aislada');
    assert.equal(await publicPage.locator('[data-experience]:visible').count(), 1);
    result.operations.push('reopen/edit territorial experience; build renders detail/list/filter');
    await page.goto(base + '/admin/#/collections/institucional/entries/asociacion');
    await page.reload();
    await waitFor(async () => await field('title').inputValue().catch(() => '') === 'AFNEMO: origen, misión y trayectoria', 'institutional record loaded');
    const originalExcerpt = await field('excerpt').inputValue();
    await field('excerpt').fill(originalExcerpt + ' Revisión temporal de prueba local.');
    await publish();
    const institutionFile = path.join(root, 'content/institucional/asociacion.md');
    await waitFor(async () => parseContent(await fs.readFile(institutionFile, 'utf8')).meta.excerpt.includes('Revisión temporal'), 'institutional edit saved');
    await settledSave();
    await build(root);
    await publicPage.goto(base + '/asociacion/');
    assert.match(await publicPage.locator('main').innerText(), /Revisión temporal de prueba local/);
    await page.reload();
    await field('excerpt').fill(originalExcerpt);
    await publish();
    await waitFor(async () => parseContent(await fs.readFile(institutionFile, 'utf8')).meta.excerpt === originalExcerpt, 'institutional change reverted in CMS');
    await settledSave();
    result.operations.push('open/edit/save institutional content, verify build and restore through CMS');
    await page.goto(base + '/admin/#/collections/experiencias/entries/experiencia-cms-aislada');
    await page.reload();
    await field('title').waitFor();
    phase = 'delete-test-content';
    await page.getByRole('button', { name: 'Eliminar entrada', exact: true }).click();
    await waitFor(async () => !await fs.stat(experienceFile).catch(() => null), 'experience deleted through CMS');
    phase = 'normal';
    result.operations.push('delete test experience through CMS');
    await page.goto(base + '/admin/#/collections/noticias');
    await page.reload();
    await page.getByText('Medios', { exact: true }).click();
    await page.getByText('foto-cms-aislada.webp', { exact: true }).click();
    phase = 'delete-test-content';
    await page.getByRole('button', { name: 'Eliminar selección', exact: true }).click();
    await waitFor(async () => !await fs.stat(path.join(root, newsData.meta.image.slice(1))).catch(() => null), 'uploaded image deleted through CMS');
    phase = 'normal';
    result.operations.push('delete uploaded test image through media library');
    await build(root);
    assert.equal((await context.request.get(base + newsRoute)).status(), 404);
    assert.equal((await context.request.get(base + '/experiencias/experiencia-cms-aislada/')).status(), 404);
    assert.equal((await context.request.get(base + newsData.meta.image)).status(), 404);
    assert.deepEqual(await fs.readdir(path.join(root, 'content/noticias')), originalNews);
    const cleanNews = await (await context.request.get(base + '/data/noticias.json')).json();
    const cleanExperiences = await (await context.request.get(base + '/data/experiencias.json')).json();
    assert.equal(cleanNews.length, 3);
    assert.equal(cleanExperiences.length, 5);
    result.operations.push('rebuild after deletion removes test pages/media and restores 3 news/5 experiences');
    assert.deepEqual(result.requestsToRemoteContentBackends, []);
    assert.deepEqual(result.pageErrors, []);
    assert.deepEqual(result.consoleErrors.filter(error => !(
      error.phase === 'image-metadata-validation' &&
      error.url.startsWith('https://unpkg.com/decap-cms@') &&
      error.message.startsWith('Error: Antes de guardar: Completa la descripción accesible de imagen principal. Completa el crédito y la autorización de imagen principal.')
    )), [], 'no console errors outside the intentional preSave rejection');
    result.completed = true;
    console.log(`PASS CMS local: ${result.operations.length} operations; real UI, official isolated filesystem proxy, news/experience/institution/image round trip and cleanup. Remote authentication NOT validated.`);
  } catch (error) {
    if (page) {
      console.error('CMS UI at failure:', (await page.locator('body').innerText().catch(() => 'closed')).slice(-1800));
      await page.screenshot({ path: path.join(evidence, 'cms-local-failure.png') }).catch(() => {});
    }
    throw error;
  } finally {
    if (context) await context.unrouteAll({ behavior: 'wait' });
    if (browser) await browser.close();
    if (proxy) { proxy.kill(); await Promise.race([new Promise(resolve => proxy.once('exit', resolve)), delay(2000)]); }
    if (server) await new Promise(resolve => server.close(resolve));
    // root was created by mkdtemp under the OS temporary directory, never workspace.
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('afnemo-cms-e2e-'));
    await fs.rm(root, { recursive: true, force: true });
    result.temporaryCopyRemoved = true;
    await fs.writeFile(path.join(evidence, 'cms-local-results.json'), JSON.stringify(result, null, 2));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
