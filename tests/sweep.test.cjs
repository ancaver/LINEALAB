'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const sweep = require('../sweep.js'), charts = require('../charts.js');
const { calculatePrimary } = require('../calculations.js'), { calculateSecondary } = require('../secondary.js');
const options = () => ({ start: 1, end: 1000, unit: 'MHz', points: 100, scale: 'log' });
const geometries = { bifilar: { radius: 0.5, separation: 5 }, coaxial: { innerRadius: 0.5, outerRadius: 2 }, placas: { width: 20, gap: 1 } };
const configuration = (type = 'bifilar') => ({ type, frequency: 100, frequencyUnit: 'MHz', conductivity: 5.8e7, relativePermittivity: 2.1, lossTangent: 0.0002, length: 1, geometry: { ...geometries[type] } });
function close(a, b) { assert.ok(Math.abs(a / b - 1) < 2e-12, `${a} != ${b}`); }
function parseCSV(text) {
  const records = []; let row = [], cell = '', quoted = false;
  for (let index = 1; index < text.length; index++) { // Saltar BOM UTF-8.
    const char = text[index];
    if (char === '"') { if (quoted && text[index + 1] === '"') { cell += '"'; index++; } else quoted = !quoted; }
    else if (!quoted && char === ',') { row.push(cell); cell = ''; }
    else if (!quoted && char === '\r' && text[index + 1] === '\n') { row.push(cell); records.push(row); row = []; cell = ''; index++; }
    else cell += char;
  }
  return records;
}
test('Barrido: conversión Hz/kHz/MHz/GHz equivalente', () => {
  const reference = sweep.createFrequencies(options());
  for (const [unit, start, end] of [['Hz', 1e6, 1e9], ['kHz', 1000, 1e6], ['MHz', 1, 1000], ['GHz', 0.001, 1]]) {
    assert.deepEqual(sweep.createFrequencies({ ...options(), unit, start, end }), reference);
  }
});
test('Muestras lineales, extremos exactos y límites de 10–500 puntos', () => {
  for (const points of [10, 100, 500]) {
    const samples = sweep.createFrequencies({ start: 1, end: 10, unit: 'Hz', points, scale: 'linear' });
    assert.equal(samples.length, points); assert.equal(samples[0], 1); assert.equal(samples.at(-1), 10);
    for (let i = 0; i < points; i++) close(samples[i], 1 + 9 * i / (points - 1));
  }
});
test('Muestras logarítmicas: razón constante y extremos incluidos', () => {
  const samples = sweep.createFrequencies({ start: 1, end: 1e9, unit: 'Hz', points: 10, scale: 'log' });
  assert.equal(samples[0], 1); assert.equal(samples.at(-1), 1e9);
  for (let i = 0; i < samples.length; i++) close(samples[i], 10 ** i);
});
test('Validación del intervalo, puntos enteros, unidad, escala y rango numérico', () => {
  for (const patch of [{ start: 0 }, { start: -1 }, { start: NaN }, { end: Infinity }, { end: 1 }, { end: 0.1 }, { points: 9 }, { points: 501 }, { points: 10.5 }, { points: '100' }, { unit: 'THz' }, { scale: 'otro' }, { start: 1e308, end: 1.5e308, unit: 'GHz' }, { start: 1, end: 1 + Number.EPSILON, unit: 'Hz' }]) {
    assert.throws(() => sweep.createFrequencies({ ...options(), ...patch }), sweep.SweepValidationError);
  }
});
for (const type of Object.keys(geometries)) test(`${type}: cada punto coincide exactamente con ambos motores existentes`, () => {
  const c = configuration(type), analysis = sweep.runSweep(c, { ...options(), points: 10 });
  assert.equal(analysis.successCount, 10); assert.equal(analysis.rejectedCount, 0);
  for (const row of analysis.rows) {
    const p = calculatePrimary({ ...c, frequency: row.frequencyHz, frequencyUnit: 'Hz' });
    assert.deepEqual(row.primary, p); assert.deepEqual(row.secondary, calculateSecondary(p));
    assert.deepEqual(row.warnings, p.warnings);
  }
});
test('No muta configuración, geometría ni opciones; snapshot independiente', () => {
  const c = configuration(), o = options(), before = JSON.stringify({ c, o });
  Object.freeze(c.geometry); Object.freeze(c); Object.freeze(o);
  const result = sweep.runSweep(c, o);
  assert.equal(JSON.stringify({ c, o }), before);
  assert.notEqual(result.configuration, c); assert.notEqual(result.configuration.geometry, c.geometry);
});
test('Avisos por punto, conteo y rango de frecuencias conservados', () => {
  const analysis = sweep.runSweep(configuration(), options());
  const warned = analysis.rows.filter(row => row.warnings.length);
  assert.equal(analysis.warningPointCount, warned.length); assert.ok(warned.length > 0 && warned.length < 100);
  for (const group of analysis.warningSummary) {
    const rows = analysis.rows.filter(row => row.warnings.some(w => w.code === group.code));
    assert.equal(group.count, rows.length); assert.equal(group.minFrequencyHz, rows[0].frequencyHz); assert.equal(group.maxFrequencyHz, rows.at(-1).frequencyHz);
  }
  const coaxial = sweep.runSweep(configuration('coaxial'), options());
  assert.equal(coaxial.warningPointCount, 100); assert.ok(coaxial.warningSummary.some(w => w.code === 'coaxial-wall'));
});
test('Errores compartidos se rechazan antes de generar resultados', () => {
  assert.throws(() => sweep.runSweep({ ...configuration(), geometry: { radius: 1, separation: 1 } }, options()), /Revisa/);
});
test('Puntos numéricamente inválidos se registran sin abortar el barrido', () => {
  const analysis = sweep.runSweep(configuration('coaxial'), { start: 1e6, end: 1e308, unit: 'Hz', points: 20, scale: 'log' });
  assert.ok(analysis.successCount > 0 && analysis.rejectedCount > 0);
  assert.equal(analysis.successCount + analysis.rejectedCount, 20);
  const rejected = analysis.rows.filter(row => !row.valid);
  assert.ok(rejected.every(row => row.secondary === null && row.error.message.length));
  for (const row of rejected) assert.equal(sweep.getMagnitude(row, 'R'), null);
});
test('CSV: encabezados y unidades, precisión round-trip, metadatos y avisos', () => {
  const analysis = sweep.runSweep(configuration(), { ...options(), points: 10 });
  const csv = sweep.toCSV(analysis), [header, ...rows] = parseCSV(csv);
  assert.equal(csv.charCodeAt(0), 0xFEFF); assert.equal(rows.length, 10);
  for (const name of ['Frecuencia [Hz]', 'R [ohm/m]', 'L [H/m]', 'C [F/m]', 'G [S/m]', 'Re(Z0) [ohm]', 'Im(Z0) [ohm]', 'alpha [Np/m]', 'alpha [dB/m]', 'beta [rad/m]', 'vp [m/s]', 'lambda [m]']) assert.ok(header.includes(name));
  for (let i = 0; i < rows.length; i++) {
    assert.equal(rows[i].length, header.length);
    assert.equal(Number(rows[i][header.indexOf('C [F/m]')]), analysis.rows[i].primary.C);
    assert.equal(Number(rows[i][header.indexOf('Im(Z0) [ohm]')]), analysis.rows[i].secondary.Z0.im);
    assert.deepEqual(JSON.parse(rows[i][header.indexOf('Dimensiones [mm] (JSON)')]), configuration().geometry);
  }
  assert.match(csv, /skin-depth/);
});
test('CSV: rechazo vacío, cero físico conservado y comillas/saltos escapados', () => {
  const analysis = sweep.runSweep({ ...configuration(), lossTangent: 0 }, { ...options(), points: 10 });
  analysis.rows[0].warnings.push({ code: 'prueba', message: 'Aviso, "citado"\r\nsegunda línea' });
  analysis.rows[1] = { frequencyHz: 2e6, valid: false, primary: null, secondary: null, warnings: [], error: { name: 'RangeError', message: 'Fuera de rango' } };
  const [header, ...rows] = parseCSV(sweep.toCSV(analysis));
  assert.equal(rows[0][header.indexOf('G [S/m]')], '0');
  assert.match(rows[0][header.indexOf('Avisos del modelo')], /"citado"\r\nsegunda/);
  assert.equal(rows[1][header.indexOf('R [ohm/m]')], '');
  assert.equal(rows[1][header.indexOf('vp [m/s]')], '');
  assert.equal(rows[1][header.indexOf('Estado')], 'rechazado');
  assert.match(rows[1][header.indexOf('Error')], /Fuera de rango/);
});
test('Gráficas: once magnitudes, unidades separadas, zoom, hover y PNG', () => {
  const analysis = sweep.runSweep(configuration(), { ...options(), points: 10 });
  assert.equal(sweep.MAGNITUDES.length, 11);
  for (const m of sweep.MAGNITUDES) {
    const spec = charts.buildPlot(analysis, m.key, 'log');
    assert.equal(spec.data.length, 1); assert.equal(spec.data[0].connectgaps, false);
    close(spec.data[0].y[0] * spec.presentation.factor, sweep.getMagnitude(analysis.rows[0], m.key));
    assert.match(spec.layout.yaxis.title.text, new RegExp(m.unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.equal(spec.layout.xaxis.type, 'log'); assert.equal(spec.layout.dragmode, 'zoom');
    assert.ok(spec.data[0].hovertemplate.includes(m.unit)); assert.equal(spec.config.toImageButtonOptions.format, 'png');
  }
  assert.equal(charts.buildPlot(analysis, 'R', 'linear').layout.xaxis.type, 'linear');
  assert.equal(charts.PLOTLY_VERSION, '2.35.2');
});
test('Gráficas: huecos sin interpolación ni mutación del análisis', () => {
  const analysis = sweep.runSweep(configuration(), { ...options(), points: 10 });
  analysis.rows[4].valid = false;
  const before = JSON.stringify(analysis), spec = charts.buildPlot(analysis, 'R', 'linear');
  assert.equal(spec.data[0].y[4], null); assert.equal(spec.data[0].connectgaps, false);
  assert.equal(spec.data[0].x[0], 1); assert.equal(spec.data[0].x.at(-1), 1000);
  assert.equal(JSON.stringify(analysis), before);
  assert.throws(() => charts.buildPlot(analysis, 'potencia', 'linear'), RangeError);
});
