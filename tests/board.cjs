const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers.cjs');
const { webcrypto } = require('node:crypto');

const task = (overrides = {}) => ({ id: 'a9c151ba-97c3-428e-82d6-5327ce8a665a', title: 'Focus quest', description: 'hiddenneedle', category: 'Development', priority: 'Medium', status: 'Backlog', week: '', due: '', created: '2026-10-15T00:00:00Z', subtasks: [], ...overrides });
const text = node => node == null || typeof node === 'boolean' ? '' : typeof node !== 'object' ? String(node) : Array.isArray(node) ? node.map(text).join(' ') : text(node.props?.children);

function board(initialTasks, options = {}) {
  let cursor = 0, tree;
  const slots = [], effects = [], saved = [], moved = [], deleted = [], categoriesSaved = [], imported = [];
  const state = value => {
    const index = cursor++;
    if (!(index in slots)) slots[index] = typeof value === 'function' ? value() : value;
    return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
  };
  const jsx = (type, props) => ({ type, props });
  const { default: Page } = load('app/page.tsx', {
    react: {
      useState: state,
      useCallback: fn => { cursor++; return fn; },
      useRef: value => { const index = cursor++; return slots[index] ??= { current: value }; },
      useMemo: fn => { cursor++; return fn(); },
      useEffect: (fn, deps) => {
        const index = cursor++, previous = slots[index];
        if (!previous || deps.some((value, i) => !Object.is(value, previous[i]))) effects.push(fn);
        slots[index] = deps;
      },
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'lucide-react': new Proxy({}, { get: (_, name) => name }),
    '@/components/useWorkspaceOverlay': { useWorkspaceOverlay() {} },
    '@/lib/drag-scroll': { scrollDragEdge() {} },
    '@/components/LogoutButton': { __esModule: true, default: 'LogoutButton' },
    '@/lib/supabase/client': { createClient: () => ({ auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } }) },
    '@/lib/kaizen-data': {
      loadCloudTasks: async () => structuredClone(initialTasks), loadCloudCategories: async () => [],
      moveCloudTask: async (...args) => moved.push(args),
      saveCloudTask: async value => saved.push(structuredClone(value)),
      deleteCloudTask: async id => deleted.push(id),
      saveCloudCategory: async name => categoriesSaved.push(name),
      validateBackup: load('lib/kaizen-data.ts', { '@/lib/supabase/client': { createClient: () => ({}) } }).validateBackup,
      importCloudBackup: async value => { imported.push(structuredClone(value)); return value.tasks.length; },
    },
  }, {
    structuredClone, crypto: webcrypto, confirm: () => true,
    alert: message => { if (!message.startsWith('Imported')) assert.fail(message); },
    File: require('node:buffer').File,
    FileReader: class { readAsText(file) { file.text().then(text => { this.result = text; this.onload(); }); } },
    localStorage: options.storage,
  });
  const render = () => { cursor = 0; tree = Page(); for (const effect of effects.splice(0)) effect(); };
  const settle = async (action = () => {}) => {
    action();
    for (let i = 0; i < 4; i++) { render(); await new Promise(setImmediate); }
    render();
  };
  function find(predicate, node = tree) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const item of node) { const found = find(predicate, item); if (found) return found; } return; }
    if (predicate(node)) return node;
    return node.props?.children === undefined ? undefined : find(predicate, node.props.children);
  }
  const button = name => find(node => node.type === 'button' && text(node).trim() === name);
  const column = name => find(node => node.type === 'section' && node.props.onDrop && text(node).includes(name));
  return { settle, find, button, column, saved, moved, deleted, categoriesSaved, imported };
}

test('Moving unscheduled backlog keeps it visible and only updates status/scheduling', async () => {
  const ui = board([task()]); await ui.settle();
  await ui.settle(() => ui.column('To Do').props.onDrop({ preventDefault() {}, dataTransfer: { getData: () => task().id } }));
  assert.equal(ui.moved.length, 1);
  assert.equal(ui.moved[0][1], 'To Do');
  assert.match(ui.moved[0][2], /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(ui.saved.length, 0);
  assert.ok(ui.find(node => node.props?.className?.startsWith('task-card') && text(node).includes('Focus quest')));
});

test('Editor preserves unsaved text and the new lane after dragging', async () => {
  const ui = board([task()]); await ui.settle();
  await ui.settle(() => ui.find(node => node.props?.className?.startsWith('task-card')).props.onClick());
  await ui.settle(() => ui.find(node => node.props?.className === 'title-input').props.onChange({ target: { value: 'Edited title' } }));
  await ui.settle(() => ui.column('In Progress').props.onDrop({ preventDefault() {}, dataTransfer: { getData: () => task().id } }));
  await ui.settle(() => ui.button('Save Changes').props.onClick());
  assert.equal(ui.saved[0].title, 'Edited title');
  assert.equal(ui.saved[0].status, 'In Progress');
  assert.equal(ui.saved[0].week, ui.moved[0][2]);
});

test('Selecting an existing card replaces a new task draft', async () => {
  const ui = board([task()]); await ui.settle();
  await ui.settle(() => ui.button('New Task').props.onClick());
  assert.equal(ui.find(node => node.props?.className === 'title-input').props.value, '');
  await ui.settle(() => ui.find(node => node.props?.className?.startsWith('task-card')).props.onClick());
  assert.equal(ui.find(node => node.props?.className === 'title-input').props.value, 'Focus quest');
});

test('Description search works in All Tasks and Weekly Planner', async () => {
  const date = new Date(); date.setDate(date.getDate() - (date.getDay() + 6) % 7);
  const week = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const ui = board([task({ status: 'To Do', week })]); await ui.settle();
  await ui.settle(() => ui.find(node => node.props?.['aria-label'] === 'Search tasks').props.onChange({ target: { value: 'hiddenneedle' } }));
  for (const view of ['All Tasks', 'Weekly Planner']) {
    await ui.settle(() => ui.button(view).props.onClick());
    assert.ok(ui.find(node => node.props?.className === 'list-row' && text(node).includes('Focus quest')));
  }
});

test('New task editor creates a task with a completed subtask and supports deletion', async () => {
  const ui = board([]); await ui.settle();
  await ui.settle(() => ui.button('New Task').props.onClick());
  await ui.settle(() => ui.find(node => node.props?.className === 'title-input').props.onChange({ target: { value: 'New private task' } }));
  await ui.settle(() => ui.find(node => node.props?.placeholder === 'Add a step...').props.onChange({ target: { value: 'Small step' } }));
  await ui.settle(() => ui.find(node => node.type === 'form' && node.props.className === 'inline-form').props.onSubmit({ preventDefault() {} }));
  await ui.settle(() => ui.find(node => node.type === 'input' && node.props.type === 'checkbox').props.onChange());
  await ui.settle(() => ui.button('Create Task').props.onClick());
  assert.equal(ui.saved.length, 1);
  assert.equal(ui.saved[0].title, 'New private task');
  assert.equal(ui.saved[0].subtasks[0].text, 'Small step');
  assert.equal(ui.saved[0].subtasks[0].done, true);
  await ui.settle(() => ui.find(node => node.props?.className?.startsWith('task-card')).props.onClick());
  await ui.settle(() => ui.button('Delete').props.onClick());
  assert.equal(ui.deleted[0], ui.saved[0].id);
  assert.ok(!ui.find(node => node.props?.className?.startsWith('task-card')));
});

test('Category creation uses the existing cloud utility and updates category tiles', async () => {
  const ui = board([]); await ui.settle();
  await ui.settle(() => ui.button('Categories').props.onClick());
  await ui.settle(() => ui.find(node => node.type === 'form').props.onSubmit({ preventDefault() {}, currentTarget: { elements: { namedItem: () => ({ value: ' Deep Work ' }) } } }));
  assert.equal(ui.categoriesSaved[0], 'Deep Work');
  assert.ok(ui.find(node => node.props?.className === 'category-tile' && text(node).includes('Deep Work')));
});

test('Weekly planning normalizes a selected day to Monday', async () => {
  const ui = board([task()]); await ui.settle();
  await ui.settle(() => ui.find(node => node.props?.className?.startsWith('task-card')).props.onClick());
  const field = ui.find(node => node.type === 'label' && text(node).trim() === 'Planned week');
  await ui.settle(() => field.props.children.find(node => node.type === 'input').props.onChange({ target: { value: '2026-10-22' } }));
  await ui.settle(() => ui.button('Save Changes').props.onClick());
  assert.equal(ui.saved[0].week, '2026-10-19');
});

test('Legacy browser import is explicit and never overwrites or deletes localStorage backups', async () => {
  const values = { 'kaizen.tasks.v1': JSON.stringify([task()]), 'kaizen.categories.v1': JSON.stringify(['Work']) };
  const before = JSON.stringify(values), reads = [];
  const storage = {
    getItem: key => { reads.push(key); return values[key] ?? null; },
    setItem: () => assert.fail('Must not overwrite browser backup'),
    removeItem: () => assert.fail('Must not delete browser backup'),
    clear: () => assert.fail('Must not clear browser storage'),
  };
  const ui = board([], { storage }); await ui.settle();
  assert.equal(reads.length, 0, 'No automatic localStorage-to-cloud synchronization');
  await ui.settle(() => ui.button('Settings').props.onClick());
  const picker = ui.find(node => node.type === 'input' && node.props.type === 'file');
  assert.notEqual(picker.props.hidden, true, 'The native backup picker must remain keyboard-accessible');
  assert.equal(picker.props['aria-label'], 'Import backup JSON');
  await ui.settle(() => ui.button('Import Browser Tasks').props.onClick());
  assert.equal(ui.imported.length, 1);
  assert.equal(ui.imported[0].tasks.length, 1);
  assert.equal(JSON.stringify(values), before);
});
