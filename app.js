/* Controles y vistas (organización lateral + pestañas). Motores puros en calculations.js y secondary.js. */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const form = $('#configuration-form');
const engine = globalThis.LineaLabCalculations;
const secondaryEngine = globalThis.LineaLabSecondary;
// Preferencia visual local; no modifica entradas ni resultados del simulador.
const themeToggle = $('#theme-toggle');
if (themeToggle && document.documentElement) {
  const applyTheme = (dark, remember = false) => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    themeToggle.setAttribute('aria-pressed', String(dark));
    themeToggle.setAttribute('aria-label', dark ? 'Activar modo claro' : 'Activar modo oscuro');
    if (remember) {
      try { globalThis.localStorage.setItem('linealab.theme', dark ? 'dark' : 'light'); } catch { /* El tema funciona también sin almacenamiento. */ }
    }
    globalThis.dispatchEvent?.(new Event('linealab:themechange'));
  };
  let savedTheme = 'light';
  try { savedTheme = globalThis.localStorage.getItem('linealab.theme') || 'light'; } catch { /* Algunos navegadores restringen el almacenamiento local. */ }
  applyTheme(savedTheme === 'dark');
  themeToggle.addEventListener('click', () => applyTheme(document.documentElement.getAttribute('data-theme') !== 'dark', true));
}
// «Acerca de» despliega las condiciones del modelo antes de desplazarse hasta ellas.
$('#about-link')?.addEventListener('click', () => { $('#about').open = true; });

const primaryKeys = ['R', 'L', 'C', 'G'];
const secondaryKeys = ['Z0', 'gamma', 'alpha', 'beta', 'phaseVelocity', 'wavelength'];
let lastResults = null;
const primary = [ ['Resistencia','R′','Ω/m'], ['Inductancia','L′','H/m'], ['Capacitancia','C′','F/m'], ['Conductancia','G′','S/m'] ];
const secondary = [ ['Impedancia característica','Z₀','Ω'], ['Constante de propagación','γ','m⁻¹'], ['Atenuación','α','Np/m'], ['Constante de fase','β','rad/m'], ['Velocidad de fase','vₚ','m/s'], ['Longitud de onda','λ','m'] ];
// Tarjetas destacadas: subconjunto de los diez parámetros, sin cálculos adicionales.
const headline = [ ['Resistencia','R′','Ω/m'], ['Inductancia','L′','H/m'], ['Impedancia característica','Z₀','Ω'], ['Atenuación','α','dB/m'] ];
const typeNames = { bifilar: 'Bifilar', coaxial: 'Coaxial', placas: 'Placas paralelas' };
const conductorLooks = { cobre: ['Cobre', '#c9743c', '#f0b184', '#8f4a1f'], aluminio: ['Aluminio', '#a7b1bc', '#e3e8ee', '#6f7a86'], plata: ['Plata', '#c9d0d8', '#f6f8fa', '#8b949e'], oro: ['Oro', '#d3a72f', '#f6dc8a', '#96701a'] };
const dielectricLooks = { aire: ['Aire', '#d9ecff', 0.35], vacio: ['Vacío', '#e6eefc', 0.2], ptfe: ['PTFE', '#f4f6f8', 1], polietileno: ['Polietileno', '#ece9df', 1] };
const geometries = {
 bifilar: { title:'Línea bifilar', description:'Dos conductores paralelos separados por un medio dieléctrico.', fields:[['radius','Radio del conductor (a)',0.5],['separation','Distancia entre centros (D)',5]] },
 coaxial: { title:'Línea coaxial', description:'Conductores concéntricos con un medio dieléctrico entre ambos.', fields:[['innerRadius','Radio del conductor interior (a)',0.5],['outerRadius','Radio interno del conductor exterior (b)',2]] },
 placas: { title:'Línea de placas paralelas', description:'Dos placas conductoras separadas por un medio dieléctrico.', fields:[['width','Ancho de las placas (w)',20],['gap','Separación entre placas (d)',1]] }
};
let selectedType = 'bifilar';
let modelSnapshot = null; // Última configuración dibujada; la consume el visor 3D.
const status = (message, state = '') => {
  $('#form-status').textContent = message;
  $('#form-status').className = `form-status ${state}`;
};

/* ---- Visualización técnica: sólo dibuja las entradas, no interviene en los cálculos. ---- */
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const dimension = value => Number.isFinite(value) && value > 0 ? `${Number(value.toPrecision(4))} mm` : '—';
const positive = value => Number.isFinite(value) && value > 0;
// Cota lineal entre dos puntos con líneas de referencia y etiqueta.
function cota(x1, y1, x2, y2, label, side) {
  const horizontal = y1 === y2, mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const tick = horizontal ? `M${x1} ${y1 - 4}v8M${x2} ${y2 - 4}v8` : `M${x1 - 4} ${y1}h8M${x2 - 4} ${y2}h8`;
  const text = horizontal
    ? `<text class="td-label" x="${mx}" y="${my + (side === 'below' ? 15 : -7)}" text-anchor="middle">${label}</text>`
    : `<text class="td-label" x="${mx + 9}" y="${my + 4}" text-anchor="start">${label}</text>`;
  return `<path class="td-dim" d="M${x1} ${y1}L${x2} ${y2}${tick}"/>${text}`;
}
function crossSection(type, g) {
  // Devuelve el SVG y si las proporciones dibujadas coinciden con las entradas.
  const cx = 150, cy = 108;
  let body = '', exact = true, valid = true;
  if (type === 'coaxial') {
    const a = g.innerRadius, b = g.outerRadius, R = 62;
    valid = positive(a) && positive(b) && b > a;
    const ratio = valid ? a / b : 0.25, r = clamp(R * ratio, 4, R - 6);
    exact = valid && Math.abs(r - R * ratio) < 0.01;
    body = `<circle class="td-jacket" cx="${cx}" cy="${cy}" r="${R + 11}"/><circle class="td-conductor" cx="${cx}" cy="${cy}" r="${R + 6}"/><circle class="td-dielectric" cx="${cx}" cy="${cy}" r="${R}"/><circle class="td-conductor" cx="${cx}" cy="${cy}" r="${r}"/>`
      + `<path class="td-axis" d="M${cx - R - 24} ${cy}H${cx + R + 24}M${cx} ${cy - R - 16}V${cy + R + 16}"/>`
      + `<path class="td-ext" d="M${cx + R} ${cy}V${cy - R - 26}M${cx} ${cy - R - 12}V${cy - R - 26}M${cx + r} ${cy}V${cy + R + 26}M${cx} ${cy + R + 12}V${cy + R + 26}"/>`
      + cota(cx, cy - R - 22, cx + R, cy - R - 22, `b = ${dimension(b)}`, 'above') + cota(cx, cy + R + 22, cx + r, cy + R + 22, `a = ${dimension(a)}`, 'below');
  } else if (type === 'bifilar') {
    const a = g.radius, D = g.separation;
    valid = positive(a) && positive(D) && D > 2 * a;
    const span = 190, scale = valid ? span / (D + 2 * a) : span / 6;
    const r = clamp((valid ? a : 0.5) * scale, 4, 70), half = (valid ? D : 5) * scale / 2;
    exact = valid && Math.abs(r - a * scale) < 0.01;
    const x1 = cx - half, x2 = cx + half;
    body = `<rect class="td-medium" x="${cx - 128}" y="${cy - r - 22}" width="256" height="${2 * r + 44}" rx="14"/>`
      + `<path class="td-axis" d="M${cx - 132} ${cy}H${cx + 132}"/><circle class="td-conductor" cx="${x1}" cy="${cy}" r="${r}"/><circle class="td-conductor" cx="${x2}" cy="${cy}" r="${r}"/>`
      + `<path class="td-ext" d="M${x1} ${cy}V${cy - r - 40}M${x2} ${cy}V${cy - r - 40}M${x1} ${cy}V${cy + r + 40}M${x1 + r} ${cy}V${cy + r + 40}"/>`
      + cota(x1, cy - r - 36, x2, cy - r - 36, `D = ${dimension(D)}`, 'above') + cota(x1, cy + r + 36, x1 + r, cy + r + 36, `a = ${dimension(a)}`, 'below');
  } else {
    const w = g.width, d = g.gap, W = 180, plate = 7;
    valid = positive(w) && positive(d);
    const ideal = valid ? W * d / w : 30, h = clamp(ideal, 10, 110);
    exact = valid && Math.abs(h - ideal) < 0.01;
    const x = cx - W / 2 - 14, top = cy - h / 2;
    body = `<rect class="td-dielectric" x="${x}" y="${top}" width="${W}" height="${h}"/><rect class="td-conductor" x="${x}" y="${top - plate}" width="${W}" height="${plate}"/><rect class="td-conductor" x="${x}" y="${top + h}" width="${W}" height="${plate}"/>`
      + `<path class="td-ext" d="M${x} ${top - plate}V${top - plate - 26}M${x + W} ${top - plate}V${top - plate - 26}M${x + W} ${top}H${x + W + 22}M${x + W} ${top + h}H${x + W + 22}"/>`
      + cota(x, top - plate - 22, x + W, top - plate - 22, `w = ${dimension(w)}`, 'above') + cota(x + W + 18, top, x + W + 18, top + h, `d = ${dimension(d)}`);
  }
  return { valid, exact, svg: `<svg viewBox="0 0 300 216" role="img" aria-label="${geometries[type].title}: sección transversal con cotas">${body}</svg>` };
}
// Vista ilustrativa en corte; decorativa y sin escala.
function illustration(type, metal, dielectric) {
  const [, mid, light, dark] = metal, [, fill, opacity] = dielectric;
  const defs = `<defs><linearGradient id="il-metal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${dark}"/><stop offset=".3" stop-color="${light}"/><stop offset=".62" stop-color="${mid}"/><stop offset="1" stop-color="${dark}"/></linearGradient><linearGradient id="il-jacket" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1117"/><stop offset=".28" stop-color="#4b5563"/><stop offset=".6" stop-color="#1f2630"/><stop offset="1" stop-color="#05070a"/></linearGradient><linearGradient id="il-diel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9aa7b5"/><stop offset=".3" stop-color="${fill}"/><stop offset=".7" stop-color="${fill}"/><stop offset="1" stop-color="#8794a3"/></linearGradient><pattern id="il-braid" width="9" height="9" patternUnits="userSpaceOnUse"><rect width="9" height="9" fill="url(#il-metal)"/><path d="M0 0l9 9M9 0L0 9" stroke="${dark}" stroke-width="1.6" opacity=".75"/></pattern></defs>`;
  // Un tramo cilíndrico horizontal con su cara de corte a la derecha.
  const tube = (end, height, paint, face, alpha = 1) => `<g opacity="${alpha}"><rect x="-20" y="${75 - height / 2}" width="${end + 20}" height="${height}" fill="${paint}"/><ellipse cx="${end}" cy="75" rx="${Math.max(3, height / 9)}" ry="${height / 2}" fill="${face}"/></g>`;
  let body;
  if (type === 'coaxial') {
    body = tube(318, 20, 'url(#il-metal)', light) + tube(262, 62, 'url(#il-diel)', fill, Math.max(opacity, 0.55)) + tube(196, 84, 'url(#il-braid)', mid) + tube(128, 100, 'url(#il-jacket)', '#2b333d');
  } else if (type === 'bifilar') {
    const wire = y => `<g transform="translate(0 ${y - 75})">${tube(312, 22, 'url(#il-metal)', light)}${tube(214, 38, 'url(#il-diel)', fill, Math.max(opacity, 0.55))}</g>`;
    body = wire(45) + wire(105);
  } else {
    const plateShape = y => `<path d="M10 ${y + 22}L80 ${y}H330L260 ${y + 22}z" fill="url(#il-metal)"/><path d="M10 ${y + 22}H260v7H10z" fill="${dark}"/><path d="M260 ${y + 22}L330 ${y}v7l-70 22z" fill="${mid}"/>`;
    body = plateShape(88) + `<path d="M10 59H260L330 37V88L260 110H10z" fill="${fill}" opacity="${Math.max(opacity * 0.6, 0.3)}"/>` + plateShape(30);
  }
  return `<svg viewBox="0 0 340 150" preserveAspectRatio="xMidYMid meet">${defs}${body}</svg>`;
}
function renderModel() {
  const configuration = readConfiguration();
  const metal = conductorLooks[$('#conductor').value] || conductorLooks.cobre;
  const dielectric = dielectricLooks[$('#dielectric').value] || dielectricLooks.aire;
  const drawing = crossSection(selectedType, configuration.geometry);
  $('#line-diagram').innerHTML = drawing.svg.replace('<svg ', `<svg style="--metal:${metal[1]};--dielectric:${dielectric[1]}" `);
  $('#line-illustration').innerHTML = illustration(selectedType, metal, dielectric);
  let note = 'Sección transversal a escala. Espesores de pared y placa no modelados.';
  if (!drawing.valid) note = 'Dimensiones incompletas o no válidas: esquema de referencia.';
  else if (!drawing.exact) note = 'Proporción ajustada para que las cotas sean legibles.';
  $('#diagram-scale-note').textContent = note;
  // Sin ceros de relleno: 5.8 × 10⁷ en lugar de 5.80000 × 10⁷.
  const show = (value, unit) => Number.isFinite(value) ? `${formatNumber(value).replace(/(\.\d*?)0+ ×/, '$1 ×').replace('. ×', ' ×')}${unit}` : '—';
  const items = [
    ['i-layers', 'Tipo de línea', typeNames[selectedType]],
    ['i-layers', 'Conductor', `${metal[0]} (σ = ${show(configuration.conductivity, ' S/m')})`],
    ['i-layers', 'Dieléctrico', `${dielectric[0]} (εr = ${show(configuration.relativePermittivity, '')}, tanδ = ${show(configuration.lossTangent, '')})`],
    ['i-wave', 'Frecuencia', show(configuration.frequency, ` ${configuration.frequencyUnit}`)],
    ['i-ruler', 'Longitud', show(configuration.length, ' m')]
  ];
  modelSnapshot = { type: selectedType, geometry: configuration.geometry, conductor: $('#conductor').value, dielectric: $('#dielectric').value, relativePermittivity: configuration.relativePermittivity, valid: drawing.valid };
  globalThis.LineaLabViewer3D?.update(modelSnapshot);
  $('#cable-data').innerHTML = items.map(([icon, term, value]) => `<div><svg class="icon"><use href="#${icon}"/></svg><dt>${term}</dt><dd>${value}</dd></div>`).join('');
}

function clearErrors() {
  form.querySelectorAll('.error').forEach(node => { node.textContent = ''; });
  form.querySelectorAll('[aria-invalid]').forEach(node => node.removeAttribute('aria-invalid'));
}

function changeGeometry(type) {
 selectedType=type;
 const geometry=geometries[type];
 document.querySelectorAll('.line-option').forEach(button => { const active=button.dataset.type===type; button.classList.toggle('active',active); button.setAttribute('aria-pressed',String(active)); });
 $('#geometry-fields').innerHTML=geometry.fields.map(([id,label,value]) => `<label for="${id}">${label}</label><div class="input-with-unit"><input id="${id}" name="${id}" type="number" min="0" step="any" value="${value}" required aria-describedby="${id}-error"><span class="unit">mm</span></div><small class="error" id="${id}-error"></small>`).join('');
 $('#diagram-title').textContent=geometry.title;
 $('#diagram-description').textContent=geometry.description;
 clearErrors(); invalidateResults(); renderModel(); status('Configura la línea para comenzar.');
}

// Los selectores cargan valores orientativos; los campos numéricos son editables.
function loadConductor() {
  $('#conductivity').value = engine.CONDUCTORS[$('#conductor').value].conductivity;
}
function loadDielectric() {
  const material = engine.DIELECTRICS[$('#dielectric').value];
  $('#relativePermittivity').value = material.relativePermittivity;
  $('#lossTangent').value = material.lossTangent;
}
function readConfiguration() {
  return {
    type: selectedType,
    frequency: $('#frequency').valueAsNumber,
    frequencyUnit: $('#frequency-unit').value,
    conductivity: $('#conductivity').valueAsNumber,
    relativePermittivity: $('#relativePermittivity').valueAsNumber,
    lossTangent: $('#lossTangent').valueAsNumber,
    length: $('#length').valueAsNumber,
    geometry: Object.fromEntries(geometries[selectedType].fields.map(([id]) => [id, $(`#${id}`).valueAsNumber]))
  };
}

// Notación científica a seis cifras significativas; cero se muestra como cero.
function formatNumber(value) {
  if (value === 0) return '0';
  if (Math.abs(value) >= 1e-2 && Math.abs(value) < 1e5) return String(Number(value.toPrecision(6)));
  const [mantissa, exponent] = value.toExponential(5).split('e');
  const superscript = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
  const power = String(Number(exponent)).split('').map(char => superscript[char]).join('');
  return `${mantissa} × 10${power}`;
}
function complexTerms(value) {
  return [formatNumber(value.re), `${value.im < 0 ? '−' : '+'} j ${formatNumber(Math.abs(value.im))}`];
}
function secondaryValue(key, results, stacked = false) {
  if (key !== 'Z0' && key !== 'gamma') return formatNumber(results[key]);
  const terms = complexTerms(results[key]);
  return stacked ? terms.map(term => `<span class="complex-component">${term}</span>`).join('') : terms.join(' ');
}
function secondaryExtras(key, results) {
  if (key === 'Z0') return [
    `|Z₀| = ${formatNumber(results.Z0Magnitude)} Ω`,
    `∠Z₀ = ${formatNumber(results.Z0PhaseDegrees)}°`
  ];
  if (key === 'alpha') return [`${formatNumber(results.alphaDb)} dB/m`];
  return [];
}
function renderCards(target, metrics, results = null) {
  $(target).innerHTML = metrics.map(([name, symbol, unit], index) => {
    const key = primaryKeys[index];
    let note = 'Modelo TEM ideal';
    if (key === 'R') note = 'Alta frecuencia · aprox.';
    else if (key === 'G') note = 'Modelo dieléctrico';
    else if (selectedType === 'placas') note = 'Placas anchas · aprox.';
    const value = results
      ? `<p class="metric-value" data-primary-value="${key}">${formatNumber(results[key])}</p><span class="metric-computed-note">${note}</span>`
      : '<span class="pending">Pendiente de cálculo</span>';
    return `<article class="metric"><div class="metric-top"><span class="metric-symbol">${symbol}</span><span class="metric-unit">${unit}</span></div><h3>${name}</h3>${value}</article>`;
  }).join('');
}
function renderSecondaryCards(results = null) {
  $('#secondary-cards').innerHTML = secondary.map(([name, symbol, unit], index) => {
    const key = secondaryKeys[index];
    const isComplex = key === 'Z0' || key === 'gamma';
    const extras = results ? secondaryExtras(key, results) : [];
    const value = results
      ? `<p class="metric-value${isComplex ? ' metric-complex' : ''}" data-secondary-value="${key}">${secondaryValue(key, results, true)}</p>${extras.length ? `<div class="metric-auxiliary">${extras.map(text => `<span>${text}</span>`).join('')}</div>` : ''}`
      : '<span class="pending">Pendiente de cálculo</span>';
    return `<article class="metric"><div class="metric-top"><span class="metric-symbol">${symbol}</span><span class="metric-unit">${unit}</span></div><h3>${name}</h3>${value}</article>`;
  }).join('');
}
function renderTable() {
  $('#results-table').innerHTML = [...primary, ...secondary].map(([name, symbol, unit], index) => {
    let value = 'Pendiente de cálculo';
    if (lastResults) {
      if (index < primary.length) value = formatNumber(lastResults[primaryKeys[index]]);
      else {
        const key = secondaryKeys[index - primary.length];
        value = secondaryValue(key, lastResults.secondary);
        const extras = secondaryExtras(key, lastResults.secondary);
        if (extras.length) value += `<small class="table-auxiliary">${extras.join(' · ')}</small>`;
      }
    }
    return `<tr><th scope="row">${name}</th><td>${symbol}</td><td>${unit}</td><td>${value}</td></tr>`;
  }).join('');
}
function renderHeadline(results = null) {
  const values = results ? [
    formatNumber(results.R), formatNumber(results.L),
    secondaryValue('Z0', results.secondary), formatNumber(results.secondary.alphaDb)
  ] : [];
  const notes = results ? ['Alta frecuencia · aprox.', 'Inductancia externa', `|Z₀| = ${formatNumber(results.secondary.Z0Magnitude)} Ω`, `${formatNumber(results.secondary.alpha)} Np/m`] : [];
  $('#headline-cards').innerHTML = headline.map(([name, symbol, unit], index) => {
    const value = results
      ? `<p class="kpi-value" data-headline-value="${index}">${values[index]}</p><span class="kpi-note">${notes[index]}</span>`
      : '<p class="kpi-value kpi-pending">—</p><span class="kpi-note">Pulsa Calcular</span>';
    return `<article class="kpi kpi-${index + 1}"><div class="kpi-top"><span class="kpi-symbol">${symbol}</span><span class="kpi-unit">${unit}</span></div><h3>${name}</h3>${value}</article>`;
  }).join('');
  $('#headline-context').textContent = results ? 'A la frecuencia de operación' : 'Pendiente de cálculo';
}
function invalidateResults() {
  lastResults = null;
  renderHeadline();
  renderCards('#primary-cards', primary);
  renderSecondaryCards();
  renderTable();
  $('#skin-diagnostics').hidden = true;
  $('#skin-diagnostics').textContent = '';
  $('#model-warnings').hidden = true;
  $('#model-warnings').textContent = '';
}
function showResults(results) {
  lastResults = results;
  renderHeadline(results);
  renderCards('#primary-cards', primary, results);
  renderSecondaryCards(results.secondary);
  renderTable();
  $('#skin-diagnostics').innerHTML = `<span>Profundidad de penetración δ = <strong>${formatNumber(results.skinDepth)} m</strong></span><span>Resistencia superficial Rs = <strong>${formatNumber(results.surfaceResistance)} Ω/□</strong></span>`;
  $('#skin-diagnostics').hidden = false;
  $('#model-warnings').innerHTML = results.warnings.length
    ? `<p>Avisos del modelo (${results.warnings.length})</p><ul>${results.warnings.map(item => `<li>${item.message}</li>`).join('')}</ul>` : '';
  $('#model-warnings').hidden = !results.warnings.length;
}

form.addEventListener('submit', event => {
  event.preventDefault();
  clearErrors();
  invalidateResults();
  try {
    const primaryResults = engine.calculatePrimary(readConfiguration());
    const results = { ...primaryResults, secondary: secondaryEngine.calculateSecondary(primaryResults) };
    showResults(results);
    const message = results.warnings.length
      ? `Parámetros primarios y secundarios calculados con ${results.warnings.length} aviso(s). Revisa las condiciones del modelo.`
      : 'Parámetros primarios y secundarios calculados. R′ es una aproximación de alta frecuencia.';
    status(message, results.warnings.length ? 'warning' : 'success');
  } catch (error) {
    if (error instanceof engine.ValidationError) {
      for (const [key, message] of Object.entries(error.issues)) {
        const input = key === 'frequencyUnit' ? $('#frequency-unit') : $(`#${key}`);
        const errorNode = key === 'frequencyUnit' ? $('#frequency-error') : $(`#${key}-error`);
        if (input) input.setAttribute('aria-invalid', 'true');
        if (errorNode) errorNode.textContent = message;
      }
      status('Revisa los campos señalados para continuar.', 'invalid');
      const firstInvalid = form.querySelector('[aria-invalid="true"]');
      if (firstInvalid) firstInvalid.focus();
    } else {
      status(error instanceof RangeError ? error.message : 'No se pudo completar el cálculo. Revisa los datos y vuelve a intentarlo.', 'invalid');
    }
  }
});
['input', 'change'].forEach(type => form.addEventListener(type, event => {
  if (event.type === 'change' && event.target.id === 'conductor') loadConductor();
  if (event.type === 'change' && event.target.id === 'dielectric') loadDielectric();
  clearErrors();
  invalidateResults();
  renderModel();
  status('Configuración modificada. Pulsa Calcular para actualizar los resultados.');
}));
form.addEventListener('reset', () => setTimeout(() => {
  // El navegador restaura primero los campos estáticos del formulario.
  loadConductor();
  loadDielectric();
  changeGeometry('bifilar');
  activateTab(0);
  status('Se ha restablecido la configuración inicial.');
}, 0));
document.querySelectorAll('.line-option').forEach(button => {
  button.addEventListener('click', () => changeGeometry(button.dataset.type));
});

const tabs = [...document.querySelectorAll('[role="tab"]')];
function activateTab(target) {
  const index = typeof target === 'number' ? target : tabs.findIndex(tab => tab.id === target);
  if (index < 0) return;
  tabs.forEach((tab, position) => {
    const active = position === index;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    document.getElementById(tab.getAttribute('aria-controls')).hidden = !active;
  });
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => activateTab(index));
  tab.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next !== undefined) { event.preventDefault(); activateTab(next); tabs[next].focus(); }
  });
});

// Lectura compartida: el análisis reutiliza la configuración y el formato existentes.
globalThis.LineaLabUI = Object.freeze({ readConfiguration, formatNumber, activateTab, modelState: () => modelSnapshot });
// El botón lateral lanza el mismo formulario de barrido que la pestaña Gráfica.
$('#generate-analysis-side')?.addEventListener('click', () => $('#sweep-form').requestSubmit());
loadConductor();
loadDielectric();
changeGeometry('bifilar');
})();
