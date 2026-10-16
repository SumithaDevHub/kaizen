const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers.cjs');

test('Recovery verifies a single-use token once across effect replays and handles failed updates', async () => {
  const states = [], ref = { current: null };
  let cursor = 0, effect, verified = 0, checked = 0;
  const client = { auth: {
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    verifyOtp: async () => { verified++; return { error: null }; },
    getUser: async () => { checked++; return { data: { user: { id: 'a' } }, error: null }; },
    updateUser: async () => { throw Error('Offline'); },
  } };
  const jsx = (type, props) => ({ type, props });
  const { default: Page } = load('app/reset-password/page.tsx', {
    react: {
      useState: initial => {
        const index = cursor++;
        if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
        return [states[index], value => { states[index] = value; }];
      },
      useRef: () => ref,
      useEffect: fn => { effect = fn; },
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '@/lib/supabase/client': { createClient: () => client },
  }, { URLSearchParams, window: { location: { search: '?token_hash=abc&type=recovery', hash: '', pathname: '/reset-password' }, history: { replaceState() {} } } });
  Page();
  const cleanup = effect(); cleanup(); effect();
  await new Promise(setImmediate);
  assert.equal(verified, 1);
  assert.equal(checked, 1);
  assert.equal(states[3], true);
  assert.equal(states[4], false);
  states[1] = states[2] = 'eightcharacters';
  cursor = 0;
  const tree = Page();
  const findForm = node => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.map(findForm).find(Boolean);
    if (node.type === 'form') return node;
    return findForm(node.props?.children);
  };
  await findForm(tree).props.onSubmit({ preventDefault() {} });
  assert.equal(states[5], false, 'Loading must reset after a thrown error');
  assert.equal(states[7], 'Offline');
});
