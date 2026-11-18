import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firstNewId, isNew, sortReceipts } from '../src/lib/board.ts';

test('영수증 날짜순 — 11/3을 나중에 발행해도 11/10이 위 (R5)', () => {
  const list = [
    { id: 'a', date: '2026-11-10', createdAt: 1 },
    { id: 'b', date: '2026-11-03', createdAt: 2 },
  ];
  assert.deepEqual(sortReceipts(list).map((r) => r.id), ['a', 'b']);
});
test('같은 날짜면 늦게 발행된 것이 위 (R5)', () => {
  const list = [
    { id: 'a', date: '2026-11-10', createdAt: 1 },
    { id: 'b', date: '2026-11-10', createdAt: 2 },
  ];
  assert.deepEqual(sortReceipts(list).map((r) => r.id), ['b', 'a']);
});
test('NEW는 상대 영수증 중 누르지 않은 것만 (D26)', () => {
  const read = new Set(['x']);
  assert.ok(isNew({ id: 'y', authorId: 'partner' }, 'me', read));
  assert.ok(!isNew({ id: 'x', authorId: 'partner' }, 'me', read));
  assert.ok(!isNew({ id: 'z', authorId: 'me' }, 'me', read));
});
test('띠를 누르면 가장 위의 NEW로 (R5)', () => {
  const sorted = [
    { id: 'm', date: '2026-11-10', createdAt: 3, authorId: 'me' },
    { id: 'p1', date: '2026-11-09', createdAt: 2, authorId: 'partner' },
    { id: 'p2', date: '2026-11-01', createdAt: 1, authorId: 'partner' },
  ];
  assert.equal(firstNewId(sorted, 'me', new Set()), 'p1');
  assert.equal(firstNewId(sorted, 'me', new Set(['p1', 'p2'])), undefined);
});
