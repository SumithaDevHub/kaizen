const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers.cjs');

test('Native drag scrolling handles both board edges and lane edges', () => {
  const { scrollDragEdge } = load('lib/drag-scroll.ts', {});
  const scrolls = [];
  const element = {
    clientWidth: 300, scrollWidth: 1200, clientHeight: 400, scrollHeight: 1600,
    getBoundingClientRect: () => ({ left: 10, right: 310, top: 20, bottom: 420 }),
    scrollBy: value => scrolls.push(value),
  };
  scrollDragEdge(element, { clientX: 300, clientY: 200 }, 'horizontal');
  scrollDragEdge(element, { clientX: 15, clientY: 200 }, 'horizontal');
  scrollDragEdge(element, { clientX: 150, clientY: 410 }, 'vertical');
  scrollDragEdge(element, { clientX: 150, clientY: 25 }, 'vertical');
  assert.deepEqual(scrolls.map(value => [value.left, value.top]), [[24,0],[-24,0],[0,24],[0,-24]]);
  scrollDragEdge(element, { clientX: 150, clientY: 200 }, 'horizontal');
  element.scrollWidth = 300;
  scrollDragEdge(element, { clientX: 300, clientY: 200 }, 'horizontal');
  assert.equal(scrolls.length, 4, 'Do not scroll centered drags or a board that already fits');
});

test('Overlay contains keyboard focus, supports Escape, and restores background scrolling', () => {
  let setup, closed = 0;
  const listeners = {};
  const docked = { matches: false, addEventListener: (_, callback) => { docked.changed = callback; }, removeEventListener() {} };
  const mobile = { matches: true, addEventListener() {}, removeEventListener() {} };
  const short = { matches: false, addEventListener() {}, removeEventListener() {} };
  const doc = {
    body: { style: { overflow: 'auto' } }, activeElement: null,
    addEventListener: (event, callback) => { listeners[event] = callback; },
    removeEventListener: event => { delete listeners[event]; },
  };
  const items = [0,1,2].map(() => ({ tabIndex: 0, hasAttribute: () => false, getClientRects: () => [{}], focus() { doc.activeElement = this; } }));
  const region = { querySelectorAll: () => items, contains: item => items.includes(item) };
  doc.querySelector = () => region;
  const { useWorkspaceOverlay } = load('components/useWorkspaceOverlay.ts', {
    react: { useEffect: callback => { setup = callback; } },
  }, { document: doc, window: { matchMedia: query => query.includes('min-width') ? docked : query.includes('height') ? short : mobile } });
  useWorkspaceOverlay(true, false, () => closed++);
  const cleanup = setup();
  assert.equal(doc.body.style.overflow, 'hidden');
  let prevented = 0;
  doc.activeElement = items[2];
  listeners.keydown({ key: 'Tab', shiftKey: false, preventDefault: () => prevented++ });
  assert.equal(doc.activeElement, items[0]);
  listeners.keydown({ key: 'Tab', shiftKey: true, preventDefault: () => prevented++ });
  assert.equal(doc.activeElement, items[2]);
  listeners.keydown({ key: 'Escape', preventDefault: () => prevented++ });
  assert.equal(closed, 1); assert.equal(prevented, 3);
  docked.matches = true; docked.changed();
  assert.equal(doc.body.style.overflow, 'auto', 'A docked desktop editor must not lock workspace scrolling');
  cleanup();
  assert.equal(doc.body.style.overflow, 'auto');
  assert.equal(Object.keys(listeners).length, 0);
  useWorkspaceOverlay(false, true, () => closed++);
  const menuCleanup = setup();
  assert.equal(doc.body.style.overflow, 'hidden', 'An open mobile sidebar locks background scrolling');
  menuCleanup();
});
