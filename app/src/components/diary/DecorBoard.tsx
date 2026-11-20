import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type MutableRefObject, type PointerEvent as ReactPointerEvent, type ReactNode, type WheelEvent } from 'react';
import { photoUrl } from '../../services/diaryPhotos';
import { ArtBody, ITEM_MAX, LIST_ITEMS, artOf, fontOf, loadPieces, newPieceId, pieceLabel, savePieces, type ListItem, type Piece, type PieceInput } from './pieces';
import { FrameCard, ListCard, MemoCard } from './widgets';

/*
 * 홈 다이어리 판: 위젯(D-day·사진·영수증)과 붙인 조각(스티커·글씨·한 줄·사진)을 화면 어디든 놓고 겹쳐 꾸민다
 *
 * 보통 때: 톡 = 원래 동작(영수증 열기, 사진 → 사진첩). 아무것도 움직이지 않는다
 * 꾹 누르면(0.35초) 편집 화면:
 *   - 위: ✕(이번 편집 모두 취소) · 되돌리기 / 다시 하기 · 완료(저장)
 *   - 톡 = 고르기, 고른 채로 바로 끌어 옮기기 (꾹 누를 필요 없음). 편집 중에는 아무것도 열리지 않는다
 *   - 고른 것 테두리: 왼쪽 위 휴지통 · 오른쪽 위 잠금 · 왼쪽 아래 좌우 반전 · 오른쪽 아래 크기
 *   - 회전: 두 손가락으로 돌리기(크기도 함께). 컴퓨터에서는 마우스 휠
 *   - 앞뒤 순서: 화면 왼쪽 가운데 ≡ 손잡이를 위(앞)·아래(뒤)로 끌기
 *   - 키보드: 방향키 옮기기, +/− 크기, [ ] 회전, Delete 지우기
 * 자리·크기·회전·반전·잠금·쌓는 순서·숨긴 위젯은 이 브라우저에 저장 (위치는 화면 크기에 대한 비율)
 */

/** 편집 중이면 옆으로 밀기(달력·책장)를 쉰다 */
export const lift = { on: false };

export type WidgetDef = { id: string; name: string; className: string; home: [number, number]; body: ReactNode };
export type DecorApi = {
  /** 붙이고 새 조각 id를 돌려준다 */
  add: (p: PieceInput) => string;
  update: (id: string, patch: Partial<PieceInput>) => void;
  showWidget: (id: string) => void;
  hiddenWidgets: () => string[];
  getPiece: (id: string) => Piece | undefined;
  /** 편집 화면으로 들어가 이 조각을 고른다 (새로 붙인 리스트: 한 번 더 누르면 바로 쓰기) */
  focus: (id: string) => void;
};

type Item = { id: string; widget?: WidgetDef; piece?: Piece; home: [number, number]; tilt: number; label: string; cls: string };
type Placed = { x: number; y: number; scale: number; tilt: number; flip: boolean; lock: boolean };
type Doc = { placed: Record<string, Placed>; order: string[]; pieces: Piece[]; hidden: string[] };
type Saved = Record<string, { fx: number; fy: number; scale: number; tilt: number; flip?: boolean; lock?: boolean }>;

const HOLD_MS = 350; // 꾹 누르기
const DOUBLE_TAP_MS = 350; // 이 안에 두 번 누르면 더블클릭
const SLOP = 8;// 이만큼 먼저 움직이면 누르기가 아니라 스와이프·끌기
const KEY_STEP = 6;
const MIN_SCALE = 0.3;
const MAX_SCALE = 3;

const storeKey = (roomId: string) => `uriduri.diary.decor.v2.${roomId}`;
const orderKey = (roomId: string) => `uriduri.diary.order.v1.${roomId}`;
const hiddenKey = (roomId: string) => `uriduri.diary.hidden.v1.${roomId}`;
function loadJson<T>(key: string, fallback: T, ok: (v: unknown) => boolean): T {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    return ok(v) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}
const writeJson = (key: string, v: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* 저장이 막힌 브라우저: 이번만 유지 */ }
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** 크기(scale 적용)까지 넣어 조각 전체가 [0,W]×[0,H] 안에 있게. 화면보다 크면 가운데 */
const fitBox = (x: number, y: number, w: number, h: number, scale: number, W: number, H: number) => {
  const sw = w * scale, sh = h * scale;
  const cx = sw >= W ? W / 2 : clamp(x + w / 2, sw / 2, W - sw / 2);
  const cy = sh >= H ? H / 2 : clamp(y + h / 2, sh / 2, H - sh / 2);
  return { x: cx - w / 2, y: cy - h / 2 };
};
/** 0°·90°… 바로 근처(1° 안)일 때만 반듯하게, 나머지는 0.1° 단위 그대로 */
const snapTilt = (t: number) => {
  const n = Math.round(t / 90) * 90;
  return Math.abs(t - n) < 1 ? n : Math.round(t * 10) / 10;
};
/** 화면에 보여 줄 각도: -180° ~ 180° */
const showDeg = (t: number) => {
  const a = ((((t + 180) % 360) + 360) % 360) - 180;
  return `${Math.round(a * 10) / 10}°`;
};

function pieceItem(p: Piece): Item {
  const base = { id: p.id, piece: p, home: [0.5, 0.53] as [number, number], label: pieceLabel(p) };
  switch (p.type) {
    case 'art': { const a = artOf(p.art); return { ...base, tilt: a.tilt, cls: a.cls }; }
    case 'text': return { ...base, tilt: 0, cls: 'decor--text' };
    case 'line': return { ...base, tilt: 0, cls: 'decor--line' };
    case 'photo': return { ...base, tilt: 0, cls: 'decor--photo' };
    case 'memo': return { ...base, tilt: -2, cls: 'decor--card' };
    case 'list': return { ...base, tilt: 0, cls: 'decor--card' };
    case 'frame': return { ...base, tilt: 0, cls: 'decor--card' };
  }
}

type Gesture =
  | { kind: 'press'; id: string; pid: number; sx: number; sy: number; lx: number; ly: number; timer: number; el: HTMLElement }
  | { kind: 'move'; id: string; pid: number; sx: number; sy: number; ox: number; oy: number; moved: boolean; wasSelected: boolean }
  | { kind: 'resize'; id: string; pid: number; cx: number; cy: number; d0: number; s0: number }
  | { kind: 'rotate'; id: string; pid: number; cx: number; cy: number; a0: number; t0: number }
  | { kind: 'pinch'; id: string; d0: number; a0: number; s0: number; t0: number };

export function DecorBoard({ roomId, me, covered, ready, widgets, api, onEditPiece, onOpenPhoto, onFillFrame, onChangeStyle, children }: {
  roomId: string; me: string; covered: boolean; ready: boolean; widgets: WidgetDef[];
  api: MutableRefObject<DecorApi | null>; onEditPiece: (p: Piece) => void; onOpenPhoto: (photoId: string) => void;
  /** 포토프레임의 빈 칸을 눌렀을 때: 사진 찍어 채우기 */
  onFillFrame: (frameId: string, cell: number) => void;
  /** 편집 화면의 '스타일' 단추 (메모장·리스트·포토프레임) */
  onChangeStyle: (p: Piece) => void; children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLElement | null>>({});
  const saved = useRef<Saved>(loadJson<Saved>(storeKey(roomId), {}, (v) => !!v && typeof v === 'object'));
  const [doc, setDocState] = useState<Doc>(() => ({
    placed: {},
    order: loadJson<string[]>(orderKey(roomId), [], Array.isArray),
    pieces: loadPieces(roomId),
    hidden: loadJson<string[]>(hiddenKey(roomId), [], Array.isArray),
  }));
  const docRef = useRef(doc);
  const setDoc = (next: Doc) => { docRef.current = next; setDocState(next); };
  const [sizes, setSizes] = useState<Record<string, { w: number; h: number }>>({});
  const sizesRef = useRef(sizes);
  sizesRef.current = sizes;
  const [editing, setEditing] = useState(false);
  const editingRef = useRef(false);
  const [selected, setSelectedState] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  // 리스트 위젯을 화면 위에서 바로 쓰는 중 (2026-11-20 사용자 요청)
  const [writing, setWritingState] = useState<string | null>(null);
  const writingRef = useRef<string | null>(null);
  const LIST_MIN_ROWS = 3;
  // 쓰는 중 보이는 칸 수: 마지막 칸에서 Enter를 누를 때만 한 칸 늘어난다 (2026-11-20 사용자 요청)
  const [extraRows, setExtraRows] = useState(0);
  const focusNext = useRef<number | null>(null);
  useEffect(() => {
    if (focusNext.current == null) return;
    inputRefs.current[focusNext.current]?.focus({ preventScroll: true });
    focusNext.current = null;
  }, [extraRows]);
  const inputRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const setSelected = (id: string | null) => { selectedRef.current = id; setSelectedState(id); };
  const [active, setActive] = useState<string | null>(null); // 지금 손으로 만지는 중
  const [turning, setTurning] = useState(false); // 돌리는 중: 각도 보여 주기
  const hist = useRef<{ stack: Doc[]; i: number }>({ stack: [], i: 0 });
  const [, setHistTick] = useState(0);
  const [note, setNote] = useState('');
  // 처음 자리는 영수증을 다 불러온 뒤에 정한다 (그 전엔 사진 위젯 내용이 바뀜)
  const readyRef = useRef(ready);
  readyRef.current = ready;

  useEffect(() => { lift.on = editing; return () => { lift.on = false; }; }, [editing]);

  // ── 무엇이 붙어 있나 ──
  const items = useMemo<Item[]>(
    () => [
      ...widgets.filter((w) => !doc.hidden.includes(w.id)).map((w) => ({ id: w.id, widget: w, home: w.home, tilt: 0, label: w.name, cls: `decor--widget ${w.className}` })),
      ...doc.pieces.map(pieceItem),
    ],
    [widgets, doc.pieces, doc.hidden],
  );
  const itemsRef = useRef(items);
  itemsRef.current = items;
  // 쌓는 순서(뒤 → 앞). 저장에 없는 것(새로 붙인 것)은 맨 앞에
  const layers = useMemo(() => {
    const ids = items.map((d) => d.id);
    const kept = doc.order.filter((id) => ids.includes(id));
    return [...kept, ...ids.filter((id) => !kept.includes(id))];
  }, [items, doc.order]);
  const layersRef = useRef(layers);
  layersRef.current = layers;

  // 사진 조각의 주소. 사진첩에서 지운 사진은 화면에서도 뗀다
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    const ids = [...new Set(doc.pieces.flatMap((p) => (p.type === 'photo' ? [p.photoId] : p.type === 'frame' ? p.photos.filter((x): x is string => !!x) : [])))].filter((id) => !urls[id]);
    if (!ids.length) return;
    void Promise.all(ids.map(async (pid) => [pid, await photoUrl(pid).catch(() => undefined)] as const)).then((got) => {
      if (!alive) return;
      const gone = new Set(got.filter(([, u]) => !u).map(([id]) => id));
      setUrls((cur) => ({ ...cur, ...Object.fromEntries(got.filter((e): e is readonly [string, string] => !!e[1])) }));
      if (gone.size && !editingRef.current) {
        const d = docRef.current;
        // 사진 조각은 떼고, 포토프레임은 빈 액자로
        const next = {
          ...d,
          pieces: d.pieces
            .filter((p) => !(p.type === 'photo' && gone.has(p.photoId)))
            .map((p) => (p.type === 'frame' ? { ...p, photos: p.photos.map((x) => (x && gone.has(x) ? null : x)) } : p)),
        };
        setDoc(next);
        savePieces(roomId, next.pieces);
      }
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.pieces]);

  // ── 저장: 위치는 화면 크기에 대한 비율(가운데 점)로 ──
  const writeAll = useCallback((d: Doc) => {
    const root = rootRef.current;
    if (root) {
      const W = root.clientWidth, H = root.clientHeight;
      const out: Saved = {};
      for (const it of itemsOf(d, widgets)) {
        const p = d.placed[it.id], s = sizesRef.current[it.id];
        if (p && s) out[it.id] = { fx: (p.x + s.w / 2) / W, fy: (p.y + s.h / 2) / H, scale: p.scale, tilt: p.tilt, flip: p.flip || undefined, lock: p.lock || undefined };
        else if (saved.current[it.id]) out[it.id] = saved.current[it.id];
      }
      saved.current = out;
      writeJson(storeKey(roomId), out);
    }
    writeJson(orderKey(roomId), d.order);
    writeJson(hiddenKey(roomId), d.hidden);
    savePieces(roomId, d.pieces);
  }, [roomId, widgets]);

  // ── 크기 재기 + 저장한 자리에 놓기 (편집 중에는 자리를 건드리지 않는다) ──
  const gesture = useRef<Gesture | null>(null);
  /** 두 번 톡을 알아보려고 마지막 톡을 기억한다 */
  const lastTap = useRef<{ id: string; t: number; x: number; y: number } | null>(null);
  const layout = useCallback(() => {
    const root = rootRef.current;
    if (!root || !root.clientWidth) return;
    const nextSizes: Record<string, { w: number; h: number }> = {};
    for (const d of itemsRef.current) {
      const el = itemRefs.current[d.id];
      if (el) nextSizes[d.id] = { w: el.offsetWidth, h: el.offsetHeight };
    }
    const prevSizes = sizesRef.current;
    sizesRef.current = nextSizes;
    setSizes(nextSizes);
    const W = root.clientWidth, H = root.clientHeight;
    const placed: Record<string, Placed> = editingRef.current || gesture.current ? { ...docRef.current.placed } : {};
    let homed = false;
    const bottomEdge = H - parseFloat(getComputedStyle(root).paddingBottom || '0');
    for (const d of itemsRef.current) {
      const sz = nextSizes[d.id];
      const cur = placed[d.id];
      // 편집 중 놓인 것은 그대로 — 단, 크기가 바뀌어(예: 투두 글이 길어져 넓어짐) 화면 밖으로 나가면 같이 안으로 옮긴다 (2026-11-20)
      if (sz && cur) {
        const was = prevSizes[d.id];
        if (was && (was.w !== sz.w || was.h !== sz.h)) placed[d.id] = { ...cur, ...fitBox(cur.x, cur.y, sz.w, sz.h, cur.scale, W, bottomEdge) };
        continue;
      }
      if (!sz) continue;
      const s = saved.current[d.id];
      if (!s && !readyRef.current) continue; // 아직 숨겨 둠
      if (!s) homed = true;
      const cx = (s ? s.fx : d.home[0]) * W, cy = (s ? s.fy : d.home[1]) * H;
      const scale = Math.min(s?.scale ?? 1, Math.max(MIN_SCALE, W / sz.w));
      const bottom = H - parseFloat(getComputedStyle(root).paddingBottom || '0');
      const at = fitBox(cx - sz.w / 2, cy - sz.h / 2, sz.w, sz.h, scale, W, bottom);
      placed[d.id] = { x: at.x, y: at.y, scale, tilt: s?.tilt ?? d.tilt, flip: !!s?.flip, lock: !!s?.lock };
    }
    const next = { ...docRef.current, placed };
    setDoc(next);
    if (homed && !editingRef.current) writeAll(next);
  }, [writeAll]);

  useEffect(() => {
    const again = () => layout();
    document.fonts?.ready.then(again);
    document.fonts?.addEventListener('loadingdone', again);
    return () => document.fonts?.removeEventListener('loadingdone', again);
  }, [layout]);

  useLayoutEffect(() => {
    layout();
    const ro = new ResizeObserver(() => layout());
    if (rootRef.current) ro.observe(rootRef.current);
    for (const el of Object.values(itemRefs.current)) if (el) ro.observe(el);
    return () => ro.disconnect();
  }, [layout, ready, doc.pieces, doc.hidden]);

  // ── 편집 화면: 들어가기·되돌리기·취소·완료 ──
  const record = (d: Doc) => {
    const h = hist.current;
    h.stack = [...h.stack.slice(0, h.i + 1), d];
    h.i = h.stack.length - 1;
    setHistTick((n) => n + 1);
  };
  /** 바꾼 것 반영: 편집 중이면 되돌리기 기록, 아니면 바로 저장 */
  const commit = (next: Doc) => {
    setDoc(next);
    if (editingRef.current) record(next);
    else writeAll(next);
  };
  const enterEdit = (id: string | null) => {
    if (!editingRef.current) {
      hist.current = { stack: [docRef.current], i: 0 };
      editingRef.current = true;
      setEditing(true);
      setNote('편집 화면이에요. 다 꾸미면 완료를 눌러요.');
    }
    setSelected(id);
  };
  /** 쓰기를 마치면 빈 항목은 뺀다 */
  const stopWriting = () => {
    const id = writingRef.current;
    if (!id) return;
    writingRef.current = null;
    setWritingState(null);
    const d = docRef.current;
    const p = d.pieces.find((x) => x.id === id);
    if (p?.type === 'list' && p.items.some((it) => !it.text.trim())) {
      commit({ ...d, pieces: d.pieces.map((x) => (x.id === id && x.type === 'list' ? { ...x, items: x.items.filter((it) => it.text.trim()) } : x)) });
    }
  };
  const startWriting = (id: string) => { if (writingRef.current === id) return; writingRef.current = id; setWritingState(id); setExtraRows(0); };
  // 쓰기를 시작할 때 한 번만 첫 빈 칸에 커서를 둔다 (새 칸이 생길 때마다 초점이 옮겨 가던 문제 고침)
  useEffect(() => {
    if (!writing) return;
    const p = docRef.current.pieces.find((x) => x.id === writing);
    const n = p?.type === 'list' ? p.items.findIndex((it) => !it.text.trim()) : -1;
    const at = n >= 0 ? n : Math.min(p?.type === 'list' ? p.items.length : 0, LIST_ITEMS - 1);
    inputRefs.current[at]?.focus({ preventScroll: true });
  }, [writing]);
  const leaveEdit = () => {
    stopWriting();
    editingRef.current = false;
    setEditing(false);
    setSelected(null);
    setActive(null);
    hist.current = { stack: [], i: 0 };
  };
  const undo = () => {
    const h = hist.current;
    if (h.i === 0) return;
    h.i -= 1;
    setDoc(h.stack[h.i]);
    setHistTick((n) => n + 1);
    setNote('되돌렸어요');
  };
  const redo = () => {
    const h = hist.current;
    if (h.i >= h.stack.length - 1) return;
    h.i += 1;
    setDoc(h.stack[h.i]);
    setHistTick((n) => n + 1);
    setNote('다시 했어요');
  };
  const cancel = () => {
    if (hist.current.stack[0]) setDoc(hist.current.stack[0]);
    leaveEdit();
    setNote('편집을 취소했어요');
  };
  const done = () => {
    writeAll(docRef.current);
    leaveEdit();
    setNote('저장했어요');
  };
  useEffect(() => { if (covered && editingRef.current) done(); }, [covered]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 고른 것 바꾸기 ──
  const patch = (id: string, p: Partial<Placed>, rec = true) => {
    const d = docRef.current;
    const cur = d.placed[id];
    if (!cur) return;
    const next = { ...d, placed: { ...d.placed, [id]: { ...cur, ...p } } };
    if (rec) commit(next);
    else setDoc(next);
  };
  /** 조각 전체가 화면 안(아래 탭 위)에 있게 */
  const keepInside = (id: string, x: number, y: number, scale = docRef.current.placed[id]?.scale ?? 1) => {
    const root = rootRef.current, s = sizesRef.current[id];
    if (!root || !s) return { x, y };
    const bottom = root.clientHeight - parseFloat(getComputedStyle(root).paddingBottom);
    return fitBox(x, y, s.w, s.h, scale, root.clientWidth, bottom);
  };
  /** 화면 너비를 넘지 않는 가장 큰 크기 */
  const maxScale = (id: string) => {
    const root = rootRef.current, s = sizesRef.current[id];
    return root && s?.w ? Math.max(MIN_SCALE, Math.min(MAX_SCALE, root.clientWidth / s.w)) : MAX_SCALE;
  };
  /** 크기를 바꾸고 화면 안으로 */
  const keepScaled = (id: string, scale: number) => {
    const p = docRef.current.placed[id];
    return p ? { scale, ...keepInside(id, p.x, p.y, scale) } : { scale };
  };
  const remove = (id: string) => {
    const d = docRef.current;
    const isWidget = widgets.some((w) => w.id === id);
    const photo = d.pieces.find((p) => p.id === id)?.type === 'photo';
    const { [id]: _gone, ...placed } = d.placed;
    commit({
      ...d,
      placed,
      order: d.order.filter((x) => x !== id),
      pieces: d.pieces.filter((p) => p.id !== id),
      hidden: isWidget ? [...d.hidden, id] : d.hidden,
    });
    setSelected(null);
    setNote(isWidget ? '위젯을 뗐어요. 스티커 창에서 다시 붙일 수 있어요' : photo ? '사진을 뗐어요. 사진첩에는 남아 있어요' : '뗐어요');
  };
  /** 쌓는 순서를 index(0 = 맨 뒤)로 */
  const setLayer = (id: string, index: number, rec: boolean) => {
    const list = layersRef.current.filter((x) => x !== id);
    list.splice(clamp(index, 0, list.length), 0, id);
    const next = { ...docRef.current, order: list };
    if (rec) commit(next);
    else setDoc(next);
  };

  // ── 손가락·마우스 ──
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const centerOf = (id: string) => {
    const p = docRef.current.placed[id], s = sizesRef.current[id];
    const r = rootRef.current!.getBoundingClientRect();
    return { x: r.left + p.x + s.w / 2, y: r.top + p.y + s.h / 2 };
  };

  const onItemDown = (id: string) => (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0 || gesture.current?.kind === 'pinch') return;
    if ((e.target as Element).closest?.('input, textarea')) return; // 리스트에 쓰는 중: 입력칸은 끌기 대신 글쓰기
    const p = docRef.current.placed[id];
    if (!p) return;
    if (!editingRef.current) {
      // 보통 때: 꾹 누르면 편집 화면 (그대로 끌면 바로 옮겨진다)
      const el = e.currentTarget;
      const pid = e.pointerId;
      const timer = window.setTimeout(() => {
        const g = gesture.current;
        if (!g || g.kind !== 'press' || g.id !== id) return;
        enterEdit(id);
        const cur = docRef.current.placed[id];
        if (!cur.lock) {
          setActive(id);
          gesture.current = { kind: 'move', id, pid, sx: g.lx, sy: g.ly, ox: cur.x, oy: cur.y, moved: false, wasSelected: false };
          try { g.el.setPointerCapture(pid); } catch { /* 이미 손을 뗌 */ }
        } else gesture.current = null;
        navigator.vibrate?.(12);
      }, HOLD_MS);
      gesture.current = { kind: 'press', id, pid, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, timer, el };
      return;
    }
    // 편집 중: 고르고 바로 끌기
    const wasSelected = selectedRef.current === id;
    setSelected(id);
    if (p.lock) { gesture.current = null; return; }
    setActive(id);
    gesture.current = { kind: 'move', id, pid: e.pointerId, sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y, moved: false, wasSelected };
  };

  const onResizeDown = (id: string) => (e: ReactPointerEvent<HTMLElement>) => {
    e.stopPropagation();
    const p = docRef.current.placed[id];
    if (!p || p.lock) return;
    const c = centerOf(id);
    gesture.current = { kind: 'resize', id, pid: e.pointerId, cx: c.x, cy: c.y, d0: Math.max(10, Math.hypot(e.clientX - c.x, e.clientY - c.y)), s0: p.scale };
    setActive(id);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* 무시 */ }
  };

  /** 회전 손잡이: 가운데를 축으로 한 손가락으로 돌린다 (손가락이 멀수록 더 세밀하게) */
  const onRotateDown = (id: string) => (e: ReactPointerEvent<HTMLElement>) => {
    e.stopPropagation();
    const p = docRef.current.placed[id];
    if (!p || p.lock) return;
    const c = centerOf(id);
    gesture.current = { kind: 'rotate', id, pid: e.pointerId, cx: c.x, cy: c.y, a0: Math.atan2(e.clientY - c.y, e.clientX - c.x), t0: p.tilt };
    setActive(id);
    setTurning(true);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* 무시 */ }
  };

  useEffect(() => {
    const down = (e: PointerEvent) => {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!editingRef.current) return;
      // 두 번째 손가락: 고른 것을 돌리고 키운다
      const sel = selectedRef.current;
      const p = sel ? docRef.current.placed[sel] : undefined;
      if (pointers.current.size === 2 && sel && p && !p.lock) {
        const [a, b] = [...pointers.current.values()];
        gesture.current = { kind: 'pinch', id: sel, d0: Math.max(10, Math.hypot(b.x - a.x, b.y - a.y)), a0: Math.atan2(b.y - a.y, b.x - a.x), s0: p.scale, t0: p.tilt };
        setActive(sel);
        setTurning(true);
        return;
      }
      // 빈 곳을 누르면 고르기 해제 (편집 화면은 그대로)
      const t = e.target as Element;
      if (writingRef.current && !t.closest?.(`[data-decor-id="${writingRef.current}"]`)) stopWriting();
      if (!t.closest?.('.decor, .edit-frame, .edit-bar, .layer-rail, [role="dialog"]')) setSelected(null);
    };
    const move = (e: PointerEvent) => {
      if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const g = gesture.current;
      if (!g) return;
      switch (g.kind) {
        case 'press': {
          if (e.pointerId !== g.pid) return;
          g.lx = e.clientX; g.ly = e.clientY;
          if (Math.hypot(e.clientX - g.sx, e.clientY - g.sy) > SLOP) { window.clearTimeout(g.timer); gesture.current = null; }
          return;
        }
        case 'move': {
          if (e.pointerId !== g.pid) return;
          const dx = e.clientX - g.sx, dy = e.clientY - g.sy;
          if (!g.moved && Math.hypot(dx, dy) < SLOP) return;
          g.moved = true;
          patch(g.id, { x: g.ox + dx, y: g.oy + dy }, false);
          return;
        }
        case 'resize': {
          if (e.pointerId !== g.pid) return;
          const d = Math.hypot(e.clientX - g.cx, e.clientY - g.cy);
          patch(g.id, { scale: clamp(g.s0 * (d / g.d0), MIN_SCALE, maxScale(g.id)) }, false);
          return;
        }
        case 'rotate': {
          if (e.pointerId !== g.pid) return;
          if (Math.hypot(e.clientX - g.cx, e.clientY - g.cy) < 12) return; // 가운데 바로 위에서는 각도가 튀어서 쉰다
          const ang = Math.atan2(e.clientY - g.cy, e.clientX - g.cx);
          patch(g.id, { tilt: g.t0 + ((ang - g.a0) * 180) / Math.PI }, false);
          return;
        }
        case 'pinch': {
          if (pointers.current.size < 2) return;
          const [a, b] = [...pointers.current.values()];
          const d = Math.hypot(b.x - a.x, b.y - a.y);
          const ang = Math.atan2(b.y - a.y, b.x - a.x);
          patch(g.id, { scale: clamp(g.s0 * (d / g.d0), MIN_SCALE, maxScale(g.id)), tilt: g.t0 + ((ang - g.a0) * 180) / Math.PI }, false);
          return;
        }
      }
    };
    const up = (e: PointerEvent) => {
      pointers.current.delete(e.pointerId);
      const g = gesture.current;
      if (!g) return;
      switch (g.kind) {
        case 'press': {
          if (e.pointerId !== g.pid) return;
          window.clearTimeout(g.timer); // 톡: 원래 동작(영수증 열기 등)은 그대로
          if (e.type !== 'pointerup') break;
          // 보통 화면에서 두 번 톡(더블클릭): 편집 화면으로 들어가 바로 쓰기 (2026-11-20 사용자 요청)
          const now = performance.now();
          const last = lastTap.current;
          if (last && last.id === g.id && now - last.t < DOUBLE_TAP_MS && Math.hypot(e.clientX - last.x, e.clientY - last.y) < SLOP * 3) {
            lastTap.current = null;
            const piece = docRef.current.pieces.find((x) => x.id === g.id);
            if (piece?.type === 'list') { enterEdit(piece.id); startWriting(piece.id); }
            else if (piece && ['text', 'line', 'memo'].includes(piece.type)) { enterEdit(piece.id); onEditPiece(piece); }
          } else lastTap.current = { id: g.id, t: now, x: e.clientX, y: e.clientY };
          break;
        }
        case 'move': {
          if (e.pointerId !== g.pid) return;
          if (g.moved) {
            const p = docRef.current.placed[g.id];
            patch(g.id, keepInside(g.id, p.x, p.y));
          } else if (g.wasSelected && e.type === 'pointerup') {
            // 고른 글씨·한 줄을 한 번 더 톡: 고치기
            const piece = docRef.current.pieces.find((x) => x.id === g.id);
            // 리스트는 창을 띄우지 않고 그 자리에서 바로 쓴다 (커서 깜빡)
            if (piece?.type === 'list') startWriting(piece.id);
            else if (piece && ['text', 'line', 'memo'].includes(piece.type)) onEditPiece(piece);
          }
          break;
        }
        case 'resize': {
          if (e.pointerId !== g.pid) return;
          const p = docRef.current.placed[g.id];
          patch(g.id, p ? keepInside(g.id, p.x, p.y) : {});
          break;
        }
        case 'rotate':
          if (e.pointerId !== g.pid) return;
        // falls through
        case 'pinch': {
          const p = docRef.current.placed[g.id];
          if (p) { const t = snapTilt(p.tilt); patch(g.id, { tilt: t, ...keepInside(g.id, p.x, p.y) }); setNote(`${showDeg(t)} 돌렸어요`); }
          setTurning(false);
          break;
        }
      }
      gesture.current = null;
      setActive(null);
    };
    // 편집 중에는 화면이 같이 움직이지 않게
    const touch = (e: TouchEvent) => { if (editingRef.current) e.preventDefault(); };
    const key = (e: globalThis.KeyboardEvent) => {
      if (!editingRef.current) return;
      if (document.querySelector('[role="dialog"]')) return; // 창이 떠 있으면 뒤 화면 단축키(Esc·되돌리기)도 쉰다
      if (e.key === 'Escape') { e.preventDefault(); cancel(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
    };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
    document.addEventListener('touchmove', touch, { passive: false });
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      document.removeEventListener('touchmove', touch);
      document.removeEventListener('keydown', key);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 컴퓨터: 휠로 돌리기
  const wheelTimer = useRef<number>();
  const onWheel = (e: WheelEvent) => {
    const sel = selectedRef.current;
    const p = sel ? docRef.current.placed[sel] : undefined;
    if (!editingRef.current || !sel || !p || p.lock) return;
    // 창(스타일 바꾸기 등)이 떠 있으면 뒤 화면은 고치지 않는다 — 창을 스크롤해도 뒤 위젯이 돌지 않게 (2026-11-20)
    if (document.querySelector('[role="dialog"]')) return;
    // 한 칸에 1°, Shift를 누르고 돌리면 0.2°
    const delta = e.deltaY || e.deltaX;
    patch(sel, { tilt: p.tilt + Math.sign(delta) * (e.shiftKey ? 0.2 : 1) }, false);
    setTurning(true);
    window.clearTimeout(wheelTimer.current);
    wheelTimer.current = window.setTimeout(() => {
      patch(sel, { tilt: snapTilt(docRef.current.placed[sel].tilt) });
      setTurning(false);
    }, 600);
  };

  // 키보드
  const onKey = (id: string, isGroup: boolean) => (e: KeyboardEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return;
    if (!editingRef.current) {
      // 버튼(스티커)은 Enter로, 묶음(위젯)은 Enter·Space로 편집 화면
      if (e.key === 'Enter' || (isGroup && e.key === ' ')) { e.preventDefault(); enterEdit(id); }
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(id); return; }
    if (selectedRef.current !== id) return;
    const p = docRef.current.placed[id];
    if (!p || p.lock) return;
    const step: Record<string, [number, number]> = { ArrowLeft: [-KEY_STEP, 0], ArrowRight: [KEY_STEP, 0], ArrowUp: [0, -KEY_STEP], ArrowDown: [0, KEY_STEP] };
    if (step[e.key]) { e.preventDefault(); patch(id, keepInside(id, p.x + step[e.key][0], p.y + step[e.key][1])); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); patch(id, keepScaled(id, clamp(p.scale * 1.1, MIN_SCALE, maxScale(id)))); }
    else if (e.key === '-') { e.preventDefault(); patch(id, { scale: clamp(p.scale / 1.1, MIN_SCALE, MAX_SCALE) }); }
    else if (['[', ']', '{', '}'].includes(e.key)) {
      // [ ] 1°씩, Shift와 함께면 15°씩
      e.preventDefault();
      const step = (e.key === ']' || e.key === '}' ? 1 : -1) * (e.shiftKey ? 15 : 1);
      const t = Math.round((p.tilt + step) * 10) / 10;
      patch(id, { tilt: t });
      setNote(showDeg(t));
    }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(id); }
  };

  // ── 바깥(아래 탭)에서 붙이기 ──
  api.current = {
    add: (input) => {
      const id = newPieceId(input.type);
      const d = docRef.current;
      // 위젯 아래 비어 있는 쪽에, 여러 개 붙여도 딱 겹치지 않게 옆으로 비껴서. 사진은 살짝 기울여서
      const n = d.pieces.length;
      const tilt = input.type === 'photo' ? (n % 2 ? 3 : -3) : input.type === 'art' ? artOf(input.art).tilt : 0;
      // 위젯 카드는 네 자리(왼쪽·오른쪽 × 두 줄)를 돌아가며
      const isCard = (t: string) => t === 'memo' || t === 'list' || t === 'frame';
      const cards = d.pieces.filter((x) => isCard(x.type)).length;
      const CARD_SPOTS = [{ fx: 0.28, fy: 0.6 }, { fx: 0.72, fy: 0.62 }, { fx: 0.3, fy: 0.75 }, { fx: 0.7, fy: 0.76 }];
      const spot = isCard(input.type)
        ? CARD_SPOTS[cards % CARD_SPOTS.length]
        : input.type === 'photo' ? { fx: 0.4 + (n % 3) * 0.1, fy: 0.71 } : { fx: 0.25 + (n % 5) * 0.125, fy: 0.53 + ((n % 3) - 1) * 0.03 };
      saved.current = { ...saved.current, [id]: { ...spot, scale: 1, tilt } };
      writeJson(storeKey(roomId), saved.current);
      const next = { ...d, pieces: [...d.pieces, { ...input, id } as Piece] };
      setDoc(next);
      if (editingRef.current) record(next);
      else savePieces(roomId, next.pieces);
      return id;
    },
    update: (id, p) => {
      const d = docRef.current;
      commit({ ...d, pieces: d.pieces.map((x) => (x.id === id ? ({ ...x, ...p } as Piece) : x)) });
    },
    showWidget: (id) => {
      const d = docRef.current;
      const { [id]: _old, ...rest } = saved.current; // 처음 자리로
      saved.current = rest;
      writeJson(storeKey(roomId), rest);
      const next = { ...d, hidden: d.hidden.filter((x) => x !== id), order: d.order.filter((x) => x !== id) };
      setDoc(next);
      if (editingRef.current) record(next);
      else writeJson(hiddenKey(roomId), next.hidden);
    },
    hiddenWidgets: () => docRef.current.hidden,
    getPiece: (id) => docRef.current.pieces.find((x) => x.id === id),
    focus: (id) => enterEdit(id),
  };

  // ── 그리기 ──
  const body = (d: Item): ReactNode => {
    const p = d.piece;
    if (!p) return d.widget?.body;
    switch (p.type) {
      case 'art': return <ArtBody id={p.art} />;
      case 'text': {
        const f = fontOf(p.font);
        // 정렬·굵기·기울기·테두리 색 (2026-11-20). 값이 없으면 예전 모양 그대로
        return (
          <span
            style={{
              display: 'block', textAlign: p.align ?? 'center',
              fontFamily: f.family, fontWeight: p.bold ? 800 : f.weight, fontStyle: p.italic ? 'italic' : undefined, textDecoration: p.underline ? 'underline' : undefined, fontSize: f.size, color: p.color,
              WebkitTextStroke: p.stroke === 'none' ? '0' : p.stroke ? `6px ${p.stroke}` : undefined,
            }}
          >
            {p.text}
          </span>
        );
      }
      case 'line': return p.text;
      case 'photo': {
        const [, m, dd] = p.date.split('-').map(Number);
        const url = urls[p.photoId];
        return (
          <button type="button" className="photo-card" onClick={() => onOpenPhoto(p.photoId)} aria-label={`${m}월 ${dd}일 사진, 사진첩에서 보기`}>
            <span className="photo-card__frame">
              <span className="photo-card__img" style={url ? { background: `center / cover no-repeat url("${url}")` } : undefined} />
            </span>
            <span className="photo-card__cap" aria-hidden="true">{m}.{dd}</span>
          </button>
        );
      }
      case 'memo': return <MemoCard text={p.text} style={p.style} interactive />;
      case 'list': {
        // 보통 화면에서 톡: 체크 (바로 저장)
        const setItems = (fn: (items: ListItem[]) => ListItem[]) => {
          const dd = docRef.current;
          commit({ ...dd, pieces: dd.pieces.map((x) => (x.id === p.id && x.type === 'list' ? { ...x, items: fn(x.items) } : x)) });
        };
        if (writing === p.id) {
          // 화면 위에서 바로 쓰기: 칸은 3개부터, 마지막 칸에서 Enter를 누르면 한 칸씩 늘어난다 (최대 개수까지)
          const count = Math.min(LIST_ITEMS, Math.max(LIST_MIN_ROWS, p.items.length, LIST_MIN_ROWS + extraRows));
          const slots: ListItem[] = Array.from({ length: count }, (_, i) => p.items[i] ?? { text: '', done: false });
          const setText = (i: number, v: string) => setItems((its) => {
            const next = [...its];
            while (next.length <= i) next.push({ text: '', done: false }); // 사이 빈 칸은 쓰기를 마칠 때 정리
            next[i] = { ...next[i], text: [...v].slice(0, ITEM_MAX).join('') };
            while (next.length && !next[next.length - 1].text) next.pop();
            return next;
          });
          return (
            <ListCard
              kind={p.kind}
              style={p.style}
              year={p.year}
              items={slots}
              // 쓰는 중에도 앞 칸을 눌러 다 한 일을 체크한다 (아직 글이 없는 빈 칸은 체크하지 않는다)
              onToggle={(i) => { if (slots[i].text.trim()) setItems((its) => its.map((it, j) => (j === i ? { ...it, done: !it.done } : it))); }}
              onToggleDay={(i, day) => {
                if (!slots[i].text.trim()) return;
                setItems((its) => its.map((it, j) => {
                  if (j !== i) return it;
                  const days = Array.from({ length: 7 }, (_, k) => !!it.days?.[k]);
                  days[day] = !days[day];
                  return { ...it, days, done: days.every(Boolean) };
                }));
              }}
              renderText={(i) => (
                // 한 줄 입력칸이면 긴 글이 잘려서, 카드 폭 안에서 줄바꿈되고 높이가 늘어나는 칸으로 (2026-11-20 사용자 요청)
                // 보이지 않는 같은 글(wl__sizer)이 칸의 폭·높이를 정한다: 투두는 글만큼 카드가 넓어지다가 최대 폭에서 줄바꿈
                <span className="wl__grow">
                <span className="wl__sizer" aria-hidden="true">{slots[i].text + ' '}</span>
                <textarea
                  ref={(el) => { inputRefs.current[i] = el; }}
                  rows={1}
                  cols={1}
                  className="wl__input"
                  value={slots[i].text}
                  aria-label={`${i + 1}번째 ${p.kind === 'bucket' ? '하고 싶은 것' : '할 일'}`}
                  enterKeyHint="next"
                  onChange={(e) => setText(i, e.target.value.replace(/[\r\n]+/g, ' '))}
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing) return; // 한글 조합 중에는 Enter·지우기를 가로채지 않는다
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (i < count - 1) inputRefs.current[i + 1]?.focus();
                      else if (slots[i].text.trim() && count < LIST_ITEMS) {
                        focusNext.current = count; // 새로 생긴 칸으로
                        setExtraRows(count + 1 - LIST_MIN_ROWS);
                      }
                    }
                    else if (e.key === 'Backspace' && !slots[i].text && i > 0) { e.preventDefault(); inputRefs.current[i - 1]?.focus(); }
                    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); stopWriting(); }
                  }}
                />
                </span>
              )}
            />
          );
        }
        return (
          <ListCard
            kind={p.kind}
            style={p.style}
            year={p.year}
            // 항목이 3개보다 적으면 빈 줄로 채워 늘 3줄부터 보여 준다 (2026-11-20 사용자 요청)
            items={[...p.items, ...Array.from({ length: Math.max(0, LIST_MIN_ROWS - p.items.length) }, () => ({ text: '', done: false }))]}
            onToggle={(i) => setItems((its) => its.map((it, j) => (j === i ? { ...it, done: !it.done } : it)))}
            onToggleDay={(i, day) => setItems((its) => its.map((it, j) => {
              if (j !== i) return it;
              const days = Array.from({ length: 7 }, (_, k) => !!it.days?.[k]);
              days[day] = !days[day];
              return { ...it, days, done: days.every(Boolean) };
            }))}
          />
        );
      }
      case 'frame':
        return (
          <FrameCard
            style={p.style}
            urls={p.photos.map((x) => (x ? urls[x] : undefined))}
            date={p.date}
            dplus={p.dplus}
            onCell={(i) => { const ph = p.photos[i]; if (ph) onOpenPhoto(ph); else onFillFrame(p.id, i); }}
          />
        );
    }
  };

  const sel = selected ? items.find((d) => d.id === selected) : undefined;
  const selPlaced = selected ? doc.placed[selected] : undefined;
  const selSize = selected ? sizes[selected] : undefined;
  const h = hist.current;

  return (
    <div ref={rootRef} className={`diary ${editing ? 'is-editing' : ''}`} onWheel={onWheel}>
      {children}

      {/* 위젯·조각: 화면 위 한 겹, 어디든. 쌓는 순서 = z-index */}
      <div className="decor-layer">
        {items.map((d) => {
          const p = doc.placed[d.id];
          const style = {
            ...(p ? { left: p.x, top: p.y, '--tilt': `${p.tilt}deg`, '--scale': p.scale, '--flip': p.flip ? -1 : 1 } : {}),
            zIndex: layers.indexOf(d.id) + 1,
          } as CSSProperties;
          const className = [
            'decor', d.cls,
            d.piece?.type === 'line' && d.piece.by !== me ? 'partner' : '',
            p ? 'is-placed' : '',
            selected === d.id ? 'is-selected' : '',
            active === d.id ? 'is-active' : '',
            p?.lock ? 'is-locked' : '',
          ].join(' ');
          const common = {
            'data-decor-id': d.id,
            ref: (el: HTMLElement | null) => { itemRefs.current[d.id] = el; },
            className, style,
            onPointerDown: onItemDown(d.id),
            onDragStart: (e: DragEvent) => e.preventDefault(),
            onContextMenu: (e: ReactMouseEvent) => e.preventDefault(),
          };
          // 안에 버튼이 있는 것(위젯·사진·메모장·리스트·액자)은 묶음으로, 나머지는 그 자체가 버튼
          if (d.widget || (d.piece && ['photo', 'memo', 'list', 'frame'].includes(d.piece.type))) {
            return (
              <div key={d.id} {...common} role="group" tabIndex={0} aria-label={d.widget ? `${d.label} 위젯` : d.label} aria-describedby="decor-help" onKeyDown={onKey(d.id, true)}>
                {body(d)}
              </div>
            );
          }
          return (
            <button key={d.id} {...common} type="button" aria-label={d.label} aria-pressed={editing ? selected === d.id : undefined} aria-describedby="decor-help" onKeyDown={onKey(d.id, false)}>
              {body(d)}
            </button>
          );
        })}

        {/* 고른 것 테두리: 휴지통 · 잠금 · 좌우 반전 · 크기 */}
        {editing && sel && selPlaced && selSize && (
          <div
            className={`edit-frame ${selPlaced.lock ? 'is-locked' : ''}`}
            style={{
              left: selPlaced.x + selSize.w / 2 - (selSize.w * selPlaced.scale) / 2,
              top: selPlaced.y + selSize.h / 2 - (selSize.h * selPlaced.scale) / 2,
              width: selSize.w * selPlaced.scale,
              height: selSize.h * selPlaced.scale,
              transform: `rotate(${selPlaced.tilt}deg)`,
            }}
          >
            {/* 위 가운데: 회전 손잡이 (한 손가락으로 세밀하게) */}
            <span className="edit-rotate__stem" aria-hidden="true" />
            <button
              type="button"
              className="edit-handle edit-handle--rot"
              aria-label={`돌리기: 지금 ${showDeg(selPlaced.tilt)}. 끌거나 왼쪽·오른쪽 방향키 (Shift: 15°씩)`}
              disabled={selPlaced.lock}
              onPointerDown={onRotateDown(sel.id)}
              onKeyDown={(e) => {
                if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
                e.preventDefault();
                const t = Math.round((selPlaced.tilt + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 15 : 1)) * 10) / 10;
                patch(sel.id, { tilt: t });
                setNote(showDeg(t));
              }}
            >
              <Icon name="rotate" />
            </button>
            {sel.piece && (sel.piece.type === 'memo' || sel.piece.type === 'list' || sel.piece.type === 'frame') && (
              <button type="button" className="edit-handle edit-handle--style" aria-label="스타일 바꾸기" disabled={selPlaced.lock} onClick={() => onChangeStyle(sel.piece!)}>
                <Icon name="palette" />
              </button>
            )}
            <button type="button" className="edit-handle edit-handle--tl" aria-label={`${sel.label} 지우기`} disabled={selPlaced.lock} onClick={() => remove(sel.id)}>
              <Icon name="trash" />
            </button>
            <button
              type="button"
              className="edit-handle edit-handle--tr"
              aria-label={selPlaced.lock ? '잠금 풀기' : '이 자리에 잠그기'}
              aria-pressed={selPlaced.lock}
              onClick={() => { patch(sel.id, { lock: !selPlaced.lock }); setNote(selPlaced.lock ? '잠금을 풀었어요' : '잠갔어요. 움직이지 않아요'); }}
            >
              <Icon name={selPlaced.lock ? 'lock' : 'unlock'} />
            </button>
            <button type="button" className="edit-handle edit-handle--bl" aria-label="좌우 반전" aria-pressed={selPlaced.flip} disabled={selPlaced.lock} onClick={() => patch(sel.id, { flip: !selPlaced.flip })}>
              <Icon name="flip" />
            </button>
            <button
              type="button"
              className="edit-handle edit-handle--br"
              aria-label="크기 조절: 끌거나 +/− 키"
              disabled={selPlaced.lock}
              onPointerDown={onResizeDown(sel.id)}
              onKeyDown={(e) => {
                if (e.key === '+' || e.key === '=' || e.key === 'ArrowUp') { e.preventDefault(); patch(sel.id, keepScaled(sel.id, clamp(selPlaced.scale * 1.1, MIN_SCALE, maxScale(sel.id)))); }
                if (e.key === '-' || e.key === 'ArrowDown') { e.preventDefault(); patch(sel.id, { scale: clamp(selPlaced.scale / 1.1, MIN_SCALE, MAX_SCALE) }); }
              }}
            >
              <Icon name="resize" />
            </button>
          </div>
        )}
      </div>
      <p id="decor-help" className="sr-only">
        {editing
          ? '끌어서 옮겨요. 방향키로 옮기고, +/− 로 크기, [ ] 로 1°씩 회전(Shift: 15°), Delete 로 지울 수 있어요.'
          : '꾹 누르거나 Enter를 누르면 편집 화면이 열려요.'}
      </p>

      {/* 돌리는 동안: 지금 각도 */}
      {editing && turning && selPlaced && <div className="edit-angle" aria-hidden="true">{showDeg(selPlaced.tilt)}</div>}

      {/* 편집 화면 머리: 취소 · 되돌리기/다시 하기 · 완료 */}
      {editing && (
        <div className="edit-bar" role="toolbar" aria-label="편집">
          <button type="button" className="edit-bar__btn" aria-label="편집 취소" onClick={cancel}><Icon name="close" /></button>
          <div className="edit-bar__mid">
            <button type="button" className="edit-bar__btn" aria-label="되돌리기" disabled={h.i === 0} onClick={undo}><Icon name="undo" /></button>
            <button type="button" className="edit-bar__btn" aria-label="다시 하기" disabled={h.i >= h.stack.length - 1} onClick={redo}><Icon name="redo" /></button>
          </div>
          <button type="button" className="edit-bar__done" onClick={done}>완료</button>
        </div>
      )}

      {/* 앞뒤 순서: 왼쪽 가운데 ≡ 손잡이를 위(앞)·아래(뒤)로 */}
      {editing && sel && layers.length > 1 && (
        <LayerRail
          count={layers.length}
          index={layers.indexOf(sel.id)}
          onChange={(i) => setLayer(sel.id, i, false)}
          onCommit={() => { record(docRef.current); setNote(`앞에서 ${layersRef.current.length - layersRef.current.indexOf(sel.id)}번째`); }}
        />
      )}
      <p role="status" className="sr-only">{note}</p>
    </div>
  );
}

function itemsOf(d: Doc, widgets: WidgetDef[]) {
  return [...widgets.filter((w) => !d.hidden.includes(w.id)).map((w) => ({ id: w.id })), ...d.pieces.map((p) => ({ id: p.id }))];
}

/** 앞뒤 순서 손잡이 (세로 슬라이더). 위 = 앞, 아래 = 뒤 */
function LayerRail({ count, index, onChange, onCommit }: { count: number; index: number; onChange: (i: number) => void; onCommit: () => void }) {
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const toIndex = (clientY: number) => {
    const r = track.current!.getBoundingClientRect();
    const t = clamp((clientY - r.top) / r.height, 0, 1);
    return Math.round((1 - t) * (count - 1));
  };
  const top = count > 1 ? (1 - index / (count - 1)) * 100 : 50;
  const fromFront = count - index;
  return (
    <div className="layer-rail">
      <span className="layer-rail__label" aria-hidden="true">앞</span>
      <div
        ref={track}
        className="layer-rail__track"
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          onChange(toIndex(e.clientY));
        }}
        onPointerMove={(e) => { if (dragging.current) onChange(toIndex(e.clientY)); }}
        onPointerUp={() => { if (dragging.current) { dragging.current = false; onCommit(); } }}
        onPointerCancel={() => { if (dragging.current) { dragging.current = false; onCommit(); } }}
      >
        {Array.from({ length: count }, (_, i) => (
          <span key={i} className="layer-rail__dot" style={{ top: `${count > 1 ? (1 - i / (count - 1)) * 100 : 50}%` }} aria-hidden="true" />
        ))}
        <span
          className="layer-rail__thumb"
          style={{ top: `${top}%` }}
          role="slider"
          tabIndex={0}
          aria-label="앞뒤 순서"
          aria-orientation="vertical"
          aria-valuemin={1}
          aria-valuemax={count}
          aria-valuenow={index + 1}
          aria-valuetext={fromFront === 1 ? '맨 앞' : index === 0 ? '맨 뒤' : `앞에서 ${fromFront}번째`}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); onChange(Math.min(count - 1, index + 1)); onCommit(); }
            if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); onChange(Math.max(0, index - 1)); onCommit(); }
          }}
        >
          <Icon name="menu" />
        </span>
      </div>
      <span className="layer-rail__label" aria-hidden="true">뒤</span>
    </div>
  );
}

type IconName = 'trash' | 'lock' | 'unlock' | 'flip' | 'resize' | 'rotate' | 'close' | 'undo' | 'redo' | 'menu' | 'palette';
const ICONS: Record<IconName, ReactNode> = {
  trash: <><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13" /><path d="M9 7V4h6v3" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  unlock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 7.5-2" /></>,
  flip: <><path d="M12 3v18" strokeDasharray="2 2" /><path d="M9 7L3 17h6z" /><path d="M15 7l6 10h-6z" fill="currentColor" /></>,
  rotate: <><path d="M20 12a8 8 0 1 1-2.35-5.65" /><path d="M20 4v5h-5" /></>,
  resize: <><path d="M14 20h6v-6" /><path d="M20 20L13 13" /><path d="M10 4H4v6" /><path d="M4 4l7 7" /></>,
  close: <><path d="M6 6l12 12M18 6L6 18" /></>,
  undo: <><path d="M9 14L4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></>,
  redo: <><path d="M15 14l5-5-5-5" /><path d="M20 9H9a5 5 0 0 0 0 10h3" /></>,
  menu: <><path d="M5 7h14M5 12h14M5 17h14" /></>,
  palette: <><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.5-.8 1.2-1.6-.4-1 .2-2.1 1.3-2.1H17a4 4 0 0 0 4-4c0-5.2-4-10.3-9-10.3z" /><circle cx="7.5" cy="11" r="1.2" fill="currentColor" /><circle cx="10" cy="7" r="1.2" fill="currentColor" /><circle cx="15" cy="7.5" r="1.2" fill="currentColor" /></>,
};
function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}
