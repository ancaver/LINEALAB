'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const engine=require('../parametric.js'),charts=require('../parametric-charts.js'),existing=require('../charts.js');
const c={type:'coaxial',frequency:100,frequencyUnit:'MHz',conductivity:5.8e7,relativePermittivity:2.1,lossTangent:.0002,length:100,geometry:{innerRadius:.5,outerRadius:2}};
const make=(patch={})=>engine.runParametric(c,{variable:'innerRadius',mode:'ratio',ratio:4,start:.4,end:.8,points:11,scale:'linear',...patch});
test('Gráfica geométrica: once magnitudes, x en mm, y con la presentación existente',()=>{
 const a=make(),snapshot=structuredClone(a);
 for(const m of engine.MAGNITUDES) for(const scale of ['linear','log']) {
  const p=charts.buildPlot(a,m.key,scale);
  assert.deepEqual(p.data[0].x,a.rows.map(row=>row.valueMm));assert.equal(p.layout.xaxis.type,scale);assert.match(p.layout.xaxis.title.text,/a \[mm\]/);
  assert.deepEqual(p.presentation,existing.presentation(a.rows.map(row=>engine.getMagnitude(row,m.key)),m));
  assert.ok(p.data[0].y.every(Number.isFinite));assert.ok(p.layout.yaxis.title.text.endsWith(`[${p.presentation.unit}]`));assert.equal(p.data[0].connectgaps,false);
 }
 assert.deepEqual(a,snapshot);
});
test('Cursor geométrico: dimensión variable/vinculada, frecuencia fija, valor SI y avisos',()=>{
 const a=make(),p=charts.buildPlot(a,'alphaDb','linear'),d=p.data[0].customdata[0];
 assert.equal(d[1],String(a.rows[0].secondary.alphaDb));assert.equal(d[3],'0.4');assert.equal(d[4],'a = 0.4 mm<br>b = 1.6 mm');assert.equal(d[5],'100000000');assert.match(d[0],/1 aviso/);
 assert.match(p.data[0].hovertemplate,/Frecuencia fija/);assert.match(p.data[0].hovertemplate,/Valor SI/);
});
test('Gráfica geométrica: constante pequeña, cero exacto y prefijos sólo visuales',()=>{
 const a=make();a.rows.forEach(row=>{row.primary.L=2.69415e-7;row.primary.G=0;});
 const snapshot=structuredClone(a),L=charts.buildPlot(a,'L','linear'),G=charts.buildPlot(a,'G','linear');
 assert.equal(L.presentation.constant,true);assert.equal(L.presentation.unit,'µH/m');assert.equal(L.data[0].y[0],.269415);
 assert.ok(L.layout.yaxis.range[0]>0 && L.layout.yaxis.range[0]<.269415 && L.layout.yaxis.range[1]>.269415);assert.match(L.layout.annotations[0].text,/Constante/);
 assert.equal(G.presentation.zero,true);assert.deepEqual(G.layout.yaxis.ticktext,['0']);assert.match(G.layout.annotations[0].text,/exactamente cero/);assert.deepEqual(a,snapshot);
});
test('Gráfica geométrica: rechazos como huecos; intervalo sin puntos válidos',()=>{
 for(const start of [1,2]) {
  const a=make({mode:'fixed',start,end:3}),p=charts.buildPlot(a,'L','linear');
  for(const [i,row] of a.rows.entries()) assert.equal(p.data[0].y[i]===null,!row.valid);
  assert.equal(p.data[0].connectgaps,false);
 }
});
test('Gráfica geométrica: negativos, tema oscuro y descarga con nombre geométrico',()=>{
 const p=charts.buildPlot(make(),'Z0Imaginary','log','dark');
 assert.ok(p.data[0].y.every(value=>value<0));assert.ok(p.layout.yaxis.range[1]<0);assert.equal(p.layout.paper_bgcolor,'#0c1a2b');
 assert.equal(p.config.toImageButtonOptions.filename,'LINEALAB-geometria-a-Z0Imaginary');assert.equal(p.config.responsive,true);
});
