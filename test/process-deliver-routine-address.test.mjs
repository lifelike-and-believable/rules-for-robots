// RFR_DELIVER_ROUTINE takes the routine's address as its page gives it to copy, or the bare id
// (docs/specs/delivery-run.md, AC-16; the maintainer, 2026-11-13: copying the address is easier than
// picking the id out of it). Any other address is refused, so the token goes nowhere else.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deliverOnMerge, routineIdOf } from '../checks/ci/deliver-on-merge.mjs';

const ID = 'trig_01AbCdEf234';
const TOKEN = 'sk-ant-oat01-Zq9xW3vT7uR5pL2mN8kJ4hG6fD1sA0yB-secretpart-XYZ';
const ONE = [{ stories: ['story-export'], docs: ['user-export'] }];

test('delivery-run#AC-16: the routine is named by its address as copied, or by its id', () => {
  assert.equal(routineIdOf(ID), ID);
  assert.equal(routineIdOf(`https://api.anthropic.com/v1/claude_code/routines/${ID}/fire`), ID);
  assert.equal(routineIdOf(`https://api.anthropic.com/v1/claude_code/routines/${ID}/fire/`), ID);
  assert.equal(routineIdOf(`https://api.anthropic.com/v1/claude_code/routines/${ID}`), ID);
  assert.equal(routineIdOf(`  https://api.anthropic.com/v1/claude_code/routines/${ID}/fire\n`), ID);
});

test('delivery-run#AC-16: an address on another host, or of another shape, is refused', () => {
  for (const value of [
    `https://evil.example/v1/claude_code/routines/${ID}/fire`,
    `https://api.anthropic.com.evil.example/v1/claude_code/routines/${ID}/fire`,
    `http://api.anthropic.com/v1/claude_code/routines/${ID}/fire`,
    `https://api.anthropic.com/v1/claude_code/routines/${ID}/fire?x=1`,
    `https://api.anthropic.com/v1/claude_code/routines/${ID}/../other/fire`,
    `https://api.anthropic.com/v1/messages`,
    `https://user@api.anthropic.com/v1/claude_code/routines/${ID}/fire`,
    'trig_ab-cd', 'TRIG_abc', TOKEN, '',
  ]) assert.equal(routineIdOf(value), null, value);
});

test('delivery-run#AC-16: a copied address starts the delivery with one request to the routines API', async () => {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ claude_code_session_url: 'https://claude.ai/code/session_01' }), { status: 200 });
  };
  const result = await deliverOnMerge({ open: ONE, routine: `https://api.anthropic.com/v1/claude_code/routines/${ID}/fire`, token: TOKEN, fetch, last: null, now: Date.now() });
  assert.equal(result.code, 0, result.lines?.join('\n'));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `https://api.anthropic.com/v1/claude_code/routines/${ID}/fire`);
});
