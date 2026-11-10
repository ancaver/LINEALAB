'use strict';
// Integración de app.js con un DOM mínimo. No sustituye una prueba visual de navegador.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const { fixture } = require('./dom-fixture.cjs');
test('UI: calcula las tres geometrías y actualiza los diez parámetros', () => {
  const { node, options, submit } = fixture();
  for (const option of options) {
    option.fire('click'); submit();
    assert.equal((node('primary-cards').innerHTML.match(/data-primary-value=/g) || []).length, 4);
    assert.equal((node('results-table').innerHTML.match(/Pendiente de cálculo/g) || []).length, 0);
    assert.equal((node('secondary-cards').innerHTML.match(/data-secondary-value=/g) || []).length, 6);
    assert.match(node('secondary-cards').innerHTML, /∠Z₀/);
    assert.match(node('secondary-cards').innerHTML, /dB\/m/);
    assert.match(node('results-table').innerHTML, /∠Z₀/);
    assert.match(node('results-table').innerHTML, /dB\/m/);
    assert.equal(node('skin-diagnostics').hidden, false);
    assert.match(node('primary-cards').innerHTML, /× 10⁻/);
    assert.match(node('form-status').textContent, /calculados/);
  }
});
test('UI: validación, foco y eliminación de resultados anteriores', () => {
  const { node, options, submit } = fixture();
  submit(); node('separation').value = '1'; submit();
  assert.equal(node('separation').attrs['aria-invalid'], 'true');
  assert.equal(node('separation').focused, true);
  assert.equal((node('primary-cards').innerHTML.match(/Pendiente de cálculo/g) || []).length, 4);
  options[1].fire('click'); node('outerRadius').value = '0.2'; submit();
  assert.equal(node('outerRadius').attrs['aria-invalid'], 'true');
  options[2].fire('click'); node('gap').value = '-1'; submit();
  assert.equal(node('gap').attrs['aria-invalid'], 'true');
  node('gap').value = '1'; node('lossTangent').value = '-0.1'; submit();
  assert.equal(node('lossTangent').attrs['aria-invalid'], 'true');
});
test('UI: cambios de material, valores manuales y resultados sincronizados', () => {
  const { node, options, submit } = fixture();
  options[1].fire('click');
  node('dielectric').value = 'ptfe'; node('configuration-form').fire('change', { target: node('dielectric') });
  assert.equal(node('relativePermittivity').value, 2.1);
  assert.equal(node('lossTangent').value, 0.0002);
  node('relativePermittivity').value = '4.2'; submit();
  assert.match(node('primary-cards').innerHTML, /1.68548 × 10⁻¹⁰/);
  assert.match(node('results-table').innerHTML, /1.68548 × 10⁻¹⁰/);
  node('conductor').value = 'oro'; node('configuration-form').fire('change', { target: node('conductor') });
  assert.equal(node('conductivity').value, 4.1e7);
  assert.equal((node('results-table').innerHTML.match(/Pendiente de cálculo/g) || []).length, 10);
  assert.equal(node('model-warnings').hidden, true);
  assert.equal((node('secondary-cards').innerHTML.match(/Pendiente de cálculo/g) || []).length, 6);
});
test('UI: cero dieléctrico, advertencias físicas, pestañas y restablecimiento', () => {
  const { node, options, tabs, submit } = fixture();
  node('frequency').value = '1'; node('frequency-unit').value = 'Hz'; submit();
  assert.match(node('model-warnings').innerHTML, /δ\/a/);
  assert.match(node('primary-cards').innerHTML, /data-primary-value="G">0</);
  options[2].fire('click'); node('width').value = '5'; submit();
  assert.match(node('model-warnings').innerHTML, /w\/d &lt; 10|w\/d < 10/);
  tabs[1].fire('click'); assert.equal(node('table-view').hidden, false);
  tabs[1].fire('keydown', { key: 'Home' }); assert.equal(tabs[0].attrs['aria-selected'], 'true');
  // Simular la restauración nativa que precede al callback de reset.
  for (const [id, value] of Object.entries({ conductor: 'cobre', dielectric: 'aire', 'frequency-unit': 'MHz', frequency: '100', length: '1' })) node(id).value = value;
  node('configuration-form').fire('reset');
  assert.equal(node('relativePermittivity').value, 1.0006);
  assert.equal(node('lossTangent').value, 0);
  assert.equal((node('primary-cards').innerHTML.match(/Pendiente de cálculo/g) || []).length, 4);
  assert.equal(node('skin-diagnostics').hidden, true);
  assert.equal((node('secondary-cards').innerHTML.match(/Pendiente de cálculo/g) || []).length, 6);
  assert.match(node('form-status').textContent, /restablecido/);
});
test('Motor disponible como script clásico, sin CommonJS ni DOM', () => {
  const context = {}; vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'calculations.js'), 'utf8'), context);
  assert.equal(typeof context.LineaLabCalculations.calculatePrimary, 'function');
  vm.runInContext(fs.readFileSync(path.join(root, 'secondary.js'), 'utf8'), context);
  assert.equal(typeof context.LineaLabSecondary.calculateSecondary, 'function');
});
test('UI: representación compleja y auxiliares coaxiales coinciden en tarjetas y tabla', () => {
  const { node, options, submit } = fixture();
  options[1].fire('click');
  node('dielectric').value = 'ptfe'; node('configuration-form').fire('change', { target: node('dielectric') });
  submit();
  for (const pattern of [/57\.3586/, /− j 0\.165158/, /9\.35266 × 10⁻³/, /\+ j 3\.03718/, /57\.3588 Ω/, /[-−]0\.164976°/, /0\.0812372 dB\/m/, /2\.06876 × 10⁸/, /2\.06876/]) {
    assert.match(node('secondary-cards').innerHTML, pattern);
    assert.match(node('results-table').innerHTML, pattern);
  }
  assert.match(node('secondary-cards').innerHTML, /Np\/m/);
  assert.match(node('secondary-cards').innerHTML, /rad\/m/);
  assert.match(node('secondary-cards').innerHTML, /m\/s/);
});
test('UI: toda entrada numérica o selección invalida los diez resultados', () => {
  const { node, submit } = fixture();
  for (const id of ['frequency', 'frequency-unit', 'length', 'conductivity', 'relativePermittivity', 'lossTangent', 'radius', 'separation', 'conductor', 'dielectric']) {
    submit();
    assert.equal((node('secondary-cards').innerHTML.match(/data-secondary-value=/g) || []).length, 6);
    const type = ['frequency-unit', 'conductor', 'dielectric'].includes(id) ? 'change' : 'input';
    node('configuration-form').fire(type, { target: node(id) });
    assert.equal((node('primary-cards').innerHTML.match(/Pendiente de cálculo/g) || []).length, 4);
    assert.equal((node('secondary-cards').innerHTML.match(/Pendiente de cálculo/g) || []).length, 6);
    assert.equal((node('results-table').innerHTML.match(/Pendiente de cálculo/g) || []).length, 10);
  }
});
