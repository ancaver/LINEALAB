/* LINEALAB v0.4 — Muestreo, orquestación de los motores existentes y CSV.
 * No contiene ecuaciones eléctricas. Funciona en navegador y en Node.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./calculations.js'), require('./secondary.js'));
  else root.LineaLabSweep = factory(root.LineaLabCalculations, root.LineaLabSecondary);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (primaryEngine, secondaryEngine) {
  'use strict';
  const UNITS = Object.freeze({ Hz: 1, kHz: 1e3, MHz: 1e6, GHz: 1e9 });
  class SweepValidationError extends Error {
    constructor(issues) { super('Revisa la configuración del análisis de frecuencia.'); this.name = 'SweepValidationError'; this.issues = issues; }
  }
  function normalizeSweep(options) {
    const issues = {};
    if (!Number.isFinite(options.start) || options.start <= 0) issues['sweep-start'] = 'Introduce una frecuencia inicial finita mayor que cero.';
    if (!Number.isFinite(options.end) || options.end <= 0) issues['sweep-end'] = 'Introduce una frecuencia final finita mayor que cero.';
    if (!issues['sweep-start'] && !issues['sweep-end'] && options.end <= options.start) issues['sweep-end'] = 'La frecuencia final debe ser mayor que la inicial.';
    if (!Object.hasOwn(UNITS, options.unit)) issues['sweep-unit'] = 'Selecciona Hz, kHz, MHz o GHz.';
    if (!Number.isInteger(options.points) || options.points < 10 || options.points > 500) issues['sweep-points'] = 'Elige un número entero de puntos entre 10 y 500.';
    if (!['linear', 'log'].includes(options.scale)) issues['sweep-scale'] = 'Selecciona muestreo lineal o logarítmico.';
    if (Object.keys(issues).length) throw new SweepValidationError(issues);
    const startHz = options.start * UNITS[options.unit], endHz = options.end * UNITS[options.unit];
    if (!Number.isFinite(startHz) || startHz <= 0) issues['sweep-start'] = 'La frecuencia inicial convertida queda fuera del rango numérico.';
    if (!Number.isFinite(endHz) || endHz <= 0 || endHz <= startHz) issues['sweep-end'] = 'El intervalo convertido no es representable. Revisa las frecuencias.';
    if (Object.keys(issues).length) throw new SweepValidationError(issues);
    return { ...options, startHz, endHz };
  }
  function createFrequencies(options) {
    const data = normalizeSweep(options);
    const logStart = Math.log(data.startHz), logEnd = Math.log(data.endHz);
    const frequencies = Array.from({ length: data.points }, (_, index) => {
      // Fijar los extremos exactamente; no depender del redondeo de exp/log.
      if (index === 0) return data.startHz;
      if (index === data.points - 1) return data.endHz;
      const t = index / (data.points - 1);
      return data.scale === 'linear' ? data.startHz + (data.endHz - data.startHz) * t : Math.exp(logStart + (logEnd - logStart) * t);
    });
    if (frequencies.some((value, index) => !Number.isFinite(value) || value <= 0 || (index > 0 && value <= frequencies[index - 1]))) {
      throw new SweepValidationError({ 'sweep-end': 'El intervalo es demasiado estrecho para generar muestras distintas con esta precisión. Amplíalo o reduce el número de puntos.' });
    }
    return frequencies;
  }
  function runSweep(configuration, options) {
    const normalized = normalizeSweep(options), frequencies = createFrequencies(options);
    const snapshot = { ...configuration, geometry: { ...configuration.geometry } };
    // Rechazar errores compartidos del formulario antes de iterar. Esta función
    // sólo valida y convierte; no evalúa las ecuaciones de ningún punto.
    primaryEngine.normalizeInput({ ...snapshot, frequency: frequencies[0], frequencyUnit: 'Hz' });
    const rows = frequencies.map(frequencyHz => {
      let primary = null;
      try {
        primary = primaryEngine.calculatePrimary({ ...snapshot, geometry: { ...snapshot.geometry }, frequency: frequencyHz, frequencyUnit: 'Hz' });
        const secondary = secondaryEngine.calculateSecondary(primary);
        return { frequencyHz, valid: true, primary, secondary, warnings: primary.warnings.map(w => ({ ...w })), error: null };
      } catch (error) {
        return {
          frequencyHz, valid: false, primary, secondary: null,
          warnings: primary ? primary.warnings.map(w => ({ ...w })) : [],
          error: { name: error.name, message: error.message }
        };
      }
    });
    const groups = new Map();
    for (const row of rows) for (const warning of row.warnings) {
      if (!groups.has(warning.code)) groups.set(warning.code, { ...warning, count: 0, minFrequencyHz: row.frequencyHz, maxFrequencyHz: row.frequencyHz });
      const group = groups.get(warning.code);
      group.count += 1; group.maxFrequencyHz = row.frequencyHz;
    }
    const successCount = rows.filter(row => row.valid).length;
    return {
      configuration: snapshot, options: normalized, rows, successCount,
      rejectedCount: rows.length - successCount,
      warningPointCount: rows.filter(row => row.warnings.length).length,
      warningSummary: [...groups.values()]
    };
  }

  const MAGNITUDES = Object.freeze([
    { key: 'R', label: 'Resistencia R′', unit: 'Ω/m', source: 'primary' },
    { key: 'L', label: 'Inductancia L′', unit: 'H/m', source: 'primary' },
    { key: 'C', label: 'Capacitancia C′', unit: 'F/m', source: 'primary' },
    { key: 'G', label: 'Conductancia G′', unit: 'S/m', source: 'primary' },
    { key: 'Z0Magnitude', label: 'Magnitud |Z₀|', unit: 'Ω', source: 'secondary' },
    { key: 'Z0Real', label: 'Parte real de Z₀', unit: 'Ω', source: 'secondary', component: 're' },
    { key: 'Z0Imaginary', label: 'Parte imaginaria de Z₀', unit: 'Ω', source: 'secondary', component: 'im' },
    { key: 'alphaDb', label: 'Atenuación α', unit: 'dB/m', source: 'secondary' },
    { key: 'beta', label: 'Constante de fase β', unit: 'rad/m', source: 'secondary' },
    { key: 'phaseVelocity', label: 'Velocidad de fase vₚ', unit: 'm/s', source: 'secondary' },
    { key: 'wavelength', label: 'Longitud de onda λ', unit: 'm', source: 'secondary' }
  ].map(item => Object.freeze(item)));
  function getMagnitude(row, key) {
    const magnitude = MAGNITUDES.find(item => item.key === key);
    if (!magnitude) throw new RangeError('Magnitud de análisis no disponible.');
    if (!row.valid) return null; // Hueco en la gráfica: no unir ni interpolar.
    return magnitude.component ? row.secondary.Z0[magnitude.component] : row[magnitude.source][magnitude.key];
  }
  const CSV_COLUMNS = Object.freeze([
    ['Frecuencia [Hz]', row => row.frequencyHz], ['Estado', row => row.valid ? 'correcto' : 'rechazado'],
    ['R [ohm/m]', row => row.primary?.R], ['L [H/m]', row => row.primary?.L],
    ['C [F/m]', row => row.primary?.C], ['G [S/m]', row => row.primary?.G],
    ['Re(Z0) [ohm]', row => row.secondary?.Z0.re], ['Im(Z0) [ohm]', row => row.secondary?.Z0.im],
    ['alpha [Np/m]', row => row.secondary?.alpha], ['alpha [dB/m]', row => row.secondary?.alphaDb],
    ['beta [rad/m]', row => row.secondary?.beta], ['vp [m/s]', row => row.secondary?.phaseVelocity],
    ['lambda [m]', row => row.secondary?.wavelength], ['|Z0| [ohm]', row => row.secondary?.Z0Magnitude],
    ['arg(Z0) [deg]', row => row.secondary?.Z0PhaseDegrees], ['arg(Z0) [rad]', row => row.secondary?.Z0PhaseRadians],
    ['omega [rad/s]', row => row.primary?.omega], ['delta [m]', row => row.primary?.skinDepth],
    ['Rs [ohm/square]', row => row.primary?.surfaceResistance],
    ['Avisos del modelo', row => row.warnings.map(w => `${w.code}: ${w.message}`).join(' | ')],
    ['Error', row => row.error ? `${row.error.name}: ${row.error.message}` : '']
  ]);
  function csvCell(value) {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }
  function toCSV(analysis) {
    const metadataHeaders = ['Geometria', 'Dimensiones [mm] (JSON)', 'sigma [S/m]', 'epsilon_r', 'tan_delta', 'Longitud [m]'];
    const c = analysis.configuration;
    const metadata = [c.type, JSON.stringify(c.geometry), c.conductivity, c.relativePermittivity, c.lossTangent, c.length];
    const header = [...CSV_COLUMNS.map(([name]) => name), ...metadataHeaders].map(csvCell).join(',');
    const lines = analysis.rows.map(row => {
      // Un punto rechazado se exporta con campos eléctricos vacíos, nunca ceros.
      const values = CSV_COLUMNS.map(([, read], index) => !row.valid && index >= 2 && index <= 18 ? '' : read(row));
      return [...values, ...metadata].map(csvCell).join(',');
    });
    // BOM para UTF-8/Excel. String(Number) conserva la precisión round-trip.
    return '\uFEFF' + [header, ...lines].join('\r\n') + '\r\n';
  }
  return Object.freeze({ FREQUENCY_UNITS: UNITS, SweepValidationError, normalizeSweep, createFrequencies, runSweep, MAGNITUDES, getMagnitude, toCSV });
});
