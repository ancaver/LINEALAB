'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { fixture } = require('./dom-fixture.cjs');
const settle = async () => { await Promise.resolve(); await Promise.resolve(); };
test('Análisis UI: valores iniciales, cálculo independiente y tabla de 100 filas', async () => {
  const f = fixture({ analysis: true, plotly: true }), n = f.node;
  assert.equal(n('sweep-start').value, '1'); assert.equal(n('sweep-end').value, '1000');
  assert.equal(n('sweep-unit').value, 'MHz'); assert.equal(n('sweep-points').value, '100'); assert.equal(n('sweep-scale').value, 'log');
  f.submit(); const cards = n('primary-cards').innerHTML, individual = n('results-table').innerHTML;
  f.generate(); await settle();
  assert.equal(n('primary-cards').innerHTML, cards); assert.equal(n('results-table').innerHTML, individual);
  assert.equal((n('sweep-results-table').innerHTML.match(/<tr/g) || []).length, 100);
  assert.match(n('sweep-status').textContent, /100 de 100/); assert.match(n('sweep-status').textContent, /0 rechazados/);
  assert.match(n('sweep-warnings').innerHTML, /δ\/a/); assert.equal(n('export-csv').disabled, false);
  assert.equal(f.plots.at(-1).type, 'react'); assert.equal(n('download-png').disabled, false);
});
test('Análisis UI: validación local y de geometría, sin resultados inventados', () => {
  const f = fixture({ analysis: true }), n = f.node;
  n('sweep-end').value = '0.5'; f.generate();
  assert.equal(n('sweep-end').attrs['aria-invalid'], 'true'); assert.equal(n('sweep-end').focused, true);
  assert.equal(n('export-csv').disabled, true);
  n('sweep-end').value = '1000'; n('separation').value = '0.5'; f.generate();
  assert.equal(n('separation').attrs['aria-invalid'], 'true'); assert.match(n('separation-error').textContent, /2a/);
  assert.match(n('sweep-results-table').innerHTML, /Pendiente/);
});
test('Análisis UI: editar intervalo no altera el resultado individual; editar geometría invalida ambos', async () => {
  const f = fixture({ analysis: true, plotly: true }), n = f.node;
  f.submit(); f.generate(); await settle(); const individual = n('results-table').innerHTML;
  n('sweep-form').fire('input', { target: n('sweep-start') });
  assert.equal(n('results-table').innerHTML, individual); assert.equal(n('export-csv').disabled, true);
  f.generate(); await settle();
  n('configuration-form').fire('input', { target: n('radius') });
  assert.equal((n('results-table').innerHTML.match(/Pendiente de cálculo/g) || []).length, 10);
  assert.match(n('sweep-results-table').innerHTML, /Pendiente de análisis/); assert.equal(n('plot-container').hidden, true);
});
test('Análisis UI: magnitud y eje redibujan sin modificar las muestras', async () => {
  const f = fixture({ analysis: true, plotly: true }), n = f.node;
  f.generate(); await settle(); const table = n('sweep-results-table').innerHTML;
  n('plot-magnitude').value = 'Z0Imaginary'; n('plot-magnitude').fire('change'); await settle();
  n('plot-scale').value = 'linear'; n('plot-scale').fire('change'); await settle();
  const graph = f.plots.at(-1);
  assert.equal(graph.args[2].xaxis.type, 'linear'); assert.match(graph.args[2].yaxis.title.text, /imaginaria/);
  assert.equal(n('sweep-results-table').innerHTML, table); assert.equal(n('export-csv').disabled, false);
  n('reset-zoom').fire('click'); n('download-png').fire('click'); await settle();
  assert.ok(f.plots.some(call => call.type === 'relayout')); assert.ok(f.plots.some(call => call.type === 'png' && call.args[1].format === 'png'));
});
test('Análisis UI: CSV se descarga como Blob sin servidor, con precisión completa', async () => {
  const f = fixture({ analysis: true }); f.generate(); f.node('export-csv').fire('click');
  assert.equal(f.downloads.length, 1); assert.match(f.downloads[0].name, /barrido\.csv/);
  const text = await f.downloads[0].blob.text();
  assert.match(text, /Frecuencia \[Hz\]/); assert.equal(text.split('\r\n').length, 102); assert.match(text, /skin-depth/);
  assert.equal(f.revoked.length, 1);
});
test('Análisis UI: CDN ausente o fallido mantiene tabla y CSV; carga tardía dibuja', async () => {
  const f = fixture({ analysis: true }), n = f.node;
  f.generate(); assert.equal(n('export-csv').disabled, false); assert.match(n('chart-message').textContent, /Cargando/);
  n('plotly-script').fire('error'); assert.match(n('chart-message').textContent, /No se pudo cargar/);
  assert.equal(n('download-png').disabled, true);
  f.installPlotly(); n('plotly-script').fire('load'); await settle();
  assert.equal(n('plot-container').hidden, false); assert.equal(n('download-png').disabled, false);
});
test('Análisis UI: puntos rechazados, avisos y campos vacíos', () => {
  const f = fixture({ analysis: true }), n = f.node;
  n('sweep-start').value = '1000000'; n('sweep-end').value = '1e308'; n('sweep-unit').value = 'Hz'; n('sweep-points').value = '20';
  f.generate(); assert.match(n('sweep-results-table').innerHTML, /rejected-row/);
  assert.match(n('sweep-results-table').innerHTML, /—/); assert.match(n('sweep-warnings').innerHTML, /rechazado/);
  assert.equal(n('export-csv').disabled, false);
});
test('Análisis UI: pestaña oculta y restablecimiento de ambos formularios', async () => {
  const f = fixture({ analysis: true, plotly: true }), n = f.node;
  f.tabs[3].fire('click'); f.generate(); assert.equal(f.plots.length, 0);
  n('chart-tab').fire('click'); await settle(); assert.ok(f.plots.length);
  n('sweep-start').value = '4'; n('sweep-scale').value = 'linear';
  n('configuration-form').reset();
  assert.equal(n('sweep-start').value, '1'); assert.equal(n('sweep-scale').value, 'log');
  assert.match(n('sweep-results-table').innerHTML, /Pendiente/); assert.equal(n('export-csv').disabled, true);
});
test('Análisis UI: una respuesta Plotly anterior no reactiva una gráfica invalidada', async () => {
  let finish;
  const f = fixture({ analysis: true, plotly: { react: () => new Promise(resolve => { finish = resolve; }), purge() {} } });
  f.generate(); f.node('sweep-form').fire('input'); finish(); await settle();
  assert.equal(f.node('plot-container').hidden, true); assert.equal(f.node('download-png').disabled, true);
});
