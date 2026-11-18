/* Controlador geométrico independiente. No escribe en el formulario principal,
 * en el visor 3D ni en el estado del controlador de frecuencia. */
(() => {
  'use strict';
  const $=selector=>document.querySelector(selector);
  const engine=globalThis.LineaLabParametric,charts=globalThis.LineaLabParametricCharts,ui=globalThis.LineaLabUI;
  const form=$('#parametric-form'),plot=$('#parametric-plot'),number=ui.formatNumber;
  const fields=['variable','mode','ratio','start','end','points','scale'];
  let mode='frequency',analysis=null,plotReady=false,revision=0,homeRange=null,plotlyFailed=false;
  const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const status=(message,state='')=>{ $('#parametric-status').textContent=message;$('#parametric-status').className=`form-status ${state}`; };
  function readOptions() {
    return {variable:$('#parametric-variable').value,mode:$('#parametric-mode').value,ratio:$('#parametric-ratio').valueAsNumber,start:$('#parametric-start').valueAsNumber,end:$('#parametric-end').valueAsNumber,points:$('#parametric-points').valueAsNumber,scale:$('#parametric-scale').value};
  }
  function updateModeBar() { $('#analysis-modes').hidden=$('#chart-view').hidden && $('#sweep-table-view').hidden; }
  function setMode(next) {
    const changed=mode!==next;mode=next;
    $('#analysis-mode-frequency').setAttribute('aria-pressed',String(mode==='frequency'));
    $('#analysis-mode-geometry').setAttribute('aria-pressed',String(mode==='geometry'));
    $('#frequency-chart-panel').hidden=mode!=='frequency';$('#frequency-table-panel').hidden=mode!=='frequency';
    $('#geometry-chart-panel').hidden=mode!=='geometry';$('#geometry-table-panel').hidden=mode!=='geometry';
    $('#analysis-mode-note').textContent=mode==='frequency'?'Dimensiones y materiales constantes':'Frecuencia y materiales constantes';
    updateModeBar();
    if (mode==='geometry') renderPlot();
    else if (changed && !$('#chart-view').hidden) $('#chart-tab').click();
  }
  function clearErrors() {
    for (const key of fields) { $(`#parametric-${key}`).removeAttribute('aria-invalid');$(`#parametric-${key}-error`).textContent=''; }
  }
  function placeholder(message) {
    $('#parametric-placeholder').hidden=false;$('#parametric-chart-message').textContent=message;plot.hidden=true;plotReady=false;
    $('#parametric-reset-zoom').disabled=true;$('#parametric-download-png').disabled=true;
  }
  function invalidate(message='Configuración modificada. Genera de nuevo el análisis geométrico.') {
    analysis=null;revision+=1;homeRange=null;
    if (globalThis.Plotly && plotReady) globalThis.Plotly.purge(plot);
    placeholder('Selecciona una dimensión y genera el análisis. La frecuencia y los materiales permanecen fijos.');
    $('#parametric-export-csv').disabled=true;$('#parametric-table-csv').disabled=true;
    $('#parametric-results-table').innerHTML='<tr><td colspan="16">Pendiente de análisis geométrico.</td></tr>';
    $('#parametric-summary').textContent='Sin análisis geométrico generado.';
    $('#parametric-table-summary').textContent='Genera un análisis geométrico para completar esta tabla.';
    $('#parametric-table-caption').textContent='Parámetros a seis cifras; α en dB/m a ocho. CSV sin ese redondeo.';
    $('#parametric-warnings').hidden=true;$('#parametric-warnings').textContent='';$('#parametric-plot-status').textContent='';status(message);
  }
  function refreshConditions() {
    const c=ui.readConfiguration(),variable=engine.VARIABLES[c.type].find(v=>v.key===$('#parametric-variable').value);
    const ratioMode=c.type==='coaxial' && variable.key==='innerRadius';
    $('#parametric-mode-field').hidden=!ratioMode;
    if (!ratioMode) $('#parametric-mode').value='fixed';
    const linked=ratioMode && $('#parametric-mode').value==='ratio';
    $('#parametric-ratio-field').hidden=!linked;$('#parametric-ratio').disabled=!linked;
    $('#parametric-fixed-dimension').textContent=linked?`b = k × a en cada punto; k = ${$('#parametric-ratio').value || '—'}.`:`${variable.fixedSymbol} = ${String(c.geometry[variable.fixed])} mm permanece constante.`;
    $('#parametric-fixed-state').textContent=`Frecuencia fija: ${c.frequency} ${c.frequencyUnit} · σc = ${c.conductivity} S/m · εr = ${c.relativePermittivity} · tanδ = ${c.lossTangent}.`;
    $('#parametric-example').hidden=c.type!=='coaxial';
    $('#parametric-variable-heading').textContent=`${variable.label} [mm]`;
  }
  function refreshVariables(reset=false) {
    const c=ui.readConfiguration(),variables=engine.VARIABLES[c.type],previous=$('#parametric-variable').value;
    $('#parametric-variable').innerHTML=variables.map(v=>`<option value="${v.key}">${v.label}</option>`).join('');
    $('#parametric-variable').value=!reset && variables.some(v=>v.key===previous)?previous:variables[0].key;
    if (reset) { $('#parametric-mode').value='fixed';defaultRange(); }
    refreshConditions();
  }
  function defaultRange() {
    const c=ui.readConfiguration(),value=c.geometry[$('#parametric-variable').value];
    $('#parametric-start').value=Number.isFinite(value) && value>0 && value/2>0?String(value/2):'0.25';
    $('#parametric-end').value=Number.isFinite(value*1.5) && value>0?String(value*1.5):'0.75';
  }
  function summary() {
    const o=analysis.options,c=analysis.configuration,v=engine.VARIABLES[c.type].find(item=>item.key===o.variable);
    return `${v.symbol}: ${o.start}–${o.end} mm · ${analysis.rows.length} puntos · ${o.scale==='log'?'Logarítmico':'Lineal'} · f fija = ${c.frequency} ${c.frequencyUnit}${o.mode==='ratio'?` · b/a = ${o.ratio}`:` · ${v.fixedSymbol} = ${c.geometry[v.fixed]} mm fijo`}`;
  }
  function showTable() {
    $('#parametric-summary').textContent=summary();$('#parametric-table-summary').textContent=summary();
    $('#parametric-table-caption').textContent=`${analysis.successCount} calculados · ${analysis.rejectedCount} rechazados. Parámetros a seis cifras; α en dB/m a ocho. CSV con precisión completa.`;
    $('#parametric-results-table').innerHTML=analysis.rows.map(row=>{
      let values=Array(12).fill('—');
      if (row.valid) {
        const p=row.primary,s=row.secondary;
        values=[p.R,p.L,p.C,p.G,s.Z0.re,s.Z0.im,s.Z0Magnitude,s.alpha,s.alphaDb,s.beta,s.phaseVelocity,s.wavelength].map(number);
        // Dos cifras visuales adicionales permiten contrastar el ejemplo coaxial.
        values[8]=String(Number(s.alphaDb.toPrecision(8)));
      }
      const dimensions=engine.dimensionEntries(analysis.configuration.type,row.geometry).map(([symbol,value])=>`${symbol} = ${Number.isFinite(value)?number(value):escape(String(value))}`).join(' · ');
      const warning=row.warnings.length?`<details><summary>${row.warnings.length} aviso(s) del modelo</summary><ul>${row.warnings.map(w=>`<li>${escape(w.message)}</li>`).join('')}</ul></details>`:'';
      const errors=row.error?Object.values(row.error.issues || {}).join(' ') || row.error.message:'';
      return `<tr${row.valid?'':' class="rejected-row"'}><th scope="row">${number(row.valueMm)}</th><td>${dimensions}</td><td>${String(row.frequencyHz)}</td>${values.map(value=>`<td>${value}</td>`).join('')}<td class="sweep-row-state">${row.valid?'Calculado':'Rechazado'}${errors?`<br>${escape(errors)}`:''}${warning}</td></tr>`;
    }).join('');
  }
  function showWarnings() {
    const data=analysis;
    const list=data.warningSummary.map(w=>`<li><strong>${w.count} punto(s), ${number(w.minValueMm)}–${number(w.maxValueMm)} mm:</strong> ${escape(w.message)}</li>`).join('');
    $('#parametric-warnings').innerHTML=`<p><strong>${data.warningPointCount} de ${data.rows.length} puntos con avisos físicos; ${data.rejectedCount} rechazados.</strong> «Calculado» no garantiza la validez física del modelo.</p>${list?`<ul>${list}</ul>`:''}${data.rejectedCount?'<p>Consulta los errores en Tabla. Los puntos rechazados quedan vacíos; no se interpolan ni se sustituyen por cero.</p>':''}`;
    $('#parametric-warnings').hidden=!data.warningPointCount && !data.rejectedCount;
  }
  const verticalHome=()=>homeRange?{'yaxis.autorange':false,'yaxis.range':[...homeRange]}:{'yaxis.autorange':true};
  function restoreVertical(update) {
    if (update['yaxis.autorange']===true && homeRange && plotReady) Promise.resolve(globalThis.Plotly.relayout(plot,verticalHome())).catch(()=>{ $('#parametric-plot-status').textContent='No se pudo ajustar la escala vertical.'; });
  }
  function renderPlot() {
    if (!analysis || mode!=='geometry' || $('#chart-view').hidden) return;
    if (!analysis.successCount) { placeholder('No hay puntos válidos para graficar. Consulta los errores en Tabla.');return; }
    if (!globalThis.Plotly) { placeholder(plotlyFailed?'No se pudo cargar Plotly local. La tabla y el CSV siguen disponibles. Comprueba la carpeta vendor.':'Cargando la biblioteca de gráficas. La tabla y el CSV están disponibles.');return; }
    const current=++revision;plotReady=false;$('#parametric-reset-zoom').disabled=true;$('#parametric-download-png').disabled=true;
    $('#parametric-placeholder').hidden=true;plot.hidden=false;$('#parametric-plot-status').textContent='';
    try {
      const spec=charts.buildPlot(analysis,$('#parametric-magnitude').value,$('#parametric-axis').value,document.documentElement?.getAttribute('data-theme') || 'light');
      homeRange=spec.presentation.range?[...spec.presentation.range]:null;
      Promise.resolve(globalThis.Plotly.react(plot,spec.data,spec.layout,spec.config)).then(()=>{
        if (current!==revision) return;
        plot.removeListener?.('plotly_relayout',restoreVertical);plot.on?.('plotly_relayout',restoreVertical);
        plotReady=true;$('#parametric-reset-zoom').disabled=false;$('#parametric-download-png').disabled=false;
      }).catch(()=>{ if (current===revision) placeholder('No se pudo dibujar la gráfica. Los resultados siguen disponibles en Tabla y CSV.'); });
    } catch(error) { placeholder(error.message); }
  }
  $('#parametric-magnitude').innerHTML=engine.MAGNITUDES.map(m=>`<option value="${m.key}">${m.label} [${m.unit}]</option>`).join('');
  $('#parametric-magnitude').value='alphaDb';
  form.addEventListener('submit',event=>{
    event.preventDefault();clearErrors();invalidate('Generando análisis geométrico…');$('#generate-parametric').disabled=true;
    try {
      analysis=engine.runParametric(ui.readConfiguration(),readOptions());
      $('#parametric-axis').value=analysis.options.scale;showTable();showWarnings();
      ui.activateTab('chart-tab');setMode('geometry');
      $('#parametric-export-csv').disabled=false;$('#parametric-table-csv').disabled=false;
      status(`${analysis.successCount} de ${analysis.rows.length} calculados · ${analysis.rejectedCount} rechazados · ${analysis.warningPointCount} con avisos.`,analysis.rejectedCount || analysis.warningPointCount?'warning':'success');
    } catch(error) {
      if (error.issues) {
        for (const [key,message] of Object.entries(error.issues)) {
          const id=key==='frequencyUnit'?'frequency-unit':key,node=$('#'+id),errorNode=$('#'+(key==='frequencyUnit'?'frequency':key)+'-error');
          node?.setAttribute('aria-invalid','true');if (errorNode) errorNode.textContent=message;
        }
        const first=[...fields.map(key=>$(`#parametric-${key}`)),...document.querySelectorAll('#configuration-form input')].find(node=>node.getAttribute('aria-invalid')==='true');first?.focus();
      }
      status(error.issues?'Revisa los campos señalados en el análisis o la configuración principal.':error.message,'invalid');
    } finally { $('#generate-parametric').disabled=false; }
  });
  for (const type of ['input','change']) {
    form.addEventListener(type,event=>{
      if (event.target.id==='parametric-variable') { $('#parametric-mode').value='fixed';defaultRange(); }
      clearErrors();refreshConditions();invalidate();
    });
    $('#configuration-form').addEventListener(type,()=>{ clearErrors();refreshConditions();invalidate(); });
  }
  document.querySelectorAll('.line-option').forEach(button=>button.addEventListener('click',()=>{ clearErrors();refreshVariables(true);invalidate(); }));
  $('#configuration-form').addEventListener('reset',()=>setTimeout(()=>{
    form.reset();refreshVariables(true);$('#parametric-magnitude').value='alphaDb';$('#parametric-axis').value='linear';clearErrors();invalidate('Se ha restablecido el análisis geométrico.');setMode('frequency');
  },0));
  $('#analysis-mode-frequency').addEventListener('click',()=>setMode('frequency'));
  $('#analysis-mode-geometry').addEventListener('click',()=>setMode('geometry'));
  $('#sweep-form').addEventListener('submit',()=>setMode('frequency'));
  document.querySelectorAll('[role="tab"]').forEach(tab=>{
    tab.addEventListener('click',()=>{ updateModeBar();renderPlot(); });
    tab.addEventListener('keydown',()=>setTimeout(()=>{ updateModeBar();renderPlot(); },0));
  });
  for (const id of ['parametric-magnitude','parametric-axis']) $('#'+id).addEventListener('change',renderPlot);
  $('#parametric-reset-zoom').addEventListener('click',async()=>{
    if (!plotReady) return;
    try { await globalThis.Plotly.relayout(plot,{'xaxis.autorange':true,...verticalHome()}); }
    catch { $('#parametric-plot-status').textContent='No se pudo restablecer el zoom.'; }
  });
  $('#parametric-download-png').addEventListener('click',async()=>{
    if (!plotReady) return;
    try { await globalThis.Plotly.downloadImage(plot,{format:'png',filename:`LINEALAB-geometria-${analysis.options.variable}-${$('#parametric-magnitude').value}`,width:1100,height:600,scale:2}); }
    catch { $('#parametric-plot-status').textContent='No se pudo descargar el PNG. Usa también la cámara de Plotly.'; }
  });
  function downloadCSV() {
    if (!analysis) return;
    const url=URL.createObjectURL(new Blob([engine.toCSV(analysis)],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');
    link.href=url;link.download=`LINEALAB-${analysis.configuration.type}-geometria.csv`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  $('#parametric-export-csv').addEventListener('click',downloadCSV);$('#parametric-table-csv').addEventListener('click',downloadCSV);
  $('#parametric-load-example').addEventListener('click',()=>{
    if (ui.readConfiguration().type!=='coaxial') return;
    $('#parametric-variable').value='innerRadius';$('#parametric-mode').value='ratio';$('#parametric-ratio').value='4';
    $('#parametric-start').value='0.4';$('#parametric-end').value='0.8';$('#parametric-points').value='11';$('#parametric-scale').value='linear';
    clearErrors();refreshConditions();invalidate('Intervalo de ejemplo cargado. Verifica cobre, PTFE y 100 MHz en la configuración principal y genera el análisis.');
  });
  globalThis.addEventListener?.('linealab:themechange',renderPlot);
  globalThis.addEventListener?.('load',()=>{ plotlyFailed=!globalThis.Plotly;renderPlot(); });
  if (document.readyState==='complete' && !globalThis.Plotly) plotlyFailed=true;
  // En CodePen y en el documento de pruebas la etiqueta de carga puede faltar.
  $('#plotly-script')?.addEventListener('load',renderPlot);
  $('#plotly-script')?.addEventListener('error',()=>{ plotlyFailed=true;renderPlot(); });
  refreshVariables(true);setMode('frequency');
})();
