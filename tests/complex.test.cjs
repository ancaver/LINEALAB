'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { complex: c } = require('../secondary.js');
function close(actual, expected, tolerance = 2e-14) {
  assert.ok(Number.isFinite(actual));
  if (expected === 0) assert.equal(actual, 0);
  else assert.ok(Math.abs(actual / expected - 1) < tolerance, `${actual} ≠ ${expected}`);
}
function pair(actual, re, im) { close(actual.re, re); close(actual.im, im); }

test('Complejos: multiplicación y división con ambas componentes', () => {
  const a = { re: 3, im: 4 }, b = { re: 5, im: -2 };
  pair(c.multiply(a, b), 23, 14);
  pair(c.divide(a, b), 7 / 29, 26 / 29);
  pair(c.multiply(a, { re: 0, im: 0 }), 0, 0);
});
test('Raíz principal: cuatro cuadrantes, cero y corte del eje negativo', () => {
  for (const [re, im, x, y] of [[3, 4, 2, 1], [3, -4, 2, -1], [-3, 4, 1, 2], [-3, -4, 1, -2], [0, 0, 0, 0], [0, 2, 1, 1], [-4, 0, 0, 2]]) {
    pair(c.sqrt({ re, im }), x, y);
  }
  assert.equal(c.sqrt({ re: -4, im: -0 }).im, -2);
});
test('Magnitud escalada y argumento en radianes con el cuadrante correcto', () => {
  assert.equal(c.magnitude({ re: 3, im: 4 }), 5);
  close(c.magnitude({ re: 1e308, im: 1e308 }), Math.SQRT2 * 1e308);
  close(c.magnitude({ re: 1e-300, im: 1e-300 }), Math.SQRT2 * 1e-300);
  close(c.phase({ re: -1, im: 1 }), 3 * Math.PI / 4);
  close(c.phase({ re: -1, im: -1 }), -3 * Math.PI / 4);
  assert.equal(c.phase({ re: 0, im: 0 }), 0);
});
test('División: no eleva números grandes o pequeños al cuadrado en Number', () => {
  for (const scale of [1e308, 1e-300, 1e-320]) pair(c.divide({ re: scale, im: scale }, { re: scale, im: scale }), 1, 0);
  pair(c.divide({ re: 1e300, im: -1e300 }, { re: 1e300, im: 1e300 }), 0, -1);
});
test('Multiplicación: escalas opuestas y cancelación sin Infinity − Infinity', () => {
  pair(c.multiply({ re: 1e308, im: 1e308 }, { re: 1e-308, im: -1e-308 }), 2, 0);
  pair(c.multiply({ re: 1e-300, im: 2e-300 }, { re: 1e300, im: -2e300 }), 5, 0);
});
test('Raíz estable aun cuando |z| excede Number.MAX_VALUE', () => {
  const input = { re: 1.7e308, im: 1.7e308 };
  const root = c.sqrt(input);
  assert.ok(root.re > 0 && root.im > 0);
  const square = c.multiply(root, root);
  close(square.re, input.re); close(square.im, input.im);
  pair(c.sqrt({ re: -1, im: 1e-300 }), 5e-301, 1);
  pair(c.sqrt({ re: Number.MIN_VALUE, im: 0 }), Math.sqrt(Number.MIN_VALUE), 0);
});
test('Fallos numéricos explícitos: división por cero, desbordamiento y entradas inválidas', () => {
  assert.throws(() => c.divide({ re: 1, im: 0 }, { re: 0, im: 0 }), RangeError);
  assert.throws(() => c.multiply({ re: 1e308, im: 0 }, { re: 1e308, im: 0 }), RangeError);
  assert.throws(() => c.multiply({ re: 1e-300, im: 0 }, { re: 1e-300, im: 0 }), RangeError);
  assert.throws(() => c.magnitude({ re: 1.7e308, im: 1.7e308 }), RangeError);
  for (const operation of [c.sqrt, c.magnitude, c.phase]) {
    for (const value of [null, { re: NaN, im: 0 }, { re: 0, im: Infinity }]) assert.throws(() => operation(value), RangeError);
  }
});
test('Límites finitos: conserva Number.MAX_VALUE y subnormales representables', () => {
  pair(c.multiply({ re: Number.MAX_VALUE, im: 0 }, { re: 1, im: 0 }), Number.MAX_VALUE, 0);
  pair(c.divide({ re: Number.MAX_VALUE, im: 0 }, { re: 1, im: 0 }), Number.MAX_VALUE, 0);
  pair(c.multiply({ re: Number.MIN_VALUE, im: 0 }, { re: 1, im: 0 }), Number.MIN_VALUE, 0);
});
