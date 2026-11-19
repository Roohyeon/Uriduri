import { useState } from 'react';
import { Button, Field, Sheet, inputClass } from '../ui';
import { countChars } from '../../lib/text';
import { ARTS, ArtBody, ITEM_MAX, LINE_MAX, LIST_ITEMS, LIST_NAMES, MAX_LINES, MEMO_MAX, TEXT_COLORS, TEXT_FONTS, TEXT_MAX, clampText, fontOf, type ArtId, type ListItem, type ListKind, type TextFontId } from './pieces';
import { WidgetPreview, type WidgetKind } from './widgets';
import { BUCKET_STYLES, FRAME_STYLES, MEMO_STYLES, TODO_STYLES } from './styles';

/** 고르는 칸 (라디오) 공통 모양: 고르면 진한 테두리, 키보드 초점도 보이게 */
const choice =
  'cursor-pointer rounded-sm border border-rule bg-frame has-[:checked]:border-ink has-[:checked]:ring-2 has-[:checked]:ring-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2';

/** 스티커 붙이기: 스티커만 늘어놓는다 (이름·바탕 없이). 마지막 '텍스트'는 글씨 스티커 쓰기로 */
const pick = 'grid h-24 w-full place-items-center rounded-lg transition-transform active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2';
export function StickerPicker({ onPick, onWrite, onClose, hiddenWidgets = [], onRestore }: {
  onPick: (id: ArtId) => void; onWrite: () => void; onClose: () => void;
  /** 편집 화면에서 뗀 위젯: 여기서 다시 붙인다 */
  hiddenWidgets?: { id: string; name: string }[]; onRestore?: (id: string) => void;
}) {
  return (
    <Sheet title="스티커 붙이기" onClose={onClose}>
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

export type TextInput = { text: string; font: TextFontId; color: string };

/** 글씨 스티커 쓰기·고치기 창 */
export function TextComposer({ initial, onDone, onClose }: { initial?: TextInput; onDone: (t: TextInput) => void; onClose: () => void }) {
  const [text, setText] = useState(initial?.text ?? '');
  const [font, setFont] = useState<TextFontId>(initial?.font ?? 'omiri');
  const [color, setColor] = useState<string>(initial?.color ?? TEXT_COLORS[0].v);
  const f = fontOf(font);
  const clean = text.trim();
  return (
    <Sheet title={initial ? '글씨 고치기' : '글씨 붙이기'} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (clean) onDone({ text: clean, font, color });
        }}
      >
        <Field id="text-sticker" label="쓸 말" hint={`${countChars(text)}/${TEXT_MAX}자 · 줄바꿈 ${MAX_LINES}줄까지`}>
          <textarea
            id="text-sticker"
            rows={2}
            className={`${inputClass} resize-none`}
            value={text}
            placeholder="오늘 하고 싶은 말"
            onChange={(e) => setText(clampText(e.target.value, TEXT_MAX))}
          />
        </Field>

        <fieldset>
          <legend className="text-sm font-semibold">글꼴</legend>
          <div className="mt-1 grid gap-2">
            {TEXT_FONTS.map((x) => (
              <label key={x.id} className={`flex min-h-12 items-center justify-between gap-3 px-3 py-1.5 ${choice}`}>
                <input type="radio" name="text-font" value={x.id} checked={font === x.id} onChange={() => setFont(x.id)} className="sr-only" />
                <span style={{ fontFamily: x.family, fontWeight: x.weight, fontSize: x.size - 4 }} aria-hidden="true">{clean || '우리두리'}</span>
                <span className="shrink-0 text-xs text-fade">{x.name}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold">색</legend>
          <div className="mt-1 flex gap-2">
            {TEXT_COLORS.map((c) => (
              <label key={c.v} className={`grid size-11 place-items-center rounded-full ${choice}`}>
                <input type="radio" name="text-color" value={c.v} checked={color === c.v} onChange={() => setColor(c.v)} className="sr-only" />
                <span aria-hidden="true" className="size-6 rounded-full" style={{ background: c.v }} />
                <span className="sr-only">{c.name}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div aria-hidden="true" className="grid min-h-20 place-items-center rounded-sm border border-dashed border-rule bg-frame px-3 py-2 text-center whitespace-pre-wrap">
          <span style={{ fontFamily: f.family, fontWeight: f.weight, fontSize: f.size, color, lineHeight: 1.15 }}>{clean || '미리 보기'}</span>
        </div>

        <Button type="submit" disabled={!clean}>{initial ? '고치기' : '붙이기'}</Button>
      </form>
    </Sheet>
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
const WIDGET_KINDS: { kind: WidgetKind; name: string }[] = [
  { kind: 'bucket', name: '버킷리스트' },
  { kind: 'memo', name: '메모장' },
  { kind: 'todo', name: '투두리스트' },
  { kind: 'frame', name: '포토프레임' },
];

/** 위젯 붙이기: 4가지 위젯 그림만 스티커처럼 (이름·바탕 없이) */
export function WidgetPicker({ onPick, onClose }: { onPick: (k: WidgetKind) => void; onClose: () => void }) {
  return (
    <Sheet title="위젯 붙이기" onClose={onClose}>
      <ul className="grid grid-cols-2 gap-3">
        {WIDGET_KINDS.map((w) => (
          <li key={w.kind}>
            <button type="button" onClick={() => onPick(w.kind)} className="widget-pick" aria-label={w.name}>
              <span className="widget-pick__art" aria-hidden="true"><WidgetPreview kind={w.kind} /></span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

const STYLE_LISTS: Record<WidgetKind, { list: readonly { id: string; name: string }[]; name: string }> = {
  memo: { list: MEMO_STYLES, name: '메모장' },
  bucket: { list: BUCKET_STYLES, name: '버킷리스트' },
  todo: { list: TODO_STYLES, name: '투두리스트' },
  frame: { list: FRAME_STYLES, name: '포토프레임' },
};

/** 스타일 고르기: 위젯을 고른 다음, 또는 편집 화면의 '스타일' 단추. 그림만 (이름은 화면 낭독기로) */
export function StylePicker({ kind, current, onPick, onClose }: { kind: WidgetKind; current?: string; onPick: (style: string) => void; onClose: () => void }) {
  const { list, name } = STYLE_LISTS[kind];
  return (
    <Sheet title={current ? `${name} 스타일 바꾸기` : `${name} 고르기`} onClose={onClose}>
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
              <span className="style-pick__art" aria-hidden="true"><WidgetPreview kind={kind} style={st.id} /></span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

/** 버킷리스트·투두리스트 쓰기·고치기: 한 줄에 하나씩. 고칠 때 같은 항목의 체크는 그대로 */
export function ListComposer({ kind, initial, onDone, onClose }: { kind: ListKind; initial?: ListItem[]; onDone: (items: ListItem[]) => void; onClose: () => void }) {
  const [text, setText] = useState((initial ?? []).map((i) => i.text).join('\n'));
  const rows = text.split('\n').map((t) => t.trim()).filter(Boolean);
  const clip = (v: string) => v.split('\n').slice(0, LIST_ITEMS).map((l) => [...l].slice(0, ITEM_MAX).join('')).join('\n');
  return (
    <Sheet title={`${LIST_NAMES[kind]} ${initial ? '고치기' : '쓰기'}`} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!rows.length) return;
          const was = new Map((initial ?? []).map((i) => [i.text, i.done]));
          const days = new Map((initial ?? []).map((i) => [i.text, i.days]));
          onDone(rows.map((t) => ({ text: t, done: was.get(t) ?? false, ...(days.get(t) ? { days: days.get(t) } : {}) })));
        }}
      >
        <Field id="list-items" label={kind === 'bucket' ? '하고 싶은 것' : '할 일'} hint={`한 줄에 하나씩 · ${rows.length}/${LIST_ITEMS}개 · 하나에 ${ITEM_MAX}자까지`}>
          <textarea
            id="list-items"
            rows={5}
            className={`${inputClass} resize-none`}
            value={text}
            placeholder={kind === 'bucket' ? '제주 여행\n커플링 맞추기\n한강 피크닉' : '영화 예매\n꽃 사 가기'}
            onChange={(e) => setText(clip(e.target.value))}
          />
        </Field>
        <p className="text-sm text-fade">붙인 뒤에는 항목을 눌러 체크할 수 있어요.</p>
        <Button type="submit" disabled={!rows.length}>{initial ? '고치기' : '붙이기'}</Button>
      </form>
    </Sheet>
  );
}
