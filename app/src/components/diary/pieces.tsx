import type { ReactNode } from 'react';
import type { IsoDate } from '../../lib/dates';
import { BUCKET_STYLES, DEFAULT_STYLE, FRAME_STYLES, MEMO_STYLES, TODO_STYLES, frameStyleOf, isOneOf, type FrameStyle, type ListStyle, type MemoStyle } from './styles';

/*
 * 홈 다이어리에 붙이는 조각(piece): 아래 탭에서 골라 몇 개든 붙인다
 * - art: 그림 스티커 (하트·반짝이·구름…)
 * - text: 글씨 스티커 (글꼴·색 골라 쓰기, 흰 테두리)
 * - line: 한 줄 (손글씨 펜, 테두리·그림자 없이 종이에 쓴 것처럼)
 * - photo: 카메라로 찍은 사진 (폴라로이드, 누르면 사진첩)
 * - 위젯(아래 탭 오른쪽): memo 메모장 · list 버킷리스트/투두리스트(톡 = 체크) · frame 포토프레임(비었으면 톡 = 카메라)
 */

/* ───── 그림 스티커 ───── */
export const ARTS = [
  { id: 'heart', name: '하트', tilt: -6, cls: 'decor--heart' },
  { id: 'sparkle', name: '반짝이', tilt: 0, cls: 'decor--sparkle' },
  { id: 'cloud', name: '구름 얼굴', tilt: 6, cls: 'decor--cloud' },
  { id: 'cake', name: '케이크', tilt: 0, cls: 'decor--cake' },
  { id: 'stamp', name: '도장 "또 가자!"', tilt: -12, cls: 'decor--stamp' },
  { id: 'tape', name: '마스킹테이프', tilt: -30, cls: 'decor--tape' },
] as const;
export type ArtId = (typeof ARTS)[number]['id'];
export const artOf = (id: ArtId) => ARTS.find((a) => a.id === id) ?? ARTS[0];

export function ArtBody({ id }: { id: ArtId }): ReactNode {
  switch (id) {
    case 'heart':
      return (
        <svg width="30" viewBox="0 0 24 24" fill="#f7b3c8" stroke="#2a2622" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
        </svg>
      );
    case 'sparkle':
      return (
        <svg width="30" viewBox="0 0 24 24" fill="#ffd64a" stroke="#2a2622" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 2l2.2 6.6L21 11l-6.8 2.4L12 20l-2.2-6.6L3 11l6.8-2.4z" />
        </svg>
      );
    case 'cloud':
      return (
        <svg width="40" viewBox="0 0 70 60" fill="none" stroke="#1f2a44" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <circle cx="22" cy="24" r="3" fill="#1f2a44" /><circle cx="46" cy="24" r="3" fill="#1f2a44" /><path d="M24 38q10 9 20 0" /><path d="M12 32h4M54 32h4" stroke="#e7a1a8" />
        </svg>
      );
    case 'cake':
      return (
        <svg width="52" viewBox="0 0 56 50" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
          <path d="M6 22L44 10 50 22z" fill="#fff" /><path d="M6 22h44v18H6z" fill="#fff" /><path d="M6 30h44" /><circle cx="44" cy="7" r="4" fill="#e7a1a8" />
        </svg>
      );
    case 'stamp':
      return <span aria-hidden="true">또 가자!</span>;
    case 'tape':
      return null;
  }
}

/* ───── 글씨 스티커 ───── */
// 글꼴: index.css @font-face (눈누 웹폰트, 상업 사용·웹 임베딩 가능, 글꼴 파일 수정·판매 금지)
export const TEXT_FONTS = [
  { id: 'omiri', name: '그리운 오미리 손글씨', family: "'GeuriunOmiriHandwriting', 'Nanum Pen Script', cursive", weight: 400, size: 28 },
  { id: 'myoeun', name: '그리운 묘은흘림체', family: "'NostalgicMyoeunHeullim', 'Nanum Pen Script', cursive", weight: 400, size: 28 },
  { id: 'gangwon', name: '강원교육모두체', family: "'GangwonEducationModuche', 'Pretendard Variable', serif", weight: 700, size: 21 },
] as const;
export type TextFontId = (typeof TEXT_FONTS)[number]['id'];
export const fontOf = (id: TextFontId) => TEXT_FONTS.find((f) => f.id === id) ?? TEXT_FONTS[0];
export const TEXT_COLORS = [
  { v: '#2a2622', name: '검정' },
  { v: '#2f5fb3', name: '파랑' },
  { v: '#c93a2b', name: '빨강' },
  { v: '#2f8a57', name: '초록' },
] as const;
/** 글씨 테두리 색: 흰색이 기본, 'none'은 테두리 없음 (2026-11-20 사용자 요청) */
export const TEXT_STROKES = [
  { v: '#ffffff', name: '흰색' },
  ...TEXT_COLORS,
  { v: 'none', name: '없음' },
] as const;
export type TextAlign = 'left' | 'center' | 'right';
/** 글씨 스티커 꾸밈 (모두 없으면 예전 모양: 가운데·보통·흰 테두리) */
export type TextLook = { align?: TextAlign; bold?: boolean; italic?: boolean; underline?: boolean; stroke?: string };
export const TEXT_MAX = 30; // 글자 수 (이모지도 1자)
export const LINE_MAX = 50; // 한 줄: 영수증 메모와 같은 길이 (R4)
export const MAX_LINES = 3;
export const MEMO_MAX = 80; // 메모장 글자 수
export const LIST_ITEMS = 8; // 버킷·투두 항목 수
export const ITEM_MAX = 24; // 항목 하나 글자 수

export type ListKind = 'bucket' | 'todo';
/** days: 습관 도트 스타일에서 요일별(월~일) 체크 */
export type ListItem = { text: string; done: boolean; days?: boolean[] };
export const LIST_NAMES: Record<ListKind, string> = { bucket: '버킷리스트', todo: '투두리스트' };

/** 쓴 말 다듬기: 최대 글자 수, 3줄 */
export const clampText = (v: string, max: number, lines = MAX_LINES) => [...v.split('\n').slice(0, lines).join('\n')].slice(0, max).join('');

/* ───── 조각 ───── */
export type Piece =
  | { id: string; type: 'art'; art: ArtId }
  | ({ id: string; type: 'text'; text: string; font: TextFontId; color: string } & TextLook)
  | { id: string; type: 'line'; text: string; by: string }
  | { id: string; type: 'photo'; photoId: string; date: IsoDate }
  | { id: string; type: 'memo'; text: string; style: MemoStyle }
  /** year: 붙인 해 — 화면에 붙은 버킷리스트 제목을 '2026 버킷리스트'로 (2026-11-20) */
  | { id: string; type: 'list'; kind: ListKind; items: ListItem[]; style: ListStyle; year?: number }
  /** photos: 칸마다 사진 id (빈 칸은 null), date·dplus: 붙인 날 (네컷·폴라로이드·인화 사진 글씨) */
  | { id: string; type: 'frame'; style: FrameStyle; photos: (string | null)[]; date?: IsoDate; dplus?: number };
// Omit이 유니언을 무너뜨리지 않게 하나씩
export type PieceInput =
  | Omit<Extract<Piece, { type: 'art' }>, 'id'>
  | Omit<Extract<Piece, { type: 'text' }>, 'id'>
  | Omit<Extract<Piece, { type: 'line' }>, 'id'>
  | Omit<Extract<Piece, { type: 'photo' }>, 'id'>
  | Omit<Extract<Piece, { type: 'memo' }>, 'id'>
  | Omit<Extract<Piece, { type: 'list' }>, 'id'>
  | Omit<Extract<Piece, { type: 'frame' }>, 'id'>;

const piecesKey = (roomId: string) => `uriduri.diary.pieces.v1.${roomId}`;
const oldTextsKey = (roomId: string) => `uriduri.diary.texts.v1.${roomId}`;

const isStr = (v: unknown): v is string => typeof v === 'string';
function isPiece(v: unknown): v is Piece {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  if (!isStr(p.id)) return false;
  switch (p.type) {
    case 'art': return ARTS.some((a) => a.id === p.art);
    case 'text': return isStr(p.text) && isStr(p.color) && TEXT_FONTS.some((f) => f.id === p.font);
    case 'line': return isStr(p.text) && isStr(p.by);
    case 'photo': return isStr(p.photoId) && isStr(p.date);
    case 'memo': return isStr(p.text) && isOneOf(MEMO_STYLES, p.style);
    case 'list':
      return (p.kind === 'bucket' || p.kind === 'todo') && Array.isArray(p.items)
        && isOneOf(p.kind === 'bucket' ? BUCKET_STYLES : TODO_STYLES, p.style)
        && p.items.every((i: unknown) => !!i && typeof i === 'object' && isStr((i as ListItem).text) && typeof (i as ListItem).done === 'boolean');
    case 'frame': return isOneOf(FRAME_STYLES, p.style) && Array.isArray(p.photos) && p.photos.every((x: unknown) => x === null || isStr(x));
    default: return false;
  }
}

/** 스타일이 생기기 전에 붙인 위젯: 기본 스타일로 */
function upgrade(v: unknown): unknown {
  if (!v || typeof v !== 'object') return v;
  const p = v as Record<string, unknown>;
  if (p.type === 'memo' && !p.style) return { ...p, style: DEFAULT_STYLE.memo };
  if (p.type === 'list' && !p.style) return { ...p, style: p.kind === 'todo' ? DEFAULT_STYLE.todo : DEFAULT_STYLE.bucket };
  if (p.type === 'frame' && !Array.isArray(p.photos)) {
    const { photoId, ...rest } = p;
    return { ...rest, style: p.style ?? DEFAULT_STYLE.frame, photos: [isStr(photoId) ? photoId : null] };
  }
  return v;
}

/** 칸 수가 다른 스타일로 바꿀 때: 앞에서부터 옮겨 담고 남는 칸은 빈 칸 (넘치는 사진은 사진첩에 그대로) */
export function fitPhotos(photos: (string | null)[], style: FrameStyle): (string | null)[] {
  const n = frameStyleOf(style).cells;
  const kept = photos.filter((x): x is string => !!x).slice(0, n);
  return [...kept, ...Array(n - kept.length).fill(null)];
}

/** 저장된 조각. 처음이면 예전 글씨 스티커(texts.v1)를 옮겨 온다 */
export function loadPieces(roomId: string): Piece[] {
  try {
    const raw = localStorage.getItem(piecesKey(roomId));
    if (raw !== null) {
      const v: unknown = JSON.parse(raw);
      return Array.isArray(v) ? v.map(upgrade).filter(isPiece) : [];
    }
    const old: unknown = JSON.parse(localStorage.getItem(oldTextsKey(roomId)) ?? '[]');
    return Array.isArray(old) ? old.map((t) => ({ ...t, type: 'text' })).filter(isPiece) : [];
  } catch {
    return [];
  }
}
export function savePieces(roomId: string, pieces: Piece[]) {
  try {
    localStorage.setItem(piecesKey(roomId), JSON.stringify(pieces));
    localStorage.removeItem(oldTextsKey(roomId));
  } catch { /* 저장이 막힌 브라우저: 이번만 유지 */ }
}

export const newPieceId = (type: string) => `${type}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** 화면 읽기용 이름 */
export function pieceLabel(p: Piece): string {
  switch (p.type) {
    case 'art': return `스티커: ${artOf(p.art).name}`;
    case 'text': return `글씨 "${p.text}"`;
    case 'line': return `한 줄 "${p.text}"`;
    case 'photo': return `${p.date.slice(5).replace('-', '월 ')}일 사진`;
    case 'memo': return `메모장 "${p.text}"`;
    case 'list': return `${LIST_NAMES[p.kind]} (${p.items.filter((i) => i.done).length}/${p.items.length} 완료)`;
    case 'frame': {
      const n = p.photos.filter(Boolean).length;
      return `포토프레임 ${frameStyleOf(p.style).name} (사진 ${n}/${p.photos.length})`;
    }
  }
}
