'use strict';
/* Prueba real de Plotly: escalas pequeñas/constantes/nulas y autoscale/reset.
 * Usa el mismo documento in-memory autorizado/documentado en browser-check.cjs.
 */
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'validation/chart-display');fs.mkdirSync(out,{recursive:true});
const scripts=['calculations.js','secondary.js','sweep.js','charts.js','vendor/plotly-basic-2.35.2.min.js','app.js','analysis.js','vendor/three-0.147.0.min.js','vendor/three-0.147.0-OrbitControls.js','vendor/three-0.147.0-RoomEnvironment.js','viewer3d.js'];
const report={harness:'Chromium real, recursos locales y documento in-memory, sin navegación HTTP/file://',offline:true,contexts:[]};
async function ready(page){await page.waitForFunction(()=>!document.querySelector('#download-png').disabled);}
async function hover(page,selector,expected){
 await page.locator(selector).scrollIntoViewIfNeeded();
 const box=await page.locator(selector+' .scatterlayer .point').nth(50).boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
 await page.waitForFunction(({selector,expected})=>document.querySelector(selector+' .hoverlayer').textContent.includes(expected),{selector,expected});
 return page.locator(selector+' .hoverlayer').textContent();
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.LINEALAB_CHROMIUM || '/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  report.browser=browser.version();
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:1000},offline:true,acceptDownloads:true});
   try{
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.setContent(fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*href="styles.css"[^>]*>/i,''));
    await page.addStyleTag({path:path.join(root,'styles.css')});for(const file of scripts)await page.addScriptTag({path:path.join(root,file)});
    const results={width,series:[]};
    for(const geometry of ['bifilar','coaxial','placas']){
     await page.click(`[data-type="${geometry}"]`);await page.click('#configuration-form button[type=submit]');await page.click('#generate-analysis-side');await ready(page);
     for(const key of ['L','C','G']){
      await page.selectOption('#plot-magnitude',key);await ready(page);
      const data=await page.evaluate(()=>{const p=document.querySelector('#plot-container');return {range:p._fullLayout.yaxis.range,y:p.data[0].y[0],name:p.data[0].name,raw:p.data[0].customdata[0][1],note:p.layout.annotations[0].text,ticks:[...p.querySelectorAll('.ytick text')].map(t=>t.textContent)};});
      if(key==='G'){assert.equal(data.y,0);assert.deepEqual(data.ticks,['0']);assert.match(data.note,/exactamente cero/);}
      else{assert.ok(data.range[0]>0 && data.range[0]<data.y && data.range[1]>data.y);assert.ok((data.range[1]-data.range[0])/data.y<0.11);assert.match(data.note,/Constante/);}
      const text=await hover(page,'#plot-container',data.raw);assert.ok(text.includes('Valor SI: '+data.raw));
      results.series.push({geometry,key,...data});
     }
    }
    // Funciones de restablecimiento del gráfico real, sin reintroducir ±1.
    await page.selectOption('#plot-magnitude','L');await ready(page);
    assert.ok(await page.locator('#plot-container .ytick text').count()>1);
    const home=await page.evaluate(()=>document.querySelector('#plot-container')._fullLayout.yaxis.range.slice());
    await page.evaluate(()=>Plotly.relayout(document.querySelector('#plot-container'),{'yaxis.autorange':false,'yaxis.range':[0,10]}));
    await page.click('#reset-zoom');
    await page.waitForFunction(expected=>{const r=document.querySelector('#plot-container')._fullLayout.yaxis.range;return r.every((v,i)=>Math.abs(v/expected[i]-1)<1e-12);},home);
    await page.locator('#plot-container [data-title="Autoscale"]').click();
    await page.waitForFunction(expected=>{const p=document.querySelector('#plot-container');return !p._fullLayout.yaxis.autorange && p._fullLayout.yaxis.range.every((v,i)=>Math.abs(v/expected[i]-1)<1e-12);},home);
    results.resetAndAutoscale=true;
    await page.click('#theme-toggle');await ready(page);
    assert.equal(await page.evaluate(()=>document.querySelector('#plot-container').layout.paper_bgcolor),'#0c1a2b');
    results.darkTheme=true;
    const pngPromise=page.waitForEvent('download');await page.click('#download-png');const png=await pngPromise;
    await png.saveAs(path.join(out,`constant-${width}.png`));assert.equal(await png.failure(),null);
    assert.equal(fs.readFileSync(path.join(out,`constant-${width}.png`)).subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    // Valor concreto del comentario, en un gráfico separado: datos sintéticos de prueba.
    await page.evaluate(async()=>{
     const analysis=LineaLabSweep.runSweep(LineaLabUI.readConfiguration(),{start:1,end:1000,unit:'MHz',points:100,scale:'log'});
     for(const row of analysis.rows)row.primary.L=2.69415e-7;
     const spec=LineaLabCharts.buildPlot(analysis,'L','log');
     const div=document.createElement('div');div.id='constant-example';div.style='width:700px;max-width:100%;height:390px';document.body.appendChild(div);
     await Plotly.newPlot(div,spec.data,spec.layout,spec.config);
    });
    const example=await page.evaluate(()=>{const p=document.querySelector('#constant-example');return {y:p.data[0].y[0],range:p._fullLayout.yaxis.range,note:p.layout.annotations[0].text};});
    assert.ok(Math.abs(example.y/0.269415-1)<1e-14);assert.match(example.note,/0.269415 µH\/m/);
    results.example={...example,hover:await hover(page,'#constant-example','2.69415e-7')};
    await page.mouse.move(0,0);
    await page.locator('#constant-example .hovertext').waitFor({state:'hidden'});
    await page.locator('#constant-example').screenshot({path:path.join(out,`example-${width}.png`)});
    assert.deepEqual(errors,[]);results.pageErrors=errors;report.contexts.push(results);
    console.log(`${width}px: 9 series constantes/nulas, hover SI íntegro, reset, autoscale, tema y PNG OK`);
   }finally{await context.close();}
  }
  report.status='passed';
 }catch(error){report.status='failed';report.error=error.stack;throw error;}
 finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');}
})().catch(error=>{console.error(error);process.exitCode=1;});
