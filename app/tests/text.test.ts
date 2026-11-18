import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIMITS, clip, countChars, isBlank, isValidText } from '../src/lib/text.ts';

test('메모 50자 — 50자는 되고 51자는 안 됨 (R4)', () => {
  assert.ok(isValidText('가'.repeat(50), LIMITS.memo));
  assert.ok(!isValidText('가'.repeat(51), LIMITS.memo));
});
test('공백만은 빈 값 (R4)', () => {
  assert.ok(isBlank('   '));
  assert.ok(!isValidText('  \n ', LIMITS.memo));
});
test('이모지 하나는 1자', () => {
  assert.equal(countChars('또 가자😀'), 5);
  assert.equal(clip('😀😀😀', 2), '😀😀');
});
test('장소 30자, 닉네임 10자, 도장 6자', () => {
  assert.deepEqual({ ...LIMITS }, { nickname: 10, memo: 50, place: 30, stamp: 6 });
});
