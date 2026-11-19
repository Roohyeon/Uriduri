import { useRef, type MouseEvent, type ReactNode, type Ref } from 'react';
import { MoodFace } from './MoodFace';
import { hashId, photoBg, showDate, type Receipt as R, type StampMark, type StampShape } from '../data';

/* ───────── 장식 요소 (레퍼런스 반영) ───────── */

/** 잉크 번짐 필터 — 도장 가장자리를 실제 인주처럼 거칠게. App에 한 번만 렌더 */
export function InkFilterDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true">
      <filter id="ink-rough">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="3" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.6" />
      </filter>
    </svg>
  );
}

const CLIP_COLORS = ['text-clip-pink', 'text-clip-sky', 'text-clip-butter'];

/** 파스텔 집게 (레퍼런스 8) */
export function Clip({ id, className = "" }: { id: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 46" aria-hidden="true" className={`absolute -top-6 left-1/2 z-10 h-11 w-16 -translate-x-1/2 drop-shadow-[0_2px_2px_rgb(31_32_35/0.25)] ${CLIP_COLORS[id % 3]} ${className}`}>
      <circle cx="32" cy="11" r="8" fill="none" stroke="currentColor" strokeWidth="5" />
      <rect x="5" y="17" width="54" height="24" rx="4" fill="currentColor" />
      <rect x="5" y="34" width="54" height="7" rx="2" fill="#1f2023" opacity="0.12" />
      <rect x="9" y="20" width="46" height="3" rx="1.5" fill="#ffffff" opacity="0.45" />
    </svg>
  );
}

/** 마스킹테이프 (레퍼런스 6) */
function Tape({ id }: { id: number }) {
  return <span aria-hidden="true" className={`tape absolute -top-3 left-1/2 z-10 h-6 w-24 -translate-x-1/2 ${id % 2 ? 'rotate-3' : '-rotate-2'}`} />;
}

/** 폴라로이드처럼 흰 테두리를 두른 사진 + 집게 또는 테이프 */
function Polaroid({ r, tall = false }: { r: R; tall?: boolean }) {
  const n = hashId(r.id);
  const tilt = [-1.6, 1.2, -0.8][n % 3];
  return (
    <figure className="relative mx-auto w-[88%] bg-frame p-2 pb-7 shadow-[0_3px_8px_-2px_rgb(31_32_35/0.3)]" style={{ transform: `rotate(${tilt}deg)` }}>
      {n % 2 === 0 ? <Tape id={n} /> : <Clip id={n} />}
      <div
        role="img"
        aria-label={r.photo.label}
        className={`grid w-full place-items-center text-xl ${tall ? 'aspect-[4/5]' : 'aspect-[4/3]'}`}
        style={{ background: photoBg(r.photo) }}
      >
        {!r.photo.src && <span aria-hidden="true">{r.photo.emoji}</span>}
      </div>
      {r.place && <figcaption className="absolute right-3 bottom-1.5 left-3 truncate text-right text-xs text-fade">{r.place}</figcaption>}
    </figure>
  );
}

/** 도장 모양 (D34): 동그라미·하트·세모. 바깥 굵은 선 + 안쪽 가는 선으로 이중 테두리 */
const SHAPES: Record<StampShape, { outer: string; inner: string; textTop: string }> = {
  circle: {
    outer: 'M50 6 a44 44 0 1 0 0.01 0 Z',
    inner: 'M50 13 a37 37 0 1 0 0.01 0 Z',
    textTop: '50%',
  },
  heart: {
    outer: 'M50 92 C18 70 4 52 4 33 C4 17 16 6 30 6 C40 6 46 12 50 19 C54 12 60 6 70 6 C84 6 96 17 96 33 C96 52 82 70 50 92 Z',
    inner: 'M50 83 C23 64 12 49 12 34 C12 22 21 14 31 14 C40 14 46 21 50 29 C54 21 60 14 69 14 C79 14 88 22 88 34 C88 49 77 64 50 83 Z',
    textTop: '45%',
  },
  triangle: {
    outer: 'M50 5 L96 91 L4 91 Z',
    inner: 'M50 19 L85 84 L15 84 Z',
    textTop: '64%',
  },
};
export const SHAPE_NAMES: Record<StampShape, string> = { circle: '동그라미', heart: '하트', triangle: '세모' };

/** 인주 도장 (D32→D34) — 고른 모양 안에 직접 쓴 문구, 잉크 번짐 필터 */
export function Stamp({ mark, animate = false, size = 76, ink = true }: { mark: StampMark; animate?: boolean; size?: number; ink?: boolean }) {
  const s = SHAPES[mark.shape];
  const len = [...mark.label].length;
  const fs = len <= 3 ? 15 : len <= 5 ? 13 : 11;
  return (
    <span
      style={{ ['--rot' as string]: `${mark.rot}deg`, transform: `rotate(${mark.rot}deg)`, width: size, height: size, filter: ink ? 'url(#ink-rough)' : undefined }}
      className={`relative block text-seal opacity-90 mix-blend-multiply ${animate ? 'anim-stamp' : ''}`}
      role="img"
      aria-label={`${mark.byName ?? mark.by}의 ${SHAPE_NAMES[mark.shape]} 스탬프: ${mark.label}`}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden="true">
        <path d={s.outer} fill="none" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" />
        <path d={s.inner} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
      <span
        className="absolute left-1/2 w-[64%] -translate-x-1/2 -translate-y-1/2 text-center leading-tight font-black break-keep"
        style={{ top: s.textTop, fontSize: fs }}
      >
        {mark.label}
      </span>
    </span>
  );
}

function StampLayer({ r, animateBy }: { r: R; animateBy?: string }) {
  return (
    <>
      {r.stamps.map((s) => (
        <span key={s.by} className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2" style={{ left: `${s.x}%`, top: `${s.y}%` }}>
          <Stamp mark={s} animate={animateBy === s.by} />
        </span>
      ))}
    </>
  );
}

/** 점선으로 이어지는 영수증 항목 줄 (레퍼런스 1) */
function Line({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 text-sm">
      {/* dl 안에는 dt·dd만 둔다. 점선은 dt 안의 장식 [03-2차 1.3.1] */}
      <dt className="flex flex-1 items-baseline gap-2 text-fade">
        <span className="shrink-0">{k}</span>
        <span aria-hidden="true" className="mb-1 flex-1 border-b border-dotted border-rule" />
      </dt>
      <dd className="min-w-0 text-right break-words">{v}</dd>
    </div>
  );
}

/* ───────── 영수증 ───────── */

/** 영수증 한 장의 본문 — 목록·상세·미리보기 공통 (03 R5 표시 항목) */
export function ReceiptBody({ r, size = 'list' }: { r: R; size?: 'list' | 'detail' }) {
  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between font-receipt text-sm">
        <span>{showDate(r.date)}</span>
        <span className="text-fade">No.{r.no}</span>
      </div>
      <div className="pt-3">
        <Polaroid r={r} tall={size === 'detail'} />
      </div>
      <p className={`${size === 'detail' ? 'text-lg' : 'text-base'} leading-snug font-semibold break-words`}>“{r.memo}”</p>
      <dl className="space-y-1">
        {r.place && <Line k="장소" v={r.place} />}
        {r.mood && <Line k="기분" v={<MoodFace mood={r.mood} size={18} />} />}
        <Line k="발행" v={r.author} />
      </dl>
    </div>
  );
}

function Barcode({ no }: { no: string }) {
  const bars = Array.from({ length: 40 }, (_, i) => ((i * 7 + (Number(no) || 0) * 3) % 3) + 1); // 번호가 아직 없으면('----') 0으로
  let x = 0;
  return (
    <div className="mt-5 flex flex-col items-center gap-1" aria-hidden="true">
      <svg viewBox="0 0 140 28" className="h-8 w-48 text-ink">
        {bars.map((w, i) => {
          const rect = i % 2 === 0 ? <rect key={i} x={x} y={0} width={w} height={28} fill="currentColor" /> : null;
          x += w + 1;
          return rect;
        })}
      </svg>
      <span className="font-receipt text-xs tracking-widest text-fade">{no}</span>
    </div>
  );
}

/** 프린터 슬롯 — 영수증이 이 틈에서 나온다 (레퍼런스 2) */
export function PrinterSlot({ children, printing = false }: { children: ReactNode; printing?: boolean }) {
  return (
    <div className="relative">
      <div className="slot relative z-10 -mx-2 h-7 rounded-sm" aria-hidden="true">
        <div className="slot-mouth absolute inset-x-5 bottom-2 h-1.5 rounded-full" />
      </div>
      <div className="-mt-3 overflow-hidden px-0 pt-3">
        <div className={printing ? 'anim-slot' : ''}>{children}</div>
      </div>
    </div>
  );
}

/** 두 사람 픽토그램 — 레퍼런스의 검은 실루엣 로고 자리 */
export function CoupleMark({ className = 'mx-auto h-10 w-16 text-ink' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 40" className={className} aria-hidden="true">
      <circle cx="20" cy="7" r="6" fill="currentColor" />
      <circle cx="44" cy="7" r="6" fill="currentColor" />
      <path d="M11 40 L13 20 Q14 15 20 15 Q26 15 27 20 L29 30 L32 26 L35 30 L37 20 Q38 15 44 15 Q50 15 51 20 L53 40 Z" fill="currentColor" />
      <path d="M32 24 C29 20 25 22 27 25 L32 30 L37 25 C39 22 35 20 32 24 Z" fill="var(--color-paper)" />
    </svg>
  );
}

/** 상세 보기 영수증 줄 구분선 (레퍼런스: 가는 점선) */
function Dash() {
  return <hr aria-hidden="true" className="my-4 border-0 border-t border-dashed border-rule" />;
}

/**
 * 상세 보기: 검은 롤러에서 풀려 나오는 영수증 (레퍼런스 10).
 * - 화면에 들어오면 종이가 롤러 아래로 스르륵 풀려 내려온다.
 * - stamping 모드에서는 영수증을 눌러 그 자리에 도장을 찍는다.
 */
export function RollReceipt({
  r,
  stampingLabel,
  onStampAt,
  animateBy,
  exportRef,
}: {
  r: R;
  mine: boolean;
  stampingLabel?: string;
  onStampAt?: (x: number, y: number) => void;
  animateBy?: string;
  /** 이미지로 저장할 때 그릴 종이 (R8) */
  exportRef?: Ref<HTMLElement>;
}) {
  const paperRef = useRef<HTMLDivElement>(null);

  const onClick = (e: MouseEvent) => {
    if (!stampingLabel || !onStampAt || !paperRef.current) return;
    const rect = paperRef.current.getBoundingClientRect();
    onStampAt(Math.round(((e.clientX - rect.left) / rect.width) * 100), Math.round(((e.clientY - rect.top) / rect.height) * 100));
  };

  return (
    <div className="relative mx-auto w-[min(380px,94vw)] pt-2">
      {/* 영수증 홀더 (레퍼런스 12) — 양 끝이 아래로 굽은 굵은 검은 막대, 종이는 그 사이에서 나온다 */}
      <div aria-hidden="true" className="printer relative z-10">
        {/* 홀더 안에 감긴 종이 롤 — 둥근 원통 음영 */}
        <div className="paper-roll absolute inset-0" />
      </div>
      {/* 홀더 안쪽에서 밀려 나오는 종이 — 위쪽은 막대에 가려진다 */}
      <div className="relative -mt-3 mx-[13px] overflow-hidden">
        <article ref={exportRef} aria-label={`${showDate(r.date)} 영수증`} className="anim-unroll roll-paper relative">
          <div
            ref={paperRef}
            onClick={onClick}
            className={`relative px-6 pt-12 pb-10 font-receipt ${stampingLabel ? 'cursor-crosshair' : ''}`}
          >
            <header className="text-center uppercase">
              <CoupleMark />
              <h2 lang="en" className="mt-5 text-xl font-semibold tracking-wide">Date Receipt</h2>
              {/* 한 줄로 (사용자 요청 2026-11-19) */}
              <p className="mt-5 flex items-baseline justify-between gap-2 text-[min(12px,3.1vw)] whitespace-nowrap">
                <span><span lang="en">ORDER:</span>#{r.no}</span>
                <span>{showDate(r.date)}</span>
                <span>우리두리 — ♥</span>
              </p>
            </header>

            {/* 기록 내용은 영수증 구성을 다시 짤 예정: 지금은 사진만 (2026-11-19) */}
            <Dash />
            <section aria-label="사진">
              <div className="roll-grid border-b-2 border-ink p-3">
                <div
                  role="img"
                  aria-label={r.photo.label}
                  className="grid aspect-[4/5] w-full place-items-center text-2xl"
                  style={{ background: photoBg(r.photo) }}
                >
                  {!r.photo.src && <span aria-hidden="true">{r.photo.emoji}</span>}
                </div>
              </div>
            </section>

            <StampLayer r={r} animateBy={animateBy} />
          </div>
          <div aria-hidden="true" className="scallop-bottom" />
        </article>
      </div>
    </div>
  );
}

/** 미리보기용 단독 영수증 (작성 화면) */
export function ReceiptPaper({ r, printing = false }: { r: R; printing?: boolean }) {
  return (
    <PrinterSlot printing={printing}>
      <article aria-label="발행될 영수증 미리보기" className="drop-shadow-[0_6px_10px_rgb(31_32_35/0.18)]">
        <div className="relative bg-paper px-5 pt-5 pb-4">
          <ReceiptBody r={r} size="detail" />
          <Barcode no={r.no} />
        </div>
        <div className="tear-bottom" />
      </article>
    </PrinterSlot>
  );
}

export function ReceiptRollSkeleton() {
  return (
    <PrinterSlot>
      <div aria-busy="true" className="shadow-paper">
        <div className="space-y-6 bg-paper px-4 py-5">
          {[0, 1].map((i) => (
            <div key={i} className={`space-y-3 ${i ? 'perforation pt-5' : ''}`}>
              <div className="h-4 w-1/2 bg-counter" />
              <div className="mx-auto aspect-[4/3] w-[88%] bg-counter" />
              <div className="h-4 w-3/4 bg-counter" />
            </div>
          ))}
        </div>
        <div className="tear-bottom" />
      </div>
    </PrinterSlot>
  );
}

/** 왁스 실링 — 상대가 연결된 순간 (레퍼런스 3·4·5) */
export function WaxSeal({ text = '우리' }: { text?: string }) {
  return (
    <span aria-hidden="true" className="wax anim-wax grid size-20 place-items-center text-paper">
      <span className="grid size-14 place-items-center rounded-full border-2 border-paper/40 text-base font-black tracking-tight">{text}</span>
    </span>
  );
}
