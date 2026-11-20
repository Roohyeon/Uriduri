import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { MOOD_NAMES, photoBg, type Receipt } from '../data';
import { useToast } from '../components/ui';
import { addDays, dday, todayIso, type IsoDate } from '../lib/dates';
import { DecorBoard, lift, type DecorApi, type WidgetDef } from '../components/diary/DecorBoard';
import { LineComposer, ListComposer, StickerPicker, StylePicker, TextComposer, WidgetPicker, type WidgetKind } from '../components/diary/sheets';
import { CameraSheet } from '../components/diary/CameraSheet';
import { fitPhotos, type ListKind, type Piece } from '../components/diary/pieces';
import { frameStyleOf, type FrameStyle, type ListStyle, type MemoStyle } from '../components/diary/styles';
import { listPhotos, photoUrl, savePhoto, type DiaryPhoto } from '../services/diaryPhotos';
import type { BoardData, Nav, Session } from '../App';

/*
 * 홈 — 다이어리 (2026-11-19, planning/uriduri/sketches/diary-home-tidy.html), 주소 /
 * - 위젯: D+ / 최근 사진 / 최근 영수증 — 흰 테두리·그림자로 오려 붙인 느낌
 * - 아래 탭으로 붙이는 조각: 스티커(그림·글씨) · 카메라(찍은 사진 → 폴라로이드) · 위젯(버킷리스트·메모장·투두리스트·포토프레임)
 * - 모두 화면 어디든: 꾹 눌러(0.35초) 들고 옮기고, 톡 누르면 크기·기울기·앞으로/뒤로 도구 (components/diary/DecorBoard)
 * - 사진을 누르면 사진첩(/album)
 * - ← 밀 때마다 오른쪽에서 한 장씩: 홈 → 우리 달력 → 우리 책장. → 밀면 한 장 돌아온다
 * 실제 데이터: D+, 쪽수, 최근 영수증(사진·장소·날짜·기분·NEW), 달력(기록·기념일). 책장의 지난 권은 예시
 */

const FOOTER_TOAST = 'calc(var(--footer-h, 88px) + 24px + env(safe-area-inset-bottom))';
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

/** 아래 탭에서 연 창 */
type Open =
  | { kind: 'stickers' }
  | { kind: 'text'; editing?: Extract<Piece, { type: 'text' }> }
  | { kind: 'line'; editing?: Extract<Piece, { type: 'line' }> }
  | { kind: 'widgets' }
  /** 위젯 스타일 고르기. change: 편집 화면에서 이미 붙인 위젯의 스타일 바꾸기 */
  | { kind: 'style'; widget: WidgetKind; change?: Piece }
  | { kind: 'memo'; style: MemoStyle; editing?: Extract<Piece, { type: 'memo' }> }
  | { kind: 'list'; list: ListKind; style: ListStyle; editing?: Extract<Piece, { type: 'list' }> }
  /** frameId·cell: 포토프레임의 그 칸부터 빈 칸을 채운다 (count장까지) */
  | { kind: 'camera'; frameId?: string; cell?: number; count?: number; toWidget?: boolean }
  | null;

/** 사진 위젯에 보여 줄 다이어리 사진 (주소까지 읽어 온 것) */
type ShownPhoto = DiaryPhoto & { url: string };

export function DeskScreen({ session, board, nav }: { session: Session; board: BoardData; nav: Nav }) {
  const [toast, showToast] = useToast(5000, FOOTER_TOAST);
  const room = session.room!;
  const me = session.user!.id;
  const today = todayIso();
  const [, mm, dd] = today.split('-').map(Number);
  const d = dday(room.anniversary, today);

  const receipts = board.receipts;
  const latest = receipts[0];
  const newCount = receipts.filter((r) => r.isNew).length;
  // 쪽: 기록이 있는 날 하나가 한 쪽. 오늘은 기록이 없어도 지금 쓰는 쪽
  const pages = useMemo(() => new Set([...receipts.map((r) => r.date), today].filter((x) => x <= today)).size, [receipts, today]);
  // 한 줄 쓰기에서 골라 올 수 있는 최근 영수증 한 줄 (같은 말은 한 번만)
  const suggestions = useMemo(() => [...new Set(receipts.map((r) => r.memo.trim()).filter(Boolean))].slice(0, 5), [receipts]);

  const [panel, setPanel] = useState<Panel>(null);
  const decorApi = useRef<DecorApi | null>(null);
  const [open, setOpen] = useState<Open>(null);
  const close = useCallback(() => setOpen(null), []);
  const [addOpen, setAddOpen] = useState(false);

  // 카메라로 찍은 가장 최근 사진 — 사진 위젯 자리에 보인다
  const [shot, setShot] = useState<ShownPhoto | null>(null);
  const showShot = useCallback(async (p: DiaryPhoto) => {
    const url = await photoUrl(p.id).catch(() => undefined);
    if (url) setShot({ ...p, url });
  }, []);
  useEffect(() => {
    let alive = true;
    listPhotos(room.id)
      .then(async (ps) => {
        for (const p of ps) {
          const url = await photoUrl(p.id).catch(() => undefined);
          if (url) { if (alive) setShot({ ...p, url }); return; }
        }
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [room.id]);

  // 위젯: 꾹 눌러 들고 어디든 옮기고, 톡 누르면 도구 (사진은 톡 = 사진첩, 영수증은 톡 = 영수증 보기)
  const widgets: WidgetDef[] = [
    {
      id: 'dday',
      name: 'D-day',
      className: 'w-dday band',
      home: [0.27, 0.1],
      body: (
        <>
          <span className="band__dday" aria-hidden="true">D+{d}</span>
          <span className="band__heart" aria-hidden="true">♥</span>
        </>
      ),
    },
    {
      id: 'photo',
      name: '사진',
      className: 'w-photo',
      home: [0.36, 0.32],
      body: (
        <div className="w-slot">
          {shot && (!latest || shot.date >= latest.date) ? (
            // 영수증 사진보다 찍은 사진이 더 최근이면(같은 날 포함) 찍은 사진
            <ShotCard p={shot} onOpen={() => nav({ name: 'album' })} />
          ) : latest ? (
            <PhotoCard r={latest} newCount={newCount} onOpen={() => nav({ name: 'album' })} />
          ) : (
            <button type="button" className="photo-empty" onClick={() => setOpen({ kind: 'camera', toWidget: true })}>
              <CameraIcon size={28} />
              오늘 첫 사진 찍기
            </button>
          )}
        </div>
      ),
    },
    {
      id: 'receipt',
      name: '영수증',
      className: 'w-receipt',
      home: [0.76, 0.36],
      body: (
        <div className="w-slot">
          {latest ? (
            <MiniReceipt r={latest} onOpen={() => nav({ name: 'detail', id: latest.id })} />
          ) : (
            <button type="button" className="slot-empty" onClick={() => nav({ name: 'compose' })}>
              <ReceiptIcon />
              첫 영수증 쓰기
            </button>
          )}
        </div>
      ),
    },
  ];

  const editPiece = (p: Piece) => {
    if (p.type === 'text') setOpen({ kind: 'text', editing: p });
    else if (p.type === 'line') setOpen({ kind: 'line', editing: p });
    else if (p.type === 'memo') setOpen({ kind: 'memo', style: p.style, editing: p });
    else if (p.type === 'list') setOpen({ kind: 'list', list: p.kind, style: p.style, editing: p });
  };

  /** 포토프레임의 빈 칸 → 카메라 (그 칸부터 남은 빈 칸 수만큼 찍을 수 있다) */
  const fillFrame = (frameId: string, cell: number) => {
    const f = decorApi.current?.getPiece(frameId);
    if (!f || f.type !== 'frame') return;
    const count = Math.max(1, f.photos.slice(cell).filter((x) => !x).length);
    setOpen({ kind: 'camera', frameId, cell, count });
  };

  /** 스타일을 골랐을 때: 새로 붙이기(쓰기 창·카메라로) 또는 붙인 위젯의 스타일 바꾸기 */
  const pickStyle = (widget: WidgetKind, style: string, change?: Piece) => {
    const api = decorApi.current;
    if (!api) return;
    if (change) {
      if (change.type === 'frame') api.update(change.id, { style: style as FrameStyle, photos: fitPhotos(change.photos, style as FrameStyle) });
      else if (change.type === 'memo') api.update(change.id, { style: style as MemoStyle });
      else if (change.type === 'list') api.update(change.id, { style: style as ListStyle });
      close();
      return;
    }
    if (widget === 'memo') setOpen({ kind: 'memo', style: style as MemoStyle });
    else if (widget === 'frame') {
      // 빈 액자를 먼저 붙이고 바로 카메라 (닫아도 액자는 남고, 빈 칸을 누르면 다시 찍기)
      const cells = frameStyleOf(style).cells;
      const frameId = api.add({ type: 'frame', style: style as FrameStyle, photos: Array(cells).fill(null), date: today, dplus: d });
      setOpen({ kind: 'camera', frameId, cell: 0, count: cells });
    } else {
      // 버킷·투두: 고른 디자인을 바로 화면에 붙이고 골라 둔다. 한 번 더 누르면 그 자리에서 쓴다 (2026-11-20 사용자 요청)
      // 버킷리스트는 붙인 해를 제목에 ('2026 버킷리스트')
      const id = api.add({ type: 'list', kind: widget, items: [], style: style as ListStyle, ...(widget === 'bucket' ? { year: new Date().getFullYear() } : {}) });
      api.focus(id);
      close();
    }
  };

  return (
    <DecorBoard
      roomId={room.id}
      me={me}
      covered={panel !== null}
      ready={board.status !== 'loading'}
      widgets={widgets}
      api={decorApi}
      onEditPiece={editPiece}
      onOpenPhoto={() => nav({ name: 'album' })}
      onFillFrame={fillFrame}
      onChangeStyle={(p) => setOpen({ kind: 'style', widget: p.type === 'list' ? p.kind : (p.type as 'memo' | 'frame'), change: p })}
    >
      <header className="diary-header">
        <h1 tabIndex={-1} className="sr-only">
          {mm}월 {dd}일 다이어리, 사귄 지 {d}일
        </h1>
        <button type="button" className="icon-btn" aria-label="설정" onClick={() => nav({ name: 'settings' })}>
          <SettingsIcon />
        </button>
      </header>

      <SidePanels panel={panel} setPanel={setPanel}>
        {{
          calendar: (
            <MonthCalendar
              today={today}
              anniversary={room.anniversary}
              receipts={receipts}
              me={me}
              onOpen={(id) => nav({ name: 'detail', id })}
            />
          ),
          shelf: (
            <>
              <div className="bookshelf__shelf" role="img" aria-label="책장 예시: 2026 봄, 제주 여행, 300~400일, 지금 쓰는 중">
                <span className="book book--blue" aria-hidden="true">2026 봄</span>
                <span className="book book--pink" aria-hidden="true">제주 여행</span>
                <span className="book book--yellow" aria-hidden="true">300~400일</span>
                <span className="book book--current" aria-hidden="true">지금 쓰는 중</span>
              </div>
              <p className="bookshelf__count">
                지금 쓰는 권 · {pages}쪽 · 영수증 {receipts.length}장 <span className="sample-tag">지난 권은 예시</span>
              </p>
              <div className="shelf-links">
                <button type="button" className="shelf-link" onClick={() => nav({ name: 'album' })}>
                  사진첩 ›
                </button>
                <button type="button" className="shelf-link" onClick={() => nav({ name: 'list' })}>
                  영수증 보드 ›
                </button>
              </div>
            </>
          ),
        }}
      </SidePanels>

      <footer className="diary-footer">
        <nav aria-label="붙이기 도구">
          <ul className="icon-nav">
            <li>
              <button type="button" className="icon-nav__btn" aria-label="스티커 붙이기" title="스티커" onClick={() => setOpen({ kind: 'stickers' })}>
                <StickerIcon />
              </button>
            </li>
            <li>
              <AddMenu
                open={addOpen}
                setOpen={setAddOpen}
                items={[
                  { key: 'camera', label: '사진', icon: <CameraIcon size={24} />, run: () => setOpen({ kind: 'camera' }) },
                ]}
              />
            </li>
            <li>
              <button type="button" className="icon-nav__btn" aria-label="위젯 붙이기" title="위젯" onClick={() => setOpen({ kind: 'widgets' })}>
                <WidgetIcon />
              </button>
            </li>
          </ul>
        </nav>
      </footer>

      {open?.kind === 'stickers' && (
        <StickerPicker
          onClose={close}
          hiddenWidgets={widgets.filter((w) => decorApi.current?.hiddenWidgets().includes(w.id))}
          onRestore={(id) => { decorApi.current?.showWidget(id); close(); }}
          onPick={(art) => { decorApi.current?.add({ type: 'art', art }); close(); }}
          onWrite={() => setOpen({ kind: 'text' })}
        />
      )}
      {open?.kind === 'text' && (
        <TextComposer
          initial={open.editing}
          onClose={close}
          onDone={(t) => {
            if (open.editing) decorApi.current?.update(open.editing.id, t);
            else decorApi.current?.add({ type: 'text', ...t });
            close();
          }}
        />
      )}
      {open?.kind === 'line' && (
        <LineComposer
          initial={open.editing?.text}
          suggestions={suggestions}
          onClose={close}
          onDone={(text) => {
            if (open.editing) decorApi.current?.update(open.editing.id, { text });
            else decorApi.current?.add({ type: 'line', text, by: me });
            close();
          }}
        />
      )}
      {open?.kind === 'widgets' && (
        <WidgetPicker
          onClose={close}
          onPick={(k) => {
            if (k !== 'receipt') { setOpen({ kind: 'style', widget: k }); return; }
            // 영수증 위젯은 하나: 떼어 두었으면 다시 붙이고, 이미 있으면 알려 준다
            close();
            if (decorApi.current?.hiddenWidgets().includes('receipt')) {
              decorApi.current.showWidget('receipt');
              showToast('영수증 위젯을 붙였어요.');
            } else showToast('영수증 위젯은 이미 붙어 있어요.');
          }}
        />
      )}
      {open?.kind === 'style' && (
        <StylePicker
          kind={open.widget}
          current={open.change && 'style' in open.change ? (open.change.style as string) : undefined}
          onClose={close}
          onBack={open.change ? undefined : () => setOpen({ kind: 'widgets' })}
          onPick={(st) => pickStyle(open.widget, st, open.change)}
        />
      )}
      {open?.kind === 'memo' && (
        <LineComposer
          memo
          initial={open.editing?.text}
          suggestions={suggestions}
          onClose={close}
          onDone={(text) => {
            if (open.editing) decorApi.current?.update(open.editing.id, { text });
            else decorApi.current?.add({ type: 'memo', text, style: open.style });
            close();
          }}
        />
      )}
      {open?.kind === 'list' && (
        <ListComposer
          kind={open.list}
          style={open.style}
          initial={open.editing?.items}
          onClose={close}
          onBack={open.editing ? undefined : () => setOpen({ kind: 'style', widget: open.list })}
          onDone={(items) => {
            if (open.editing) decorApi.current?.update(open.editing.id, { items });
            else decorApi.current?.add({ type: 'list', kind: open.list, items, style: open.style });
            close();
          }}
        />
      )}
      {open?.kind === 'camera' && (
        <CameraSheet
          count={open.count ?? 1}
          onClose={close}
          onDone={async (shots) => {
            const saved = [];
            for (const sh of shots) saved.push(await savePhoto(room.id, sh.blob, sh.w, sh.h));
            const f = open.frameId ? decorApi.current?.getPiece(open.frameId) : undefined;
            if (f && f.type === 'frame') {
              // 고른 칸부터 빈 칸을 차례로 채운다
              const photos = [...f.photos];
              let k = 0;
              for (let i = open.cell ?? 0; i < photos.length && k < saved.length; i++) if (!photos[i]) photos[i] = saved[k++].id;
              decorApi.current?.update(f.id, { photos });
              showToast(`액자에 사진 ${k}장을 넣었어요.`);
            } else if (open.toWidget) {
              // 사진 위젯의 빈 자리에서 찍었으면 그 자리에 바로 보인다
              showToast('사진을 넣었어요. 사진을 누르면 사진첩에서 볼 수 있어요.');
            } else {
              decorApi.current?.add({ type: 'photo', photoId: saved[0].id, date: saved[0].date });
              showToast('사진을 붙였어요. 사진을 누르면 사진첩에서 볼 수 있어요.');
            }
            if (saved.length) await showShot(saved[saved.length - 1]);
            close();
          }}
        />
      )}
      {toast}
    </DecorBoard>
  );
}

const shortDate = (iso: IsoDate) => {
  const [, m, d] = iso.split('-').map(Number);
  return `${m}.${d}`;
};

/* ───────────────── 사진·영수증 위젯 ───────────────── */

function PhotoCard({ r, newCount, onOpen }: { r: Receipt; newCount: number; onOpen: () => void }) {
  return (
    <button type="button" className="photo-card" onClick={onOpen} aria-label={`최근 사진, 사진첩에서 보기: ${r.photo.label}`}>
      {newCount > 0 && <span className="photo-card__new">NEW {newCount}</span>}
      <span className="photo-card__frame">
        <span className="photo-card__img" style={{ background: r.photo.src ? photoBg(r.photo) : undefined }} />
      </span>
      <span className="photo-card__cap" aria-hidden="true">{r.place || (r.mood ? MOOD_NAMES[r.mood] : shortDate(r.date))}</span>
    </button>
  );
}

function ShotCard({ p, onOpen }: { p: ShownPhoto; onOpen: () => void }) {
  return (
    <button type="button" className="photo-card" onClick={onOpen} aria-label={`최근 사진 ${shortDate(p.date)}, 사진첩에서 보기`}>
      <span className="photo-card__frame">
        <span className="photo-card__img" style={{ background: `center / cover no-repeat url("${p.url}")` }} />
      </span>
      <span className="photo-card__cap" aria-hidden="true">{shortDate(p.date)}</span>
    </button>
  );
}

function MiniReceipt({ r, onOpen }: { r: Receipt; onOpen: () => void }) {
  const [y, m, d] = r.date.split('-');
  return (
    <button type="button" className="receipt" onClick={onOpen} aria-label={`영수증 No.${r.no} 열기`}>
      <span className="receipt__paper" aria-hidden="true">
        <span className="receipt__title">[ 영수증 ]</span>
        <span className="receipt__rule" />
        <span>{r.place || '우리 둘'}</span>
        <span>{y}.{m}.{d}</span>
        <span className="receipt__row" style={{ marginTop: 3 }}><span>No.</span><span>{r.no}</span></span>
        <span className="receipt__row"><span>쓴 사람</span><span>{r.author}</span></span>
        {r.mood && <span className="receipt__row"><span>기분</span><span>{MOOD_NAMES[r.mood]}</span></span>}
        <span className="receipt__rule" />
        <span className="receipt__row receipt__total"><span>TOTAL</span><span>{r.dplus >= 1 ? `D+${r.dplus}` : `D-${1 - r.dplus}`}</span></span>
      </span>
    </button>
  );
}

/* ───────────────── 가운데 + : 둥글게 펼쳐지는 메뉴 ───────────────── */

type AddItem = { key: string; label: string; icon: ReactNode; run: () => void };

function AddMenu({ open, setOpen, items }: { open: boolean; setOpen: (v: boolean) => void; items: AddItem[] }) {
  const btn = useRef<HTMLButtonElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  const wrap = useRef<HTMLDivElement>(null);

  // 열리면 첫 메뉴로 초점. Esc·바깥을 누르면 닫는다
  useEffect(() => {
    if (!open) return;
    first.current?.focus({ preventScroll: true });
    const key = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); btn.current?.focus(); }
    };
    const down = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('keydown', key, true);
    document.addEventListener('pointerdown', down);
    return () => { document.removeEventListener('keydown', key, true); document.removeEventListener('pointerdown', down); };
  }, [open, setOpen]);

  // + 위쪽 부채꼴에 고르게: 왼쪽 위 → 위 → 오른쪽 위
  const spread = 110;
  const angle = (i: number) => (items.length === 1 ? -90 : -90 - spread / 2 + (spread * i) / (items.length - 1));

  return (
    <div ref={wrap} className={`radial ${open ? 'is-open' : ''}`}>
      <ul id="add-menu" className="radial__menu" role="menu" aria-label="붙이기">
        {items.map((it, i) => (
          <li key={it.key} role="none" style={{ '--a': `${angle(i)}deg`, '--i': i } as CSSProperties}>
            <button
              ref={i === 0 ? first : undefined}
              type="button"
              role="menuitem"
              className="radial__item"
              tabIndex={open ? 0 : -1}
              aria-hidden={!open}
              onClick={() => { setOpen(false); it.run(); }}
            >
              <span className="radial__icon">{it.icon}</span>
              <span className="radial__label">{it.label}</span>
            </button>
          </li>
        ))}
      </ul>
      <button
        ref={btn}
        type="button"
        className="icon-nav__btn icon-nav__btn--camera radial__toggle"
        aria-label={open ? '붙이기 메뉴 닫기' : '붙이기 메뉴 열기'}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="add-menu"
        onClick={() => setOpen(!open)}
      >
        <PlusIcon />
      </button>
    </div>
  );
}

/* ───────────────── 옆 화면: 홈 → 달력 → 책장 (모두 오른쪽에서) ───────────────── */

type Panel = 'calendar' | 'shelf' | null;
// 왼쪽으로 밀 때마다 한 장씩 넘어가고, 오른쪽으로 밀면 한 장 돌아온다
const ORDER: Panel[] = [null, 'calendar', 'shelf'];
const step = (cur: Panel, by: number): Panel => ORDER[Math.max(0, Math.min(ORDER.length - 1, ORDER.indexOf(cur) + by))];

function SidePanels({ panel, setPanel, children }: { panel: Panel; setPanel: (p: Panel) => void; children: { calendar: ReactNode; shelf: ReactNode } }) {
  const closeRefs = { calendar: useRef<HTMLButtonElement>(null), shelf: useRef<HTMLButtonElement>(null) };
  const tabRefs = { calendar: useRef<HTMLButtonElement>(null), shelf: useRef<HTMLButtonElement>(null) };
  const panelRef = useRef(panel);
  const prev = useRef<Panel>(null);

  // 앞으로 가면 새 화면의 돌아가기 버튼으로, 돌아오면 넘어갈 때 누른 손잡이로 초점
  useEffect(() => {
    panelRef.current = panel;
    const back = ORDER.indexOf(panel) < ORDER.indexOf(prev.current);
    if (back && prev.current) tabRefs[prev.current].current?.focus({ preventScroll: true });
    else if (panel) closeRefs[panel].current?.focus({ preventScroll: true });
    prev.current = panel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel]);

  // ← 밀면 다음 장(홈 → 달력 → 책장), → 밀면 이전 장. Esc도 한 장 돌아간다
  useEffect(() => {
    let swipe: { id: number; x: number; y: number } | null = null;
    const down = (e: PointerEvent) => {
      if ((e.target as Element).closest?.('.decor-tools, .icon-nav, .mcal__day, [role="dialog"]')) return;
      swipe = { id: e.pointerId, x: e.clientX, y: e.clientY };
    };
    const up = (e: PointerEvent) => {
      if (!swipe || e.pointerId !== swipe.id) return;
      const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
      swipe = null;
      if (lift.on) return;
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      const next = step(panelRef.current, dx < 0 ? 1 : -1);
      if (next !== panelRef.current) setPanel(next);
    };
    const cancel = () => { swipe = null; };
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape' && panelRef.current) setPanel(step(panelRef.current, -1)); };
    document.addEventListener('pointerdown', down);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', cancel);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', cancel);
      document.removeEventListener('keydown', esc);
    };
  }, [setPanel]);

  const pages = [
    // tabOn: 손잡이가 보이는 때, back: 돌아가기 버튼
    { key: 'calendar' as const, tab: '달력', title: '우리 달력', tabOn: panel === null, back: { label: '‹ 다이어리', to: null as Panel } },
    { key: 'shelf' as const, tab: '책장', title: '우리 책장', tabOn: panel === 'calendar', back: { label: '‹ 달력', to: 'calendar' as Panel } },
  ];
  const at = ORDER.indexOf(panel);
  return (
    <>
      {pages.map((s) => (
        <div key={s.key}>
          <button
            ref={tabRefs[s.key]}
            type="button"
            className={`side-tab side-tab--right ${s.key === 'shelf' ? 'side-tab--over' : ''}`}
            aria-controls={`${s.key}-panel`}
            aria-expanded={panel === s.key}
            hidden={!s.tabOn}
            onClick={() => setPanel(s.key)}
          >
            {s.tab}
          </button>
          <aside
            id={`${s.key}-panel`}
            // 책장이 열려도 달력은 밑에 깔려 있어서, 돌아오면 달력이 보인다
            className={`side-panel side-panel--right ${at >= ORDER.indexOf(s.key) ? 'is-open' : ''}`}
            aria-labelledby={`${s.key}-title`}
          >
            <div className="side-panel__head">
              <h2 id={`${s.key}-title`} className="section-title">{s.title}</h2>
              <button ref={closeRefs[s.key]} type="button" className="side-close" aria-label={`${s.back.to ? '달력으로' : '다이어리로'} 돌아가기`} onClick={() => setPanel(s.back.to)}>
                {s.back.label}
              </button>
            </div>
            {children[s.key]}
          </aside>
        </div>
      ))}
    </>
  );
}

/** 우리 달력 — 오늘 동그라미, 기록한 날은 사진 조각(상대 기록은 하늘색), 100일 단위·해마다 기념일은 하트 */
function MonthCalendar({ today, anniversary, receipts, me, onOpen }: { today: IsoDate; anniversary: IsoDate; receipts: Receipt[]; me: string; onOpen: (id: string) => void }) {
  const [offset, setOffset] = useState(0);
  const [ty, tm] = today.split('-').map(Number);
  const first = new Date(Date.UTC(ty, tm - 1 + offset, 1));
  const y = first.getUTCFullYear(), m = first.getUTCMonth() + 1;
  const lead = first.getUTCDay();
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const byDate = useMemo(() => {
    const map = new Map<IsoDate, Receipt[]>();
    // 날짜마다 가장 먼저 붙인 영수증이 대표 (목록은 최신순)
    for (const r of [...receipts].reverse()) map.set(r.date, [...(map.get(r.date) ?? []), r]);
    return map;
  }, [receipts]);
  const [, am, ad] = anniversary.split('-').map(Number);
  const firstIso = `${y}-${String(m).padStart(2, '0')}-01`;

  const cells: ReactNode[] = [];
  for (let i = 0; i < lead; i++) cells.push(<span key={`l${i}`} className="mcal__day mcal__day--empty" aria-hidden="true" />);
  for (let day = 1; day <= days; day++) {
    const iso = addDays(firstIso, day - 1);
    const n = dday(anniversary, iso);
    const anniv = n > 1 && (n % 100 === 0 || (m === am && day === ad));
    const recs = byDate.get(iso);
    const isToday = iso === today;
    const parts = [`${m}월 ${day}일`, isToday && '오늘', recs && `기록 ${recs.length}개`, anniv && (n % 100 === 0 ? `${n}일 기념일` : '기념일')].filter(Boolean).join(' · ');
    const cls = `mcal__day ${isToday ? 'mcal__day--today' : ''} ${anniv ? 'mcal__day--anniv' : ''}`;
    const inner = (
      <>
        <span className="mcal__num" aria-hidden="true">{day}</span>
        {recs && (
          <span
            aria-hidden="true"
            className={`mcal__thumb ${recs[0].authorId === me ? '' : 'mcal__thumb--partner'}`}
            style={recs[0].photo.src ? { backgroundImage: `url("${recs[0].photo.src}")` } : undefined}
          />
        )}
        {anniv && <i className="mcal__heart" aria-hidden="true">♥</i>}
      </>
    );
    cells.push(
      recs ? (
        <button key={iso} type="button" className={cls} aria-label={`${parts}, 열기`} aria-current={isToday ? 'date' : undefined} onClick={() => onOpen(recs[recs.length - 1].id)}>
          {inner}
        </button>
      ) : (
        <span key={iso} role="img" className={cls} aria-label={parts} aria-current={isToday ? 'date' : undefined}>
          {inner}
        </span>
      ),
    );
  }

  return (
    <section className="mcal" aria-labelledby="month-title">
      <div className="mcal__band">
        <button type="button" className="mcal__nav" aria-label="지난달" onClick={() => setOffset((o) => o - 1)}>‹</button>
        <h3 id="month-title" className="mcal__title" aria-live="polite">
          <span className="mcal__month">{m}월</span> <span className="mcal__year">{y}</span>
        </h3>
        <button type="button" className="mcal__nav" aria-label="다음달" onClick={() => setOffset((o) => o + 1)}>›</button>
      </div>
      <div className="mcal__body">
        <div className="mcal__weekdays" aria-hidden="true">
          {WEEK.map((w, i) => <span key={w} className={i === 0 ? 'sun' : i === 6 ? 'sat' : ''}>{w}</span>)}
        </div>
        <div className="mcal__grid">{cells}</div>
        <p className="mcal__legend" aria-hidden="true">
          <span><span className="mcal__thumb mcal__thumb--legend" />내 기록</span>
          <span><span className="mcal__thumb mcal__thumb--legend mcal__thumb--partner" />상대 기록</span>
          <span><i className="mcal__heart">♥</i>기념일</span>
        </p>
      </div>
    </section>
  );
}

/* ───────────────── 아이콘 ───────────────── */

function SettingsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function StickerIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-9-9" /><path d="M12 3v5a4 4 0 0 0 4 4h5z" fill="#f6e39b" />
      <circle cx="7.6" cy="12.6" r="1" fill="currentColor" stroke="none" /><circle cx="10.8" cy="12.6" r="1" fill="currentColor" stroke="none" />
      <path d="M7 16.2c1.3 1.4 3.4 1.4 4.6 0" />
    </svg>
  );
}

function CameraIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 8h3l1.6-2.4h6.8L17 8h3v11H4z" /><circle cx="12" cy="13.2" r="3.4" /><path d="M17.6 10.6h.01" />
    </svg>
  );
}

/** 영수증: 아래가 톱니처럼 뜯긴 종이 */
function ReceiptIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21z" /><path d="M9 8h6M9 11.5h6M9 15h3.5" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/** 위젯: 둥근 네모 넷 (휴대폰 홈 화면 위젯 모양) */
function WidgetIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="2.2" fill="#f6e39b" />
      <rect x="13" y="3.5" width="7.5" height="7.5" rx="2.2" />
      <rect x="3.5" y="13" width="7.5" height="7.5" rx="2.2" />
      <rect x="13" y="13" width="7.5" height="7.5" rx="3.75" fill="#f7b3c8" />
    </svg>
  );
}
