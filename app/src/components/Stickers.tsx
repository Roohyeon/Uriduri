import type { CSSProperties, ReactNode } from 'react';

/* 스티커 콜라주 조각 (2026-11-19) — 홈 '오늘'·스플래시·앱 소개가 함께 쓴다. 스타일은 index.css '스티커 콜라주' */

/** 콜라주 위 자리 — 기울기와 붙는 순서(톡) */
export function Sticker({
  left, right, top, width, tilt, delay, children,
}: { left?: string; right?: string; top: number; width: string | number; tilt: number; delay: number; children: ReactNode }) {
  const style = { left, right, top, width, transform: `rotate(${tilt}deg)`, animationDelay: `${delay}ms`, ['--tilt' as string]: `${tilt}deg` } as CSSProperties;
  return <div className="anim-pop absolute" style={style}>{children}</div>;
}

/** 작은 프로필 동그라미 + 시간·문구 칩 */
export function TimeChip({ who, tone, className = '', children }: { who: string; tone: 'blush' | 'sky'; className?: string; children: ReactNode }) {
  return (
    <span className={`sticker-flat inline-flex items-center gap-1.5 rounded-full bg-frame py-1 pr-3 pl-1 text-sm font-bold whitespace-nowrap ${className}`}>
      <span aria-hidden="true" className={`grid size-6 place-items-center rounded-full text-xs ${tone === 'blush' ? 'bg-blush' : 'bg-clip-sky'}`}>
        {[...who][0]}
      </span>
      <span className="sr-only">{who}, </span>
      <span className="font-receipt">{children}</span>
    </span>
  );
}

/** 작은 달력 — 오늘은 빨간 동그라미, 다음 기념일은 하트 */
export function MiniMonth({ today, mark }: { today: string; mark: string }) {
  const [y, m, d] = today.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const [my, mm, md] = mark.split('-').map(Number);
  const markDay = my === y && mm === m ? md : 0;
  const cells = [...Array(first).fill(0), ...Array.from({ length: days }, (_, i) => i + 1)];
  return (
    <span aria-hidden="true" className="block whitespace-nowrap">
      <span className="flex items-baseline justify-between">
        <span className="font-receipt text-sm font-bold">{y}</span>
        <span className="font-receipt text-[30px] leading-none font-black">{String(m).padStart(2, '0')}</span>
      </span>
      <span className="mt-1 grid grid-cols-7 text-center font-receipt text-[9px] text-fade">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, i) => <span key={i}>{w}</span>)}
      </span>
      <span className="grid grid-cols-7 gap-y-0.5 text-center font-receipt text-[10px]">
        {cells.map((c, i) => (
          <span key={i} className="grid place-items-center">
            {c === d ? (
              <span className="grid size-[17px] place-items-center rounded-full bg-seal font-bold text-paper">{c}</span>
            ) : c === markDay ? (
              <span className="text-seal">♥</span>
            ) : (
              <span className={c ? '' : 'invisible'}>{c || '.'}</span>
            )}
          </span>
        ))}
      </span>
    </span>
  );
}

/** 손으로 그린 낙서 */
export function Doodle({ kind, style }: { kind: 'sparkle' | 'heart' | 'lines' | 'arrow'; style: CSSProperties }) {
  const paths = {
    sparkle: <path d="M20 4c1 9 3 13 12 16-9 3-11 7-12 16-1-9-3-13-12-16 9-3 11-7 12-16z" />,
    heart: <path d="M20 33C8 25 5 18 8 13c3-5 9-4 12 1 3-5 9-6 12-1 3 5 0 12-12 20z" fill="#f7b3c8" stroke="#f7b3c8" />,
    lines: <><path d="M10 10l6 6" /><path d="M8 22h8" /><path d="M12 32l5-5" /></>,
    arrow: <><path d="M34 34C30 20 22 12 8 9" /><path d="M8 9l7-3M8 9l4 6" /></>,
  };
  return (
    <svg aria-hidden="true" viewBox="0 0 40 40" width="40" height="40" className="absolute text-ink" style={style}
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {paths[kind]}
    </svg>
  );
}


/** 말풍선 스티커 (꼬리는 index.css .bubble-tail) */
export function Bubble({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`bubble-tail sticker-flat relative inline-block rounded-[22px] bg-frame px-4 py-2.5 text-lg font-bold whitespace-nowrap ${className}`}>{children}</span>;
}

/** 오려 붙인 사진 — 실제 사진이 없을 때는 파스텔 바탕 + 그림 문자 */
export function PhotoSticker({ tone, emoji, caption, className = '' }: { tone: 'sky' | 'blush' | 'butter' | 'sun'; emoji: string; caption?: string; className?: string }) {
  const bg = { sky: 'bg-clip-sky', blush: 'bg-blush', butter: 'bg-clip-butter', sun: 'bg-sun' }[tone];
  return (
    <span className={`sticker-flat block bg-frame p-2 pb-2.5 ${className}`}>
      <span aria-hidden="true" className={`grid aspect-square w-full place-items-center text-[48px] ${bg}`}>{emoji}</span>
      {caption && <span className="mt-1.5 block truncate text-xs font-semibold">{caption}</span>}
    </span>
  );
}
