import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute, routePath, type Route } from '../src/lib/route.ts';

const all: Route[] = [
  { name: 'list' }, { name: 'login' }, { name: 'invite', token: 'abc_DEF-123' }, { name: 'nickname' },
  { name: 'anniversary' }, { name: 'noroom' }, { name: 'created' }, { name: 'compose' },
  { name: 'detail', id: 'r1' }, { name: 'edit', id: 'r1' }, { name: 'settings' },
];
test('모든 화면은 주소로 갔다가 같은 화면으로 돌아온다', () => {
  for (const r of all) assert.deepEqual(parseRoute(routePath(r)), r);
});
test('끝의 / 는 무시', () => assert.deepEqual(parseRoute('/settings/'), { name: 'settings' }));
test('모르는 주소', () => assert.equal(parseRoute('/r/../../etc').name, 'notfound'));
