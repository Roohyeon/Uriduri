// 위젯 스타일 목록 — 위젯 창에서 고르고, 편집 화면의 '스타일' 단추로 바꾼다 (내용·사진은 그대로)
// 모양은 widgets.tsx, 꾸밈은 index.css '위젯 스타일'

export const FRAME_STYLES = [
  { id: 'wood', name: '나무 액자', cells: 1 },
  { id: 'v2', name: '세로 2컷', cells: 2 },
  { id: 'h2', name: '가로 2컷', cells: 2 },
  { id: 'four', name: '네컷 (흰색)', cells: 4 },
  { id: 'four-black', name: '네컷 (검정)', cells: 4 },
  { id: 'four-pink', name: '네컷 (분홍)', cells: 4 },
  { id: 'grid', name: '2×2', cells: 4 },
  { id: 'three', name: '3컷', cells: 3 },
  { id: 'film', name: '필름 스트립', cells: 3 },
  { id: 'polaroid', name: '폴라로이드', cells: 1 },
  { id: 'print', name: '인화 사진', cells: 1 },
  { id: 'stamp', name: '우표', cells: 1 },
  { id: 'heart', name: '하트', cells: 1 },
  { id: 'circle', name: '동그라미', cells: 1 },
  { id: 'arch', name: '아치 창문', cells: 1 },
  { id: 'gold', name: '금 액자', cells: 1 },
] as const;
export type FrameStyle = (typeof FRAME_STYLES)[number]['id'];
export const frameStyleOf = (id: string) => FRAME_STYLES.find((s) => s.id === id) ?? FRAME_STYLES[0];

export const MEMO_STYLES = [
  { id: 'lined', name: '줄 노트' },
  { id: 'postit-yellow', name: '포스트잇 노랑' },
  { id: 'postit-pink', name: '포스트잇 분홍' },
  { id: 'postit-sky', name: '포스트잇 하늘' },
  { id: 'postit-mint', name: '포스트잇 민트' },
  { id: 'torn', name: '찢은 노트' },
  { id: 'letter', name: '편지 (톡하면 펼쳐짐)' },
  { id: 'bubble', name: '말풍선' },
  { id: 'chalk', name: '칠판' },
  { id: 'typewriter', name: '타자기' },
] as const;
export type MemoStyle = (typeof MEMO_STYLES)[number]['id'];

export const BUCKET_STYLES = [
  { id: 'heart', name: '하트 체크' },
  { id: 'passport', name: '여권 도장' },
  { id: 'scratch', name: '스크래치' },
  { id: 'ticket', name: '티켓' },
  { id: 'progress', name: '진행률' },
] as const;
export const TODO_STYLES = [
  { id: 'check', name: '체크' },
  { id: 'clipboard', name: '클립보드' },
  { id: 'receipt', name: '장보기 영수증' },
  { id: 'planner', name: '주간 플래너' },
  { id: 'habit', name: '습관 도트' },
] as const;
export type BucketStyle = (typeof BUCKET_STYLES)[number]['id'];
export type TodoStyle = (typeof TODO_STYLES)[number]['id'];
export type ListStyle = BucketStyle | TodoStyle;

export const DEFAULT_STYLE = { memo: 'lined', bucket: 'heart', todo: 'check', frame: 'wood' } as const;

export const isOneOf = (list: readonly { id: string }[], v: unknown): boolean => typeof v === 'string' && list.some((s) => s.id === v);
