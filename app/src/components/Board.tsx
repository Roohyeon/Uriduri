import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { hashId, photoBg, showDate, type Receipt } from '../data';
import { Clip, Stamp } from './Receipt';
import { MoodFace } from './MoodFace';

import { defaultPos, type BoardPos } from '../lib/board';
export { defaultPos, type BoardPos };
export type BoardLayout = Record<string, BoardPos>;

const CARD_W = 46; // 카드 폭(보드 폭 대비 %)
const CARD_H = 300; // 카드 대략 높이(px) — 보드 높이 계산용
const LONG_PRESS_MS = 450;


function BoardCard({ r }: { r: Receipt }) {
  return (
    <div className="relative">
      <Clip id={hashId(r.id)} className="!-top-5 !h-10 !w-14" />
      {r.isNew && <span className="absolute top-3 right-2 z-20 rounded-sm bg-seal px-1.5 text-xs font-bold text-paper">NEW</span>}
      <div className="bg-paper px-3 pt-5 pb-3">
        <p className="font-receipt text-xs">{showDate(r.date)}</p>
        <div
          role="img"
          aria-label={r.photo.label}
          className="relative mt-2 grid aspect-square w-full place-items-center border-[5px] border-frame text-lg shadow-[0_1px_3px_rgb(31_32_35/0.25)]"
          style={{ background: photoBg(r.photo) }}
        >
          {!r.photo.src && <span aria-hidden="true">{r.photo.emoji}</span>}
          {r.stamps.map((s) => (
            <span key={s.by} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${Math.min(s.x, 78)}%`, top: `${Math.min(s.y + 20, 80)}%` }}>
              <Stamp mark={s} size={50} />
            </span>
          ))}
        </div>
        <p className="mt-2 line-clamp-2 text-sm leading-snug font-semibold">“{r.memo}”</p>
        <p className="mt-1 flex items-center gap-1 text-xs text-fade">{r.author} {r.mood && <MoodFace mood={r.mood} size={14} />}</p>
      </div>
      <div className="tear-bottom" />
    </div>
  );
}

/**
 * 메인 화이트보드 (D36): 영수증을 집게로 붙여 두고,
 * - 짧게 누르면 상세 보기
 * - 꾹 누르면(0.45초) 들어 올려 원하는 곳으로 옮김
 * - 키보드: 카드에 초점을 두고 화살표로 옮김(Shift+화살표는 크게), Enter로 열기
 */
export function Board({
  items,
  layout,
  onMove,
  onOpen,
  dropId,
}: {
  items: Receipt[];
  layout: BoardLayout;
  onMove: (id: string, pos: BoardPos, done: boolean) => void;
  onOpen: (r: Receipt) => void;
  dropId?: string;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number>();
  const press = useRef<{ id: string; sx: number; sy: number; offX: number; offY: number; moved: boolean } | null>(null);
  const [dragId, setDragId] = useState<string>();
  // 끌어 옮긴 직후에 따라오는 click은 무시한다 (옮기기가 열기로 오인되지 않게)
  const justDragged = useRef(false);
  // 나중에 만진 카드가 위로. 저장된 z 순서로 시작 (두 사람이 함께 쓰는 배치, 임시 Q23)
  const [order, setOrder] = useState<string[]>(() => [...items].sort((a, b) => (layout[a.id]?.z ?? 0) - (layout[b.id]?.z ?? 0)).map((r) => r.id));
  useEffect(() => { setOrder((o) => [...o.filter((id) => items.some((r) => r.id === id)), ...items.map((r) => r.id).filter((id) => !o.includes(id))]); }, [items]);

  const pos = (r: Receipt, i: number) => layout[r.id] ?? defaultPos(i);
  const height = Math.max(560, ...items.map((r, i) => pos(r, i).y + CARD_H + 40));

  // 끄는 동안에는 화면 스크롤을 막는다
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const block = (e: TouchEvent) => { if (dragId !== undefined) e.preventDefault(); };
    el.addEventListener('touchmove', block, { passive: false });
    return () => el.removeEventListener('touchmove', block);
  }, [dragId]);

  const bringToFront = (id: string) => setOrder((o) => [...o.filter((x) => x !== id), id]);

  const onDown = (e: PointerEvent<HTMLButtonElement>, r: Receipt, i: number) => {
    const rect = boardRef.current!.getBoundingClientRect();
    const p = pos(r, i);
    press.current = {
      id: r.id, sx: e.clientX, sy: e.clientY, moved: false,
      offX: e.clientX - rect.left - (p.x / 100) * rect.width,
      offY: e.clientY - rect.top - p.y,
    };
    const target = e.currentTarget;
    const pid = e.pointerId;
    timer.current = window.setTimeout(() => {
      setDragId(r.id);
      bringToFront(r.id);
      target.setPointerCapture?.(pid);
      navigator.vibrate?.(12);
    }, LONG_PRESS_MS);
  };

  const onMovePtr = (e: PointerEvent<HTMLButtonElement>, r: Receipt, i: number) => {
    const p0 = press.current;
    if (!p0 || p0.id !== r.id) return;
    if (dragId === undefined) {
      if (Math.hypot(e.clientX - p0.sx, e.clientY - p0.sy) > 8) { window.clearTimeout(timer.current); press.current = null; } // 스크롤로 판단
      return;
    }
    p0.moved = true;
    const rect = boardRef.current!.getBoundingClientRect();
    const x = Math.max(0, Math.min(100 - CARD_W, ((e.clientX - rect.left - p0.offX) / rect.width) * 100));
    const y = Math.max(0, e.clientY - rect.top - p0.offY);
    onMove(r.id, { x, y, rot: 0 }, false);
    void i;
  };

  const onUp = (r: Receipt, i: number) => {
    window.clearTimeout(timer.current);
    const p0 = press.current;
    press.current = null;
    void p0;
    if (dragId !== undefined) {
      const p = pos(r, i);
      onMove(r.id, { ...p, rot: Math.round(Math.random() * 8 - 4) }, true);
      setDragId(undefined);
      justDragged.current = true;
    }
  };
  // 열기는 click 하나로 처리 — 짧게 누르기, Enter, Space, 화면 읽기 프로그램 모두 같은 길 [03-2.1.1, 04 Board:163]
  const onClickCard = (r: Receipt) => {
    if (justDragged.current) { justDragged.current = false; return; }
    onOpen(r);
  };

  const onKey = (e: KeyboardEvent, r: Receipt, i: number) => {
    const step = e.shiftKey ? 40 : 10;
    const p = pos(r, i);
    const moves: Record<string, BoardPos> = {
      ArrowLeft: { ...p, x: Math.max(0, p.x - step / 4) },
      ArrowRight: { ...p, x: Math.min(100 - CARD_W, p.x + step / 4) },
      ArrowUp: { ...p, y: Math.max(0, p.y - step) },
      ArrowDown: { ...p, y: p.y + step },
    };
    if (moves[e.key]) { e.preventDefault(); bringToFront(r.id); onMove(r.id, moves[e.key], true); }
  };

  return (
    // 화이트보드는 홈 전체 배경(.board-page)이라, 여기서는 영수증을 붙일 자리만 잡는다 (사용자 요청 2026-11-17)
    <div>
      <div ref={boardRef} className="relative" style={{ height }}>
        {items.map((r, i) => {
          const p = pos(r, i);
          const dragging = dragId === r.id;
          const z = order.indexOf(r.id) + 1;
          return (
            <button
              key={r.id}
              id={`r-${r.id}`}
              type="button"
              aria-label={`${showDate(r.date)} ${r.author}의 영수증${r.isNew ? ', 새 영수증' : ''}. 누르면 열고, 꾹 누르거나 화살표 키로 옮겨요`}
              onPointerDown={(e) => onDown(e, r, i)}
              onPointerMove={(e) => onMovePtr(e, r, i)}
              onPointerUp={() => onUp(r, i)}
              onPointerCancel={() => { window.clearTimeout(timer.current); press.current = null; setDragId(undefined); }}
              onKeyDown={(e) => onKey(e, r, i)}
              onClick={() => onClickCard(r)}
              onContextMenu={(e) => e.preventDefault()}
              className={`absolute block text-left select-none [-webkit-touch-callout:none] ${dropId === r.id ? 'anim-drop' : ''} ${dragging ? 'cursor-grabbing' : 'cursor-pointer'}`}
              style={{
                left: `${p.x}%`,
                top: p.y,
                width: `${CARD_W}%`,
                zIndex: dragging ? 100 : z,
                transform: `rotate(${p.rot}deg) scale(${dragging ? 1.06 : 1})`,
                transition: dragging ? 'transform 120ms' : 'transform 260ms ease-out, top 0ms, left 0ms',
                filter: dragging
                  ? 'drop-shadow(0 18px 18px rgb(31 32 35 / 0.3))'
                  : 'drop-shadow(0 4px 5px rgb(31 32 35 / 0.18))',
              }}
            >
              <BoardCard r={r} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
