/* LINEALAB — Motor independiente del DOM. Sin dependencias.
 * Geometría de entrada en mm, frecuencia con unidad explícita; salidas en SI.
 * Compatible con scripts clásicos (GitHub Pages/CodePen) y require() (Node).
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LineaLabCalculations = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // CODATA 2022, valores centrales redondeados; ε0 y μ0 no son exactos en el SI actual.
  const CONSTANTS = Object.freeze({ EPSILON_0: 8.8541878188e-12, MU_0: 1.25663706127e-6 });
  const FREQUENCY_UNITS = Object.freeze({ Hz: 1, kHz: 1e3, MHz: 1e6, GHz: 1e9 });
  // Conductividades volumétricas orientativas en S/m, cerca de 20 °C.
  const CONDUCTORS = Object.freeze({
    cobre: Object.freeze({ conductivity: 5.8e7 }),
    aluminio: Object.freeze({ conductivity: 3.5e7 }),
    plata: Object.freeze({ conductivity: 6.3e7 }),
    oro: Object.freeze({ conductivity: 4.1e7 })
  });
  // Valores de arranque ilustrativos: no modelan dispersión, humedad ni temperatura.
  const DIELECTRICS = Object.freeze({
    aire: Object.freeze({ relativePermittivity: 1.0006, lossTangent: 0 }),
    vacio: Object.freeze({ relativePermittivity: 1, lossTangent: 0 }),
    ptfe: Object.freeze({ relativePermittivity: 2.1, lossTangent: 2e-4 }),
    polietileno: Object.freeze({ relativePermittivity: 2.25, lossTangent: 3e-4 })
  });
  const GEOMETRY_FIELDS = Object.freeze({
    bifilar: ['radius', 'separation'], coaxial: ['innerRadius', 'outerRadius'], placas: ['width', 'gap']
  });
  // Umbrales de aviso heurísticos, NO fronteras exactas de validez física.
  const LIMITS = Object.freeze({ skinDepthToRadius: 0.1, minPlateRatio: 10, minWireSeparationRatio: 5 });

  class ValidationError extends Error {
    constructor(issues) {
      super('Revisa los valores introducidos.');
      this.name = 'ValidationError';
      this.issues = issues;
    }
  }

  function normalizeInput(input) {
    const issues = {};
    const positive = (key, value) => {
      if (!Number.isFinite(value) || value <= 0) issues[key] = 'Introduce un número finito mayor que cero.';
    };
    positive('frequency', input.frequency);
    positive('conductivity', input.conductivity);
    positive('relativePermittivity', input.relativePermittivity);
    positive('length', input.length);
    if (!Number.isFinite(input.lossTangent) || input.lossTangent < 0) {
      issues.lossTangent = 'La tangente de pérdidas debe ser finita y mayor o igual que cero.';
    }
    if (!Object.hasOwn(FREQUENCY_UNITS, input.frequencyUnit)) issues.frequencyUnit = 'Selecciona una unidad de frecuencia válida.';
    if (!Object.hasOwn(GEOMETRY_FIELDS, input.type)) issues.type = 'Selecciona una geometría válida.';
    const geometry = input.geometry || {};
    (Object.hasOwn(GEOMETRY_FIELDS, input.type) ? GEOMETRY_FIELDS[input.type] : []).forEach(key => positive(key, geometry[key]));
    if (input.type === 'coaxial' && !issues.innerRadius && !issues.outerRadius && geometry.outerRadius <= geometry.innerRadius) {
      issues.outerRadius = 'El radio b debe ser mayor que el radio a.';
    }
    if (input.type === 'bifilar' && !issues.radius && !issues.separation && geometry.separation <= 2 * geometry.radius) {
      issues.separation = 'D debe ser mayor que 2a para evitar contacto o superposición de los conductores.';
    }
    if (Object.keys(issues).length) throw new ValidationError(issues);
    const frequencyHz = input.frequency * FREQUENCY_UNITS[input.frequencyUnit];
    const geometrySI = Object.fromEntries(GEOMETRY_FIELDS[input.type].map(key => [key, geometry[key] * 1e-3]));
    if (!Number.isFinite(frequencyHz) || frequencyHz <= 0) throw new ValidationError({ frequency: 'La frecuencia convertida queda fuera del rango numérico.' });
    for (const [key, value] of Object.entries(geometrySI)) {
      if (!Number.isFinite(value) || value <= 0) throw new ValidationError({ [key]: 'La dimensión convertida queda fuera del rango numérico.' });
    }
    return { ...input, frequencyHz, geometrySI };
  }

  function calculatePrimary(input) {
    const data = normalizeInput(input);
    const { MU_0: mu, EPSILON_0 } = CONSTANTS;
    const epsilon = EPSILON_0 * data.relativePermittivity;
    const omega = 2 * Math.PI * data.frequencyHz;
    // μc = μ0: conductores no magnéticos, ambos del mismo material.
    const surfaceResistance = Math.sqrt(Math.PI * data.frequencyHz * mu / data.conductivity);
    const skinDepth = Math.sqrt(2 / (omega * mu * data.conductivity));
    const warnings = [];
    const warn = (code, message) => warnings.push({ code, message });
    let R, L, C;
    const g = data.geometrySI;
    if (data.type === 'coaxial') {
      const a = g.innerRadius, b = g.outerRadius;
      const logRatio = Math.log1p((b - a) / a);
      C = 2 * Math.PI * epsilon / logRatio;
      L = mu * logRatio / (2 * Math.PI);
      R = surfaceResistance / (2 * Math.PI) * (1 / a + 1 / b);
      if (skinDepth / a >= LIMITS.skinDepthToRadius) {
        warn('skin-depth', 'δ/a ≥ 0.1: el efecto pelicular puede no estar desarrollado. R′ y la omisión de inductancia interna pueden ser inadecuadas.');
      }
      warn('coaxial-wall', 'No se especificó el espesor del conductor exterior. El modelo de R′ requiere una pared mucho más gruesa que δ; esa condición no se puede verificar.');
    } else if (data.type === 'bifilar') {
      const a = g.radius, D = g.separation;
      const ratio = D / (2 * a);
      const A = Math.acosh(ratio);
      C = Math.PI * epsilon / A;
      L = mu * A / Math.PI;
      R = surfaceResistance / (Math.PI * a);
      if (skinDepth / a >= LIMITS.skinDepthToRadius) {
        warn('skin-depth', 'δ/a ≥ 0.1: el efecto pelicular puede no estar desarrollado. R′ y la omisión de inductancia interna pueden ser inadecuadas.');
      }
      if (ratio < LIMITS.minWireSeparationRatio) {
        warn('wire-proximity', 'D/(2a) < 5: los conductores están próximos. La aproximación de R′ omite el efecto de proximidad y puede subestimar las pérdidas.');
      }
    } else {
      const w = g.width, d = g.gap;
      C = epsilon * w / d;
      L = mu * d / w;
      R = 2 * surfaceResistance / w;
      if (w / d < LIMITS.minPlateRatio) {
        warn('plate-fringing', 'w/d < 10: las placas no son suficientemente anchas según el criterio orientativo. Los efectos de borde pueden alterar C′ y L′.');
      }
      if (skinDepth / w >= LIMITS.skinDepthToRadius) {
        warn('skin-depth', 'δ/w ≥ 0.1: la profundidad de penetración no es pequeña respecto al ancho. La aproximación superficial de R′ puede no ser válida.');
      }
      warn('plate-thickness', 'No se especificó el espesor de las placas. R′ supone espesor mucho mayor que δ y corriente en las caras enfrentadas; no se puede verificar el régimen pelicular a través del espesor.');
    }
    const G = omega * C * data.lossTangent;
    // No multiplicar por longitud: R, L, C y G son por metro.
    const positiveResults = [R, L, C, surfaceResistance, skinDepth, omega, epsilon];
    if (positiveResults.some(value => !Number.isFinite(value) || value <= 0) || !Number.isFinite(G) || G < 0 || (data.lossTangent > 0 && G === 0)) {
      throw new RangeError('La combinación de entradas excede el rango numérico del modelo. Usa magnitudes físicas representables.');
    }
    return { R, L, C, G, skinDepth, surfaceResistance, frequencyHz: data.frequencyHz, omega, epsilon, mu, warnings };
  }

  return Object.freeze({ CONSTANTS, CONDUCTORS, DIELECTRICS, LIMITS, ValidationError, normalizeInput, calculatePrimary });
});
