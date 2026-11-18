'use strict';
/* Integración geométrica en el mismo modo de prueba del proyecto: Chromium
 * headless, documento in-memory, recursos locales y red desactivada.
 * No comprueba navegación HTTP/file://, GPU ni un dispositivo móvil físico.
 */
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'validation/parametric');fs.mkdirSync(out,{recursive:true});
const scripts=['calculations.js','secondary.js','sweep.js','charts.js','vendor/plotly-basic-2.35.2.min.js','app.js','analysis.js','parametric.js','parametric-charts.js','parametric-ui.js','vendor/three-0.147.0.min.js','vendor/three-0.147.0-OrbitControls.js','vendor/three-0.147.0-RoomEnvironment.js','viewer3d.js'];
const report={generatedAtUTC:new Date().toISOString(),harness:'Chromium real en documento in-memory, recursos locales íntegros, sin navegación HTTP/file://',offline:true,contexts:[],pending:['Navegación al sitio publicado y file://','Móvil físico, Safari/Firefox','Apertura del CSV geométrico en Excel/LibreOffice','GPU física']};
const variants=[['bifilar','radius',.2,.8,'fixed'],['bifilar','separation',1.1,10,'fixed'],['coaxial','innerRadius',.2,1.5,'fixed'],['coaxial','innerRadius',.4,.8,'ratio'],['coaxial','outerRadius',.6,3,'fixed'],['placas','width',1,30,'fixed'],['placas','gap',.2,3,'fixed']];
const ready=page=>page.waitForFunction(()=>!document.querySelector('#parametric-download-png').disabled);
async function install(page) {
 await page.setContent(fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*href="styles.css"[^>]*>/i,''));
 await page.addStyleTag({path:path.join(root,'styles.css')});for(const file of scripts) await page.addScriptTag({path:path.join(root,file)});
}
async function range(page,start,end,points=11) {
 await page.fill('#parametric-start',String(start));await page.fill('#parametric-end',String(end));await page.fill('#parametric-points',String(points));await page.click('#generate-parametric');
}
async function capture(page,name) {
 await page.mouse.move(0,0);await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(out,name),fullPage:true,animations:'disabled'});
}
async function csv(page,button,file) {
 const promise=page.waitForEvent('download');await page.click(button);const d=await promise;assert.equal(await d.failure(),null);await d.saveAs(path.join(out,file));return fs.readFileSync(path.join(out,file),'utf8');
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.LINEALAB_CHROMIUM || '/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});report.browser=browser.version();report.playwright=require('playwright/package.json').version;
 try {
  for(const width of [1440,390]) {
   const name=width===1440?'desktop':'mobile',context=await browser.newContext({viewport:{width,height:1000},isMobile:width===390,hasTouch:width===390,offline:true,acceptDownloads:true});
   try {
    const page=await context.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())) requests.push(r.url());});await install(page);
    const result={width,mobileEmulated:width===390,matrix:[]};assert.equal(await page.locator('[role="tab"]').count(),4);
    await page.click('#chart-tab');await page.click('#analysis-mode-geometry');
    for(const [type,variable,start,end,mode] of variants) {
     await page.click(`[data-type="${type}"]`);await page.selectOption('#dielectric','ptfe');await page.selectOption('#parametric-variable',variable);
     if(type==='coaxial' && variable==='innerRadius') await page.selectOption('#parametric-mode',mode);
     if(mode==='ratio') await page.fill('#parametric-ratio','4');
     const state=await page.evaluate(()=>JSON.stringify(LineaLabUI.modelState()));
     for(const points of [10,100,500]) {
      await range(page,start,end,points);await ready(page);
      assert.equal(await page.locator('#parametric-results-table tr').count(),points);
      const data=await page.evaluate(()=>{const p=document.querySelector('#parametric-plot');return {x:p.data[0].x,y:p.data[0].y,label:p.layout.xaxis.title.text};});
      assert.equal(data.x[0],start);assert.equal(data.x.at(-1),end);assert.equal(data.x.length,points);assert.ok(data.y.every(Number.isFinite));assert.match(data.label,/\[mm\]/);
      assert.equal(await page.evaluate(()=>JSON.stringify(LineaLabUI.modelState())),state);
      result.matrix.push({type,variable,mode,points});
     }
    }
    console.log(`${name}: siete variantes × 10/100/500 puntos OK`);
    // Ejemplo obligatorio, usando el formulario principal real.
    await page.click('[data-type="coaxial"]');await page.selectOption('#dielectric','ptfe');await page.fill('#length','100');
    await page.click('#configuration-form button[type="submit"]');await page.click('#generate-analysis-side');
    await page.waitForFunction(()=>!document.querySelector('#download-png').disabled);
    const frequencyTable=await page.locator('#sweep-results-table').innerHTML(),individual=await page.locator('#results-table').innerHTML();
    await page.click('#analysis-mode-geometry');await page.locator('#parametric-example > summary').click();await page.click('#parametric-load-example');await page.click('#generate-parametric');await ready(page);
    assert.equal(await page.locator('#sweep-results-table').innerHTML(),frequencyTable);assert.equal(await page.locator('#results-table').innerHTML(),individual);
    const references=await page.evaluate(()=>[0,5,10].map(i=>{const r=document.querySelectorAll('#parametric-results-table tr')[i];return {a:Number(r.cells[0].textContent),geometry:r.cells[1].textContent,alphaDb:Number(r.cells[11].textContent)};}));
    for(const [i,expected] of [.1008867,.0681374,.0517626].entries()) assert.ok(Math.abs(references[i].alphaDb-expected)<=5e-8,JSON.stringify(references));
    result.references=references;const table=await page.locator('#parametric-results-table').innerHTML();
    for(const m of require('../parametric.js').MAGNITUDES) {
     await page.selectOption('#parametric-magnitude',m.key);await ready(page);
     assert.ok(await page.evaluate(()=>document.querySelector('#parametric-plot').data[0].y.every(Number.isFinite)));
     assert.equal(await page.locator('#parametric-results-table').innerHTML(),table);
    }
    result.magnitudes=11;await page.selectOption('#parametric-magnitude','alphaDb');await ready(page);
    await page.locator('#parametric-plot').scrollIntoViewIfNeeded();
    const point=await page.locator('#parametric-plot .scatterlayer .point').nth(5).boundingBox();await page.mouse.move(point.x+point.width/2,point.y+point.height/2);
    await page.waitForSelector('#parametric-plot .hoverlayer .hovertext');const hover=await page.locator('#parametric-plot .hoverlayer').textContent();
    const raw=await page.evaluate(()=>document.querySelector('#parametric-plot').data[0].customdata[5][1]);assert.ok(hover.includes(raw));assert.match(hover,/Frecuencia fija: 100000000 Hz/);assert.match(hover,/a = .*mm/);assert.match(hover,/b = .*mm/);result.hoverExactSI=true;
    const drag=await page.locator('#parametric-plot .nsewdrag').boundingBox();await page.mouse.move(drag.x+drag.width*.2,drag.y+drag.height*.2);await page.mouse.down();await page.mouse.move(drag.x+drag.width*.7,drag.y+drag.height*.8,{steps:12});await page.mouse.up();
    await page.waitForFunction(()=>document.querySelector('#parametric-plot')._fullLayout.xaxis.autorange===false);await page.click('#parametric-reset-zoom');await page.waitForFunction(()=>document.querySelector('#parametric-plot')._fullLayout.xaxis.autorange===true);result.zoomAndReset=true;
    const text=await csv(page,'#parametric-export-csv',`${name}-geometry.csv`);assert.ok(text.startsWith('\uFEFF'));assert.ok(text.includes('0.10088669473051273'));assert.equal(text.split('\r\n').length,13);
    await page.click('#sweep-table-tab');assert.equal(await csv(page,'#parametric-table-csv',`${name}-table.csv`),text);
    const dimensions=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:innerWidth,table:document.querySelector('#geometry-table-panel .table-scroll').scrollWidth,container:document.querySelector('#geometry-table-panel .table-scroll').clientWidth}));assert.ok(dimensions.page<=width+1,JSON.stringify(dimensions));assert.ok(dimensions.table>dimensions.container);result.layout=dimensions;result.identicalCSVs=true;
    await capture(page,`${name}-table.png`);await page.click('#chart-tab');await ready(page);
    const pngPromise=page.waitForEvent('download');await page.click('#parametric-download-png');const png=await pngPromise;await png.saveAs(path.join(out,`${name}-plot.png`));assert.equal(await png.failure(),null);
    const bytes=fs.readFileSync(path.join(out,`${name}-plot.png`));assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),2200);assert.equal(bytes.readUInt32BE(20),1200);result.png={width:2200,height:1200,bytes:bytes.length};
    await capture(page,`${name}-light.png`);const before=await page.evaluate(()=>JSON.stringify(document.querySelector('#parametric-plot').data[0].y));await page.click('#theme-toggle');await ready(page);assert.equal(await page.evaluate(()=>document.querySelector('#parametric-plot').layout.paper_bgcolor),'#0c1a2b');assert.equal(await page.evaluate(()=>JSON.stringify(document.querySelector('#parametric-plot').data[0].y)),before);result.themePreservesResults=true;await capture(page,`${name}-dark.png`);
    await page.selectOption('#parametric-mode','fixed');await range(page,1,3,11);await ready(page);assert.ok(await page.evaluate(()=>document.querySelector('#parametric-plot').data[0].y.includes(null)));assert.ok((await page.locator('#parametric-results-table').innerHTML()).includes('Rechazado'));
    await range(page,2,3,11);assert.equal(await page.locator('#parametric-download-png').isDisabled(),true);assert.equal(await page.locator('#parametric-export-csv').isDisabled(),false);assert.match(await page.locator('#parametric-chart-message').textContent(),/No hay puntos válidos/);result.rejectedGapsAndEmpty=true;
    // G'=0 real, conservando una sola marca cero en el eje vertical.
    await page.selectOption('#dielectric','aire');await page.selectOption('#parametric-mode','ratio');await range(page,.4,.8,11);await ready(page);await page.selectOption('#parametric-magnitude','G');await ready(page);
    assert.deepEqual(await page.locator('#parametric-plot .ytick text').allTextContents(),['0']);assert.match(await page.locator('#parametric-plot .annotation-text').textContent(),/exactamente cero/);result.exactZero=true;
    await page.fill('#parametric-ratio','1');await page.click('#generate-parametric');assert.equal(await page.getAttribute('#parametric-ratio','aria-invalid'),'true');
    await page.click('button[type="reset"]');await page.waitForFunction(()=>document.querySelector('#parametric-status').textContent.includes('restablecido'));assert.equal(await page.locator('#parametric-export-csv').isDisabled(),true);assert.equal(await page.getAttribute('#summary-tab','aria-selected'),'true');result.validationAndReset=true;
    assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);result.pageErrors=errors;result.httpRequests=requests;report.contexts.push(result);console.log(`${name}: referencias, 11 magnitudes, hover, zoom, PNG/CSV, temas, huecos y cero exacto OK`);
   } finally { await context.close(); }
  }
  report.status='passed';
 } catch(error) { report.status='failed';report.error=error.stack;throw error; }
 finally {await browser.close();fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify(report,null,2)+'\n');}
})().catch(error=>{console.error(error);process.exitCode=1;});
