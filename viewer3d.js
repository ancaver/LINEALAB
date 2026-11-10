/* Visor 3D del modelo geométrico (three.js r147 local). Sólo dibuja las entradas:
 * no interviene en ningún cálculo. Si falta three.js o WebGL, la app conserva la
 * ilustración plana y la sección acotada en SVG. */
(() => {
'use strict';
const $ = selector => document.querySelector(selector);
const ui = globalThis.LineaLabUI;
const METALS = {
  cobre: { color: 0xc9652b, roughness: 0.34 }, aluminio: { color: 0xc4cad1, roughness: 0.38 },
  plata: { color: 0xe9ebed, roughness: 0.22 }, oro: { color: 0xd9a02a, roughness: 0.28 }
};
const DIELECTRICS = {
  aire: { name: 'Aire', color: 0x9fd0ff, opacity: 0.1 }, vacio: { name: 'Vacío', color: 0xb9c7ff, opacity: 0.05 },
  ptfe: { name: 'PTFE', color: 0xf4f5f2, opacity: 1 }, polietileno: { name: 'Polietileno', color: 0xe9e3cf, opacity: 0.9 }
};
const mm = value => `${Number(value.toPrecision(4))} mm`;
let state = null;

/* ---------- Escena ---------- */
const stage = $('#viewer-stage'), canvas = $('#viewer-canvas');
let renderer = null, scene, camera, controls, model = null, anchors = [], extent = 2, radial = 1, shadowPlane, dimensionMaterial;
let viewAnimation = null, dirty = true, running = false, expanded = false;
const reducedMotion = globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
function initScene() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.LinearToneMapping; renderer.toneMappingExposure = 0.82;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
  camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(4, 9, 6); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.5, far: 30 }); key.shadow.radius = 6; key.shadow.bias = -0.0005;
  scene.add(key, new THREE.AmbientLight(0xffffff, 0.25));
  shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.14 }));
  shadowPlane.rotation.x = -Math.PI / 2; shadowPlane.receiveShadow = true; scene.add(shadowPlane);
  dimensionMaterial = new THREE.LineBasicMaterial({ color: 0x1f63e0, depthTest: false, transparent: true });
  controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enablePan = false; controls.enableZoom = false;
  controls.autoRotateSpeed = 1.2; controls.maxPolarAngle = Math.PI * 0.62;
  controls.addEventListener('start', () => { viewAnimation = null; markView(null); });
  controls.addEventListener('change', () => { dirty = true; });
}

/* Trenzado de la malla: textura procedural, sin imágenes externas. */
function braidTexture() {
  const size = 128, c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#2e2e2e'; g.fillRect(0, 0, size, size);
  const strand = (x1, y1, x2, y2, shade) => { g.strokeStyle = shade; g.lineWidth = 9; g.lineCap = 'butt'; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.strokeStyle = '#00000055'; g.lineWidth = 1; g.stroke(); };
  for (let i = -size; i <= size * 2; i += 32) {
    strand(i, 0, i + size, size, '#f2f2f2'); strand(i + 16, 0, i + 16 - size, size, '#9a9a9a');
  }
  // Cruces alternos para sugerir el tejido por encima y por debajo.
  for (let y = 0; y < size; y += 32) for (let x = 0; x < size; x += 32) { g.fillStyle = '#f2f2f2'; g.save(); g.translate(x + 24, y + 24); g.rotate(Math.PI / 4); g.fillRect(-6, -4.5, 12, 9); g.restore(); }
  const texture = new THREE.CanvasTexture(c);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.encoding = THREE.sRGBEncoding; texture.anisotropy = 8;
  return texture;
}
function materials() {
  const metal = METALS[state.conductor], dielectric = DIELECTRICS[state.dielectric];
  const solid = dielectric.opacity >= 1;
  return {
    metal: new THREE.MeshStandardMaterial({ color: metal.color, metalness: 1, roughness: metal.roughness }),
    metalFace: new THREE.MeshStandardMaterial({ color: metal.color, metalness: 0.9, roughness: 0.5 }),
    dielectric: new THREE.MeshPhysicalMaterial({ color: dielectric.color, roughness: 0.42, clearcoat: 0.25, transparent: !solid, opacity: dielectric.opacity, depthWrite: solid }),
    jacket: new THREE.MeshStandardMaterial({ color: 0x0c0e11, roughness: 0.6, metalness: 0, envMapIntensity: 0.15 }),
    jacketFace: new THREE.MeshStandardMaterial({ color: 0x1b1f25, roughness: 0.85, envMapIntensity: 0.4 })
  };
}
// Cilindro macizo sobre el eje X entre x0 y x1.
function rod(radius, x0, x1, side, cap) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, x1 - x0, 96, 1, false), cap ? [side, cap, cap] : side);
  mesh.rotation.z = -Math.PI / 2; mesh.position.x = (x0 + x1) / 2; mesh.castShadow = true;
  return mesh;
}
function line(points) {
  const object = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(...p))), dimensionMaterial);
  object.renderOrder = 10; object.userData.dimension = true;
  return object;
}
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

function buildCoaxial(group, g, m, names) {
  const ratio = g.innerRadius / g.outerRadius, shown = clamp(ratio, 0.035, 0.97);
  const b = 1, a = shown, shield = b + 0.1, jacket = shield + 0.17;
  const x = { start: -5.2, jacket: -0.6, shield: 0.6, dielectric: 1.7, core: 2.9 };
  const braid = braidTexture(), cell = 2 * Math.PI * shield / 14;
  braid.repeat.set(14, (x.shield - x.start) / cell);
  const metal = METALS[state.conductor];
  const braidMaterial = new THREE.MeshStandardMaterial({ color: metal.color, map: braid, bumpMap: braid, bumpScale: 0.035, metalness: 0.9, roughness: 0.4 });
  group.add(rod(a, x.start - 0.004, x.core, m.metal, m.metalFace), rod(b, x.start - 0.003, x.dielectric, m.dielectric), rod(shield, x.start - 0.002, x.shield, braidMaterial, m.metalFace), rod(jacket, x.start, x.jacket, m.jacket, m.jacketFace));
  group.add(line([[x.dielectric + 0.004, 0, 0], [x.dielectric + 0.004, b, 0]]), line([[x.core + 0.004, 0, 0], [x.core + 0.004, a, 0]]));
  anchors = [
    { at: [x.jacket - 1.6, jacket * 0.72, jacket * 0.7], band: 'top', title: 'Cubierta', text: 'ilustrativa', optional: true },
    { at: [(x.jacket + x.shield) / 2, shield * 0.72, shield * 0.7], band: 'top', title: 'Conductor exterior', text: `b = ${mm(g.outerRadius)}` },
    { at: [(x.shield + x.dielectric) / 2, b * 0.72, b * 0.7], band: 'top', title: 'Dieléctrico', text: `${names.dielectric} · εr = ${names.permittivity}` },
    { at: [x.core - 0.25, -a * 0.7, a * 0.72], band: 'bottom', title: 'Conductor interior', text: `a = ${mm(g.innerRadius)}` }
  ];
  return { exact: shown === ratio, radius: jacket, center: (x.start + x.core) / 2, half: (x.core - x.start) / 2 };
}
function buildBifilar(group, g, m, names) {
  const k = 2.3 / (g.separation + 2 * g.radius), ideal = g.radius * k, a = clamp(ideal, 0.04, 1.1), half = g.separation * k / 2;
  const x = { start: -4.6, medium: 0.9, wire: 2.7 };
  for (const z of [-half, half]) { const wire = rod(a, x.start - 0.004, x.wire, m.metal, m.metalFace); wire.position.z = z; group.add(wire); }
  const height = 2 * a + 0.5, width = 2 * half + 2 * a + 0.5;
  // Translúcido: deja ver los conductores embebidos en el medio.
  Object.assign(m.dielectric, { transparent: true, opacity: Math.min(m.dielectric.opacity, 0.5), depthWrite: false });
  const medium = new THREE.Mesh(new THREE.BoxGeometry(x.medium - x.start, height, width), m.dielectric);
  medium.position.x = (x.start + x.medium) / 2; medium.renderOrder = 2; group.add(medium);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(medium.geometry), new THREE.LineBasicMaterial({ color: 0x8aa0b8, transparent: true, opacity: 0.6 }));
  edges.position.copy(medium.position); group.add(edges);
  const end = x.wire + 0.004;
  group.add(line([[end, 0, -half], [end, 0, half]]), line([[end, 0, half], [end, a, half]]));
  anchors = [
    { at: [(x.start + x.medium) / 2, height / 2, 0], band: 'top', title: 'Dieléctrico', text: `${names.dielectric} · εr = ${names.permittivity}` },
    { at: [end, 0, 0], band: 'top', title: 'Distancia entre centros', text: `D = ${mm(g.separation)}` },
    { at: [end, a * 0.5, half], band: 'bottom', title: 'Conductor', text: `a = ${mm(g.radius)}` }
  ];
  return { exact: a === ideal, radius: Math.max(height / 2, 0.6), center: (x.start + x.wire) / 2, half: (x.wire - x.start) / 2, depth: width / 2 };
}
function buildPlacas(group, g, m, names) {
  const w = 2.6, ideal = g.gap / g.width * w, d = clamp(ideal, 0.035, 2.4), thickness = 0.055;
  const x = { start: -4.2, medium: 1.1, plate: 2.6 };
  for (const sign of [-1, 1]) {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(x.plate - x.start, thickness, w), m.metal);
    plate.position.set((x.start + x.plate) / 2, sign * (d / 2 + thickness / 2), 0); plate.castShadow = true; group.add(plate);
  }
  const medium = new THREE.Mesh(new THREE.BoxGeometry(x.medium - x.start, d, w), m.dielectric);
  medium.position.x = (x.start + x.medium) / 2; group.add(medium);
  const end = x.plate + 0.004, top = d / 2 + thickness;
  group.add(line([[end, top, -w / 2], [end, top, w / 2]]), line([[end, -d / 2, w / 2], [end, d / 2, w / 2]]));
  anchors = [
    { at: [(x.start + x.medium) / 2 + 1, d / 2, w / 2], band: 'bottom', title: 'Dieléctrico', text: `${names.dielectric} · εr = ${names.permittivity}` },
    { at: [end, top, 0], band: 'top', title: 'Ancho de las placas', text: `w = ${mm(g.width)}` },
    { at: [end, 0, w / 2], band: 'bottom', title: 'Separación', text: `d = ${mm(g.gap)}` }
  ];
  return { exact: d === ideal, radius: Math.max(top, 0.5), center: (x.start + x.plate) / 2, half: (x.plate - x.start) / 2, depth: w / 2 };
}
function dispose(object) {
  object.traverse(node => {
    node.geometry?.dispose();
    for (const material of [].concat(node.material || [])) { if (material === dimensionMaterial) continue; material.map?.dispose(); material.dispose(); }
  });
}
function rebuild() {
  if (!renderer) return;
  if (model) { scene.remove(model); dispose(model); }
  model = new THREE.Group();
  const names = { dielectric: DIELECTRICS[state.dielectric].name, permittivity: Number.isFinite(state.relativePermittivity) ? String(Number(state.relativePermittivity.toPrecision(6))) : '—' };
  const build = { coaxial: buildCoaxial, bifilar: buildBifilar, placas: buildPlacas }[state.type];
  const info = build(model, state.geometry, materials(), names);
  model.position.x = -info.center;
  scene.add(model);
  shadowPlane.position.y = -info.radius - 0.35;
  const previous = extent;
  extent = Math.hypot(info.half, info.radius, info.depth || info.radius);
  radial = Math.max(info.radius, info.depth || 0);
  renderCallouts(); dirty = true;
  if (Math.abs(previous - extent) > 0.4 || !camera.userData.placed) setView(currentView || 'iso', true);
  $('#viewer-scale-note').textContent = info.exact
    ? 'Dimensiones eléctricas a escala. Cubierta, espesores y extensión del dieléctrico son ilustrativos.'
    : 'Proporción ajustada para que el modelo sea legible: con estas dimensiones un elemento quedaría demasiado pequeño para verse.';
}

/* ---------- Cámara ---------- */
let currentView = 'iso';
function markView(name) {
  currentView = name || currentView;
  document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === name)));
}
function fitDistance() {
  const vertical = THREE.MathUtils.degToRad(camera.fov) / 2, horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
  // La sección frontal encuadra sólo el radio; las demás vistas, el tramo completo.
  return (currentView === 'front' ? radial * 1.5 : extent * 0.74) / Math.sin(Math.min(vertical, horizontal));
}
function setView(name, instant = false) {
  markView(name);
  // Campo de visión muy estrecho en la sección: casi ortográfica, sin que las capas cercanas tapen a las lejanas.
  const fov = name === 'front' ? 5 : 30, lensChanged = camera.fov !== fov;
  camera.fov = fov; camera.updateProjectionMatrix();
  const direction = { iso: [0.52, 0.3, 0.8], front: [1, 0.02, 0.001], side: [0.001, 0.12, 1] }[name];
  const target = new THREE.Vector3(...direction).normalize().multiplyScalar(fitDistance());
  camera.userData.placed = true;
  if (instant || reducedMotion || lensChanged) { camera.position.copy(target); viewAnimation = null; }
  else viewAnimation = { from: camera.position.clone(), to: target, start: performance.now() };
  controls.target.set(0, 0, 0); dirty = true;
}
function zoom(factor) {
  viewAnimation = null; dirty = true;
  const fit = fitDistance(), distance = clamp(camera.position.length() * factor, fit * 0.45, fit * 2.2);
  camera.position.setLength(distance);
}

/* ---------- Etiquetas proyectadas ---------- */
let calloutNodes = [];
function renderCallouts() {
  $('#viewer-callouts').innerHTML = anchors.map(item => `<div class="callout${item.optional ? ' optional' : ''}"><b>${item.title}</b><span>${item.text}</span></div>`).join('');
  calloutNodes = [...$('#viewer-callouts').children];
  $('#viewer-leaders').innerHTML = anchors.map(() => '<line/><circle r="3"/>').join('');
}
const projected = new THREE.Vector3();
function placeCallouts() {
  // Las cotas sólo caben con el visor ampliado; en compacto las lleva la sección 2D.
  const visible = expanded && $('#viewer-labels').checked, width = stage.clientWidth, height = stage.clientHeight;
  $('#viewer-callouts').hidden = !visible; $('#viewer-leaders').style.display = visible ? '' : 'none';
  dimensionMaterial.opacity = visible ? 1 : 0;
  if (!visible || !model) return;
  const items = anchors.map((item, index) => {
    projected.set(...item.at).applyMatrix4(model.matrixWorld).project(camera);
    const node = calloutNodes[index];
    return { item, node, index, x: (projected.x + 1) / 2 * width, y: (1 - projected.y) / 2 * height, w: node.offsetWidth, h: node.offsetHeight, shown: node.offsetWidth > 0 };
  });
  const lines = $('#viewer-leaders').children;
  for (const band of ['top', 'bottom']) {
    const row = items.filter(entry => entry.item.band === band && entry.shown).sort((p, q) => p.x - q.x);
    let cursor = 10;
    for (const entry of row) { entry.left = Math.max(cursor, entry.x - entry.w / 2); cursor = entry.left + entry.w + 8; }
    let limit = width - 10;
    for (const entry of [...row].reverse()) { entry.left = Math.max(10, Math.min(entry.left, limit - entry.w)); limit = entry.left - 8; }
    for (const entry of row) {
      entry.top = band === 'top' ? 12 : height - entry.h - 12;
      entry.node.style.transform = `translate(${Math.round(entry.left)}px,${Math.round(entry.top)}px)`;
    }
  }
  for (const entry of items) {
    const lineNode = lines[entry.index * 2], dot = lines[entry.index * 2 + 1];
    lineNode.style.display = dot.style.display = entry.shown ? '' : 'none';
    if (!entry.shown) continue;
    const edge = entry.item.band === 'top' ? entry.top + entry.h : entry.top;
    lineNode.setAttribute('x1', entry.left + entry.w / 2); lineNode.setAttribute('y1', edge);
    lineNode.setAttribute('x2', entry.x); lineNode.setAttribute('y2', entry.y);
    dot.setAttribute('cx', entry.x); dot.setAttribute('cy', entry.y);
  }
}

/* ---------- Ciclo de dibujo ---------- */
function resize() {
  const width = stage.clientWidth, height = stage.clientHeight;
  if (!width || !height) return;
  renderer.setSize(width, height, false);
  camera.aspect = width / height; camera.updateProjectionMatrix(); dirty = true;
}
function frame(now) {
  requestAnimationFrame(frame);
  if (document.hidden || stage.hidden) return;
  if (viewAnimation) {
    const t = Math.min(1, (now - viewAnimation.start) / 550), eased = t * t * (3 - 2 * t);
    // Interpolación sobre la esfera para que el modelo no se acerque a mitad del giro.
    const length = viewAnimation.from.length() + (viewAnimation.to.length() - viewAnimation.from.length()) * eased;
    camera.position.copy(viewAnimation.from).lerp(viewAnimation.to, eased).setLength(length);
    if (t === 1) viewAnimation = null;
    dirty = true;
  }
  controls.autoRotate = $('#viewer-rotate').checked && !viewAnimation;
  controls.update();
  // Sólo se dibuja cuando algo cambió: cámara, modelo, tamaño, tema o etiquetas.
  if (!dirty) return;
  dirty = false;
  renderer.render(scene, camera);
  placeCallouts();
}
function themeColors() {
  if (!renderer) return;
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  dimensionMaterial.color.set(accent);
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  shadowPlane.material.opacity = dark ? 0.4 : 0.14; dirty = true;
}

/* ---------- Integración con la app ---------- */
function update(next) {
  state = next;
  if (!renderer || !state) return;
  if (state.valid) rebuild();
  canvas.style.visibility = $('#viewer-callouts').style.visibility = $('#viewer-leaders').style.visibility = state.valid ? '' : 'hidden';
  $('#viewer-note').hidden = state.valid;
  if (!state.valid) $('#viewer-scale-note').textContent = 'Corrige las dimensiones para ver el modelo.';
  dirty = true;
}
function start() {
  if (running || !stage || !globalThis.THREE || !THREE.OrbitControls || !THREE.RoomEnvironment) return false;
  try { initScene(); } catch { renderer = null; return false; } // Sin WebGL: se mantiene la ilustración plana.
  running = true;
  stage.hidden = false;
  $('#line-illustration').hidden = true;
  resize();
  new ResizeObserver(() => { resize(); if (!viewAnimation) camera.position.setLength(clamp(camera.position.length(), fitDistance() * 0.45, fitDistance() * 2.2)); }).observe(stage);
  new MutationObserver(themeColors).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
  document.querySelectorAll('.line-option').forEach(button => button.addEventListener('click', () => setView('iso')));
  $('#viewer-expand').addEventListener('click', () => {
    expanded = !expanded;
    $('#model-hero').classList.toggle('expanded', expanded);
    $('#viewer-expand').setAttribute('aria-pressed', String(expanded));
    $('#viewer-expand').textContent = expanded ? 'Reducir visor' : 'Ampliar visor';
    $('#viewer-bar').hidden = $('#viewer-scale-note').hidden = !expanded;
    resize(); setView(currentView || 'iso', true);
  });
  $('#viewer-zoom-in').addEventListener('click', () => zoom(0.85));
  $('#viewer-zoom-out').addEventListener('click', () => zoom(1.18));
  $('#viewer-labels').addEventListener('change', () => { dirty = true; });
  $('#viewer-rotate').addEventListener('change', () => { dirty = true; });
  canvas.addEventListener('webglcontextrestored', () => { dirty = true; });
  themeColors(); update(ui.modelState());
  requestAnimationFrame(frame);
  return true;
}
globalThis.LineaLabViewer3D = Object.freeze({ update, start, isRunning: () => running });
// three.js se carga en diferido: se arranca cuando el documento termina de cargarlo.
if (!start()) globalThis.addEventListener('load', start);
})();
