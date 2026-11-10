'use strict';
/* DOM mínimo compartido para pruebas de controladores. No es un navegador. */
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const engine = require('../calculations.js'), secondaryEngine = require('../secondary.js');
const root = path.resolve(__dirname, '..');
function fixture({ analysis = false, plotly = false } = {}) {
  const nodes = new Map(), downloads = [], plots = [], urls = new Map(), revoked = [];
  function attributes(tag) { return Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(match => [match[1], match[2]])); }
  class Element {
    constructor(id = '', attrs = {}, formId = null, tag = '') {
      this.id = id; this.attrs = attrs; this.formId = formId; this.tag = tag;
      this.listeners = {}; this.value = attrs.value || ''; this.defaultValue = this.value;
      this.hidden = 'hidden' in attrs; this.disabled = 'disabled' in attrs;
      this.className = attrs.class || ''; this.dataset = {}; this.classList = { toggle() {} };
      this.html = ''; this.text = ''; nodes.set(id, this);
    }
    get valueAsNumber() { return this.value === '' ? NaN : Number(this.value); }
    set textContent(text) { this.text = text; this.html = ''; }
    get textContent() { return this.text; }
    set innerHTML(html) {
      this.html = html;
      if (this.id === 'geometry-fields') {
        for (const node of [...nodes.values()]) if (node.geometry) nodes.delete(node.id);
        for (const match of html.matchAll(/<(input|small)[^>]*id="([^"]+)"[^>]*>/g)) {
          const node = new Element(match[2], attributes(match[0]), 'configuration-form', match[1]); node.geometry = true;
        }
      }
    }
    get innerHTML() { return this.html; }
    setAttribute(key, value) { this.attrs[key] = value; }
    getAttribute(key) { return this.attrs[key]; }
    removeAttribute(key) { delete this.attrs[key]; }
    hasAttribute(key) { return key in this.attrs; }
    addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); }
    fire(type, event = {}) { for (const handler of this.listeners[type] || []) handler({ preventDefault() {}, type, target: this, ...event }); }
    focus() { this.focused = true; }
    querySelectorAll(selector) { return queryAll(selector).filter(node => !this.id.endsWith('-form') || node.formId === this.id); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    appendChild() {}
    click() { if (this.tag === 'a') downloads.push({ name: this.download, blob: urls.get(this.href) }); this.fire('click'); }
    remove() {}
    reset() {
      for (const node of nodes.values()) if (node.formId === this.id && ['input', 'select'].includes(node.tag)) node.value = node.defaultValue;
      this.fire('reset');
    }
  }
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  let currentForm = null;
  for (const match of html.matchAll(/<\/?[\w-]+[^>]*>/g)) {
    const tag = match[0], name = /^<\/?([\w-]+)/.exec(tag)[1], attrs = attributes(tag);
    if (tag.startsWith('</')) { if (name === 'form') currentForm = null; continue; }
    if (name === 'form') currentForm = attrs.id;
    if (attrs.id) {
      if (/\shidden(?:\s|>)/.test(tag)) attrs.hidden = '';
      if (/\sdisabled(?:\s|>)/.test(tag)) attrs.disabled = '';
      new Element(attrs.id, attrs, currentForm, name);
    }
  }
  for (const match of html.matchAll(/<select([^>]*)>([\s\S]*?)<\/select>/g)) {
    const id = attributes(match[1]).id, element = nodes.get(id);
    if (!element) continue;
    const options = [...match[2].matchAll(/<option([^>]*)>([^<]*)<\/option>/g)];
    const chosen = options.find(option => /\bselected\b/.test(option[1])) || options[0];
    if (chosen) element.value = element.defaultValue = attributes(chosen[1]).value || chosen[2];
  }
  const options = ['bifilar', 'coaxial', 'placas'].map(type => {
    const element = new Element('option-' + type, { class: 'line-option' }, 'configuration-form', 'button'); element.dataset.type = type; return element;
  });
  const tabs = [...nodes.values()].filter(node => node.attrs.role === 'tab');
  function queryAll(selector) {
    if (selector === '.line-option') return options;
    if (selector === '[role="tab"]') return tabs;
    if (selector === '.error') return [...nodes.values()].filter(node => node.id.endsWith('-error'));
    if (selector === '[aria-invalid]') return [...nodes.values()].filter(node => node.hasAttribute('aria-invalid'));
    if (selector === '[aria-invalid="true"]') return [...nodes.values()].filter(node => node.attrs['aria-invalid'] === 'true');
    if (selector === '#configuration-form input') return [...nodes.values()].filter(node => node.tag === 'input' && node.formId === 'configuration-form');
    return [];
  }
  const document = {
    querySelector: selector => selector.startsWith('#') ? nodes.get(selector.slice(1)) : queryAll(selector)[0],
    querySelectorAll: queryAll, getElementById: id => nodes.get(id),
    body: new Element('__body'), createElement: tag => new Element('__created-' + nodes.size, {}, null, tag)
  };
  const plotlyStub = {
    react: (...args) => { plots.push({ type: 'react', args }); return Promise.resolve(); },
    purge: (...args) => { plots.push({ type: 'purge', args }); },
    relayout: (...args) => { plots.push({ type: 'relayout', args }); return Promise.resolve(); },
    downloadImage: (...args) => { plots.push({ type: 'png', args }); return Promise.resolve(); }
  };
  const window = { LineaLabCalculations: engine, LineaLabSecondary: secondaryEngine, addEventListener() {} };
  if (plotly) window.Plotly = plotly === true ? plotlyStub : plotly;
  const context = { document, globalThis: window, setTimeout: handler => handler(), Number, RangeError, Promise, Blob,
    URL: { createObjectURL(blob) { const url = 'blob:' + urls.size; urls.set(url, blob); return url; }, revokeObjectURL: url => revoked.push(url) } };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'app.js'), 'utf8'), context);
  if (analysis) {
    window.LineaLabSweep = require('../sweep.js'); window.LineaLabCharts = require('../charts.js');
    vm.runInNewContext(fs.readFileSync(path.join(root, 'analysis.js'), 'utf8'), context);
  }
  return { node: id => nodes.get(id), options, tabs, plots, downloads, revoked, window,
    installPlotly() { window.Plotly = plotlyStub; },
    submit: () => nodes.get('configuration-form').fire('submit'),
    generate: () => nodes.get('sweep-form').fire('submit') };
}
module.exports = { fixture };
