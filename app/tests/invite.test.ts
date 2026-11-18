import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INVITE_TTL_MS, inviteStatus, newToken, parseInviteInput } from '../src/lib/invite.ts';

const inv = { token: 't', roomId: 'room1', createdAt: 0 };
const base = { now: 1000, userId: 'u2', memberCount: 1 };

test('24시간 안의 새 링크는 들어갈 수 있다', () => assert.equal(inviteStatus(inv, base), 'ok'));
test('24시간이 지나면 만료 (R2)', () => assert.equal(inviteStatus(inv, { ...base, now: INVITE_TTL_MS }), 'expired'));
test('한 번 쓴 링크는 사용됨 (R2)', () => assert.equal(inviteStatus({ ...inv, usedBy: 'u9' }, base), 'used'));
test('새 링크를 만들면 이전 링크는 만료 안내 (R2)', () => assert.equal(inviteStatus({ ...inv, revokedAt: 500 }, base), 'expired'));
test('두 명이 찬 방은 가득 (R3)', () => assert.equal(inviteStatus({ ...inv, usedBy: 'u2' }, { ...base, userId: 'u3', memberCount: 2 }), 'full'));
test('이미 이 방 멤버면 안내 없이 열림 (R3)', () => assert.equal(inviteStatus({ ...inv, usedBy: 'u2' }, { ...base, userRoomId: 'room1', memberCount: 2 }), 'member'));
test('다른 방에 속한 계정은 거절 (R3)', () => assert.equal(inviteStatus(inv, { ...base, userRoomId: 'room2' }), 'other_room'));
test('없는 링크', () => assert.equal(inviteStatus(undefined, base), 'not_found'));
test('토큰은 43자 base64url이고 매번 다르다', () => {
  const a = newToken();
  const b = newToken();
  assert.match(a, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(a, b);
});

const T = 'GFZZteouylDD-oqI3wTGxctWMKbbdZJFRfpo-4YLphc';
test('붙여 넣은 초대 링크에서 토큰 꺼내기', () => {
  assert.equal(parseInviteInput(`https://uriduri.app/i/${T}`), T);
  assert.equal(parseInviteInput(`  http://localhost:5180/i/${T}/  `), T);
  assert.equal(parseInviteInput(`[우리두리] 초대 링크예요 https://uriduri.app/i/${T} 눌러서 들어와!`), T);
  assert.equal(parseInviteInput(T), T);
});
test('초대 링크가 아니면 null', () => {
  assert.equal(parseInviteInput('https://uriduri.app/i/짧음'), null);
  assert.equal(parseInviteInput(`https://uriduri.app/i/${T}x`), null);
  assert.equal(parseInviteInput('안녕'), null);
  assert.equal(parseInviteInput(''), null);
});
