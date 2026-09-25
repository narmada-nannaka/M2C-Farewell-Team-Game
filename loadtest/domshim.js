/* Minimal DOM shim. Just enough surface for minigames.js so the pack can be
   mounted, clicked and torn down outside a browser. Test scaffolding only. */
'use strict';

function makeStyle() {
  const s = {};
  Object.defineProperty(s, 'cssText', {
    get() { return s._css || ''; },
    set(v) { s._css = (s._css || '') + v; }
  });
  return s;
}

class Node {
  constructor(tag) {
    this.tagName = (tag || 'div').toUpperCase();
    this.children = [];
    this.parent = null;
    this._text = '';
    this.style = makeStyle();
    this.dataset = {};
    this.attrs = {};
    this._cls = new Set();
    this.listeners = {};
    this.onclick = null;
    this.type = '';
    this.value = '50';
    this.min = '0'; this.max = '100';
    this.width = 300; this.height = 260;
  }
  get className() { return [...this._cls].join(' '); }
  set className(v) { this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get classList() {
    const c = this._cls;
    return {
      add: (...n) => n.forEach(x => c.add(x)),
      remove: (...n) => n.forEach(x => c.delete(x)),
      toggle: (n, f) => (f === undefined ? (c.has(n) ? c.delete(n) : c.add(n)) : (f ? c.add(n) : c.delete(n))),
      contains: n => c.has(n)
    };
  }
  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v == null ? '' : v); this.children = []; }
  set innerHTML(v) { this.children = []; this._html = v; }
  get innerHTML() { return this._html || ''; }
  get isConnected() { let n = this; while (n.parent) n = n.parent; return n._root === true; }
  get clientWidth() { return 340; }
  get clientHeight() { return 260; }
  appendChild(c) { c.parent = this; this.children.push(c); return c; }
  append(...cs) { cs.forEach(c => this.appendChild(c)); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(x => x !== this); this.parent = null; }
  setAttribute(k, v) { this.attrs[k] = v; }
  addEventListener(k, fn) { (this.listeners[k] = this.listeners[k] || []).push(fn); }
  getBoundingClientRect() { return { left: 0, top: 0, width: 340, height: 260 }; }
  setPointerCapture() {}
  getContext() { return ctx2d(); }
  fire(ev, payload) { (this.listeners[ev] || []).forEach(fn => fn(payload || {})); }
  all(out = []) { out.push(this); this.children.forEach(c => c.all(out)); return out; }
}

function ctx2d() {
  const noop = () => {};
  return {
    canvas: null,
    scale: noop, setTransform: noop, clearRect: noop, fillRect: noop, beginPath: noop,
    moveTo: noop, lineTo: noop, arc: noop, closePath: noop, fill: noop, stroke: noop,
    save: noop, restore: noop, translate: noop, rotate: noop, rect: noop, roundRect: noop,
    fillText: noop, strokeText: noop,
    measureText: () => ({ width: 40 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    set fillStyle(v) {}, get fillStyle() { return '#000'; },
    set strokeStyle(v) {}, get strokeStyle() { return '#000'; },
    set lineWidth(v) {}, set lineCap(v) {}, set font(v) {}, set textAlign(v) {},
    set textBaseline(v) {}, set shadowColor(v) {}, set shadowBlur(v) {}, set globalAlpha(v) {}
  };
}

const root = new Node('body');
root._root = true;

const document = {
  createElement: t => new Node(t),
  body: root
};

const win = {
  document,
  devicePixelRatio: 1,
  requestAnimationFrame: fn => setTimeout(() => fn(Date.now()), 16),
  cancelAnimationFrame: id => clearTimeout(id),
  performance: { now: () => Date.now() }
};

global.window = win;
global.document = document;
global.requestAnimationFrame = win.requestAnimationFrame;
global.cancelAnimationFrame = win.cancelAnimationFrame;
global.performance = win.performance;
global.devicePixelRatio = 1;

module.exports = { Node, document, win, root };
