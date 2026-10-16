const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers.cjs');

test('Logout signs out locally, redirects, and never queries user data', async () => {
  const calls = [];
  const jsx = (type, props) => ({ type, props });
  const module = load('components/LogoutButton.tsx', {
    react: { useState: value => [value, () => {}] },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    'lucide-react': { LogOut: 'icon' },
    '@/lib/supabase/client': { createClient: () => ({ auth: { signOut: async options => {
      calls.push(options.scope); return { error: null };
    } } }) },
  }, { window: { location: { replace: path => calls.push(path) } } });
  await module.default({}).props.children[0].props.onClick();
  assert.deepEqual(calls, ['local', '/login']);
});

test('Logout failure keeps the current page and reports an error', async () => {
  let message;
  const jsx = (type, props) => ({ type, props });
  const module = load('components/LogoutButton.tsx', {
    react: { useState: value => [value, next => { if (typeof next === 'string') message = next; }] },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    'lucide-react': { LogOut: 'icon' },
    '@/lib/supabase/client': { createClient: () => ({ auth: { signOut: async () => { throw Error('Offline'); } } }) },
  }, { window: { location: { replace: () => assert.fail('Must not redirect') } } });
  await module.default({}).props.children[0].props.onClick();
  assert.equal(message, 'Offline');
});

test('Backup validation rejects malformed nested data before writes', () => {
  const { validateBackup } = load('lib/kaizen-data.ts', {
    '@/lib/supabase/client': { createClient: () => ({}) },
  });
  const task = { title: 'Quest', description: '', category: 'Development', status: 'To Do', priority: 'Medium', week: '', due: '', created: '2026-10-15T00:00:00Z', subtasks: [] };
  assert.doesNotThrow(() => validateBackup({ tasks: [task], categories: ['Work'] }));
  for (const bad of [null, {}, { tasks: [{ ...task, subtasks: [null] }] }, { tasks: [task], categories: [42] }, { tasks: [{ ...task, status: 'invalid' }] }, { tasks: [{ ...task, due: '2026-02-30' }] }]) {
    assert.throws(() => validateBackup(bad), /Invalid backup/);
  }
});

test('Account changes stop cloud writes from an old board', async () => {
  let id = 'user-a';
  let queries = 0;
  const api = load('lib/kaizen-data.ts', {
    '@/lib/supabase/client': { createClient: () => ({
      auth: { getUser: async () => ({ data: { user: { id } }, error: null }) },
      from: () => { queries++; return { select: () => ({ eq: () => ({ order: () => ({ range: async () => ({ data: [], error: null }) }) }) }) }; },
    }) },
  });
  await api.loadCloudCategories();
  id = 'user-b';
  await assert.rejects(api.saveCloudTask({}), /account changed/);
  assert.equal(queries, 1);
});

test('Cloud moves filter by task owner and do not write task details or subtasks', async () => {
  const calls = [];
  const chain = {
    update: value => { calls.push(['update', value]); return chain; },
    eq: (...args) => { calls.push(['eq', ...args]); return chain; },
    select: () => chain,
    single: async () => ({ error: null }),
  };
  const api = load('lib/kaizen-data.ts', {
    '@/lib/supabase/client': { createClient: () => ({
      auth: { getUser: async () => ({ data: { user: { id: 'user-a' } }, error: null }) },
      from: table => { assert.equal(table, 'tasks'); return chain; },
    }) },
  });
  await api.moveCloudTask('task-a', 'In Progress', '2026-10-12');
  assert.equal(JSON.stringify(calls), JSON.stringify([
    ['update', { status: 'in_progress', planned_week: '2026-10-12' }],
    ['eq', 'user_id', 'user-a'], ['eq', 'id', 'task-a'],
  ]));
});

test('Middleware preserves refreshed cookies on protected and login redirects', async () => {
  for (const loggedIn of [false, true]) {
    const response = url => {
      const jar = [];
      return { url, cookies: { set: (...args) => jar.push(args.length === 1 ? args[0] : { name: args[0], value: args[1], ...args[2] }), getAll: () => jar }, headers: new Map() };
    };
    const { updateSession } = load('lib/supabase/middleware.ts', {
      'next/server': { NextResponse: { next: () => response(), redirect: url => response(url) } },
      '@supabase/ssr': { createServerClient: (_url, _key, options) => ({ auth: { getUser: async () => {
        options.cookies.setAll([{ name: 'session', value: 'refreshed', options: { httpOnly: true } }]);
        return { data: { user: loggedIn ? { id: 'a' } : null }, error: null };
      } } }) },
    });
    const url = new URL(`https://example.test${loggedIn ? '/login' : '/'}?secret=discard`);
    url.clone = () => new URL(url);
    const result = await updateSession({ nextUrl: url, cookies: { getAll: () => [], set: () => {} } });
    assert.equal(result.url.pathname, loggedIn ? '/' : '/login');
    assert.equal(result.url.search, '');
    assert.equal(result.cookies.getAll()[0].value, 'refreshed');
    assert.equal(result.headers.get('Cache-Control'), 'private, no-store');
  }
});

test('Email confirmation accepts PKCE, routes recovery, and rejects invalid links', async () => {
  let verified = 0;
  let exchanged = 0;
  const { GET } = load('app/auth/confirm/route.ts', {
    'next/server': { NextResponse: { redirect: url => url } },
    '@/lib/supabase/server': { createClient: async () => ({ auth: {
      verifyOtp: async () => { verified++; return { error: null }; },
      exchangeCodeForSession: async () => { exchanged++; return { error: null }; },
    } }) },
  }, { URL });
  assert.equal(await GET({ url: 'https://example.test/auth/confirm?token_hash=abc&type=recovery' }), 'https://example.test/reset-password');
  assert.equal(await GET({ url: 'https://example.test/auth/confirm?code=abc' }), 'https://example.test/');
  assert.equal(await GET({ url: 'https://example.test/auth/confirm?code=abc&type=recovery' }), 'https://example.test/reset-password');
  assert.equal(await GET({ url: 'https://example.test/auth/confirm?token_hash=abc&type=invalid' }), 'https://example.test/login?error=invalid-link');
  assert.equal(verified, 1);
  assert.equal(exchanged, 2);
});
