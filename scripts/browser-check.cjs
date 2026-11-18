'use strict';
/* Integración real con Chromium/Plotly, sin servidor ni modificar políticas.
 * Ejecutar: node scripts/browser-check.cjs (Playwright opcional para desarrollo).
 * Se cargan los archivos íntegros en un documento de prueba about:blank. La
 * navegación a file:// o al sitio publicado se documenta como prueba separada.
 */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.resolve(process.env.LINEALAB_EVIDENCE || path.join(root, 'validation/browser'));
fs.mkdirSync(output, { recursive: true });
const scripts = ['calculations.js','secondary.js','sweep.js','charts.js','vendor/plotly-basic-2.35.2.min.js','app.js','analysis.js','vendor/three-0.147.0.min.js','vendor/three-0.147.0-OrbitControls.js','vendor/three-0.147.0-RoomEnvironment.js','viewer3d.js'];
const magnitudes = require('../sweep.js').MAGNITUDES;
const report = { generatedAtUTC: new Date().toISOString(), harness: 'Chromium real con documento in-memory, recursos locales íntegros; sin navegación file:// ni HTTP', offline: true, contexts: [], pending: ['Navegación real al sitio publicado o por file:// en este entorno', 'Dispositivo móvil físico y navegadores distintos de Chromium', 'Apertura real en Microsoft Excel'] };
const executable = process.env.LINEALAB_CHROMIUM || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
async function ready(page) { await page.waitForFunction(() => !document.querySelector('#download-png').disabled); }
async function install(page) {
  const html = fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*href="styles.css"[^>]*>/i,'');
  await page.setContent(html);
  await page.addStyleTag({ path: path.join(root,'styles.css') });
  for (const file of scripts) await page.addScriptTag({ path: path.join(root,file) });
  assert.equal(await page.evaluate(() => Plotly.version),'2.35.2');
}
async function runContext(browser, name, viewport, mobile) {
  const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1, offline: true, acceptDownloads: true });
  try {
    const page = await context.newPage();
    const errors = [], requests = [];
    page.on('pageerror',error => errors.push(error.message));
    page.on('request',request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
    await install(page);
    const result = { name, viewport, mobileEmulated: mobile, matrix: [], png: null, csv: null };
    for (const geometry of ['bifilar','coaxial','placas']) {
      await page.click(`[data-type="${geometry}"]`);
      await page.selectOption('#dielectric','ptfe');
      await page.click('#configuration-form button[type="submit"]');
      assert.equal(await page.locator('[data-primary-value]').count(),4);
      assert.equal(await page.locator('[data-secondary-value]').count(),6);
      const individual = await page.locator('#results-table').innerHTML();
      for (const points of [10,100,500]) {
        await page.click('#chart-tab');await page.fill('#sweep-points',String(points)); await page.click('#generate-analysis'); await ready(page);
        assert.equal(await page.locator('#sweep-results-table tr').count(),points);
        assert.equal(await page.locator('#results-table').innerHTML(),individual);
        for (const magnitude of magnitudes) {
          await page.selectOption('#plot-magnitude',magnitude.key); await ready(page);
          const data = await page.evaluate(() => {
            const p=document.querySelector('#plot-container');
            return {points:p.data[0].y.length,name:p.data[0].name,valid:p.data[0].y.every(Number.isFinite),svg:p.querySelectorAll('.scatterlayer .trace').length};
          });
          assert.equal(data.points,points); assert.ok(data.valid && data.svg>0); assert.ok(data.name.includes(magnitude.unit));
        }
        result.matrix.push({geometry,points,magnitudesRendered:11});
      }
      console.log(`${name}: ${geometry}, barridos 10/100/500 y once magnitudes OK`);
    }
    // Caso reproducible para descargas y evidencia visual.
    await page.click('[data-type="coaxial"]'); await page.selectOption('#dielectric','ptfe');
    await page.click('#configuration-form button[type="submit"]');
    await page.click('#chart-tab');await page.fill('#sweep-points','100'); await page.click('#generate-analysis'); await ready(page);
    await page.selectOption('#plot-magnitude','R'); await ready(page);
    assert.equal(await page.locator('.legendtext').first().evaluate(node => getComputedStyle(node).textAnchor),'start');
    await page.selectOption('#plot-scale','linear'); await ready(page);
    assert.equal(await page.evaluate(() => document.querySelector('#plot-container')._fullLayout.xaxis.type),'linear');
    await page.selectOption('#plot-scale','log'); await ready(page);
    // Arrastre real con ratón: genera el evento de zoom de Plotly.
    await page.locator('#plot-container').scrollIntoViewIfNeeded();
    const drag = await page.locator('#plot-container .nsewdrag').boundingBox();
    assert.ok(drag && drag.width>50);
    await page.mouse.move(drag.x+drag.width*0.2,drag.y+drag.height*0.2);
    await page.mouse.down();await page.mouse.move(drag.x+drag.width*0.7,drag.y+drag.height*0.8,{steps:12});await page.mouse.up();
    await page.waitForFunction(() => document.querySelector('#plot-container')._fullLayout.xaxis.autorange === false);
    result.zoom = 'Arrastre real y autorange=false verificados';
    await page.click('#reset-zoom');
    await page.waitForFunction(() => document.querySelector('#plot-container')._fullLayout.xaxis.autorange === true);
    result.resetZoom = true;
    const point = await page.locator('#plot-container .scatterlayer .point').nth(50).boundingBox();
    await page.mouse.move(point.x+point.width/2,point.y+point.height/2);
    await page.waitForSelector('#plot-container .hoverlayer .hovertext');
    result.hover = (await page.locator('#plot-container .hoverlayer').textContent()).includes('Frecuencia');
    assert.ok(result.hover);
    const pngPromise = page.waitForEvent('download');await page.click('#download-png');const png = await pngPromise;
    const pngPath = path.join(output,`${name}-plot.png`);await png.saveAs(pngPath);assert.equal(await png.failure(),null);
    const bytes=fs.readFileSync(pngPath);assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16),2200);assert.equal(bytes.readUInt32BE(20),1200);
    result.png={file:path.basename(pngPath),bytes:bytes.length,width:2200,height:1200};
    const csvPromise = page.waitForEvent('download');await page.click('#export-csv');const csv = await csvPromise;
    const csvPath = path.join(output,`${name}-coaxial.csv`);await csv.saveAs(csvPath);assert.equal(await csv.failure(),null);
    const text=fs.readFileSync(csvPath,'utf8');assert.ok(text.startsWith('\uFEFF'));assert.equal(text.split('\r\n').length,102);
    result.csv={file:path.basename(csvPath),rows:100,bytes:Buffer.byteLength(text)};
    await page.screenshot({path:path.join(output,`${name}-screen.png`),fullPage:true});
    if (mobile) await page.tap('#sweep-table-tab'); else await page.click('#sweep-table-tab');
    await page.locator('#sweep-table-view').waitFor({state:'visible'});
    const dimensions = await page.evaluate(() => ({page:document.documentElement.scrollWidth,viewport:innerWidth,table:document.querySelector('.sweep-table-scroll').scrollWidth,container:document.querySelector('.sweep-table-scroll').clientWidth}));
    assert.ok(dimensions.viewport<=viewport.width+1 && dimensions.page<=viewport.width+1,JSON.stringify(dimensions));
    assert.ok(dimensions.table>dimensions.container,JSON.stringify(dimensions)); result.layout=dimensions;
    if (mobile) await page.screenshot({path:path.join(output,'mobile-table.png'),fullPage:true});
    await page.click('button[type="reset"]');
    await page.waitForFunction(() => document.querySelector('#sweep-status').textContent.includes('restablecido'));
    assert.equal(await page.locator('[data-primary-value]').count(),0);assert.equal(await page.locator('[data-secondary-value]').count(),0);
    assert.equal(await page.inputValue('#sweep-points'),'100');assert.ok(await page.locator('#export-csv').isDisabled());
    await page.fill('#frequency','0');await page.click('#configuration-form button[type="submit"]');
    assert.equal(await page.getAttribute('#frequency','aria-invalid'),'true');
    await page.fill('#frequency','100');await page.fill('#separation','0.5');await page.click('#configuration-form button[type="submit"]');
    assert.equal(await page.getAttribute('#separation','aria-invalid'),'true');
    await page.click('#chart-tab');await page.fill('#sweep-points','9');await page.click('#generate-analysis');
    assert.equal(await page.getAttribute('#sweep-points','aria-invalid'),'true');
    result.validationAndReset=true;
    assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
    result.pageErrors=errors;result.httpRequests=requests;report.contexts.push(result);
  } finally { await context.close(); }
}
(async()=>{
  const browser=await chromium.launch({executablePath:executable,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  try {
    report.browser=browser.version();report.playwright=require('playwright/package.json').version;
    await runContext(browser,'desktop',{width:1440,height:1000},false);
    await runContext(browser,'mobile',{width:390,height:844},true);
    report.status='passed';
  } catch(error) {report.status='failed';report.error=error.stack;throw error;}
  finally {await browser.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');}
})().catch(error=>{console.error(error);process.exitCode=1;});
