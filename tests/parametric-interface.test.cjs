'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./dom-fixture.cjs');
const settle=async()=>{await Promise.resolve();await Promise.resolve();};
function setup(plotly=true) {
 const f=fixture({analysis:true,parametric:true,plotly});
 f.options[1].fire('click');f.node('dielectric').value='ptfe';f.node('configuration-form').fire('change',{target:f.node('dielectric')});f.node('parametric-load-example').click();
 return f;
}
test('Interfaz geométrica: modos disponibles y cuatro pestañas originales',()=>{
 const f=setup(),n=f.node;assert.equal(f.tabs.length,4);assert.equal(n('geometry-chart-panel').hidden,true);
 n('chart-tab').click();assert.equal(n('analysis-modes').hidden,false);n('analysis-mode-geometry').click();
 assert.equal(n('frequency-chart-panel').hidden,true);assert.equal(n('geometry-chart-panel').hidden,false);assert.equal(n('analysis-mode-geometry').attrs['aria-pressed'],'true');
 n('sweep-table-tab').click();assert.equal(n('geometry-table-panel').hidden,false);n('summary-tab').click();assert.equal(n('analysis-modes').hidden,true);
});
test('Interfaz geométrica: ejemplo, once filas y referencias visibles sin alterar configuración',async()=>{
 const f=setup(),n=f.node;f.submit();const c=JSON.stringify(f.window.LineaLabUI.readConfiguration()),table=n('results-table').innerHTML,model=JSON.stringify(f.window.LineaLabUI.modelState());
 f.generateParametric();await settle();assert.equal((n('parametric-results-table').innerHTML.match(/<tr/g)||[]).length,11);
 for(const value of ['0.10088669','0.068137406','0.05176264','a = 0.4 · b = 1.6','a = 0.6 · b = 2.4','a = 0.8 · b = 3.2']) assert.ok(n('parametric-results-table').innerHTML.includes(value),value);
 assert.equal(n('results-table').innerHTML,table);assert.equal(JSON.stringify(f.window.LineaLabUI.readConfiguration()),c);assert.equal(JSON.stringify(f.window.LineaLabUI.modelState()),model);
 assert.equal(n('parametric-download-png').disabled,false);assert.equal(n('chart-view').hidden,false);assert.match(n('parametric-summary').textContent,/b\/a = 4/);assert.match(n('parametric-warnings').innerHTML,/espesor/);
});
test('Interfaz geométrica: frecuencia y geometría conservan sus resultados y CSV independientes',async()=>{
 const f=setup(),n=f.node;f.generate();await settle();const table=n('sweep-results-table').innerHTML;
 n('export-csv').click();const csv=await f.downloads[0].blob.text();f.generateParametric();await settle();assert.equal(n('sweep-results-table').innerHTML,table);
 n('analysis-mode-frequency').click();n('export-csv').click();assert.equal(await f.downloads[1].blob.text(),csv);
 n('analysis-mode-geometry').click();n('parametric-export-csv').click();n('parametric-table-csv').click();assert.equal(await f.downloads[2].blob.text(),await f.downloads[3].blob.text());assert.notEqual(await f.downloads[2].blob.text(),csv);
 n('parametric-form').fire('input',{target:n('parametric-start')});assert.equal(n('parametric-table-csv').disabled,true);assert.equal(n('export-csv').disabled,false);assert.equal(n('sweep-results-table').innerHTML,table);
});
test('Interfaz geométrica: editar frecuencia no borra el análisis geométrico y viceversa',()=>{
 const f=setup(),n=f.node;f.generateParametric();const table=n('parametric-results-table').innerHTML;
 n('sweep-form').fire('input',{target:n('sweep-start')});assert.equal(n('parametric-results-table').innerHTML,table);assert.equal(n('parametric-export-csv').disabled,false);
});
test('Interfaz geométrica: siete variantes y restricciones de relación',()=>{
 const f=setup(),n=f.node;n('parametric-points').value='100';
 for(const [index,variable,symbol,mode] of [[0,'radius','a'],[0,'separation','D'],[1,'innerRadius','a'],[1,'innerRadius','a','ratio'],[1,'outerRadius','b'],[2,'width','w'],[2,'gap','d']]) {
  f.options[index].fire('click');n('parametric-variable').value=variable;n('parametric-form').fire('change',{target:n('parametric-variable')});
  assert.match(n('parametric-variable-heading').textContent,new RegExp(symbol+' \\[mm\\]'));
  assert.equal(n('parametric-mode-field').hidden,!(index===1 && variable==='innerRadius'));assert.equal(n('parametric-ratio').disabled,true);
  if(mode==='ratio') { n('parametric-mode').value=mode;n('parametric-form').fire('change',{target:n('parametric-mode')});assert.equal(n('parametric-ratio').disabled,false); }
  f.generateParametric();assert.match(n('parametric-status').textContent,/100 de 100 calculados/);
 }
});
test('Interfaz geométrica: errores globales y puntos rechazados con huecos',async()=>{
 const f=setup(),n=f.node;n('parametric-ratio').value='1';f.generateParametric();assert.equal(n('parametric-ratio').attrs['aria-invalid'],'true');assert.equal(n('parametric-ratio').focused,true);assert.equal(n('parametric-export-csv').disabled,true);
 n('parametric-mode').value='fixed';n('parametric-start').value='1';n('parametric-end').value='3';f.generateParametric();await settle();
 assert.match(n('parametric-results-table').innerHTML,/Rechazado/);assert.match(n('parametric-results-table').innerHTML,/radio b debe ser mayor/);assert.match(n('parametric-results-table').innerHTML,/—/);
 const graph=f.plots.filter(call=>call.type==='react' && call.args[0].id==='parametric-plot').at(-1);assert.ok(graph.args[1][0].y.includes(null));
 n('parametric-start').value='2';f.generateParametric();assert.equal(n('parametric-download-png').disabled,true);assert.equal(n('parametric-export-csv').disabled,false);assert.match(n('parametric-chart-message').textContent,/No hay puntos válidos/);
});
test('Interfaz geométrica: cambiar magnitud/eje, zoom y PNG no cambian la tabla',async()=>{
 const f=setup(),n=f.node;f.generateParametric();await settle();const table=n('parametric-results-table').innerHTML;
 n('parametric-magnitude').value='C';n('parametric-magnitude').fire('change');await settle();n('parametric-axis').value='log';n('parametric-axis').fire('change');await settle();
 const p=f.plots.at(-1);assert.equal(p.args[2].xaxis.type,'log');assert.match(p.args[2].xaxis.title.text,/mm/);assert.match(p.args[2].yaxis.title.text,/pF\/m/);assert.equal(n('parametric-results-table').innerHTML,table);
 n('parametric-reset-zoom').click();n('parametric-download-png').click();await settle();assert.ok(f.plots.some(p=>p.type==='relayout' && p.args[0].id==='parametric-plot'));assert.ok(f.plots.some(p=>p.type==='png' && p.args[1].filename.includes('geometria')));
});
test('Interfaz geométrica: cualquier entrada principal invalida ambas modalidades',()=>{
 const f=setup(),n=f.node;f.generate();f.generateParametric();n('configuration-form').fire('input',{target:n('frequency')});
 assert.equal(n('parametric-export-csv').disabled,true);assert.equal(n('export-csv').disabled,true);assert.match(n('parametric-results-table').innerHTML,/Pendiente/);assert.equal(n('parametric-plot').hidden,true);
});
test('Interfaz geométrica: restablecer recupera modos y valores iniciales',()=>{
 const f=setup(),n=f.node;f.generateParametric();n('configuration-form').reset();assert.equal(n('parametric-mode').value,'fixed');assert.equal(n('parametric-start').value,'0.25');assert.equal(n('parametric-points').value,'100');
 assert.equal(n('analysis-mode-frequency').attrs['aria-pressed'],'true');assert.equal(n('parametric-magnitude').value,'alphaDb');assert.equal(n('parametric-export-csv').disabled,true);
});
test('Interfaz geométrica: Plotly ausente no impide tabla/CSV y admite carga tardía',async()=>{
 const f=setup(false),n=f.node;f.generateParametric();assert.match(n('parametric-chart-message').textContent,/Cargando/);assert.equal(n('parametric-export-csv').disabled,false);
 n('plotly-script').fire('error');assert.match(n('parametric-chart-message').textContent,/No se pudo cargar/);f.installPlotly();n('plotly-script').fire('load');await settle();assert.equal(n('parametric-download-png').disabled,false);
});
test('Interfaz geométrica: promesa Plotly antigua no reactiva resultados invalidados',async()=>{
 let finish;const f=setup({react:()=>new Promise(resolve=>{finish=resolve;}),purge(){}}),n=f.node;
 f.generateParametric();n('parametric-form').fire('input');finish();await settle();assert.equal(n('parametric-plot').hidden,true);assert.equal(n('parametric-download-png').disabled,true);
});
