// 화면은 여기의 backend만 부른다. 묶음 5에서 Supabase 구현으로 바꿔 끼운다.
import { createLocalBackend, localPerson } from './local';
import type { Backend } from './types';

export const backend: Backend = createLocalBackend();
export * from './types';

/** 이 기기에서 마지막으로 쓴 로그인 방식 (R1, D28) — 로그인 방식과 상관없이 기기에 남긴다 */
// 로컬 모드는 한 브라우저에서 A·B 두 사람을 흉내 내므로 사람마다 따로 기억한다
const lastKey = () => (backend.mode === 'local' ? `uriduri.lastProvider.${localPerson()}` : 'uriduri.lastProvider');
export const lastProvider = (): 'kakao' | 'google' | null => {
  try {
    const v = localStorage.getItem(lastKey());
    return v === 'kakao' || v === 'google' ? v : null;
  } catch {
    return null;
  }
};
export const rememberProvider = (p: 'kakao' | 'google') => {
  try { localStorage.setItem(lastKey(), p); } catch { /* 저장 못 해도 로그인은 됨 */ }
};

/** 이 기기에서 지난번과 다른 방식으로 로그인했을 때 지난 방식 (R1, D28 "혹시 다른 방식으로…" 안내용) */
const SUSPECT = 'uriduri.suspectProvider';
export const suspectProvider = {
  get: (): 'kakao' | 'google' | null => {
    const v = sessionStorage.getItem(SUSPECT);
    return v === 'kakao' || v === 'google' ? v : null;
  },
  /** 로그인 직전에 부른다 */
  check: (now: 'kakao' | 'google') => {
    const prev = lastProvider();
    if (prev && prev !== now) sessionStorage.setItem(SUSPECT, prev);
    else sessionStorage.removeItem(SUSPECT);
  },
  clear: () => sessionStorage.removeItem(SUSPECT),
};

/** 초대 링크로 들어왔다가 로그인하는 동안 토큰을 기억 (R3, D33) */
const PENDING_INVITE = 'uriduri.pendingInvite';
export const pendingInvite = {
  get: () => sessionStorage.getItem(PENDING_INVITE),
  set: (t: string) => sessionStorage.setItem(PENDING_INVITE, t),
  clear: () => sessionStorage.removeItem(PENDING_INVITE),
};

/** 방 만들기 전에 고른 사귄 날 (D37) — 방을 만들 때 함께 보낸다 */
const PENDING_ANNIV = 'uriduri.pendingAnniversary';
export const pendingAnniversary = {
  get: () => sessionStorage.getItem(PENDING_ANNIV),
  set: (d: string) => sessionStorage.setItem(PENDING_ANNIV, d),
  clear: () => sessionStorage.removeItem(PENDING_ANNIV),
};

/** 로그인 전에 입력한 닉네임 (2026-11-18 순서 변경: 소개 → 닉네임 → 사귄 날 → 로그인) — 로그인 직후 계정에 저장한다 */
const PENDING_NICK = 'uriduri.pendingNickname';
export const pendingNickname = {
  get: () => sessionStorage.getItem(PENDING_NICK),
  set: (n: string) => sessionStorage.setItem(PENDING_NICK, n),
  clear: () => sessionStorage.removeItem(PENDING_NICK),
};

/** 이 기기에서 앱 소개를 본 적 있는지 — 본 사람은 스플래시 뒤 바로 로그인으로 (2026-11-18 사용자 결정) */
const onboardedKey = () => (backend.mode === 'local' ? `uriduri.onboarded.${localPerson()}` : 'uriduri.onboarded');
export const onboarded = {
  get: (): boolean => {
    try { return localStorage.getItem(onboardedKey()) === '1'; } catch { return false; }
  },
  set: () => {
    try { localStorage.setItem(onboardedKey(), '1'); } catch { /* 못 남겨도 다음에 소개를 한 번 더 볼 뿐 */ }
  },
};
