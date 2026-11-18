/* Especificación Plotly pura. Las escalas y prefijos sólo afectan a la vista. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./sweep.js'));
  else root.LineaLabCharts = factory(root.LineaLabSweep);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (sweep) {
  'use strict';
  const PLOTLY_VERSION = '2.35.2';
  const PLOTLY_URL = 'https://cdn.plot.ly/plotly-basic-2.35.2.min.js';
  const PREFIXES = Object.freeze({ '-30':'q', '-27':'r', '-24':'y', '-21':'z', '-18':'a', '-15':'f', '-12':'p', '-9':'n', '-6':'µ', '-3':'m', 0:'', 3:'k', 6:'M', 9:'G', 12:'T', 15:'P', 18:'E', 21:'Z', 24:'Y', 27:'R', 30:'Q' });
  const PREFIXABLE = new Set(['R','L','C','G','Z0Magnitude','Z0Real','Z0Imaginary','wavelength']);
  const superscript = value => String(value).split('').map(char => ({'-':'⁻',0:'⁰',1:'¹',2:'²',3:'³',4:'⁴',5:'⁵',6:'⁶',7:'⁷',8:'⁸',9:'⁹'}[char])).join('');
  const shortNumber = value => value === 0 ? '0' : String(Number(value.toPrecision(8)));

  function presentation(values, magnitude) {
    const finite = values.filter(Number.isFinite);
    const maximum = finite.length ? Math.max(...finite) : null;
    const minimum = finite.length ? Math.min(...finite) : null;
    const peak = finite.length ? Math.max(Math.abs(minimum), Math.abs(maximum)) : 0;
    let exponent = 0;
    if (peak > 0 && (PREFIXABLE.has(magnitude.key) || peak < 1e-6 || peak >= 1e6)) {
      exponent = Math.max(-300, Math.min(300, 3 * Math.floor(Math.log10(peak) / 3)));
      // µH/m es una unidad habitual para inductancias de líneas de transmisión.
      if (magnitude.key === 'L' && peak >= 1e-8 && peak < 1e-3) exponent = -6;
    }
    const factor = 10 ** exponent;
    const prefix = PREFIXABLE.has(magnitude.key) && Object.hasOwn(PREFIXES, exponent) ? PREFIXES[exponent] : null;
    const unit = prefix !== null ? `${prefix}${magnitude.unit}` : exponent === 0 ? magnitude.unit : `10${superscript(exponent)} ${magnitude.unit}`;
    const y = values.map(value => Number.isFinite(value) ? value / factor : null);
    const zero = finite.length > 0 && finite.every(value => value === 0);
    const constant = finite.length > 0 && minimum === maximum;
    let range = null;
    if (finite.length) {
      if (zero) range = [-0.5, 0.5]; // Espacio de dibujo; la ÚNICA marca visible será 0.
      else {
        const low = minimum / factor, high = maximum / factor;
        // Margen relativo a los datos, sin imponer ±1 ni un mínimo absoluto.
        const amplitude = Math.max(Math.abs(low),Math.abs(high));
        const margin = Math.max(constant ? amplitude * 0.05 : Math.max((high / 2 - low / 2) * 0.16, amplitude * Number.EPSILON * 16), Number.MIN_VALUE);
        range = [Math.max(-Number.MAX_VALUE, low - margin), Math.min(Number.MAX_VALUE, high + margin)];
      }
    }
    const note = !constant ? '' : zero ? `Valor exactamente cero: 0 ${magnitude.unit}` : `Constante: ${shortNumber(y.find(Number.isFinite))} ${unit}`;
    return { y, factor, exponent, unit, baseUnit: magnitude.unit, range, constant, zero, note };
  }

  function buildPlot(analysis, key, scale, theme = 'light') {
    const dark = theme === 'dark';
    const surface = dark ? '#0c1a2b' : '#ffffff';
    const accent = dark ? '#22d3ee' : '#1f63e0';
    const ink = dark ? '#b4c6da' : '#4a5f78';
    const grid = dark ? '#1d3650' : '#e6ecf4';
    const magnitude = sweep.MAGNITUDES.find(item => item.key === key);
    if (!magnitude || !['linear', 'log'].includes(scale)) throw new RangeError('Selecciona una magnitud y una escala horizontal válidas.');
    const unit = analysis.options.unit, factor = sweep.FREQUENCY_UNITS[unit];
    const raw = analysis.rows.map(row => sweep.getMagnitude(row, key));
    const view = presentation(raw, magnitude);
    return {
      presentation: view,
      data: [{
        type: 'scatter', mode: 'lines+markers', name: `${magnitude.label} [${view.unit}]`,
        x: analysis.rows.map(row => row.frequencyHz / factor), y: view.y,
        connectgaps: false,
        line: { color: accent, width: view.constant ? 3 : 2 },
        marker: { size: 4, color: analysis.rows.map(row => row.warnings.length ? '#d79a2b' : accent) },
        // Cadenas round-trip: Plotly no redondea el valor SI al interpolar el hover.
        customdata: analysis.rows.map((row,index) => [
          `${row.warnings.length} aviso(s) del modelo`,
          raw[index] === null ? null : String(raw[index]),
          view.y[index] === null ? null : String(view.y[index]),
          String(row.frequencyHz / factor)
        ]),
        hovertemplate: `Frecuencia: %{customdata[3]} ${unit}<br>${magnitude.label}: %{customdata[2]} ${view.unit}<br>Valor SI: %{customdata[1]} ${magnitude.unit}<br>Modelo aproximado · %{customdata[0]}<extra></extra>`
      }],
      layout: {
        title: { text: `${magnitude.label} frente a frecuencia`, font: { size: 14 } },
        font: { family: 'Segoe UI, Arial, sans-serif', size: 11, color: ink },
        paper_bgcolor: surface, plot_bgcolor: surface,
        hoverlabel: { bgcolor: surface, font: { color: ink } },
        modebar: { bgcolor: surface, color: ink, activecolor: accent },
        uirevision: `${key}:${scale}:${view.exponent}`,
        margin: { l: 80, r: 25, t: 60, b: 95 }, height: 390,
        xaxis: { title: { text: `Frecuencia [${unit}]` }, type: scale, autorange: true, automargin: true, gridcolor: grid, exponentformat: 'e' },
        yaxis: {
          title: { text: `${magnitude.label} [${view.unit}]`, standoff: 12 },
          type: 'linear', autorange: view.range === null, ...(view.range ? { range: [...view.range] } : {}),
          ...(view.zero ? { tickmode:'array', tickvals:[0], ticktext:['0'], zeroline:false } : { tickmode:'auto', tickvals:null, ticktext:null, zeroline:true }),
          automargin: true, gridcolor: grid, exponentformat: 'e', showexponent: 'all'
        },
        annotations: view.note ? [{
          text: view.note, xref:'paper', yref:'paper', x:0.02, y:0.98,
          xanchor:'left', yanchor:'top', showarrow:false, align:'left',
          font:{size:11,color:ink}, bgcolor:surface, bordercolor:grid, borderpad:5
        }] : [],
        showlegend: true, legend: { orientation: 'h', y: -0.22, x: 0 }, hovermode: 'closest', dragmode: 'zoom'
      },
      config: {
        responsive: true, displaylogo: false, displayModeBar: true, scrollZoom: true, doubleClick: 'reset',
        modeBarButtonsToRemove: ['select2d', 'lasso2d'],
        toImageButtonOptions: { format: 'png', filename: `LINEALAB-${key}`, width: 1100, height: 600, scale: 2 }
      }
    };
  }
  return Object.freeze({ PLOTLY_VERSION, PLOTLY_URL, presentation, buildPlot });
});
