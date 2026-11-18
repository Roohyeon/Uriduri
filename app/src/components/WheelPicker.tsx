import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { scrollBehavior } from '../lib/motion';

const ROW = 44; // 한 칸 높이(px)
const VISIBLE = 5; // 보이는 칸 수 (가운데가 선택)

/**
 * 휠 피커 한 열.
 * - 위아래로 굴리면 가운데 칸이 선택된다 (scroll-snap)
 * - 가운데 숫자를 누르면 입력칸으로 바뀌어 직접 쓸 수 있다
 * - 다른 칸을 누르면 그 칸으로 굴러간다
 * - 키보드: ↑↓로 한 칸, Enter로 직접 입력
 */
export function WheelColumn({
  label,
  unit,
  values,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  values: number[];
  value: number;
  onChange: (v: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const settle = useRef<number>();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const index = Math.max(0, values.indexOf(value));

  // 값이 바깥에서 바뀌면(범위 변경·직접 입력) 그 칸으로 굴린다
  // 처음 그릴 때는 애니메이션 없이 바로 그 자리에 둔다 (부드러운 스크롤 중간값이 선택되는 문제 방지)
  const mounted = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!mounted.current) { mounted.current = true; el.scrollTop = index * ROW; return; }
    if (Math.round(el.scrollTop / ROW) !== index) el.scrollTo({ top: index * ROW, behavior: scrollBehavior() });
  }, [index, values.length]);

  const onScroll = () => {
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const i = Math.min(values.length - 1, Math.max(0, Math.round(el.scrollTop / ROW)));
      if (values[i] !== value) onChange(values[i]);
    }, 90);
  };

  const commit = () => {
    const n = parseInt(draft, 10);
    if (!Number.isNaN(n)) {
      const clamped = Math.min(values[values.length - 1], Math.max(values[0], n));
      onChange(clamped);
    }
    setEditing(false);
  };

  const onKey = (e: KeyboardEvent) => {
    if (editing) return;
    if (e.key === 'ArrowUp' && index > 0) { e.preventDefault(); onChange(values[index - 1]); }
    if (e.key === 'ArrowDown' && index < values.length - 1) { e.preventDefault(); onChange(values[index + 1]); }
    if (e.key === 'Enter') { e.preventDefault(); setDraft(String(value)); setEditing(true); }
  };

  return (
    <div className="relative flex-1">
      <div
        ref={ref}
        role="spinbutton"
        tabIndex={0}
        aria-label={label}
        aria-valuenow={value}
        aria-valuetext={`${value}${unit}`}
        aria-description="위아래 화살표로 바꾸고, Enter로 직접 입력해요"
        aria-valuemin={values[0]}
        aria-valuemax={values[values.length - 1]}
        onScroll={onScroll}
        onKeyDown={onKey}
        className="wheel relative overflow-y-scroll overscroll-contain font-receipt focus-visible:outline-2"
        style={{ height: ROW * VISIBLE, scrollSnapType: 'y mandatory', paddingBlock: ROW * 2 }}
      >
        {values.map((v, i) => {
          const dist = Math.abs(i - index);
          const center = i === index;
          return (
            // 숫자 칸은 손가락·마우스용. 키보드와 화면 읽기 프로그램은 바깥 spinbutton으로 다룬다 [03-4.1.2]
            <div
              key={v}
              aria-hidden="true"
              onClick={() => {
                if (center) { setDraft(String(v)); setEditing(true); }
                else onChange(v);
              }}
              className={`flex w-full cursor-pointer items-center justify-center hover:text-ink ${center ? 'text-ink' : 'text-fade'}`}
              style={{
                height: ROW,
                scrollSnapAlign: 'center',
                // 투명도 없이 fade 그대로(종이 위 6.4:1). 먼 칸은 크기로만 줄인다 [03-2차 1.4.3]
                fontSize: center ? 22 : dist >= 2 ? 16 : 18,
                fontWeight: center ? 600 : 400,
                transform: `perspective(300px) rotateX(${Math.max(-50, Math.min(50, (index - i) * 22))}deg)`,
              }}
            >
              {v}
              {center && <span className="ml-0.5 text-sm font-normal">{unit}</span>}
            </div>
          );
        })}
      </div>

      {editing && (
        <div className="absolute inset-x-1 z-10" style={{ top: ROW * 2 }}>
          <input
            autoFocus
            inputMode="numeric"
            pattern="[0-9]*"
            aria-label={`${label} 직접 입력`}
            name={`wheel-${label}`}
            autoComplete="off"
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, unit === '년' ? 4 : 2))}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
            className="block w-full rounded-sm border-2 border-ink bg-paper text-center font-receipt text-xl font-semibold"
            style={{ height: ROW }}
          />
        </div>
      )}
    </div>
  );
}

/** 년·월·일 휠 피커. 오늘(max)을 넘는 날짜는 고를 수 없다 */
export function DateWheel({ value, onChange, max, minYear }: { value: string; onChange: (v: string) => void; max: string; minYear: number }) {
  const [y, m, d] = value.split('-').map(Number);
  const [maxY, maxM, maxD] = max.split('-').map(Number);
  const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

  const monthsFor = (yy: number) => range(1, yy === maxY ? maxM : 12);
  const daysFor = (yy: number, mm: number) => {
    const last = new Date(yy, mm, 0).getDate();
    return range(1, yy === maxY && mm === maxM ? maxD : last);
  };
  // 년·월이 바뀌면 일/월을 범위 안으로 맞춘다
  const set = (yy: number, mm: number, dd: number) => {
    const ms = monthsFor(yy);
    const m2 = Math.min(mm, ms[ms.length - 1]);
    const ds = daysFor(yy, m2);
    const d2 = Math.min(dd, ds[ds.length - 1]);
    onChange(`${yy}-${String(m2).padStart(2, '0')}-${String(d2).padStart(2, '0')}`);
  };

  return (
    <div className="relative rounded-sm bg-paper px-2 shadow-paper">
      {/* 가운데 선택 띠 + 위아래 흐려짐 */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-2 rounded-sm border-y-2 border-ink/80" style={{ top: ROW * 2, height: ROW }} />
      <div aria-hidden="true" className="wheel-fade pointer-events-none absolute inset-0 z-[1]" />
      <div className="flex">
        <WheelColumn label="년" unit="년" values={range(minYear, maxY)} value={y} onChange={(v) => set(v, m, d)} />
        <WheelColumn label="월" unit="월" values={monthsFor(y)} value={m} onChange={(v) => set(y, v, d)} />
        <WheelColumn label="일" unit="일" values={daysFor(y, m)} value={d} onChange={(v) => set(y, m, v)} />
      </div>
    </div>
  );
}
