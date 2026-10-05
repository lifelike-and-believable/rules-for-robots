import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fromRow, listMembersSql, toRow } from '../src/members.js';

const row = { id: 7, full_name: 'Ada Lovelace', email: 'ada@example.com', phone: '555-0100', city: 'Halifax', created_at: new Date(0), updated_at: new Date(0) };

test('maps a row to a member and back', () => {
  const member = fromRow(row);
  assert.equal(member.fullName, 'Ada Lovelace');
  assert.equal(member.phone, '555-0100');
  assert.deepEqual(toRow(member), { full_name: 'Ada Lovelace', email: 'ada@example.com', phone: '555-0100', city: 'Halifax' });
});

test('pages the member list', () => {
  assert.deepEqual(listMembersSql(3, 10).values, [10, 20]);
});
