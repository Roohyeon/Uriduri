import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dday, exifToIso, fmtDate, fmtDplus, isIsoDate, toIso } from '../src/lib/dates.ts';

test('사귄 날을 1일로 센다 — 기획 R1 예시 D+413', () => {
  assert.equal(dday('2025-09-30', '2026-11-16'), 413);
  assert.equal(dday('2026-11-16', '2026-11-16'), 1);
});
test('윤년·월말을 넘어도 하루씩 센다', () => {
  assert.equal(dday('2024-02-28', '2024-03-01'), 3);
});
test('표시 형식 2026.11.15 (일)', () => {
  assert.equal(fmtDate('2026-11-15'), '2026.11.15 (일)');
  assert.equal(fmtDate('2026-11-16'), '2026.11.16 (월)');
  assert.equal(fmtDate('2026-11-15', false), '2026.11.15');
});
test('날짜 값 검사', () => {
  assert.ok(isIsoDate('2026-02-28'));
  assert.ok(!isIsoDate('2026-02-30'));
  assert.ok(!isIsoDate('2026.02.28'));
});
test('촬영 정보 문자열은 찍힌 날짜 그대로', () => {
  assert.equal(exifToIso('2026:11:14 23:59:00'), '2026-11-14');
  assert.equal(exifToIso('garbage'), undefined);
  assert.equal(exifToIso(undefined), undefined);
  assert.equal(exifToIso(new Date(2026, 10, 14, 23, 59)), '2026-11-14');
});
test('기기 시간 기준 오늘', () => {
  assert.equal(toIso(new Date(2026, 0, 5, 0, 1)), '2026-01-05');
});
test('사귄 날 전 영수증은 D-로 (음수 D+ 막기)', () => {
  assert.deepEqual(fmtDplus(413), { short: 'D+413', long: '이날 함께한 지 413일째' });
  assert.deepEqual(fmtDplus(1), { short: 'D+1', long: '이날 함께한 지 1일째' });
  assert.deepEqual(fmtDplus(dday('2026-11-17', '2026-11-16')), { short: 'D-1', long: '사귄 날 1일 전' });
  assert.deepEqual(fmtDplus(dday('2026-11-17', '2026-11-08')), { short: 'D-9', long: '사귄 날 9일 전' });
});

test('다음 100일 기념일', async () => {
  const { nextMilestone, addDays } = await import('../src/lib/dates.ts');
  assert.deepEqual(nextMilestone(412), { day: 500, left: 88 });
  assert.deepEqual(nextMilestone(400), { day: 400, left: 0 });
  assert.deepEqual(nextMilestone(1), { day: 100, left: 99 });
  assert.deepEqual(nextMilestone(-5), { day: 100, left: 105 });
  assert.equal(addDays('2026-12-30', 3), '2027-01-02');
});
