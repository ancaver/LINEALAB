/* Controlador del análisis: independiente del cálculo individual y sin ecuaciones. */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const sweep = globalThis.LineaLabSweep, charts = globalThis.LineaLabCharts;
  const ui = globalThis.LineaLabUI, number = ui.formatNumber;
  const form = $('#sweep-form'), plot = $('#plot-container');
  const fields = ['sweep-start', 'sweep-end', 'sweep-unit', 'sweep-points', 'sweep-scale'];
  let homeRange = null;
  let analysis = null, plotReady = false, plotRevision = 0, plotlyFailed = false;
  const escape = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const setStatus = (text, state = '') => { $('#sweep-status').textContent = text; $('#sweep-status').className = `form-status ${state}`; };
  function clearErrors() {
    for (const id of fields) { $(`#${id}`).removeAttribute('aria-invalid'); $(`#${id}-error`).textContent = ''; }
  }
  function plotMessage(text) {
    $('#chart-placeholder').hidden = false; $('#chart-message').textContent = text;
    plot.hidden = true; plotReady = false;
    $('#reset-zoom').disabled = true; $('#download-png').disabled = true;
  }
  function clearPlot() {
    homeRange = null;
    plotRevision += 1;
    if (globalThis.Plotly && plotReady) globalThis.Plotly.purge(plot);
    plotMessage('Genera un análisis para visualizar una magnitud. El cálculo individual se muestra en sus tarjetas y tabla.');
    $('#plot-status').textContent = '';
  }
  function invalidate(message = 'Configuración modificada. Pulsa Generar análisis para actualizar el barrido.') {
    analysis = null;
    $('#export-csv').disabled = true;
    $('#sweep-results-table').innerHTML = '<tr><td colspan="13">Pendiente de análisis.</td></tr>';
    $('#sweep-table-caption').textContent = 'Genera un análisis para completar esta tabla.';
    $('#sweep-warnings').hidden = true; $('#sweep-warnings').textContent = '';
    clearPlot(); setStatus(message);
  }
  function showTable() {
    const unit = analysis.options.unit, factor = sweep.FREQUENCY_UNITS[unit];
    $('#sweep-frequency-heading').textContent = `Frecuencia [${unit}]`;
    $('#sweep-table-caption').textContent = `${analysis.configuration.type} · ${analysis.rows.length} frecuencias · ${analysis.successCount} calculadas y ${analysis.rejectedCount} rechazadas. Valores mostrados a seis cifras; CSV sin ese redondeo.`;
    $('#sweep-results-table').innerHTML = analysis.rows.map(row => {
      let values = Array(11).fill('—');
      if (row.valid) {
        const p = row.primary, s = row.secondary;
        values = [p.R, p.L, p.C, p.G, s.Z0.re, s.Z0.im, s.alpha, s.alphaDb, s.beta, s.phaseVelocity, s.wavelength].map(number);
      }
      const state = row.valid ? 'Calculado' : 'Rechazado';
      const warnings = row.warnings.length ? `<details><summary>${row.warnings.length} aviso(s) del modelo</summary><ul>${row.warnings.map(w => `<li>${escape(w.message)}</li>`).join('')}</ul></details>` : '';
      const error = row.error ? `<br>${escape(row.error.message)}` : '';
      return `<tr${row.valid ? '' : ' class="rejected-row"'}><th scope="row">${number(row.frequencyHz / factor)}</th>${values.map(value => `<td>${value}</td>`).join('')}<td class="sweep-row-state">${state}${error}${warnings}</td></tr>`;
    }).join('');
  }
  function showWarnings() {
    const data = analysis, factor = sweep.FREQUENCY_UNITS[data.options.unit];
    const list = data.warningSummary.map(w => `<li><strong>${w.count} punto(s), ${number(w.minFrequencyHz / factor)}–${number(w.maxFrequencyHz / factor)} ${data.options.unit}:</strong> ${escape(w.message)}</li>`).join('');
    $('#sweep-warnings').innerHTML = `<p><strong>${data.warningPointCount} de ${data.rows.length} puntos tienen avisos del modelo.</strong> Parte del intervalo puede quedar fuera del régimen aplicable; los límites de los avisos son orientativos.</p>${list ? `<ul>${list}</ul>` : ''}${data.rejectedCount ? `<p>${data.rejectedCount} punto(s) rechazado(s). Consulta su error en la tabla; no se interpolan ni se sustituyen por cero.</p>` : ''}`;
    $('#sweep-warnings').hidden = !data.warningPointCount && !data.rejectedCount;
  }
  function verticalHome() {
    return homeRange ? { 'yaxis.autorange': false, 'yaxis.range': [...homeRange] } : { 'yaxis.autorange': true };
  }
  function restoreVerticalScale(update) {
    if (update['yaxis.autorange'] === true && homeRange && plotReady) {
      Promise.resolve(globalThis.Plotly.relayout(plot, verticalHome())).catch(() => {
        $('#plot-status').textContent = 'No se pudo ajustar la escala vertical.';
      });
    }
  }
  function renderPlot() {
    if (!analysis || $('#chart-view').hidden) return;
    if (!analysis.successCount) { clearPlot(); plotMessage('No hay puntos calculados para graficar. Consulta los errores en la tabla del barrido.'); return; }
    if (!globalThis.Plotly) {
      plotMessage(plotlyFailed ? 'No se pudo cargar Plotly. La tabla y el CSV siguen disponibles. Comprueba que la carpeta vendor esté junto a index.html, según el README.' : 'Cargando la biblioteca de gráficas. La tabla y el CSV ya están disponibles.');
      return;
    }
    const revision = ++plotRevision;
    plotReady = false; $('#reset-zoom').disabled = true; $('#download-png').disabled = true;
    $('#chart-placeholder').hidden = true; plot.hidden = false;
    $('#plot-status').textContent = '';
    try {
      const spec = charts.buildPlot(analysis, $('#plot-magnitude').value, $('#plot-scale').value, document.documentElement?.getAttribute('data-theme') || 'light');
      homeRange = spec.presentation.range ? [...spec.presentation.range] : null;
      Promise.resolve(globalThis.Plotly.react(plot, spec.data, spec.layout, spec.config)).then(() => {
        if (revision !== plotRevision) return;
        // Restaurar el margen basado en datos también desde la barra de Plotly.
        plot.removeListener?.('plotly_relayout', restoreVerticalScale);
        plot.on?.('plotly_relayout', restoreVerticalScale);
        plotReady = true; $('#reset-zoom').disabled = false; $('#download-png').disabled = false;
      }).catch(() => { if (revision === plotRevision) plotMessage('No se pudo dibujar la gráfica. Los datos siguen disponibles en la tabla y el CSV.'); });
    } catch (error) { plotMessage(error.message); }
  }
  $('#plot-magnitude').innerHTML = `<optgroup label="Parámetros primarios">${sweep.MAGNITUDES.slice(0, 4).map(m => `<option value="${m.key}">${m.label} [${m.unit}]</option>`).join('')}</optgroup><optgroup label="Parámetros secundarios">${sweep.MAGNITUDES.slice(4).map(m => `<option value="${m.key}">${m.label} [${m.unit}]</option>`).join('')}</optgroup>`;
  $('#plot-magnitude').value = 'R';
  form.addEventListener('submit', event => {
    event.preventDefault(); clearErrors(); invalidate('Generando análisis…');
    // La gráfica pasa a primer plano, salvo que se esté consultando la tabla del barrido.
    if ($('#sweep-table-view').hidden) ui.activateTab('chart-tab');
    $('#generate-analysis').disabled = true;
    try {
      analysis = sweep.runSweep(ui.readConfiguration(), {
        start: $('#sweep-start').valueAsNumber, end: $('#sweep-end').valueAsNumber,
        unit: $('#sweep-unit').value, points: $('#sweep-points').valueAsNumber, scale: $('#sweep-scale').value
      });
      $('#plot-scale').value = analysis.options.scale;
      showTable(); showWarnings(); renderPlot();
      $('#export-csv').disabled = false;
      setStatus(`${analysis.successCount} de ${analysis.rows.length} puntos calculados correctamente; ${analysis.rejectedCount} rechazados; ${analysis.warningPointCount} con avisos. «Calculado» indica éxito numérico, no validez física garantizada.`, analysis.rejectedCount || analysis.warningPointCount ? 'warning' : 'success');
    } catch (error) {
      if (error.issues) {
        ui.activateTab('chart-tab'); // Los campos del intervalo viven en esta pestaña.
        for (const [key, message] of Object.entries(error.issues)) {
          const node = $(`#${key}`), errorNode = $(`#${key}-error`);
          if (node) node.setAttribute('aria-invalid', 'true');
          if (errorNode) errorNode.textContent = message;
        }
        const first = [...fields.map(id => $(`#${id}`)), ...document.querySelectorAll('#configuration-form input')].find(node => node.getAttribute('aria-invalid') === 'true');
        if (first) first.focus();
      }
      setStatus(error.issues ? 'Revisa los campos señalados en el análisis o la configuración de la línea.' : error.message, 'invalid');
    } finally { $('#generate-analysis').disabled = false; }
  });
  for (const type of ['input', 'change']) {
    form.addEventListener(type, () => { clearErrors(); invalidate(); });
    $('#configuration-form').addEventListener(type, () => invalidate());
  }
  document.querySelectorAll('.line-option').forEach(button => button.addEventListener('click', () => invalidate()));
  $('#configuration-form').addEventListener('reset', () => setTimeout(() => {
    form.reset(); $('#plot-magnitude').value = 'R'; $('#plot-scale').value = 'log'; clearErrors(); invalidate('Se ha restablecido el intervalo inicial: 1–1000 MHz, 100 puntos logarítmicos.');
  }, 0));
  globalThis.addEventListener?.('linealab:themechange', renderPlot);
  $('#plot-magnitude').addEventListener('change', renderPlot);
  $('#plot-scale').addEventListener('change', renderPlot);
  $('#chart-tab').addEventListener('click', renderPlot);
  document.querySelectorAll('[role="tab"]').forEach(tab => tab.addEventListener('keydown', () => setTimeout(renderPlot, 0)));
  $('#reset-zoom').addEventListener('click', async () => {
    if (!plotReady) return;
    try { await globalThis.Plotly.relayout(plot, { 'xaxis.autorange': true, ...verticalHome() }); }
    catch { $('#plot-status').textContent = 'No se pudo restablecer el zoom.'; }
  });
  $('#download-png').addEventListener('click', async () => {
    if (!plotReady) return;
    try { await globalThis.Plotly.downloadImage(plot, { format: 'png', filename: `LINEALAB-${$('#plot-magnitude').value}`, width: 1100, height: 600, scale: 2 }); }
    catch { $('#plot-status').textContent = 'No se pudo descargar el PNG. Usa también el botón de cámara de la gráfica.'; }
  });
  $('#export-csv').addEventListener('click', () => {
    if (!analysis) return;
    const blob = new Blob([sweep.toCSV(analysis)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `LINEALAB-${analysis.configuration.type}-barrido.csv`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  globalThis.addEventListener?.('load', () => { if (!globalThis.Plotly) plotlyFailed = true; renderPlot(); });
  if (document.readyState === 'complete' && !globalThis.Plotly) plotlyFailed = true;
  const loader = $('#plotly-script');
  if (loader) {
    loader.addEventListener('load', renderPlot);
    loader.addEventListener('error', () => { plotlyFailed = true; renderPlot(); });
  }
})();
