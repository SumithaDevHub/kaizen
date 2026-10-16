const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers.cjs');

function form(file, auth, search = '') {
  const slots = [], pending = [], redirects = [];
  let cursor = 0, tree;
  const jsx = (type, props) => ({ type, props });
  const { default: Page } = load(file, {
    react: {
      useState: initial => {
        const index = cursor++;
        if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
        return [slots[index], value => { slots[index] = value; }];
      },
      useRef: value => { const index = cursor++; return slots[index] ??= { current: value }; },
      useEffect: (fn, deps) => {
        const index = cursor++, previous = slots[index];
        if (!previous || deps.some((value, i) => value !== previous[i])) pending.push(fn);
        slots[index] = deps;
      },
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '@/lib/supabase/client': { createClient: () => ({ auth }) },
  }, { URLSearchParams, window: { location: { origin: 'https://kaizen.example', search, hash: '', pathname: '/reset-password', assign: path => redirects.push(path) }, history: { replaceState() {} } } });
  const render = () => { cursor = 0; tree = Page(); for (const effect of pending.splice(0)) effect(); };
  const settle = async (action = () => {}) => { await action(); for (let i = 0; i < 3; i++) { render(); await new Promise(setImmediate); } };
  function find(predicate, node = tree) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.map(child => find(predicate, child)).find(Boolean);
    if (predicate(node)) return node;
    return node.props?.children === undefined ? undefined : find(predicate, node.props.children);
  }
  const fill = (id, value) => settle(() => find(node => node.props?.id === id).props.onChange({ target: { value } }));
  const submit = () => settle(() => find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }));
  render();
  return { settle, find, fill, submit, redirects };
}

test('Login trims email, authenticates, redirects, and recovers from invalid credentials', async () => {
  const calls = []; let fail = true;
  const ui = form('app/login/page.tsx', { signInWithPassword: async payload => { calls.push(payload); return { error: fail ? Error('Invalid credentials') : null }; } });
  await ui.fill('email', ' alice@example.test '); await ui.fill('password', 'test-password');
  await ui.submit();
  assert.equal(ui.redirects.length, 0);
  assert.ok(ui.find(node => node.props?.role === 'status' && node.props.children === 'Invalid credentials'));
  assert.equal(ui.find(node => node.props?.type === 'submit').props.disabled, false);
  fail = false; await ui.submit();
  assert.equal(calls[1].email, 'alice@example.test');
  assert.deepEqual(ui.redirects, ['/']);
});

test('Signup uses the correct confirmation URL and handles both email confirmation and active sessions', async () => {
  for (const session of [null, { access_token: 'test-only' }]) {
    let payload;
    const ui = form('app/login/page.tsx', { signUp: async input => { payload = input; return { data: { session }, error: null }; } });
    await ui.settle(() => ui.find(node => node.props?.className === 'kaizen-auth-switch').props.onClick());
    await ui.fill('email', ' alice@example.test '); await ui.fill('password', 'test-password');
    await ui.submit();
    assert.equal(payload.email, 'alice@example.test');
    assert.equal(payload.options.emailRedirectTo, 'https://kaizen.example/auth/confirm');
    assert.equal(ui.redirects.length, session ? 1 : 0);
    if (!session) assert.ok(ui.find(node => node.props?.role === 'status' && node.props.children.includes('Check your email')));
  }
});

test('Expired confirmation errors are visible on the login form', async () => {
  const ui = form('app/login/page.tsx', {}, '?error=confirmation-failed'); await ui.settle();
  assert.ok(ui.find(node => node.props?.role === 'status' && node.props.children.includes('invalid or expired')));
});

test('Forgot Password sends the recovery URL and reports errors without leaving the form busy', async () => {
  let payload, fail = false;
  const ui = form('app/forgot-password/page.tsx', { resetPasswordForEmail: async (...input) => {
    payload = input; if (fail) throw Error('Offline'); return { error: null };
  } });
  await ui.fill('email', ' alice@example.test '); await ui.submit();
  assert.equal(payload[0], 'alice@example.test');
  assert.equal(payload[1].redirectTo, 'https://kaizen.example/reset-password');
  assert.ok(ui.find(node => node.props?.role === 'status' && node.props.children.includes('If this email is registered')));
  fail = true; await ui.submit();
  assert.equal(ui.find(node => node.props?.type === 'submit').props.disabled, false);
  assert.ok(ui.find(node => node.props?.role === 'status' && node.props.children === 'Offline'));
});

test('Reset Password validates confirmation, updates once, clears inputs, and signs out locally', async () => {
  const updates = [], signouts = [];
  const ui = form('app/reset-password/page.tsx', {
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    getUser: async () => ({ data: { user: { id: 'alice' } }, error: null }),
    updateUser: async payload => { updates.push(payload); return { error: null }; },
    signOut: async payload => { signouts.push(payload); return { error: null }; },
  });
  await ui.settle();
  await ui.fill('password', 'new-password'); await ui.fill('confirm-password', 'mismatch'); await ui.submit();
  assert.equal(updates.length, 0);
  await ui.fill('confirm-password', 'new-password'); await ui.submit();
  assert.equal(updates.length, 1); assert.equal(updates[0].password, 'new-password');
  assert.equal(signouts[0].scope, 'local');
  assert.ok(!ui.find(node => node.type === 'form'));
  assert.ok(ui.find(node => node.props?.role === 'status' && node.props.children.includes('successfully')));
});

test('Reset Password rejects error links and unauthenticated sessions', async () => {
  for (const search of ['', '?error=access_denied']) {
    const ui = form('app/reset-password/page.tsx', {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      getUser: async () => ({ data: { user: null }, error: null }),
    }, search);
    await ui.settle();
    assert.ok(!ui.find(node => node.type === 'form'));
    assert.ok(ui.find(node => node.props?.role === 'status' && node.props.children.includes('missing or expired')));
  }
});
