// 초대 링크 규칙 (R2, R3, D25) — 순수 함수
export const INVITE_TTL_MS = 24 * 60 * 60 * 1000;

export type InviteStatus = 'ok' | 'expired' | 'used' | 'full' | 'other_room' | 'member' | 'not_found';

export type InviteRow = {
  token: string;
  roomId: string;
  createdAt: number; // ms
  usedBy?: string;
  revokedAt?: number;
};

/** 추측할 수 없는 토큰: 무작위 32바이트 → base64url 43자 */
export function newToken(rand: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const bytes = rand(32);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * 초대 링크를 열었을 때 상태.
 * 순서: 없음 → 이미 이 방 멤버(안내 없이 열기) → 다른 방 소속 → 방 가득 → 사용됨 → 새 링크로 무효 → 만료
 */
export function inviteStatus(
  inv: InviteRow | undefined,
  ctx: { now: number; userId: string; userRoomId?: string; memberCount: number },
): InviteStatus {
  if (!inv) return 'not_found';
  if (ctx.userRoomId === inv.roomId) return 'member';
  if (ctx.userRoomId) return 'other_room';
  if (ctx.memberCount >= 2) return 'full';
  if (inv.usedBy) return 'used';
  if (inv.revokedAt !== undefined) return 'expired'; // 새 링크를 만들면 이전 링크는 만료 안내 (R2)
  if (ctx.now - inv.createdAt >= INVITE_TTL_MS) return 'expired';
  return 'ok';
}

/**
 * 붙여 넣은 초대 링크나 코드에서 토큰을 꺼낸다. 앞뒤 공백·카톡 문구가 섞여 있어도 된다.
 * 예: "https://uriduri.app/i/AbC…(43자)", "AbC…(43자)"
 */
export function parseInviteInput(text: string): string | null {
  const t = text.trim();
  const inUrl = /\/i\/([A-Za-z0-9_-]{43})(?![A-Za-z0-9_-])/.exec(t);
  if (inUrl) return inUrl[1];
  return /^[A-Za-z0-9_-]{43}$/.test(t) ? t : null;
}

/** 상태 → 로그인 화면의 오류 상태 이름 (디자인 LoginScreen state) */
export const inviteErrorState: Partial<Record<InviteStatus, string>> = {
  expired: 'expired',
  not_found: 'expired',
  used: 'used',
  full: 'full',
  other_room: 'other',
};
