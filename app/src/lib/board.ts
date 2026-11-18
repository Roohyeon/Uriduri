// 보드 규칙 (R5, D26, D36) — 순수 함수
import type { IsoDate } from './dates';

export type Sortable = { id: string; date: IsoDate; createdAt: number };

/** 영수증 날짜순(최근이 위). 날짜가 같으면 늦게 발행된 것이 위 (R5) */
export function sortReceipts<T extends Sortable>(list: T[]): T[] {
  return [...list].sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));
}

/** NEW: 상대가 쓴 영수증 중 내가 아직 누르지 않은 것 (D26) */
export function isNew(r: { authorId: string; id: string }, me: string, readIds: Set<string>): boolean {
  return r.authorId !== me && !readIds.has(r.id);
}

/** "새 영수증 N개" 띠가 이동할 곳: 정렬된 목록에서 가장 위의 NEW (R5) */
export function firstNewId<T extends Sortable & { authorId: string }>(sorted: T[], me: string, readIds: Set<string>): string | undefined {
  return sorted.find((r) => isNew(r, me, readIds))?.id;
}

/** 보드 위 자리: x = 보드 폭 대비 %, y = 위에서부터 px, rot = 기울기(도), z = 쌓인 순서 */
export type BoardPos = { x: number; y: number; rot: number; z?: number };

const TILTS = [-3, 2.5, -1.5, 3, -2.5, 1.5];

/** 옮기지 않은 영수증의 기본 자리: 날짜순(D22)으로 두 줄 엇갈려 붙인다 */
export function defaultPos(index: number): BoardPos {
  const col = index % 2;
  return { x: col ? 51 : 3, y: Math.floor(index / 2) * 340 + (col ? 70 : 24), rot: TILTS[index % TILTS.length] };
}
