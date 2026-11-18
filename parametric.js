/* LINEALAB v1.1 — Barridos geométricos puros, sin ecuaciones eléctricas propias.
 * Dimensiones de entrada/muestreo en mm. Los motores existentes convierten a SI.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./calculations.js'), require('./secondary.js'), require('./sweep.js'));
  else root.LineaLabParametric = factory(root.LineaLabCalculations, root.LineaLabSecondary, root.LineaLabSweep);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (primaryEngine, secondaryEngine, sweep) {
  'use strict';
  const VARIABLES = Object.freeze({
    bifilar: Object.freeze([
      Object.freeze({ key:'radius', symbol:'a', label:'Radio del conductor a', fixed:'separation', fixedSymbol:'D' }),
      Object.freeze({ key:'separation', symbol:'D', label:'Separación entre centros D', fixed:'radius', fixedSymbol:'a' })
    ]),
    coaxial: Object.freeze([
      Object.freeze({ key:'innerRadius', symbol:'a', label:'Radio interior a', fixed:'outerRadius', fixedSymbol:'b' }),
      Object.freeze({ key:'outerRadius', symbol:'b', label:'Radio interno exterior b', fixed:'innerRadius', fixedSymbol:'a' })
    ]),
    placas: Object.freeze([
      Object.freeze({ key:'width', symbol:'w', label:'Ancho de las placas w', fixed:'gap', fixedSymbol:'d' }),
      Object.freeze({ key:'gap', symbol:'d', label:'Separación entre placas d', fixed:'width', fixedSymbol:'w' })
    ])
  });
  class ParametricValidationError extends Error {
    constructor(issues) { super('Revisa la configuración del análisis geométrico.'); this.name='ParametricValidationError'; this.issues=issues; }
  }
  function normalizeOptions(type, options) {
    const issues={};
    if (!Object.hasOwn(VARIABLES,type)) issues.type='Selecciona una geometría válida.';
    if (!VARIABLES[type]?.some(variable=>variable.key===options.variable)) issues['parametric-variable']='Selecciona una dimensión de la geometría actual.';
    const mode=options.mode ?? 'fixed';
    if (!['fixed','ratio'].includes(mode) || (mode==='ratio' && (type!=='coaxial' || options.variable!=='innerRadius'))) issues['parametric-mode']='La relación b/a constante sólo se aplica al barrido del radio interior coaxial a.';
    if (mode==='ratio' && (!Number.isFinite(options.ratio) || options.ratio<=1)) issues['parametric-ratio']='La relación k = b/a debe ser finita y mayor que 1.';
    for (const key of ['start','end']) if (!Number.isFinite(options[key]) || options[key]<=0) issues['parametric-'+key]='Introduce una dimensión finita mayor que cero, en mm.';
    if (!issues['parametric-start'] && !issues['parametric-end'] && options.end<=options.start) issues['parametric-end']='El valor final debe ser mayor que el inicial.';
    if (!Number.isInteger(options.points) || options.points<10 || options.points>500) issues['parametric-points']='Elige un número entero de puntos entre 10 y 500.';
    if (!['linear','log'].includes(options.scale)) issues['parametric-scale']='Selecciona muestreo lineal o logarítmico.';
    if (Object.keys(issues).length) throw new ParametricValidationError(issues);
    return {variable:options.variable,mode,ratio:mode==='ratio'?options.ratio:null,start:options.start,end:options.end,points:options.points,scale:options.scale,unit:'mm'};
  }
  function createValues(options) {
    // El llamador público runParametric valida las opciones antes de muestrear.
    const logStart=Math.log(options.start),logEnd=Math.log(options.end);
    const values=Array.from({length:options.points},(_,index)=>{
      if (index===0) return options.start;
      if (index===options.points-1) return options.end;
      const t=index/(options.points-1);
      return options.scale==='linear' ? options.start+(options.end-options.start)*t : Math.exp(logStart+(logEnd-logStart)*t);
    });
    if (values.some((value,index)=>!Number.isFinite(value) || value<=0 || (index>0 && value<=values[index-1]))) throw new ParametricValidationError({'parametric-end':'El intervalo no permite muestras distintas con esta precisión. Amplíalo o reduce el número de puntos.'});
    return values;
  }
  function runParametric(configuration, options) {
    const snapshot={...configuration,geometry:{...configuration.geometry}};
    const normalized=normalizeOptions(snapshot.type,options);
    const values=createValues(normalized);
    // Reutilizar la validación del motor. Una geometría inicial inválida puede
    // entrar/salir del dominio durante el barrido: se valida de nuevo por punto.
    try { primaryEngine.normalizeInput(snapshot); }
    catch(error) {
      if (!error.issues) throw error;
      const geometryKeys=VARIABLES[snapshot.type].map(variable=>variable.key);
      const shared=Object.fromEntries(Object.entries(error.issues).filter(([key])=>!geometryKeys.includes(key)));
      if (Object.keys(shared).length) throw new primaryEngine.ValidationError(shared);
    }
    const frequencyHz=snapshot.frequency*sweep.FREQUENCY_UNITS[snapshot.frequencyUnit];
    if (!Number.isFinite(frequencyHz) || frequencyHz<=0) throw new primaryEngine.ValidationError({frequency:'La frecuencia fija convertida queda fuera del rango numérico.'});
    const rows=values.map(valueMm=>{
      const geometry={...snapshot.geometry,[normalized.variable]:valueMm};
      // k es una relación adimensional; a y b conservan su unidad de entrada mm.
      if (normalized.mode==='ratio') geometry.outerRadius=normalized.ratio*valueMm;
      let primary=null;
      try {
        primary=primaryEngine.calculatePrimary({...snapshot,geometry});
        const secondary=secondaryEngine.calculateSecondary(primary);
        return {valueMm,geometry,frequencyHz,valid:true,primary,secondary,warnings:primary.warnings.map(w=>({...w})),error:null};
      } catch(error) {
        return {valueMm,geometry,frequencyHz,valid:false,primary,secondary:null,warnings:primary?primary.warnings.map(w=>({...w})):[],error:{name:error.name,message:error.message,issues:error.issues?{...error.issues}:null}};
      }
    });
    const groups=new Map();
    for (const row of rows) for (const warning of row.warnings) {
      if (!groups.has(warning.code)) groups.set(warning.code,{...warning,count:0,minValueMm:row.valueMm,maxValueMm:row.valueMm});
      const group=groups.get(warning.code);group.count+=1;group.maxValueMm=row.valueMm;
    }
    const successCount=rows.filter(row=>row.valid).length;
    return {configuration:snapshot,options:normalized,frequencyHz,rows,successCount,rejectedCount:rows.length-successCount,warningPointCount:rows.filter(row=>row.warnings.length).length,warningSummary:[...groups.values()]};
  }
  function dimensionEntries(type,geometry) { return VARIABLES[type].map(variable=>[variable.symbol,geometry[variable.key]]); }
  function csvCell(value) {
    const text=value===undefined || value===null ? '' : String(value);
    return /[",\r\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text;
  }
  const ELECTRICAL_COLUMNS=Object.freeze([
    ['R [ohm/m]',r=>r.primary.R],['L [H/m]',r=>r.primary.L],['C [F/m]',r=>r.primary.C],['G [S/m]',r=>r.primary.G],
    ['Re(Z0) [ohm]',r=>r.secondary.Z0.re],['Im(Z0) [ohm]',r=>r.secondary.Z0.im],['|Z0| [ohm]',r=>r.secondary.Z0Magnitude],
    ['alpha [Np/m]',r=>r.secondary.alpha],['alpha [dB/m]',r=>r.secondary.alphaDb],['beta [rad/m]',r=>r.secondary.beta],
    ['vp [m/s]',r=>r.secondary.phaseVelocity],['lambda [m]',r=>r.secondary.wavelength],
    ['Re(gamma) [1/m]',r=>r.secondary.gamma.re],['Im(gamma) [1/m]',r=>r.secondary.gamma.im],['arg(Z0) [deg]',r=>r.secondary.Z0PhaseDegrees],
    ['delta [m]',r=>r.primary.skinDepth],['Rs [ohm/square]',r=>r.primary.surfaceResistance]
  ]);
  function toCSV(analysis) {
    const c=analysis.configuration,o=analysis.options;
    const columns=[
      ['Variable',()=>o.variable],['Valor variable [mm]',r=>r.valueMm],
      ...VARIABLES[c.type].map(v=>[`${v.symbol} [mm]`,r=>r.geometry[v.key]]),
      ['Frecuencia fija [Hz]',r=>r.frequencyHz],['Estado',r=>r.valid?'correcto':'rechazado'],
      ...ELECTRICAL_COLUMNS.map(([name,read])=>[name,r=>r.valid?read(r):'']),
      ['Avisos del modelo',r=>r.warnings.map(w=>`${w.code}: ${w.message}`).join(' | ')],
      ['Error',r=>r.error?`${r.error.name}: ${r.error.message}${r.error.issues?' '+JSON.stringify(r.error.issues):''}`:''],
      ['Geometria',()=>c.type],['Modo',()=>o.mode],['k = b/a',()=>o.ratio],['sigma [S/m]',()=>c.conductivity],['epsilon_r',()=>c.relativePermittivity],['tan_delta',()=>c.lossTangent],['Longitud [m]',()=>c.length]
    ];
    return '\uFEFF'+[columns.map(([name])=>csvCell(name)).join(','),...analysis.rows.map(row=>columns.map(([,read])=>csvCell(read(row))).join(','))].join('\r\n')+'\r\n';
  }
  return Object.freeze({VARIABLES,ParametricValidationError,normalizeOptions,runParametric,dimensionEntries,MAGNITUDES:sweep.MAGNITUDES,getMagnitude:sweep.getMagnitude,toCSV});
});
