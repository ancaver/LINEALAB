'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const engine=require('../parametric.js'),primary=require('../calculations.js'),secondary=require('../secondary.js'),frequency=require('../sweep.js');
const base=type=>({type,frequency:100,frequencyUnit:'MHz',conductivity:5.8e7,relativePermittivity:2.1,lossTangent:.0002,length:100,geometry:type==='coaxial'?{innerRadius:.5,outerRadius:2}:type==='bifilar'?{radius:.5,separation:5}:{width:20,gap:1}});
const options=(variable,start,end,extra={})=>({variable,start,end,points:11,scale:'linear',mode:'fixed',...extra});
const near=(value,expected,tolerance=2e-12)=>assert.ok(Math.abs(value/expected-1)<=tolerance,`${value} ≠ ${expected}`);
const variants=[
 ['bifilar','radius',.2,.8,{}],['bifilar','separation',1.1,10,{}],
 ['coaxial','innerRadius',.2,1.5,{}],['coaxial','innerRadius',.4,.8,{mode:'ratio',ratio:4}],['coaxial','outerRadius',.6,3,{}],
 ['placas','width',1,30,{}],['placas','gap',.2,3,{}]
];
for(const [a,b,expected] of [[.4,1.6,.1008867],[.6,2.4,.0681374],[.8,3.2,.0517626]]) {
 test(`Referencia coaxial independiente: a=${a} mm, b=${b} mm`,()=>{
  const result=engine.runParametric(base('coaxial'),options('innerRadius',a,a+.1,{mode:'ratio',ratio:4}));
  const row=result.rows[0];assert.equal(row.geometry.innerRadius,a);assert.equal(row.geometry.outerRadius,b);assert.equal(row.frequencyHz,1e8);
  assert.ok(Math.abs(row.secondary.alphaDb-expected)<=5e-8,`${row.secondary.alphaDb}`);
 });
}
for(const [type,variable,start,end,extra] of variants) {
 test(`Paramétrico: ${type} ${variable} ${extra.mode || 'fixed'}, 10/100/500 puntos y dos muestreos`,()=>{
  for(const points of [10,100,500]) for(const scale of ['linear','log']) {
   const c=base(type),snapshot=structuredClone(c);Object.freeze(c.geometry);Object.freeze(c);
   const result=engine.runParametric(c,options(variable,start,end,{...extra,points,scale}));
   assert.equal(result.rows.length,points);assert.equal(result.rows[0].valueMm,start);assert.equal(result.rows.at(-1).valueMm,end);
   assert.equal(result.successCount,points);assert.equal(result.rejectedCount,0);assert.deepEqual(c,snapshot);
   for(const [index,row] of result.rows.entries()) {
    if(index) assert.ok(row.valueMm>result.rows[index-1].valueMm);
    assert.equal(row.frequencyHz,1e8);assert.equal(row.geometry[variable],row.valueMm);
    for(const key of Object.keys(c.geometry)) if(key!==variable) assert.equal(row.geometry[key],extra.mode==='ratio'?row.valueMm*4:c.geometry[key]);
    const p=primary.calculatePrimary({...c,geometry:row.geometry}),s=secondary.calculateSecondary(p);
    assert.deepEqual(row.primary,p);assert.deepEqual(row.secondary,s);
    for(const m of engine.MAGNITUDES) assert.ok(Number.isFinite(engine.getMagnitude(row,m.key)));
    if(type==='bifilar') assert.ok(row.geometry.separation>2*row.geometry.radius);
    if(type==='coaxial') assert.ok(row.geometry.outerRadius>row.geometry.innerRadius);
   }
  }
 });
}
test('Geometría parcial inválida: no hay interpolaciones ni ceros sustitutivos',()=>{
 for(const [type,o] of [['coaxial',options('innerRadius',1,3)],['bifilar',options('radius',1,3)],['bifilar',options('separation',.5,3)]]) {
  const result=engine.runParametric(base(type),o);assert.ok(result.successCount>0 && result.rejectedCount>0);
  for(const row of result.rows.filter(row=>!row.valid)) { assert.equal(row.primary,null);assert.equal(row.secondary,null);assert.ok(row.error.issues);for(const m of engine.MAGNITUDES) assert.equal(engine.getMagnitude(row,m.key),null); }
 }
});
test('Intervalo completamente inválido y dimensión fija no positiva quedan registrados',()=>{
 for(const c of [base('coaxial'),{...base('coaxial'),geometry:{innerRadius:.5,outerRadius:0}}]) {
  const result=engine.runParametric(c,options('innerRadius',2,3));assert.equal(result.successCount,0);assert.equal(result.rejectedCount,11);assert.ok(result.rows.every(row=>!row.valid));
 }
 const c=base('placas');c.geometry.gap=-1;assert.equal(engine.runParametric(c,options('width',1,2)).rejectedCount,11);
});
test('Se permite corregir la dimensión barrida de una configuración inicial inválida',()=>{
 const c=base('coaxial');c.geometry.innerRadius=3;const result=engine.runParametric(c,options('innerRadius',.4,.8));assert.equal(result.successCount,11);assert.equal(c.geometry.innerRadius,3);
});
test('Opciones inválidas, relación adimensional y dominio de cada variable',()=>{
 const invalid=[
  {start:0},{end:0},{start:NaN},{end:Infinity},{end:.4},{points:9},{points:501},{points:10.5},{scale:'otro'},{variable:'width'},{mode:'otro'},
  ...[0,1,-4,NaN,Infinity].map(ratio=>({mode:'ratio',ratio})),{variable:'outerRadius',mode:'ratio',ratio:4}
 ];
 for(const patch of invalid) assert.throws(()=>engine.runParametric(base('coaxial'),options('innerRadius',.4,.8,patch)),engine.ParametricValidationError);
 assert.throws(()=>engine.runParametric(base('bifilar'),options('radius',.1,.2,{mode:'ratio',ratio:4})),engine.ParametricValidationError);
 assert.throws(()=>engine.runParametric({...base('coaxial'),type:'inexistente'},options('innerRadius',.4,.8)),engine.ParametricValidationError);
});
test('Dimensiones no representables se rechazan sin resultados ficticios',()=>{
 const result=engine.runParametric(base('coaxial'),options('innerRadius',2,3,{mode:'ratio',ratio:Number.MAX_VALUE}));
 assert.equal(result.rejectedCount,11);assert.ok(result.rows.every(row=>row.geometry.outerRadius===Infinity && !row.valid));
 const tiny=engine.runParametric(base('placas'),options('width',Number.MIN_VALUE,Number.MIN_VALUE*20));assert.ok(tiny.rejectedCount>0);
 assert.throws(()=>engine.runParametric(base('placas'),options('width',1,1+Number.EPSILON,{points:500})),engine.ParametricValidationError);
});
test('Frecuencia fija/materiales inválidos se señalan en los campos principales',()=>{
 for(const patch of [{frequency:0},{frequency:Infinity},{frequencyUnit:'THz'},{conductivity:0},{relativePermittivity:0},{lossTangent:-1},{length:0}]) assert.throws(()=>engine.runParametric({...base('coaxial'),...patch},options('innerRadius',.4,.8)),primary.ValidationError);
});
test('Coaxial b/a=4: atenuación decreciente, L/C constantes y |Z0| casi constante',()=>{
 const result=engine.runParametric(base('coaxial'),options('innerRadius',.4,.8,{mode:'ratio',ratio:4}));
 for(const [i,expected] of [[0,.1008867],[5,.0681374],[10,.0517626]]) assert.ok(Math.abs(result.rows[i].secondary.alphaDb-expected)<=5e-8);
 for(const [i,row] of result.rows.entries()) {
  near(row.primary.L,result.rows[0].primary.L);near(row.primary.C,result.rows[0].primary.C);
  near(row.secondary.Z0Magnitude,result.rows[0].secondary.Z0Magnitude,2e-5);
  if(i) assert.ok(row.secondary.alphaDb<result.rows[i-1].secondary.alphaDb);
 }
});
test('Coaxial con b fijo admite atenuación no monótona',()=>{
 const result=engine.runParametric(base('coaxial'),options('innerRadius',.01,1.999,{points:500}));
 const y=result.rows.map(row=>row.secondary.alphaDb),minimum=Math.min(...y);assert.ok(minimum<y[0] && minimum<y.at(-1));
});
test('Unidades: frecuencia equivalente, dimensiones mm y longitud sin multiplicación',()=>{
 const c=base('coaxial'),o=options('innerRadius',.4,.8,{mode:'ratio',ratio:4}),a=engine.runParametric(c,o),b=engine.runParametric({...c,frequency:.1,frequencyUnit:'GHz',length:1},o);
 assert.deepEqual(a.rows,b.rows);assert.equal(a.rows[0].geometry.innerRadius,.4);assert.equal(a.rows[0].frequencyHz,1e8);
});
test('No se altera el barrido de frecuencia ni se pierden advertencias',()=>{
 const c=base('coaxial'),o={start:1,end:1000,unit:'MHz',scale:'log',points:100};const before=frequency.runSweep(c,o),snapshot=structuredClone(before);
 const result=engine.runParametric(c,options('innerRadius',.4,.8,{mode:'ratio',ratio:4}));assert.deepEqual(before,snapshot);assert.deepEqual(frequency.runSweep(c,o),before);
 assert.equal(result.warningPointCount,11);assert.equal(result.warningSummary[0].code,'coaxial-wall');assert.equal(result.warningSummary[0].minValueMm,.4);assert.equal(result.warningSummary[0].maxValueMm,.8);
});
// Analizador CSV de prueba: interpreta comillas, comas y finales CRLF.
function parseCSV(text) {
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++) {
  const c=text[i];if(c==='"') {if(quoted && text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
  else if(c===',' && !quoted){row.push(cell);cell='';}
  else if(c==='\r' && text[i+1]==='\n' && !quoted){row.push(cell);rows.push(row);row=[];cell='';i++;}else cell+=c;
 }
 return rows;
}
test('CSV: dimensiones vinculadas, frecuencia, precisión completa y blancos de rechazo',()=>{
 for(const o of [options('innerRadius',.4,.8,{mode:'ratio',ratio:4}),options('innerRadius',1,3)]) {
  const result=engine.runParametric(base('coaxial'),o),text=engine.toCSV(result);assert.ok(text.startsWith('\uFEFF'));
  const [head,...rows]=parseCSV(text.slice(1));assert.equal(rows.length,11);
  const index=label=>head.indexOf(label);assert.ok(index('|Z0| [ohm]')>=0);
  for(const [i,cells] of rows.entries()) {
   const row=result.rows[i];assert.equal(Number(cells[index('a [mm]')]),row.geometry.innerRadius);assert.equal(Number(cells[index('b [mm]')]),row.geometry.outerRadius);
   assert.equal(Number(cells[index('Frecuencia fija [Hz]')]),1e8);
   for(const [label,value] of [['L [H/m]',row.primary?.L],['alpha [dB/m]',row.secondary?.alphaDb]]) assert.equal(cells[index(label)],row.valid?String(value):'');
   if(!row.valid) assert.match(cells[index('Error')],/ValidationError/);
  }
 }
});
test('CSV: ceros físicos y errores con comas, comillas y saltos se conservan',()=>{
 const c=base('placas');c.lossTangent=0;const result=engine.runParametric(c,options('width',1,20));
 const [head,...rows]=parseCSV(engine.toCSV(result).slice(1));assert.ok(rows.every(row=>row[head.indexOf('G [S/m]')]==='0'));
 const row=result.rows[0];row.valid=false;row.error={name:'Error',message:'Texto, con "comillas"\ny salto'};
 const parsed=parseCSV(engine.toCSV(result).slice(1));assert.equal(parsed[1][head.indexOf('Error')],'Error: Texto, con "comillas"\ny salto');
});
