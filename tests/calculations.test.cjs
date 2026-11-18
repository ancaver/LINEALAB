'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../calculations.js');
const { calculatePrimary, CONSTANTS, ValidationError } = engine;
const geometries = { coaxial: { innerRadius: 0.5, outerRadius: 2 }, bifilar: { radius: 0.5, separation: 5 }, placas: { width: 20, gap: 1 } };
function input(type = 'coaxial', overrides = {}) {
  return { type, frequency: 100, frequencyUnit: 'MHz', conductivity: 5.8e7, relativePermittivity: 2.1, lossTangent: 2e-4, length: 1, geometry: { ...geometries[type] }, ...overrides };
}
function close(actual, expected, tolerance = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= Math.abs(expected) * tolerance, `${actual} ≠ ${expected}`);
}
const warningCodes = result => result.warnings.map(warning => warning.code);

test('Coaxial: referencia numérica del proyecto y conversión mm → m', () => {
  const r = calculatePrimary(input());
  close(r.L, 2.77259e-7, 1e-6);
  close(r.C, 8.42738e-11, 1e-6);
  close(r.R, 1.03806849810322);
  close(r.G, 1.0590154609715234e-5);
  close(r.skinDepth, 6.608549310516836e-6);
});
test('Bifilar: referencia independiente en vacío', () => {
  const r = calculatePrimary(input('bifilar', { relativePermittivity: 1 }));
  close(r.R, 1.660909596965152);
  close(r.L, 9.169726677034007e-7);
  close(r.C, 1.2133950064636371e-11);
});
test('Placas anchas: referencia independiente en vacío', () => {
  const r = calculatePrimary(input('placas', { relativePermittivity: 1 }));
  close(r.R, 0.2608950694051253);
  close(r.L, 6.28318530635e-8);
  close(r.C, 1.77083756376e-10);
});
for (const type of Object.keys(geometries)) {
  test(`${type}: L′ y C′ independientes de frecuencia; escalas de R′ y G′`, () => {
    const low = calculatePrimary(input(type, { frequency: 1 }));
    const high = calculatePrimary(input(type, { frequency: 100 }));
    assert.equal(low.L, high.L); assert.equal(low.C, high.C);
    close(high.R / low.R, 10); close(high.G / low.G, 100);
    close(low.skinDepth / high.skinDepth, 10);
    close(high.L * high.C, CONSTANTS.MU_0 * CONSTANTS.EPSILON_0 * 2.1);
  });
  test(`${type}: longitud no multiplica los parámetros por metro`, () => {
    const short = calculatePrimary(input(type));
    const long = calculatePrimary(input(type, { length: 120 }));
    for (const key of ['R', 'L', 'C', 'G']) assert.equal(short[key], long[key]);
  });
  test(`${type}: dieléctrico sin pérdidas, εr y conductividad editables`, () => {
    const base = calculatePrimary(input(type));
    const modified = calculatePrimary(input(type, { relativePermittivity: 4.2, lossTangent: 0, conductivity: 4 * 5.8e7 }));
    assert.equal(modified.G, 0); close(modified.C / base.C, 2);
    assert.equal(modified.L, base.L); close(modified.R / base.R, 0.5);
  });
}
test('Hz/kHz/MHz/GHz representan la misma frecuencia', () => {
  const expected = calculatePrimary(input());
  for (const [frequencyUnit, frequency] of Object.entries({ Hz: 1e8, kHz: 1e5, MHz: 100, GHz: 0.1 })) {
    assert.deepEqual(calculatePrimary(input('coaxial', { frequencyUnit, frequency })), expected);
  }
});
test('Baja frecuencia: aviso de penetración, sin sustituir R′ por una fórmula DC', () => {
  for (const type of ['coaxial', 'bifilar', 'placas']) {
    const r = calculatePrimary(input(type, { frequency: 1, frequencyUnit: 'Hz' }));
    assert.ok(warningCodes(r).includes('skin-depth'));
    assert.ok(r.R > 0);
  }
  assert.ok(!warningCodes(calculatePrimary(input())).includes('skin-depth'));
});
test('Avisos de proximidad, efectos de borde y espesores desconocidos', () => {
  const near = input('bifilar', { geometry: { radius: 0.5, separation: 1.2 } });
  assert.ok(warningCodes(calculatePrimary(near)).includes('wire-proximity'));
  assert.ok(!warningCodes(calculatePrimary(input('bifilar'))).includes('wire-proximity'));
  const narrow = input('placas', { geometry: { width: 5, gap: 1 } });
  assert.ok(warningCodes(calculatePrimary(narrow)).includes('plate-fringing'));
  assert.ok(!warningCodes(calculatePrimary(input('placas'))).includes('plate-fringing'));
  assert.ok(warningCodes(calculatePrimary(input('placas'))).includes('plate-thickness'));
  assert.ok(warningCodes(calculatePrimary(input())).includes('coaxial-wall'));
});
test('Rechaza valores nulos, negativos, NaN, infinitos y texto; tanδ permite cero', () => {
  for (const key of ['frequency', 'conductivity', 'relativePermittivity', 'length']) {
    for (const value of [0, -1, NaN, Infinity, '100', undefined]) {
      assert.throws(() => calculatePrimary(input('coaxial', { [key]: value })), error => error instanceof ValidationError && key in error.issues);
    }
  }
  for (const value of [-1, NaN, Infinity, undefined]) assert.throws(() => calculatePrimary(input('coaxial', { lossTangent: value })), ValidationError);
  for (const type of Object.keys(geometries)) for (const key of Object.keys(geometries[type])) {
    for (const value of [0, -1, NaN, Infinity]) assert.throws(() => calculatePrimary(input(type, { geometry: { ...geometries[type], [key]: value } })), ValidationError);
  }
});
test('Rechaza geometrías en contacto o superpuestas y selecciones inválidas', () => {
  for (const outerRadius of [0.5, 0.2]) assert.throws(() => calculatePrimary(input('coaxial', { geometry: { innerRadius: 0.5, outerRadius } })), ValidationError);
  for (const separation of [1, 0.9]) assert.throws(() => calculatePrimary(input('bifilar', { geometry: { radius: 0.5, separation } })), ValidationError);
  for (const type of ['desconocido', '__proto__']) assert.throws(() => calculatePrimary(input('coaxial', { type })), ValidationError);
  assert.throws(() => calculatePrimary(input('coaxial', { frequencyUnit: 'THz' })), ValidationError);
});
test('Desbordamiento y subdesbordamiento: nunca devuelve NaN, infinito ni ceros espurios', () => {
  assert.throws(() => calculatePrimary(input('coaxial', { frequency: Number.MAX_VALUE, frequencyUnit: 'GHz' })), ValidationError);
  assert.throws(() => calculatePrimary(input('bifilar', { geometry: { radius: Number.MIN_VALUE, separation: 5 } })), ValidationError);
  assert.throws(() => calculatePrimary(input('coaxial', { conductivity: Number.MIN_VALUE })), RangeError);
});
test('Los valores iniciales contienen todos los materiales y son inmutables', () => {
  assert.deepEqual(Object.keys(engine.CONDUCTORS), ['cobre', 'aluminio', 'plata', 'oro']);
  assert.deepEqual(Object.keys(engine.DIELECTRICS), ['aire', 'vacio', 'ptfe', 'polietileno']);
  assert.equal(engine.DIELECTRICS.ptfe.relativePermittivity, 2.1);
  assert.ok(Object.isFrozen(engine.DIELECTRICS.ptfe));
});
