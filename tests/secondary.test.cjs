'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { calculatePrimary, CONSTANTS } = require('../calculations.js');
const { calculateSecondary, complex, NP_TO_DB } = require('../secondary.js');
function close(actual, expected, tolerance = 2e-12) {
  assert.ok(Number.isFinite(actual));
  if (expected === 0) assert.equal(actual, 0);
  else assert.ok(Math.abs(actual / expected - 1) < tolerance, `${actual} ≠ ${expected}`);
}
function pair(actual, expected, tolerance) { close(actual.re, expected.re, tolerance); close(actual.im, expected.im, tolerance); }
const geometries = { coaxial: { innerRadius: 0.5, outerRadius: 2 }, bifilar: { radius: 0.5, separation: 5 }, placas: { width: 20, gap: 1 } };
function primary(type, overrides = {}) {
  return calculatePrimary({ type, frequency: 100, frequencyUnit: 'MHz', conductivity: 5.8e7, relativePermittivity: 2.1, lossTangent: 0.0002, length: 1, geometry: geometries[type], ...overrides });
}

test('Referencia compleja independiente: Z/Y=1−j y ZY=−1+j', () => {
  const r = calculateSecondary({ R: 1, L: 1, C: 1, G: 0, omega: 1 });
  // Raíces analíticas; no se reutilizan las funciones complejas del motor.
  const u = Math.sqrt((Math.SQRT2 + 1) / 2), v = Math.sqrt((Math.SQRT2 - 1) / 2);
  pair(r.Z0, { re: u, im: -v }); pair(r.gamma, { re: v, im: u });
  close(r.phaseVelocity, 1 / u); close(r.wavelength, 2 * Math.PI / u);
  close(r.alphaDb, 8.686 * v); close(r.Z0Magnitude, 2 ** 0.25);
  close(r.Z0PhaseRadians, -Math.PI / 8); close(r.Z0PhaseDegrees, -22.5);
});
test('Referencia coaxial PTFE, 100 MHz: comparación con Python cmath', () => {
  const r = calculateSecondary(primary('coaxial'));
  // Referencia generada independientemente en Python 3 con cmath.sqrt(Z/Y), sqrt(Z*Y).
  pair(r.Z0, { re: 57.35860207734671, im: -0.165157533283972 }, 2e-11);
  pair(r.gamma, { re: 0.009352655526378498, im: 3.037180571937363 }, 2e-11);
});
for (const type of Object.keys(geometries)) {
  test(`${type}: ramas pasivas, partes imaginarias, velocidades y unidades`, () => {
    const p = primary(type), r = calculateSecondary(p);
    assert.ok(r.alpha >= 0 && r.beta > 0 && r.Z0.re > 0);
    assert.ok(r.Z0.im !== 0); // No reducir Z0 a un real.
    pair(r.Z, { re: p.R, im: p.omega * p.L }); pair(r.Y, { re: p.G, im: p.omega * p.C });
    // Ω·m⁻¹=Ω/m, y (m⁻¹)/Ω=S/m.
    pair(complex.multiply(r.Z0, r.gamma), r.Z);
    pair(complex.divide(r.gamma, r.Z0), r.Y);
    pair(complex.multiply(r.gamma, r.gamma), complex.multiply(r.Z, r.Y));
    pair(complex.multiply(r.Z0, r.Z0), complex.divide(r.Z, r.Y));
    close(r.phaseVelocity * r.beta, p.omega);
    close(r.wavelength * r.beta, 2 * Math.PI);
    close(r.phaseVelocity / r.wavelength, p.frequencyHz);
    close(r.alphaDb, NP_TO_DB * r.alpha); assert.equal(NP_TO_DB, 8.686);
  });
  test(`${type}: línea ideal R′=G′=0 y vₚ=c/√εr`, () => {
    const p = primary(type), r = calculateSecondary({ ...p, R: 0, G: 0 });
    close(r.Z0.re, Math.sqrt(p.L / p.C)); assert.equal(r.Z0.im, 0);
    assert.equal(r.alpha, 0); assert.equal(r.alphaDb, 0);
    close(r.beta, p.omega * Math.sqrt(p.L * p.C));
    close(r.phaseVelocity, 1 / Math.sqrt(p.L * p.C));
    close(r.wavelength, r.phaseVelocity / p.frequencyHz);
    close(r.phaseVelocity, 299792458 / Math.sqrt(2.1), 2e-10);
    close(r.phaseVelocity, 1 / Math.sqrt(CONSTANTS.MU_0 * CONSTANTS.EPSILON_0 * 2.1));
  });
  test(`${type}: G′=0 conserva pérdidas conductoras y fase compleja`, () => {
    const p = primary(type, { lossTangent: 0 }), r = calculateSecondary(p);
    assert.equal(p.G, 0); assert.ok(r.alpha > 0 && r.beta > 0 && r.Z0.im < 0);
  });
  test(`${type}: resultados primarios sin mutaciones y longitud independiente`, () => {
    const p = primary(type), before = JSON.parse(JSON.stringify(p));
    const r = calculateSecondary(p);
    assert.deepEqual(p, before);
    assert.deepEqual(r, calculateSecondary(primary(type, { length: 100 })));
  });
}
test('Aproximaciones analíticas independientes de bajas pérdidas', () => {
  const p = { R: 0.01, L: 2.5e-7, C: 1e-10, G: 1e-6, omega: 2 * Math.PI * 1e8 };
  const r = calculateSecondary(p), zIdeal = Math.sqrt(p.L / p.C);
  const alphaApprox = p.R / (2 * zIdeal) + p.G * zIdeal / 2;
  const betaApprox = p.omega * Math.sqrt(p.L * p.C);
  const imaginaryApprox = zIdeal / 2 * (p.G / (p.omega * p.C) - p.R / (p.omega * p.L));
  close(r.alpha, alphaApprox, 1e-8); close(r.beta, betaApprox, 1e-8);
  close(r.Z0.re, zIdeal, 1e-8); close(r.Z0.im, imaginaryApprox, 1e-8);
});
test('Pérdidas diminutas: α e Im(Z0) no se pierden por cancelación', () => {
  const r = calculateSecondary({ R: 1e-300, L: 1, C: 1, G: 0, omega: 1 });
  close(r.alpha, 5e-301); close(r.Z0.im, -5e-301); close(r.beta, 1);
});
test('Condición de Heaviside R/L=G/C: Z0 real y propagación exacta', () => {
  const p = { R: 2, L: 2, C: 8, G: 8, omega: 3 }, r = calculateSecondary(p);
  pair(r.Z0, { re: 0.5, im: 0 }); pair(r.gamma, { re: 4, im: 12 });
});
test('Pérdida dieléctrica dominante admite Im(Z0)>0; fase en grados coherente', () => {
  const r = calculateSecondary({ R: 0, L: 1, C: 1, G: 1, omega: 1 });
  assert.ok(r.Z0.im > 0 && r.alpha > 0 && r.beta > 0);
  close(r.Z0PhaseDegrees, 22.5);
});
test('Escalado por unidad de longitud: Z0 invariante, gamma proporcional', () => {
  const p = { R: 0.3, L: 2e-7, C: 8e-11, G: 1e-6, omega: 1e8 };
  const r = calculateSecondary(p), scaled = { ...p };
  for (const key of ['R', 'L', 'C', 'G']) scaled[key] *= 100;
  const s = calculateSecondary(scaled);
  pair(s.Z0, r.Z0); close(s.alpha, r.alpha * 100); close(s.beta, r.beta * 100);
  close(s.phaseVelocity, r.phaseVelocity / 100); close(s.wavelength, r.wavelength / 100);
});
test('Hz, kHz, MHz y GHz equivalentes dan secundarios idénticos', () => {
  const reference = calculateSecondary(primary('coaxial'));
  for (const [frequencyUnit, frequency] of Object.entries({ Hz: 1e8, kHz: 1e5, MHz: 100, GHz: 0.1 })) {
    assert.deepEqual(calculateSecondary(primary('coaxial', { frequencyUnit, frequency })), reference);
  }
});
test('Escalas extremas: no materializa ZY o Z/Y antes de extraer sus raíces', () => {
  for (const scale of [1e300, 1e-300]) {
    const r = calculateSecondary({ R: 0, G: 0, L: scale, C: scale, omega: 1 });
    close(r.Z0.re, 1); assert.equal(r.Z0.im, 0); close(r.beta, scale);
    close(r.phaseVelocity, 1 / scale); close(r.wavelength, 2 * Math.PI / scale);
    const ratio = calculateSecondary({ R: 0, G: 0, L: scale, C: 1 / scale, omega: 1 });
    close(ratio.Z0.re, scale); close(ratio.beta, 1);
  }
  const lossy = calculateSecondary({ R: 1e300, G: 1e300, L: 1e300, C: 1e300, omega: 1 });
  close(lossy.alpha, 1e300); close(lossy.beta, 1e300);
});
test('Entradas pasivas inválidas y salidas no representables fallan explícitamente', () => {
  const p = { R: 1, G: 0, L: 1, C: 1, omega: 1 };
  assert.throws(() => calculateSecondary(null), RangeError);
  for (const key of Object.keys(p)) for (const value of [-1, NaN, Infinity, '1', undefined]) assert.throws(() => calculateSecondary({ ...p, [key]: value }), RangeError);
  for (const key of ['L', 'C', 'omega']) assert.throws(() => calculateSecondary({ ...p, [key]: 0 }), RangeError);
  assert.throws(() => calculateSecondary({ ...p, L: 1e308, omega: 1e308 }), RangeError);
  assert.throws(() => calculateSecondary({ ...p, R: 0, L: 1e-320, C: 1e-320 }), RangeError);
});
