/* LINEALAB — Etapa 3. Aritmética compleja y secundarios, independiente del DOM.
 * Entrada: R [Ω/m], L [H/m], C [F/m], G [S/m], omega [rad/s].
 * No se redondea ningún resultado interno. No altera el motor de la etapa 2.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LineaLabSecondary = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const NP_TO_DB = 8.686; // Factor redondeado solicitado: 20 log10(e) ≈ 8.686.
  const rangeMessage = 'El cálculo secundario o complejo queda fuera del rango numérico de JavaScript. Revisa las magnitudes introducidas.';
  const zero = () => ({ m: 0, e: 0 });

  /* Reales escalados m·2^e: los exponentes intermedios pueden exceder el rango
   * de Number. Cada componente se escala por separado para conservar pérdidas
   * diminutas junto a reactancias grandes. Sólo se materializan las salidas.
   */
  function scaled(value) {
    if (value === 0) return { m: value, e: 0 };
    let e = Math.min(1023, Math.max(-1074, Math.floor(Math.log2(Math.abs(value)))));
    let m = value / 2 ** e;
    // log2 puede redondear al entero adyacente cerca de una potencia de dos.
    if (Math.abs(m) < 1) { m *= 2; e -= 1; }
    if (Math.abs(m) >= 2) { m /= 2; e += 1; }
    return { m, e };
  }
  function normalize(m, e) {
    const part = scaled(m);
    return { m: part.m, e: part.m === 0 ? 0 : part.e + e };
  }
  function product(a, b) { return normalize(a.m * b.m, a.e + b.e); }
  function sum(a, b) {
    if (a.m === 0) return b;
    if (b.m === 0) return a;
    const e = Math.max(a.e, b.e);
    return normalize(a.m * 2 ** (a.e - e) + b.m * 2 ** (b.e - e), e);
  }
  function quotient(a, b) {
    if (b.m === 0) throw new RangeError('No se puede dividir por cero.');
    return normalize(a.m / b.m, a.e - b.e);
  }
  function negate(a) { return { m: -a.m, e: a.e }; }
  function asNumber(value) {
    if (value.m === 0) return 0; // Canonicalizar −0 en las salidas.
    // Permitir el redondeo correcto a subnormales sin calcular 2^(-1075).
    const result = value.e < -1074
      ? (value.m * 2 ** (value.e + 1074)) * Number.MIN_VALUE
      : value.m * 2 ** value.e;
    if (!Number.isFinite(result) || result === 0) throw new RangeError(rangeMessage);
    return result;
  }
  function checkComplex(value) {
    if (!value || !Number.isFinite(value.re) || !Number.isFinite(value.im)) {
      throw new RangeError('Un número complejo debe tener componentes re e im finitas.');
    }
  }
  function parts(value) { return { re: scaled(value.re), im: scaled(value.im) }; }
  function materialize(value) { return { re: asNumber(value.re), im: asNumber(value.im) }; }
  function multiplyScaled(a, b) {
    const x = parts(a), y = parts(b);
    return {
      re: sum(product(x.re, y.re), negate(product(x.im, y.im))),
      im: sum(product(x.re, y.im), product(x.im, y.re))
    };
  }
  function divideScaled(a, b) {
    const x = parts(a), y = parts(b);
    const denominator = sum(product(y.re, y.re), product(y.im, y.im));
    if (denominator.m === 0) throw new RangeError('No se puede dividir por un complejo nulo.');
    return {
      re: quotient(sum(product(x.re, y.re), product(x.im, y.im)), denominator),
      im: quotient(sum(product(x.im, y.re), negate(product(x.re, y.im))), denominator)
    };
  }
  function sqrtScaled(value) {
    const { re, im } = value;
    if (re.m === 0 && im.m === 0) return { re: zero(), im };
    // Exponente par para extraer 2^(e/2) sin desbordar ni subdesbordar.
    const e = 2 * Math.floor(Math.max(re.m === 0 ? -Infinity : re.e, im.m === 0 ? -Infinity : im.e) / 2);
    const x = re.m === 0 ? 0 : re.m * 2 ** (re.e - e);
    const y = im.m === 0 ? 0 : im.m * 2 ** (im.e - e);
    const large = normalize(Math.sqrt((Math.hypot(x, y) + Math.abs(x)) / 2), e / 2);
    const twiceLarge = { m: large.m, e: large.e + 1 };
    // La componente pequeña se obtiene por 2*u*v = Im(z), sin cancelación.
    if (re.m >= 0) return { re: large, im: quotient(im, twiceLarge) };
    const negativeImaginary = im.m < 0 || Object.is(im.m, -0);
    return {
      re: quotient({ m: Math.abs(im.m), e: im.e }, twiceLarge),
      im: negativeImaginary ? negate(large) : large
    };
  }

  function multiply(a, b) {
    checkComplex(a); checkComplex(b);
    return materialize(multiplyScaled(a, b));
  }
  function divide(a, b) {
    checkComplex(a); checkComplex(b);
    return materialize(divideScaled(a, b));
  }
  function sqrt(value) {
    checkComplex(value);
    return materialize(sqrtScaled(parts(value)));
  }
  function magnitude(value) {
    checkComplex(value);
    const result = Math.hypot(value.re, value.im);
    if (!Number.isFinite(result)) throw new RangeError(rangeMessage);
    return result;
  }
  function phase(value) {
    checkComplex(value);
    // Convención de API: arg(0) = 0. En el cálculo de Z0 nunca se usa arg(0).
    return value.re === 0 && value.im === 0 ? 0 : Math.atan2(value.im, value.re);
  }
  const complex = Object.freeze({ multiply, divide, sqrt, magnitude, phase });

  function calculateSecondary(primary) {
    if (!primary) throw new RangeError('Se requieren los parámetros primarios y la frecuencia angular.');
    for (const key of ['R', 'G', 'L', 'C', 'omega']) {
      const value = primary[key];
      const validSign = key === 'R' || key === 'G' ? value >= 0 : value > 0;
      if (!Number.isFinite(value) || !validSign) {
        throw new RangeError('Para una línea pasiva se exige R′ ≥ 0, G′ ≥ 0, L′ > 0, C′ > 0 y ω > 0, todos finitos y en SI.');
      }
    }
    const { R, L, C, G, omega } = primary;
    const Z = { re: R, im: asNumber(product(scaled(omega), scaled(L))) }; // Ω/m
    const Y = { re: G, im: asNumber(product(scaled(omega), scaled(C))) }; // S/m
    // No materializar Z/Y ni Z*Y: pueden desbordar aun si sus raíces son finitas.
    const Z0 = materialize(sqrtScaled(divideScaled(Z, Y)));
    const gamma = materialize(sqrtScaled(multiplyScaled(Z, Y)));
    // R,G ≥ 0 y ω,L,C > 0 sitúan ZY en el semiplano superior, o en el
    // eje real negativo sin pérdidas. La raíz principal da α ≥ 0 y β > 0.
    const alpha = gamma.re === 0 ? 0 : gamma.re;
    const beta = gamma.im;
    if (alpha < 0 || beta <= 0 || Z0.re <= 0) throw new RangeError('No se pudo seleccionar una rama pasiva físicamente válida.');
    const phaseVelocity = asNumber(quotient(scaled(omega), scaled(beta)));
    const wavelength = asNumber(quotient(scaled(2 * Math.PI), scaled(beta)));
    const alphaDb = asNumber(product(scaled(NP_TO_DB), scaled(alpha)));
    const Z0Magnitude = magnitude(Z0);
    const Z0PhaseRadians = phase(Z0);
    const Z0PhaseDegrees = Z0PhaseRadians * (180 / Math.PI);
    return {
      Z, Y, Z0, gamma: { re: alpha, im: beta }, alpha, beta,
      phaseVelocity, wavelength, alphaDb, Z0Magnitude, Z0PhaseRadians, Z0PhaseDegrees
    };
  }

  return Object.freeze({ complex, NP_TO_DB, calculateSecondary });
});
