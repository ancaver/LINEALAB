'use strict';
/* Prueba real del visor 3D (three.js local) con Chromium: arranque con WebGL,
 * tres geometrías, vistas, etiquetas, dimensiones no válidas, tema y respaldo
 * sin WebGL. Usa el mismo documento in-memory que browser-check.cjs.
 * Ejecutar: node scripts/viewer3d-browser.cjs (Playwright opcional para desarrollo).
 */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'validation/viewer3d');
fs.mkdirSync(out, { recursive: true });
const scripts = ['calculations.js','secondary.js','sweep.js','charts.js','vendor/plotly-basic-2.35.2.min.js','app.js','analysis.js','vendor/three-0.147.0.min.js','vendor/three-0.147.0-OrbitControls.js','vendor/three-0.147.0-RoomEnvironment.js','viewer3d.js'];
const report = { generatedAtUTC: new Date().toISOString(), harness: 'Chromium real con documento in-memory y WebGL por software (SwiftShader); sin navegación file:// ni HTTP', offline: true, contexts: [], pending: ['GPU física, móvil físico y navegadores distintos de Chromium'] };
const executable = process.env.LINEALAB_CHROMIUM || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
async function open(browser, viewport, { webgl = true } = {}) {
  const context = await browser.newContext({ viewport, offline: true });
  const page = await context.newPage(), errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<link\b[^>]*href="styles.css"[^>]*>/i, '');
  await page.setContent(html);
  if (!webgl) await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) { return /webgl/.test(type) ? null : original.call(this, type, ...rest); };
  });
  await page.addStyleTag({ path: path.join(root, 'styles.css') });
  for (const file of scripts) await page.addScriptTag({ path: path.join(root, file) });
  return { context, page, errors, requests };
}
const settle = page => page.waitForTimeout(700);
(async () => {
  const browser = await chromium.launch({ executablePath: executable, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    report.browser = browser.version();
    for (const [name, viewport] of [['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 844 }]]) {
      const { context, page, errors, requests } = await open(browser, viewport);
      try {
        assert.equal(await page.evaluate(() => THREE.REVISION), '147');
        assert.equal(await page.evaluate(() => LineaLabViewer3D.isRunning()), true);
        assert.equal(await page.locator('#viewer-stage').isVisible(), true);
        assert.equal(await page.locator('#line-illustration').isVisible(), false);
        // Compacto por defecto: sin barra ni etiquetas, y los resultados caben en la primera pantalla de escritorio.
        assert.equal(await page.locator('#viewer-bar').isVisible(), false);
        assert.equal(await page.locator('#viewer-callouts').isVisible(), false);
        const compact = await page.evaluate(() => ({ stage: document.querySelector('#viewer-stage').clientHeight, hero: document.querySelector('#model-hero').offsetHeight, kpiTop: Math.round(document.querySelector('#headline-cards').getBoundingClientRect().top) }));
        assert.ok(compact.stage <= 220, JSON.stringify(compact));
        if (name === 'desktop') assert.ok(compact.kpiTop < 520, JSON.stringify(compact));
        await page.screenshot({ path: path.join(out, `${name}-compacto.png`) });
        await page.click('#viewer-expand'); await settle(page);
        assert.equal(await page.locator('#viewer-bar').isVisible(), true);
        const result = { name, viewport, compact, geometries: {} }, images = [];
        for (const geometry of ['bifilar', 'coaxial', 'placas']) {
          await page.click(`[data-type="${geometry}"]`); await settle(page);
          const callouts = await page.locator('#viewer-callouts .callout').count();
          assert.ok(callouts >= 3, `${geometry}: etiquetas`);
          const image = await page.locator('#viewer-canvas').screenshot();
          assert.ok(image.length > 6000, `${geometry}: lienzo sin dibujo (${image.length} bytes)`);
          images.push(image.toString('base64'));
          result.geometries[geometry] = { callouts, canvasPngBytes: image.length, note: await page.textContent('#viewer-scale-note') };
        }
        assert.equal(new Set(images).size, 3, 'cada geometría debe dibujar un modelo distinto');
        // Las cotas reflejan las entradas escritas.
        await page.click('[data-type="coaxial"]'); await page.fill('#innerRadius', '0.52'); await settle(page);
        assert.match(await page.textContent('#viewer-callouts'), /a = 0\.52 mm/);
        assert.match(await page.textContent('#viewer-callouts'), /b = 2 mm/);
        for (const view of ['front', 'side', 'iso']) {
          await page.click(`[data-view="${view}"]`); await settle(page);
          assert.equal(await page.getAttribute(`[data-view="${view}"]`, 'aria-pressed'), 'true');
        }
        await page.click('#viewer-zoom-in'); await page.click('#viewer-zoom-out');
        await page.uncheck('#viewer-labels'); await settle(page);
        assert.equal(await page.locator('#viewer-callouts').isVisible(), false);
        await page.check('#viewer-labels');
        // Geometría no válida: aviso en el visor, sin modelo inventado.
        await page.fill('#innerRadius', '5'); await settle(page);
        assert.equal(await page.locator('#viewer-note').isVisible(), true);
        await page.fill('#innerRadius', '0.52'); await settle(page);
        assert.equal(await page.locator('#viewer-note').isVisible(), false);
        await page.click('#viewer-expand'); await settle(page); // De vuelta al modo compacto.
        assert.equal(await page.locator('#viewer-bar').isVisible(), false);
        await page.selectOption('#dielectric', 'ptfe'); await page.click('#configuration-form button[type="submit"]'); await settle(page);
        await page.screenshot({ path: path.join(out, `${name}-light.png`), fullPage: true });
        await page.click('#theme-toggle'); await settle(page);
        await page.screenshot({ path: path.join(out, `${name}-dark.png`), fullPage: true });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        assert.ok(overflow <= 1, `desbordamiento horizontal ${overflow}`);
        assert.deepEqual(errors, []); assert.deepEqual(requests, []);
        result.pageErrors = errors; result.httpRequests = requests; report.contexts.push(result);
        console.log(`${name}: visor 3D, tres geometrías, vistas, etiquetas, validación y tema OK`);
      } finally { await context.close(); }
    }
    // Respaldo: sin WebGL se conserva la ilustración plana y la app sigue calculando.
    const { context, page, errors } = await open(browser, { width: 1440, height: 1000 }, { webgl: false });
    try {
      assert.equal(await page.evaluate(() => LineaLabViewer3D.isRunning()), false);
      assert.equal(await page.locator('#viewer-stage').isVisible(), false);
      assert.equal(await page.locator('#viewer-bar').isVisible(), false);
      assert.equal(await page.locator('#line-illustration svg').isVisible(), true);
      await page.click('[data-type="coaxial"]'); await page.click('#configuration-form button[type="submit"]');
      assert.equal(await page.locator('[data-primary-value]').count(), 4);
      await page.screenshot({ path: path.join(out, 'fallback-sin-webgl.png') });
      assert.deepEqual(errors, []);
      report.fallbackWithoutWebGL = true;
      console.log('sin WebGL: ilustración plana de respaldo y cálculo OK');
    } finally { await context.close(); }
    report.status = 'passed';
  } catch (error) { report.status = 'failed'; report.error = error.stack; throw error; }
  finally { await browser.close(); fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n'); }
})().catch(error => { console.error(error); process.exitCode = 1; });
