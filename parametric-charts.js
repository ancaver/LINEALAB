/* Adaptador geométrico de la vista Plotly existente. Sin fórmulas eléctricas. */
(function (root,factory) {
  'use strict';
  if (typeof module==='object' && module.exports) module.exports=factory(require('./parametric.js'),require('./charts.js'));
  else root.LineaLabParametricCharts=factory(root.LineaLabParametric,root.LineaLabCharts);
})(typeof globalThis!=='undefined'?globalThis:this,function (parametric,charts) {
  'use strict';
  function buildPlot(analysis,key,scale,theme='light') {
    // Reutiliza íntegramente el formato, prefijos, ceros exactos y márgenes
    // verticales existentes. Sólo sustituye la proyección del eje horizontal.
    const spec=charts.buildPlot({...analysis,options:{...analysis.options,unit:'Hz'}},key,scale,theme);
    const variable=parametric.VARIABLES[analysis.configuration.type].find(v=>v.key===analysis.options.variable);
    const magnitude=parametric.MAGNITUDES.find(m=>m.key===key),view=spec.presentation,trace=spec.data[0];
    trace.x=analysis.rows.map(row=>row.valueMm);
    trace.customdata=analysis.rows.map((row,index)=>[
      `${row.warnings.length} aviso(s) del modelo`,
      row.valid?String(parametric.getMagnitude(row,key)):null,
      view.y[index]===null?null:String(view.y[index]),String(row.valueMm),
      parametric.dimensionEntries(analysis.configuration.type,row.geometry).map(([symbol,value])=>`${symbol} = ${String(value)} mm`).join('<br>'),
      String(row.frequencyHz)
    ]);
    trace.hovertemplate=`${variable.symbol}: %{customdata[3]} mm<br>%{customdata[4]}<br>Frecuencia fija: %{customdata[5]} Hz<br>${magnitude.label}: %{customdata[2]} ${view.unit}<br>Valor SI: %{customdata[1]} ${magnitude.unit}<br>Modelo aproximado · %{customdata[0]}<extra></extra>`;
    spec.layout.title.text=`${magnitude.label} frente a ${variable.symbol}`;
    // Separar título y barra de herramientas también en pantallas estrechas.
    spec.layout.title.y=.89;spec.layout.title.yanchor='top';spec.layout.margin.t=85;
    spec.layout.xaxis.title.text=`${variable.label} [mm]`;
    spec.layout.uirevision=`geometria:${analysis.configuration.type}:${analysis.options.variable}:${analysis.options.mode}:${key}:${scale}:${view.exponent}`;
    spec.config.toImageButtonOptions.filename=`LINEALAB-geometria-${variable.symbol}-${key}`;
    return spec;
  }
  return Object.freeze({buildPlot});
});
