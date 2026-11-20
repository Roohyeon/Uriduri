import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Field, Sheet, inputClass } from '../ui';
import { countChars } from '../../lib/text';
import { ARTS, ArtBody, ITEM_MAX, LINE_MAX, LIST_ITEMS, LIST_NAMES, MAX_LINES, MEMO_MAX, TEXT_COLORS, TEXT_FONTS, TEXT_MAX, clampText, fontOf, type ArtId, type TextAlign, type TextLook, type ListItem, type ListKind, type TextFontId } from './pieces';
import { ListCard, WidgetPreview, type WidgetKind } from './widgets';
import { BUCKET_STYLES, FRAME_STYLES, MEMO_STYLES, TODO_STYLES, type ListStyle } from './styles';

/** 스티커 붙이기: 스티커만 늘어놓는다 (이름·바탕 없이). 마지막 '텍스트'는 글씨 스티커 쓰기로 */
const pick = 'grid h-24 w-full min-w-0 place-items-center overflow-hidden rounded-lg transition-transform active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2';
export function StickerPicker({ onPick, onWrite, onClose, hiddenWidgets = [], onRestore }: {
  onPick: (id: ArtId) => void; onWrite: () => void; onClose: () => void;
  /** 편집 화면에서 뗀 위젯: 여기서 다시 붙인다 */
  hiddenWidgets?: { id: string; name: string }[]; onRestore?: (id: string) => void;
}) {
  return (
    <Sheet title="스티커 붙이기" onClose={onClose} className="sheet-box--glass" grabber>
      {hiddenWidgets.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="뗀 위젯 다시 붙이기">
          {hiddenWidgets.map((w) => (
            <li key={w.id}>
              <button type="button" onClick={() => onRestore?.(w.id)} className="min-h-11 rounded-full border border-edge bg-frame px-4 text-sm font-semibold">
                {w.name} 위젯 다시 붙이기
              </button>
            </li>
          ))}
        </ul>
      )}
      <ul className="grid grid-cols-3 gap-2">
        {ARTS.map((a) => (
          <li key={a.id}>
            <button type="button" onClick={() => onPick(a.id)} className={pick} aria-label={a.name}>
              <span className={`decor ${a.cls} is-placed`} style={{ position: 'static', transform: `rotate(${a.tilt / 2}deg)` }} aria-hidden="true">
                <ArtBody id={a.id} />
              </span>
            </button>
          </li>
        ))}
        <li>
          <button type="button" onClick={onWrite} className={pick} aria-label="텍스트 쓰기">
            <span className="decor decor--text is-placed" style={{ position: 'static' }} aria-hidden="true">
              <span style={{ fontFamily: fontOf('omiri').family, fontSize: 28 }}>텍스트</span>
            </span>
          </button>
        </li>
      </ul>
    </Sheet>
  );
}

export type TextInput = { text: string; font: TextFontId; color: string } & TextLook;

/** 화면에 보이는 영역(키보드를 뺀 높이)을 따라간다 — 도구 줄을 키보드 바로 위에 붙이려고 */
function useVisibleViewport() {
  const [box, setBox] = useState(() => ({ top: 0, height: window.innerHeight }));
  useEffect(() => {
    const vv = window.visualViewport;
    const update = () => setBox(vv ? { top: vv.offsetTop, height: vv.height } : { top: 0, height: window.innerHeight });
    update();
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);
  return box;
}

/** 글씨 테두리 미리보기: 입력칸에서는 text-stroke 대신 둥글게 두른 글자 그림자로 그린다 */
const strokeShadow = (c: string) =>
  c === 'none'
    ? undefined
    : Array.from({ length: 12 }, (_, i) => {
        const a = (Math.PI * 2 * i) / 12;
        return `${(3 * Math.cos(a)).toFixed(2)}px ${(3 * Math.sin(a)).toFixed(2)}px 0 ${c}`;
      }).join(', ');

const ALIGNS: { v: TextAlign; name: string }[] = [
  { v: 'center', name: '가운데 정렬' },
  { v: 'left', name: '왼쪽 정렬' },
  { v: 'right', name: '오른쪽 정렬' },
];

/** 글자 색 팔레트 (2026-11-20 사용자 요청: 색 여러 개) */
const PALETTE = [
  { v: '#2a2622', name: '검정' },
  { v: '#ffffff', name: '흰색' },
  { v: '#8a8580', name: '회색' },
  { v: '#c93a2b', name: '빨강' },
  { v: '#ef7d32', name: '주황' },
  { v: '#f2c230', name: '노랑' },
  { v: '#2f8a57', name: '초록' },
  { v: '#3aa6c9', name: '하늘' },
  { v: '#2f5fb3', name: '파랑' },
  { v: '#6a4bb3', name: '보라' },
  { v: '#e86a9a', name: '분홍' },
  { v: '#8a5a3c', name: '갈색' },
] as const;

/** 정렬 아이콘: 가로줄 세 개 */
function AlignIcon({ align }: { align: TextAlign }) {
  const x = (w: number) => (align === 'left' ? 4 : align === 'right' ? 20 - w : 12 - w / 2);
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1={x(16)} x2={x(16) + 16} y1="7" y2="7" />
      <line x1={x(10)} x2={x(10) + 10} y1="12" y2="12" />
      <line x1={x(14)} x2={x(14) + 14} y1="17" y2="17" />
    </svg>
  );
}

/** 스포이드 아이콘 */
function DropperIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 5.5l4 4" />
      <path d="M17.6 3.4a2 2 0 0 1 2.9 2.9l-2.3 2.3-2.9-2.9z" />
      <path d="M15.3 8.6L6.8 17.1 4 20l2.9-2.8 8.5-8.5" />
    </svg>
  );
}

type Tool = 'font' | 'color' | 'stroke' | 'align' | 'style';

/** EyeDropper(크롬 등)만 있는 화면 색 집기. 없는 브라우저는 색 고르기 창으로 대신한다 */
type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };

/**
 * 글씨 스티커 쓰기·고치기 (2026-11-20 사용자 요청으로 구성 변경)
 * - 입력칸 없이 검은 반투명 바탕 위에 바로 쓴다. 열리면 바로 커서가 깜빡인다
 * - 아래 도구 줄: Aa(글꼴) | 무지개 팔레트(색) | 정렬 | BIU(굵게·기울이기·밑줄). 누르면 배경이 칠해지고 그 위에 고를 것들이 뜬다
 * - 키보드가 올라오면 도구 줄이 키보드 바로 위에 붙는다. 취소·붙이기는 위에 있어 가리지 않는다
 */
export function TextComposer({ initial, onDone, onClose }: { initial?: TextInput; onDone: (t: TextInput) => void; onClose: () => void }) {
  const [text, setText] = useState(initial?.text ?? '');
  const [font, setFont] = useState<TextFontId>(initial?.font ?? 'omiri');
  const [color, setColor] = useState<string>(initial?.color ?? TEXT_COLORS[0].v);
  const [align, setAlign] = useState<TextAlign>(initial?.align ?? 'center');
  const [bold, setBold] = useState(!!initial?.bold);
  const [italic, setItalic] = useState(!!initial?.italic);
  const [underline, setUnderline] = useState(!!initial?.underline);
  const [stroke, setStroke] = useState<string>(initial?.stroke ?? '#ffffff'); // 테두리 색, 'none'은 없음
  const [tool, setTool] = useState<Tool>();
  const vv = useVisibleViewport();
  const area = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const f = fontOf(font);
  const clean = text.trim();
  const done = () => { if (clean) onDone({ text: clean, font, color, align, bold, italic, underline, stroke }); };

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    area.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); closeRef.current(); } };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      opener?.focus?.();
    };
  }, []);

  // 글이 길어 줄이 넘어가면 쓰는 칸 높이를 글에 맞춘다
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [text, font, bold, italic, underline, align]);

  // 도구를 눌러도 쓰는 칸 초점(= 키보드·커서)이 내려가지 않게
  const keep = (e: { preventDefault: () => void; target: EventTarget }) => {
    if ((e.target as HTMLElement).closest('input')) return;
    e.preventDefault();
  };
  const toggle = (t: Tool) => setTool((cur) => (cur === t ? undefined : t));

  const pickFromScreen = async () => {
    const ED = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper;
    if (ED) {
      try { setColor((await new ED().open()).sRGBHex); } catch { /* 취소 */ }
      area.current?.focus({ preventScroll: true });
    } else {
      picker.current?.click();
    }
  };
  const custom = !PALETTE.some((c) => c.v.toLowerCase() === color.toLowerCase());
  const lines = Math.min(MAX_LINES, Math.max(1, text.split('\n').length));
  const alignName = ALIGNS.find((a) => a.v === align)!.name;

  return createPortal(
    <div className="tc" role="dialog" aria-modal="true" aria-label={initial ? '글씨 고치기' : '글씨 붙이기'} style={{ top: vv.top, height: vv.height }}>
      <div className="tc__top">
        <button type="button" className="tc__btn" onClick={onClose}>취소</button>
        <span className="tc__count" aria-hidden="true">{countChars(text)}/{TEXT_MAX}</span>
        <button type="button" className="tc__btn tc__btn--done" disabled={!clean} onClick={done}>{initial ? '고치기' : '붙이기'}</button>
      </div>

      <div className="tc__stage" onClick={() => area.current?.focus()}>
        <textarea
          ref={area}
          autoFocus
          aria-label={`쓸 말, ${TEXT_MAX}자, 줄바꿈 ${MAX_LINES}줄까지`}
          rows={lines}
          className="tc__text"
          value={text}
          spellCheck={false}
          onChange={(e) => setText(clampText(e.target.value, TEXT_MAX))}
          style={{
            textAlign: align, fontFamily: f.family, fontWeight: bold ? 800 : f.weight, fontStyle: italic ? 'italic' : 'normal',
            textDecoration: underline ? 'underline' : 'none',
            fontSize: f.size * 1.3, color, textShadow: strokeShadow(stroke),
          }}
        />
      </div>

      <div className="tc__tools" onPointerDown={keep} onMouseDown={keep}>
        {/* 고른 도구의 선택지: 도구 줄 바로 위에 뜬다 */}
        {tool === 'font' && (
          <div className="tc__row" role="group" aria-label="글꼴">
            {TEXT_FONTS.map((x) => (
              <button key={x.id} type="button" className="tc__chip" aria-pressed={font === x.id} aria-label={x.name} onClick={() => setFont(x.id)}>
                <span style={{ fontFamily: x.family, fontWeight: x.weight, fontSize: x.size - 8 }} aria-hidden="true">가나다</span>
              </button>
            ))}
          </div>
        )}
        {tool === 'color' && (
          <div className="tc__row" role="group" aria-label="글자 색">
            <button type="button" className="tc__icon" aria-label="스포이드로 색 집기" onClick={pickFromScreen}><DropperIcon /></button>
            <input ref={picker} type="color" className="sr-only" tabIndex={-1} aria-hidden="true" value={/^#[0-9a-f]{6}$/i.test(color) ? color : '#000000'} onChange={(e) => setColor(e.target.value)} />
            {custom && (
              <button type="button" className="tc__swatch" aria-pressed="true" aria-label="집은 색">
                <span aria-hidden="true" style={{ background: color }} />
              </button>
            )}
            {PALETTE.map((c) => (
              <button key={c.v} type="button" className="tc__swatch" aria-pressed={color.toLowerCase() === c.v} aria-label={c.name} onClick={() => setColor(c.v)}>
                <span aria-hidden="true" style={{ background: c.v }} />
              </button>
            ))}
          </div>
        )}
        {tool === 'stroke' && (
          <div className="tc__row" role="group" aria-label="테두리 색">
            <button type="button" className="tc__swatch" aria-pressed={stroke === 'none'} aria-label="테두리 없음" onClick={() => setStroke('none')}>
              <span aria-hidden="true" className="tc__none" />
            </button>
            {PALETTE.map((c) => (
              <button key={c.v} type="button" className="tc__swatch" aria-pressed={stroke.toLowerCase() === c.v} aria-label={`${c.name} 테두리`} onClick={() => setStroke(c.v)}>
                <span aria-hidden="true" style={{ background: c.v }} />
              </button>
            ))}
          </div>
        )}
        {tool === 'align' && (
          <div className="tc__row" role="group" aria-label="정렬">
            {ALIGNS.map((a) => (
              <button key={a.v} type="button" className="tc__icon" aria-pressed={align === a.v} aria-label={a.name} onClick={() => setAlign(a.v)}>
                <AlignIcon align={a.v} />
              </button>
            ))}
          </div>
        )}
        {tool === 'style' && (
          <div className="tc__row" role="group" aria-label="글자 모양">
            <button type="button" className="tc__icon" aria-pressed={bold} aria-label="굵게" onClick={() => setBold(!bold)}><b aria-hidden="true">B</b></button>
            <button type="button" className="tc__icon" aria-pressed={italic} aria-label="기울이기" onClick={() => setItalic(!italic)}><i aria-hidden="true" style={{ fontFamily: 'serif' }}>I</i></button>
            <button type="button" className="tc__icon" aria-pressed={underline} aria-label="밑줄" onClick={() => setUnderline(!underline)}><u aria-hidden="true">U</u></button>
          </div>
        )}

        {/* 도구 줄: Aa | 무지개 팔레트 | 테두리 | 정렬 | BIU */}
        <div className="tc__row tc__row--main" role="toolbar" aria-label="글씨 꾸미기">
          <button type="button" className="tc__tab" aria-expanded={tool === 'font'} aria-label="글꼴" onClick={() => toggle('font')}>
            <span aria-hidden="true" className="tc__aa">Aa</span>
          </button>
          <button type="button" className="tc__tab" aria-expanded={tool === 'color'} aria-label="색" onClick={() => toggle('color')}>
            <span aria-hidden="true" className="tc__rainbow"><span style={{ background: color }} /></span>
          </button>
          {/* 테두리 색 (2026-11-20 사용자 요청) */}
          <button type="button" className="tc__tab" aria-expanded={tool === 'stroke'} aria-label="테두리" onClick={() => toggle('stroke')}>
            <span aria-hidden="true" className="tc__outline">A</span>
          </button>
          <button type="button" className="tc__tab" aria-expanded={tool === 'align'} aria-label={`정렬, 지금 ${alignName}`} onClick={() => toggle('align')}>
            <AlignIcon align={align} />
          </button>
          <button type="button" className="tc__tab" aria-expanded={tool === 'style'} aria-label="굵게·기울이기·밑줄" onClick={() => toggle('style')}>
            <span aria-hidden="true" className="tc__biu"><b>B</b><i>I</i><u>U</u></span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** 한 줄·메모장 쓰기·고치기: 손글씨로 붙는다. 최근 영수증 한 줄을 골라 올 수도 있다 */
export function LineComposer({ initial, suggestions, memo = false, onDone, onClose }: {
  initial?: string; suggestions: string[]; memo?: boolean; onDone: (text: string) => void; onClose: () => void;
}) {
  const [text, setText] = useState(initial ?? '');
  const clean = text.trim();
  const max = memo ? MEMO_MAX : LINE_MAX;
  const lines = memo ? 5 : MAX_LINES;
  const name = memo ? '메모장' : '한 줄';
  return (
    <Sheet title={initial ? `${name} 고치기` : `${name} 쓰기`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (clean) onDone(clean);
        }}
      >
        <Field id="line-sticker" label={memo ? '메모' : '한 줄'} hint={`${countChars(text)}/${max}자 · 줄바꿈 ${lines}줄까지`}>
          <textarea
            id="line-sticker"
            rows={memo ? 4 : 2}
            className={`${inputClass} resize-none`}
            value={text}
            placeholder={memo ? '오늘 남기고 싶은 말' : '오늘 어땠어?'}
            onChange={(e) => setText(clampText(e.target.value, max, lines))}
          />
        </Field>

        {suggestions.length > 0 && !initial && (
          <div>
            <p className="text-sm font-semibold" id="line-suggest">최근 영수증의 한 줄에서 가져오기</p>
            <ul className="mt-1 flex flex-wrap gap-2" aria-labelledby="line-suggest">
              {suggestions.map((s) => (
                <li key={s}>
                  <button type="button" onClick={() => setText(clampText(s, max, lines))} className="min-h-11 rounded-full border border-rule bg-frame px-3 text-left text-sm hover:border-ink">
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div aria-hidden="true" className="diary-line-preview grid min-h-20 place-items-center rounded-sm border border-dashed border-rule px-3 py-2 text-center whitespace-pre-wrap">
          {clean || '미리 보기'}
        </div>

        <Button type="submit" disabled={!clean}>{initial ? '고치기' : '붙이기'}</Button>
      </form>
    </Sheet>
  );
}

export type { WidgetKind };
/** 'receipt': 홈의 최근 영수증 위젯 (스타일 없이 바로 붙인다) */
export type PickKind = WidgetKind | 'receipt';

const WIDGET_KINDS: { kind: PickKind; name: string }[] = [
  { kind: 'bucket', name: '버킷리스트' },
  { kind: 'memo', name: '메모장' },
  { kind: 'todo', name: '투두리스트' },
  { kind: 'frame', name: '포토프레임' },
  { kind: 'receipt', name: '영수증' },
];

/** 위젯 붙이기: 위젯 그림만 스티커처럼 (이름·바탕 없이) */
export function WidgetPicker({ onPick, onClose }: { onPick: (k: PickKind) => void; onClose: () => void }) {
  return (
    <Sheet title="위젯 붙이기" onClose={onClose} className="sheet-box--glass" grabber>
      <ul className="grid grid-cols-2 gap-3">
        {WIDGET_KINDS.map((w) => (
          <li key={w.kind}>
            <button type="button" onClick={() => onPick(w.kind)} className="widget-pick" aria-label={w.name}>
              <span className="widget-pick__art" aria-hidden="true">{w.kind === 'receipt' ? <ReceiptPreview /> : <WidgetPreview kind={w.kind} />}</span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

/** 위젯 창의 영수증 그림 (예시) */
function ReceiptPreview() {
  return (
    <span className="w-receipt" style={{ display: 'block' }}>
      <span className="receipt" style={{ display: 'block' }}>
        <span className="receipt__paper">
          <span className="receipt__title">[ 영수증 ]</span>
          <span className="receipt__rule" />
          <span>우리 둘</span>
          <span>2026.11.20</span>
          <span className="receipt__row" style={{ marginTop: 3 }}><span>No.</span><span>12</span></span>
          <span className="receipt__rule" />
          <span className="receipt__row receipt__total"><span>TOTAL</span><span>D+411</span></span>
        </span>
      </span>
    </span>
  );
}

const STYLE_LISTS: Record<WidgetKind, { list: readonly { id: string; name: string }[]; name: string }> = {
  memo: { list: MEMO_STYLES, name: '메모장' },
  bucket: { list: BUCKET_STYLES, name: '버킷리스트' },
  todo: { list: TODO_STYLES, name: '투두리스트' },
  frame: { list: FRAME_STYLES, name: '포토프레임' },
};

/** 스타일 고르기: 위젯을 고른 다음, 또는 편집 화면의 '스타일' 단추. 그림만 (이름은 화면 낭독기로) */
export function StylePicker({ kind, current, onPick, onClose, onBack }: { kind: WidgetKind; current?: string; onPick: (style: string) => void; onClose: () => void; onBack?: () => void }) {
  const { list, name } = STYLE_LISTS[kind];
  return (
    <Sheet title={current ? `${name} 스타일 바꾸기` : `${name} 고르기`} onClose={onClose} onBack={onBack} className="sheet-box--glass" grabber>
      <ul className={`grid gap-3 ${kind === 'frame' ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {list.map((st) => (
          <li key={st.id}>
            <button
              type="button"
              onClick={() => onPick(st.id)}
              className={`style-pick style-pick--${kind} ${current === st.id ? 'is-current' : ''}`}
              aria-label={st.name}
              aria-pressed={current ? current === st.id : undefined}
            >
              <span className="style-pick__art" aria-hidden="true">
                <WidgetPreview kind={kind} style={st.id} />
                {/* 투두리스트: 지금 스타일은 카드 바깥을 두르는 아이 그림 같은 빨간 점선 (카드 위를 지나가지 않게, 2026-11-20) */}
                {kind === 'todo' && current === st.id && (
                  <svg className="style-pick__doodle" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <path vectorEffect="non-scaling-stroke" d="M10 12.2 C24 5.9 46 10.1 66 6.6 C80 4.5 96 8 93.3 22 C96.1 38 90.5 52 94.7 70 C96.8 84 90 96 72 92.3 C54 95.8 36 90.2 18 94.4 C6 97 3.9 86 6.7 70 C3.2 54 8.8 40 4.6 26 C3.9 20 5.3 16 10 12.2" />
                  </svg>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

/**
 * 버킷리스트·투두리스트 쓰기·고치기: 고른 디자인 그대로 위에서 바로 쓴다 (2026-11-20 사용자 요청)
 * 항목마다 입력칸, 마지막 빈 칸에 쓰면 다음 칸이 생긴다. Enter로 다음 칸. 고칠 때 같은 항목의 체크는 그대로
 */
export function ListComposer({ kind, style, initial, onDone, onClose, onBack }: {
  kind: ListKind; style: ListStyle; initial?: ListItem[];
  onDone: (items: ListItem[]) => void; onClose: () => void; onBack?: () => void;
}) {
  const [values, setValues] = useState<string[]>(() => (initial ?? []).map((i) => i.text));
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const rows = values.map((t) => t.trim()).filter(Boolean);
  // 빈 칸 하나를 늘 끝에 둔다 (최대 개수 전까지)
  const slots = values.length < LIST_ITEMS ? [...values, ''] : values;
  const was = new Map((initial ?? []).map((i) => [i.text, i]));
  const shown: ListItem[] = slots.map((t) => {
    const old = was.get(t.trim());
    return { text: t, done: old?.done ?? false, ...(old?.days ? { days: old.days } : {}) };
  });
  const setAt = (i: number, v: string) => {
    const next = [...slots];
    next[i] = [...v].slice(0, ITEM_MAX).join('');
    while (next.length && next[next.length - 1] === '') next.pop(); // 끝의 빈 칸은 저장 목록에서 뺀다
    setValues(next);
  };
  return (
    <Sheet title={`${LIST_NAMES[kind]} ${initial ? '고치기' : '쓰기'}`} onClose={onClose} onBack={onBack}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!rows.length) return;
          onDone(rows.map((t) => {
            const old = was.get(t);
            return { text: t, done: old?.done ?? false, ...(old?.days ? { days: old.days } : {}) };
          }));
        }}
      >
        <div className="list-compose">
          <ListCard
            kind={kind}
            style={style}
            items={shown}
            renderText={(i) => (
              <input
                ref={(el) => { refs.current[i] = el; }}
                className="wl__input"
                value={slots[i]}
                aria-label={`${i + 1}번째 ${kind === 'bucket' ? '하고 싶은 것' : '할 일'}`}
                autoFocus={i === 0 && !initial}
                enterKeyHint="next"
                onChange={(e) => setAt(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); refs.current[i + 1]?.focus(); }
                  if (e.key === 'Backspace' && !slots[i] && i > 0) { e.preventDefault(); refs.current[i - 1]?.focus(); }
                }}
              />
            )}
          />
        </div>
        <Button type="submit" disabled={!rows.length}>{initial ? '고치기' : '붙이기'}</Button>
      </form>
    </Sheet>
  );
}
