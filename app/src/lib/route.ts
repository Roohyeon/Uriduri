// 주소 ↔ 화면 (디자인 보류 C4: 주소에 화면을 반영해 새로고침·뒤로가기가 되게) — 순수 함수
export type Route =
  | { name: 'list' }
  | { name: 'desk' }
  | { name: 'album' }
  | { name: 'login' }
  | { name: 'intro' }
  | { name: 'invite'; token: string }
  | { name: 'nickname' }
  | { name: 'anniversary' }
  | { name: 'noroom' }
  | { name: 'created' }
  | { name: 'compose' }
  | { name: 'detail'; id: string }
  | { name: 'edit'; id: string }
  | { name: 'settings' }
  | { name: 'notfound'; path: string };

const ID = '([A-Za-z0-9_-]{1,64})';
const table: [RegExp, (m: RegExpExecArray) => Route][] = [
  [/^\/$/, () => ({ name: 'desk' })], // 홈 = 다이어리 (2026-11-19)
  [/^\/board$/, () => ({ name: 'list' })], // 영수증 보드
  [/^\/album$/, () => ({ name: 'album' })], // 사진첩
  [/^\/login$/, () => ({ name: 'login' })],
  [/^\/welcome\/intro$/, () => ({ name: 'intro' })],
  [new RegExp(`^/i/${ID}$`), (m) => ({ name: 'invite', token: m[1] })],
  [/^\/welcome\/nickname$/, () => ({ name: 'nickname' })],
  [/^\/welcome\/anniversary$/, () => ({ name: 'anniversary' })],
  [/^\/room\/new$/, () => ({ name: 'noroom' })],
  [/^\/room\/created$/, () => ({ name: 'created' })],
  [/^\/new$/, () => ({ name: 'compose' })],
  [new RegExp(`^/r/${ID}$`), (m) => ({ name: 'detail', id: m[1] })],
  [new RegExp(`^/r/${ID}/edit$`), (m) => ({ name: 'edit', id: m[1] })],
  [/^\/settings$/, () => ({ name: 'settings' })],
];

export function parseRoute(pathname: string): Route {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  for (const [re, make] of table) {
    const m = re.exec(path);
    if (m) return make(m);
  }
  return { name: 'notfound', path };
}

export function routePath(r: Route): string {
  switch (r.name) {
    case 'desk': return '/';
    case 'list': return '/board';
    case 'album': return '/album';
    case 'login': return '/login';
    case 'intro': return '/welcome/intro';
    case 'invite': return `/i/${r.token}`;
    case 'nickname': return '/welcome/nickname';
    case 'anniversary': return '/welcome/anniversary';
    case 'noroom': return '/room/new';
    case 'created': return '/room/created';
    case 'compose': return '/new';
    case 'detail': return `/r/${r.id}`;
    case 'edit': return `/r/${r.id}/edit`;
    case 'settings': return '/settings';
    case 'notfound': return r.path;
  }
}

/** 탭 제목에 쓰는 화면 이름 */
export const routeTitle: Record<Route['name'], string> = {
  list: '우리 보드',
  desk: '오늘',
  album: '사진첩',
  login: '로그인',
  intro: '앱 소개',
  invite: '초대',
  nickname: '닉네임 정하기',
  anniversary: '사귄 날',
  noroom: '우리 방',
  created: '방 만들기 완료',
  compose: '영수증 발행',
  detail: '영수증 보기',
  edit: '영수증 수정',
  settings: '설정',
  notfound: '찾을 수 없는 화면',
};
