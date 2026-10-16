const { test } = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const { load } = require('./helpers.cjs');

// Stateful PostgREST substitute: these tests exercise real data utilities,
// owner filters, retries and failures, not the deployed database's RLS rules.
function database() {
  const db = { categories: [], tasks: [], subtasks: [], calls: [], cascade: true, fail: () => false };
  db.client = userId => ({
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null }, error: null }) },
    from(table) {
      let operation = 'select', payload, options = {}, single = false, from = 0, to = Infinity;
      const filters = [];
      const query = {
        select() { return query; },
        eq(key, value) { filters.push(row => row[key] === value); return query; },
        in(key, values) { filters.push(row => values.includes(row[key])); return query; },
        order() { return query; },
        range(start, end) { from = start; to = end; return query; },
        upsert(value, config) { operation = 'upsert'; payload = value; options = config ?? {}; return query; },
        delete() { operation = 'delete'; return query; },
        single() { single = true; return query; },
        then(resolve, reject) {
          return Promise.resolve().then(() => {
            db.calls.push({ table, operation, payload: structuredClone(payload), options });
            if (db.fail(table, operation)) return { data: null, error: { code: 'TEST', message: 'Simulated outage' } };
            let rows = db[table].filter(row => filters.every(filter => filter(row)));
            if (operation === 'upsert') {
              rows = [];
              for (const input of Array.isArray(payload) ? payload : [payload]) {
                const keys = (options.onConflict ?? 'id').split(',');
                let record = db[table].find(row => keys.every(key => input[key] !== undefined && row[key] === input[key]));
                if (record) { if (!options.ignoreDuplicates) Object.assign(record, structuredClone(input)); }
                else { record = { id: webcrypto.randomUUID(), ...structuredClone(input) }; db[table].push(record); }
                rows.push(record);
              }
            } else if (operation === 'delete') {
              const ids = rows.map(row => row.id);
              if (table === 'tasks') {
                if (!db.cascade && db.subtasks.some(row => ids.includes(row.task_id))) return { data: null, error: { code: '23503' } };
                db.subtasks = db.subtasks.filter(row => !ids.includes(row.task_id));
              }
              db[table] = db[table].filter(row => !ids.includes(row.id));
            } else rows = rows.sort((a, b) => a.id.localeCompare(b.id)).slice(from, to + 1);
            if (single && rows.length !== 1) return { data: null, error: { code: 'PGRST116', message: 'Expected one row' } };
            return { data: structuredClone(single ? rows[0] : rows), error: null };
          }).then(resolve, reject);
        },
      };
      return query;
    },
  });
  db.api = userId => load('lib/kaizen-data.ts', {
    '@/lib/supabase/client': { createClient: () => db.client(userId) },
  }, { crypto: webcrypto, TextEncoder });
  return db;
}

const task = (overrides = {}) => ({ id: webcrypto.randomUUID(), title: 'Private quest', description: 'Notes', category: 'Development', priority: 'High', status: 'To Do', week: '2026-10-12', due: '', created: '2026-10-16T00:00:00Z', subtasks: [{ id: webcrypto.randomUUID(), text: 'First step', done: false }], ...overrides });

test('Tasks, categories and subtasks persist through create/edit/reload and stay owner-filtered', async () => {
  const db = database(), alice = db.api('alice'), bob = db.api('bob');
  const a = task(), b = task({ title: 'Bob secret', category: 'Bob only' });
  await alice.saveCloudTask(a); await bob.saveCloudTask(b);
  a.title = 'Edited quest'; a.status = 'Review'; a.week = '2026-10-19';
  a.subtasks[0].done = true;
  a.subtasks.push({ id: webcrypto.randomUUID(), text: 'Second step', done: false });
  await alice.saveCloudTask(a);
  const loaded = await db.api('alice').loadCloudTasks();
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].title, 'Edited quest');
  assert.equal(loaded[0].week, '2026-10-19');
  assert.equal(loaded[0].status, 'Review');
  assert.equal(loaded[0].subtasks.length, 2);
  assert.equal(loaded[0].subtasks[0].done, true);
  assert.deepEqual(Array.from(await alice.loadCloudCategories()), ['Development']);
  assert.equal((await bob.loadCloudTasks())[0].title, 'Bob secret');
  a.subtasks.shift(); await alice.saveCloudTask(a);
  assert.equal((await alice.loadCloudTasks())[0].subtasks.length, 1);
  assert.equal((await bob.loadCloudTasks())[0].subtasks.length, 1);
});

test('Deleting a task is atomic and cannot remove another user’s task', async () => {
  const db = database(), alice = db.api('alice'), bob = db.api('bob');
  const a = task(), b = task(); await alice.saveCloudTask(a); await bob.saveCloudTask(b);
  await assert.rejects(alice.deleteCloudTask(b.id));
  db.fail = (table, operation) => table === 'tasks' && operation === 'delete';
  await assert.rejects(alice.deleteCloudTask(a.id));
  assert.equal(db.subtasks.length, 2);
  db.fail = () => false; db.cascade = false;
  await assert.rejects(alice.deleteCloudTask(a.id), /No subtasks were removed/);
  assert.equal(db.tasks.length, 2); assert.equal(db.subtasks.length, 2);
  db.cascade = true; await alice.deleteCloudTask(a.id);
  assert.equal(db.tasks[0].id, b.id); assert.equal(db.subtasks[0].task_id, b.id);
  assert.ok(!db.calls.some(call => call.table === 'subtasks' && call.operation === 'delete'));
});

test('Interrupted imports resume missing steps without overwriting cloud edits or duplicating tasks', async () => {
  const db = database(), api = db.api('alice'), backup = { tasks: [task()], categories: ['Work'] };
  const original = JSON.stringify(backup);
  db.fail = (table, operation) => table === 'subtasks' && operation === 'upsert';
  await assert.rejects(api.importCloudBackup(backup));
  assert.equal(db.tasks.length, 1); assert.equal(db.subtasks.length, 0);
  db.tasks[0].title = 'Edited in cloud after interruption';
  db.fail = () => false;
  await api.importCloudBackup(backup);
  assert.equal(db.tasks.length, 1); assert.equal(db.subtasks.length, 1);
  assert.equal(db.tasks[0].title, 'Edited in cloud after interruption');
  db.subtasks[0].is_completed = true;
  await api.importCloudBackup(backup);
  assert.equal(db.tasks.length, 1); assert.equal(db.subtasks.length, 1);
  assert.equal(db.subtasks[0].is_completed, true);
  assert.equal(JSON.stringify(backup), original);
});

test('Imports preserve matching existing tasks and generate separate identities per user', async () => {
  const db = database(), alice = db.api('alice'), bob = db.api('bob'), original = task();
  await alice.saveCloudTask(original);
  await alice.importCloudBackup({ tasks: [original] });
  assert.equal(db.tasks.length, 1); assert.equal(db.tasks[0].id, original.id);
  await bob.importCloudBackup({ tasks: [original] });
  assert.equal(db.tasks.length, 2); assert.notEqual(db.tasks[1].id, original.id);
  assert.equal(db.tasks[1].user_id, 'bob');
  const other = task({ title: 'New import' });
  await alice.importCloudBackup({ tasks: [other] }); await bob.importCloudBackup({ tasks: [other] });
  const ids = db.tasks.filter(row => row.title === 'New import').map(row => row.id);
  assert.equal(new Set(ids).size, 2);
});

test('Cloud loading paginates past Supabase’s single-response limit', async () => {
  const db = database(), api = db.api('alice');
  db.categories.push({ id: 'category', user_id: 'alice', name: 'Development' });
  for (let i = 0; i < 1105; i++) {
    db.tasks.push({ id: String(i).padStart(4, '0'), user_id: 'alice', title: `Task ${i}`, category_id: 'category', priority: 'low', status: 'todo', created_at: '2026-10-16T00:00:00Z' });
    db.subtasks.push({ id: `step-${i}`, user_id: 'alice', task_id: String(i).padStart(4, '0'), title: 'Step', is_completed: false, position: 0 });
  }
  const loaded = await api.loadCloudTasks();
  assert.equal(loaded.length, 1105);
  assert.equal(loaded.reduce((sum, row) => sum + row.subtasks.length, 0), 1105);
});

test('Unauthenticated requests and malformed backups cannot write cloud records', async () => {
  const db = database(), api = db.api(null);
  await assert.rejects(api.saveCloudTask(task()), /Please log in/);
  await assert.rejects(api.importCloudBackup({ tasks: [task({ due: '2026-02-30' })] }), /Invalid backup/);
  assert.equal(db.calls.length, 0);
});
