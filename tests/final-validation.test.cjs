'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const references = require('./fixtures/final-references.json');
const { calculatePrimary } = require('../calculations.js');
const { calculateSecondary } = require('../secondary.js');
const { runSweep } = require('../sweep.js');
const geometries = { coaxial: { innerRadius: 0.5, outerRadius: 2 }, bifilar: { radius: 0.5, separation: 5 }, placas: { width: 20, gap: 1 } };
const input = type => ({ type, geometry: { ...geometries[type] }, frequency: 100, frequencyUnit: 'MHz', length: 1, conductivity: 5.8e7, relativePermittivity: 2.1, lossTangent: 0.0002 });
function compare(actual, expected, key) {
  const ref = Number(expected);
  // Criterio relativo en los valores no nulos; las líneas ideales usan cero exacto.
  const bound = Math.max(Number.MIN_VALUE, Math.abs(ref) * references.relativeTolerance);
  assert.ok(Number.isFinite(actual) && Math.abs(actual-ref) <= bound, `${key}: ${actual} vs ${expected}, tolerancia ${bound}`);
}
for (const sample of references.cases) test(`Referencia Decimal 70 dígitos: ${sample.type}, ${sample.frequencyHz} Hz`, () => {
  const p = calculatePrimary({ ...input(sample.type), frequency: sample.frequencyHz, frequencyUnit: 'Hz' });
  const s = calculateSecondary(p);
  const actual = { ...p, ...s, Z0Real: s.Z0.re, Z0Imaginary: s.Z0.im };
  for (const [key, expected] of Object.entries(sample.expected)) compare(actual[key], expected, key);
});
for (const type of Object.keys(geometries)) {
  test(`${type}: tendencias 1 MHz → 100 MHz → 1 GHz`, () => {
    const rows = references.cases.filter(row => row.type === type).map(row => {
      const p = calculatePrimary({ ...input(type), frequency: row.frequencyHz, frequencyUnit: 'Hz' });
      return { p, s: calculateSecondary(p) };
    });
    for (let i=1;i<rows.length;i++) {
      const a=rows[i-1], b=rows[i], ratio=b.p.frequencyHz/a.p.frequencyHz;
      compare(b.p.R/a.p.R, Math.sqrt(ratio), 'R ~ sqrt(f)');
      assert.equal(b.p.L,a.p.L); assert.equal(b.p.C,a.p.C);
      compare(b.p.G/a.p.G,ratio,'G ~ f');
      assert.ok(b.s.beta>a.s.beta); assert.ok(b.s.alpha>a.s.alpha);
      assert.ok(b.s.wavelength<a.s.wavelength);
      const ideal=Math.sqrt(b.p.L/b.p.C);
      assert.ok(Math.abs(b.s.Z0Magnitude-ideal)<Math.abs(a.s.Z0Magnitude-ideal));
    }
  });
  for (const points of [10,100,500]) test(`${type}: barrido completo de ${points} puntos y once magnitudes`, () => {
    const analysis=runSweep(input(type),{start:1,end:1000,unit:'MHz',points,scale:'log'});
    assert.equal(analysis.rows.length,points);assert.equal(analysis.successCount,points);assert.equal(analysis.rejectedCount,0);
    const { MAGNITUDES,getMagnitude }=require('../sweep.js');
    for(const magnitude of MAGNITUDES)for(const row of analysis.rows)assert.ok(Number.isFinite(getMagnitude(row,magnitude.key)));
  });
}
