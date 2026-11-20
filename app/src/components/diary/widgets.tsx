import { useState, type ReactNode } from 'react';
import type { IsoDate } from '../../lib/dates';
import { LIST_NAMES, type ListItem, type ListKind } from './pieces';
import { frameStyleOf, type FrameStyle, type ListStyle, type MemoStyle } from './styles';

/*
 * 붙이는 위젯의 모양 (아래 탭 오른쪽 '위젯'). 스타일 목록은 styles.ts, 꾸밈은 index.css '위젯 스타일'
 * 모두 흰 테두리 + 그림자로 오려 붙인 느낌. 손글씨 글꼴
 */

const WEEK = ['월', '화', '수', '목', '금', '토', '일'];
const todayIndex = () => (new Date().getDay() + 6) % 7; // 월 = 0

/* ───────────── 메모장 ───────────── */

/** interactive: 보통 화면에서 편지를 톡하면 펼치기·접기 */
export function MemoCard({ text, style, interactive = false }: { text: string; style: MemoStyle; interactive?: boolean }) {
  const [open, setOpen] = useState(false);
  if (style === 'letter') {
    const inner = open ? (
      <span className="wm-letter__paper">{text}</span>
    ) : (
      <span className="wm-letter__env" aria-hidden="true">
        <span className="wm-letter__flap" />
        <span className="wm-letter__seal">♥</span>
        <span className="wm-letter__to">To. 우리</span>
      </span>
    );
    return interactive ? (
      <button type="button" className={`wg wm wm--letter ${open ? 'is-open' : ''}`} aria-expanded={open} aria-label={open ? '편지 접기' : '편지 펼치기'} onClick={() => setOpen((o) => !o)}>
        {inner}
      </button>
    ) : (
      <span className={`wg wm wm--letter ${open ? 'is-open' : ''}`}>{inner}</span>
    );
  }
  return (
    <span className={`wg wm wm--${style}`}>
      {style === 'lined' && <span className="wm__tape" aria-hidden="true" />}
      {style === 'torn' && <span className="wm__rings" aria-hidden="true" />}
      {style === 'typewriter' && <span className="wm__head" aria-hidden="true">— MEMO —</span>}
      <span className="wm__text">{text}</span>
    </span>
  );
}

/* ───────────── 버킷리스트 · 투두리스트 ───────────── */

export function ListCard({ kind, style, items, onToggle, onToggleDay, renderText, year }: {
  kind: ListKind; style: ListStyle; items: ListItem[];
  /** 있으면 제목 앞에 붙인 해 (화면에 붙은 버킷리스트만) */
  year?: number;
  onToggle?: (i: number) => void; onToggleDay?: (i: number, day: number) => void;
  /** 쓰기 화면: 항목 글자 자리에 입력칸을 넣는다 (그 디자인 그대로 바로 쓰기, 2026-11-20) */
  renderText?: (i: number) => ReactNode;
}) {
  const done = items.filter((i) => i.done).length;
  const title = year ? `${year} ${LIST_NAMES[kind]}` : LIST_NAMES[kind];
  const today = todayIndex();

  const head = (() => {
    switch (style) {
      case 'passport': return <span className="wl__head"><span className="wl__kicker">✈ PASSPORT</span>{title}</span>;
      case 'scratch': return <span className="wl__head"><span className="wl__kicker">✦ SCRATCH ✦</span>{title}</span>;
      case 'ticket': return <span className="wl__head"><span className="wl__kicker">ADMIT TWO</span>{title}</span>;
      case 'progress':
        return (
          <span className="wl__head">
            {title} <span className="wl__count">{done}/{items.length}</span>
            <span className="wl__bar" aria-hidden="true"><span style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} /></span>
          </span>
        );
      case 'clipboard': return <><span className="wl__clip" aria-hidden="true" /><span className="wl__head">{title}</span></>;
      case 'receipt': return <span className="wl__head">[ TO DO ]<span className="wl__rule" aria-hidden="true" /></span>;
      case 'planner':
        return (
          <span className="wl__head">
            이번 주
            <span className="wl__week" aria-hidden="true">
              {WEEK.map((w, i) => <span key={w} className={i === today ? 'is-today' : ''}>{w}</span>)}
            </span>
          </span>
        );
      case 'habit':
        return (
          <span className="wl__head">
            {title}
            <span className="wl__days" aria-hidden="true">{WEEK.map((w) => <span key={w}>{w}</span>)}</span>
          </span>
        );
      default: return <span className="wl__head">{title}</span>;
    }
  })();

  const mark = (it: ListItem) => {
    switch (style) {
      case 'heart': return it.done ? '♥' : '♡';
      case 'progress': return it.done ? '★' : '☆';
      case 'scratch': return it.done ? '★' : '';
      case 'receipt': return it.done ? '✓' : '·';
      default: return it.done ? '✓' : '';
    }
  };

  return (
    <span className={`wg wl wl--${kind} wl--${style}`}>
      {head}
      <span className="wl__items" role="list">
        {items.map((it, i) => {
          if (style === 'habit') {
            const days = it.days ?? [];
            return (
              <span key={i} role="listitem" className="wl__item">
                <span className="wl__text">{renderText ? renderText(i) : it.text}</span>
                <span className="wl__dots">
                  {WEEK.map((w, d) =>
                    onToggleDay ? (
                      <button key={w} type="button" role="checkbox" aria-checked={!!days[d]} aria-label={`${it.text} ${w}요일`} className={`wl__dot ${days[d] ? 'is-on' : ''}`} onClick={() => onToggleDay(i, d)} />
                    ) : (
                      <span key={w} className={`wl__dot ${days[d] ? 'is-on' : ''}`} />
                    ),
                  )}
                </span>
              </span>
            );
          }
          const inner = (
            <>
              <span className="wl__box" aria-hidden="true">{mark(it)}</span>
              <span className="wl__text">{renderText ? renderText(i) : it.text}</span>
              {style === 'passport' && it.done && <span className="wl__stamp" aria-hidden="true">DONE</span>}
              {style === 'ticket' && <span className="wl__punch" aria-hidden="true" />}
            </>
          );
          return (
            <span key={i} role="listitem" className={`wl__item ${it.done ? 'is-done' : ''}`}>
              {onToggle ? (
                <button type="button" role="checkbox" aria-checked={it.done} className="wl__btn" onClick={() => onToggle(i)}>{inner}</button>
              ) : <span className="wl__btn">{inner}</span>}
            </span>
          );
        })}
      </span>
    </span>
  );
}

/* ───────────── 포토프레임 ───────────── */

const shortDate = (iso?: IsoDate) => (iso ? `${+iso.slice(5, 7)}.${+iso.slice(8, 10)}` : '');

/** urls: 칸마다 사진 주소. sample: 고르는 창의 예시(파스텔 바탕) */
export function FrameCard({ style, urls, date, dplus, onCell, sample = false }: {
  style: FrameStyle; urls: (string | undefined)[]; date?: IsoDate; dplus?: number; onCell?: (i: number) => void; sample?: boolean;
}) {
  const n = frameStyleOf(style).cells;
  const four = style.startsWith('four');
  return (
    <span className={`wg wf wf--${style} ${four ? 'wf--fourcut' : ''}`}>
      <span className="wf__cells">
        {Array.from({ length: n }, (_, i) => {
          const url = urls[i];
          const content = url ? (
            <span className="wf__img" style={{ backgroundImage: `url("${url}")` }} />
          ) : sample ? (
            <span className={`wf__img wf__img--sample wf__img--s${i % 4}`} />
          ) : (
            <span className="wf__empty" aria-hidden="true">+</span>
          );
          return onCell ? (
            <button key={i} type="button" className="wf__cell" onClick={() => onCell(i)} aria-label={url ? `${i + 1}번째 사진, 사진첩에서 보기` : `${i + 1}번째 칸, 눌러서 사진 넣기`}>
              {content}
            </button>
          ) : (
            <span key={i} className="wf__cell">{content}</span>
          );
        })}
      </span>
      {four && (
        <span className="wf__note">
          우리두리
          <br />
          {[dplus ? `D+${dplus}` : '', date ? date.slice(2).split('-').join('.') : ''].filter(Boolean).join(' · ')}
        </span>
      )}
      {style === 'polaroid' && <span className="wf__cap">{shortDate(date) || '우리 둘'}</span>}
      {style === 'print' && date && <span className="wf__date">'{date.slice(2, 4)} {date.slice(5, 7)} {date.slice(8, 10)}</span>}
      {style === 'stamp' && <span className="wf__stamp-text">우리두리 ♡</span>}
    </span>
  );
}

/* ───────────── 고르는 창에 보이는 예시 ───────────── */

const SAMPLE_ITEMS: Record<ListKind, ListItem[]> = {
  bucket: [{ text: '제주 여행', done: true }, { text: '커플링 맞추기', done: false }, { text: '한강 피크닉', done: false }],
  todo: [{ text: '영화 예매', done: true, days: [true, true, false, true] }, { text: '꽃 사 가기', done: false, days: [true, false, true] }, { text: '편지 쓰기', done: false, days: [false, true] }],
};
const SAMPLE_DATE = '2026-11-19';

export type WidgetKind = 'memo' | ListKind | 'frame';

/** kind만 주면 기본 스타일 (위젯 창), style까지 주면 그 스타일 (스타일 창) */
export function WidgetPreview({ kind, style }: { kind: WidgetKind; style?: string }) {
  switch (kind) {
    case 'memo':
      return <MemoCard text={'오늘 데이트\n최고였어 ♡'} style={(style ?? 'lined') as MemoStyle} />;
    case 'bucket':
    case 'todo':
      return <ListCard kind={kind} style={(style ?? (kind === 'bucket' ? 'heart' : 'check')) as ListStyle} items={SAMPLE_ITEMS[kind]} />;
    case 'frame':
      return <FrameCard style={(style ?? 'wood') as FrameStyle} urls={[]} sample date={SAMPLE_DATE} dplus={411} />;
  }
}
