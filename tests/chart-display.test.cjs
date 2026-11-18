'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { buildPlot, presentation } = require('../charts.js');
const { MAGNITUDES, runSweep, toCSV } = require('../sweep.js');
function series(key, values) {
  const magnitude = MAGNITUDES.find(item => item.key === key);
  return { options:{unit:'MHz'}, rows:values.map((value,index) => ({
    frequencyHz:(index+1)*1e6, valid:value!==null, warnings:[],
    primary:{[key]:value}, secondary:magnitude.component ? {Z0:{[magnitude.component]:value}} : {[key]:value}
  })) };
}
const near = (actual,expected) => assert.ok(Math.abs(actual/expected-1)<2e-15,`${actual} != ${expected}`);

test('L constante 2.69415e-7 H/m: µH/m y rango relativo, sin ±1', () => {
  const spec=buildPlot(series('L',Array(10).fill(2.69415e-7)),'L','log');
  assert.equal(spec.presentation.unit,'µH/m'); assert.equal(spec.presentation.factor,1e-6);
  near(spec.data[0].y[0],0.269415);
  const [lo,hi]=spec.layout.yaxis.range;
  assert.ok(lo>0 && lo<0.269415 && hi>0.269415 && hi<0.3);
  assert.equal(spec.layout.yaxis.autorange,false);
  assert.match(spec.layout.annotations[0].text,/Constante: 0.269415 µH\/m/);
  assert.equal(new Set(spec.data[0].y).size,1); assert.ok(spec.data[0].line.width>=3);
});
test('Capacitancia constante: prefijos pF/m y nF/m coherentes con los datos', () => {
  for (const [value,unit,expected] of [[8.42738e-11,'pF/m',84.2738],[2.5e-9,'nF/m',2.5]]) {
    const spec=buildPlot(series('C',[value,value,value]),'C','linear');
    assert.equal(spec.presentation.unit,unit);near(spec.data[0].y[0],expected);
    assert.match(spec.layout.yaxis.title.text,new RegExp(unit));assert.match(spec.data[0].name,new RegExp(unit));
    near(spec.data[0].y[0]*spec.presentation.factor,value);
  }
});
test('Series variables diminutas mantienen variación y un margen proporcionado', () => {
  const values=[1e-15,1.2e-15,2e-15];const spec=buildPlot(series('C',values),'C','log');
  assert.equal(spec.presentation.unit,'fF/m');assert.equal(spec.presentation.constant,false);
  assert.deepEqual(spec.layout.annotations,[]);near(spec.data[0].y[0],1);near(spec.data[0].y[2],2);
  assert.ok(spec.layout.yaxis.range[0]>0 && spec.layout.yaxis.range[1]<3);
});
test('Cero auténtico: marca única 0 y anotación explícita, sin etiquetas ±1', () => {
  const spec=buildPlot(series('G',[0,0,0]),'G','linear');
  assert.equal(spec.presentation.zero,true);assert.equal(spec.presentation.unit,'S/m');
  assert.deepEqual(spec.layout.yaxis.tickvals,[0]);assert.deepEqual(spec.layout.yaxis.ticktext,['0']);
  assert.match(spec.layout.annotations[0].text,/exactamente cero: 0 S\/m/);
  assert.deepEqual(spec.data[0].y,[0,0,0]);assert.equal(spec.data[0].customdata[0][1],'0');
  assert.ok(spec.layout.yaxis.range[0]<0 && spec.layout.yaxis.range[1]>0); // Línea centrada, no cortada.
});
test('Un valor muy pequeño no se clasifica como cero y los huecos siguen siendo huecos', () => {
  const value=1e-30;const spec=buildPlot(series('C',[value,null,value]),'C','log');
  assert.equal(spec.presentation.zero,false);assert.equal(spec.presentation.constant,true);
  assert.equal(spec.data[0].y[1],null);assert.equal(spec.data[0].customdata[1][1],null);
  assert.equal(spec.data[0].connectgaps,false);assert.ok(spec.data[0].y[0]>0);
  assert.equal(spec.data[0].customdata[0][1],String(value));
});
test('Serie casi constante: conserva la variación sin inventar constancia', () => {
  const a=1e-7,b=a*(1+1e-12);const spec=buildPlot(series('L',[a,b]),'L','linear');
  assert.equal(spec.presentation.constant,false);assert.equal(spec.layout.annotations.length,0);
  assert.notEqual(spec.data[0].y[0],spec.data[0].y[1]);
  assert.ok(spec.layout.yaxis.range[0]<spec.data[0].y[0] && spec.layout.yaxis.range[1]>spec.data[0].y[1]);
});
test('Valores constantes negativos y de ambos signos conservan el signo y su escala', () => {
  const spec=buildPlot(series('Z0Imaginary',[-0.002,-0.002]),'Z0Imaginary','log');
  assert.equal(spec.presentation.unit,'mΩ');near(spec.data[0].y[0],-2);
  assert.ok(spec.layout.yaxis.range[0]<-2 && spec.layout.yaxis.range[1]>-2 && spec.layout.yaxis.range[1]<0);
  const mixed=buildPlot(series('Z0Imaginary',[-1e-9,0,1e-9]),'Z0Imaginary','linear');
  assert.ok(mixed.layout.yaxis.range[0]<0 && mixed.layout.yaxis.range[1]>0);assert.equal(mixed.presentation.constant,false);
});
test('Hover: conserva la cadena SI round-trip completa, además del valor de la unidad visual', () => {
  const value=2.7725887218737085e-7;const spec=buildPlot(series('L',[value,value]),'L','log');
  assert.equal(spec.data[0].customdata[0][1],String(value));
  assert.equal(Number(spec.data[0].customdata[0][1]),value);
  assert.match(spec.data[0].hovertemplate,/Valor SI: %{customdata\[1\]} H\/m/);
  assert.match(spec.data[0].hovertemplate,/µH\/m/);
});
test('Sin muestras válidas: no anota cero ni inventa datos', () => {
  const spec=buildPlot(series('L',[null,null]),'L','linear');
  assert.equal(spec.presentation.zero,false);assert.equal(spec.presentation.constant,false);
  assert.equal(spec.presentation.range,null);assert.deepEqual(spec.layout.annotations,[]);
  assert.deepEqual(spec.data[0].y,[null,null]);
});
test('Escalas extremas finitas no generan límites infinitos', () => {
  const magnitude=MAGNITUDES.find(item=>item.key==='beta');
  for (const value of [1e-300,1e300,Number.MAX_VALUE,Number.MIN_VALUE]) {
    const view=presentation([value,value],magnitude);
    assert.ok(view.range.every(Number.isFinite));assert.ok(view.range[0]<view.y[0] && view.range[1]>view.y[0]);
    assert.equal(view.zero,false);
  }
});
test('Vista y cambio de tema no mutan resultados, frecuencias, tarjetas ni CSV', () => {
  const analysis=runSweep({type:'coaxial',geometry:{innerRadius:0.5,outerRadius:2},frequency:100,frequencyUnit:'MHz',conductivity:5.8e7,relativePermittivity:2.1,lossTangent:0.0002,length:1},{start:1,end:1000,unit:'MHz',points:10,scale:'log'});
  const before=JSON.stringify(analysis),csv=toCSV(analysis);
  for(const magnitude of MAGNITUDES)for(const theme of ['light','dark']) {
    const spec=buildPlot(analysis,magnitude.key,'log',theme);
    assert.ok(spec.presentation.range.every(Number.isFinite));
  }
  assert.equal(JSON.stringify(analysis),before);assert.equal(toCSV(analysis),csv);
});
