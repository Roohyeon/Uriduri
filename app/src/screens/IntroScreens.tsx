import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, TextButton } from '../components/ui';
import { CoupleMark, Stamp } from '../components/Receipt';
import { scrollBehavior } from '../lib/motion';
import { onboarded, pendingInvite } from '../services';
import type { Nav } from '../App';

/** 스플래시 (2026-11-18 사용자 결정): 로그인 전에 앱을 처음 열었을 때 로고를 잠깐 보여 준다 */
export function SplashScreen({ onDone, ms = 1500 }: { onDone: () => void; ms?: number }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, ms);
    return () => window.clearTimeout(t);
  }, [onDone, ms]);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3" aria-label="우리두리">
      <CoupleMark className="h-16 w-[6.4rem] text-ink" />
      <span className="text-2xl font-bold tracking-tight">우리두리</span>
      <span className="font-receipt text-xs tracking-widest text-fade">DATE RECEIPT</span>
    </main>
  );
}

type Slide = { title: string; body: string; art: ReactNode };

/** 소개 장마다 들어가는 작은 그림 — 앱의 감열지 영수증 분위기를 그대로 쓴다 */
const MiniReceipt = ({ className = '', memo = '오늘 진짜 맛있었다' }: { className?: string; memo?: string }) => (
  <div className={`w-36 bg-paper px-3 py-3 font-receipt text-[10px] shadow-paper ${className}`}>
    <div className="text-center font-bold">우리두리</div>
    <div className="mt-1 flex justify-between text-fade"><span>2026.11.18</span><span>D+100</span></div>
    <div className="mt-2 h-16 bg-gradient-to-br from-counter to-rule" />
    <div className="mt-2 truncate">{memo}</div>
  </div>
);

const SLIDES: Slide[] = [
  {
    title: '사진 한 장, 한 줄이면 끝',
    body: '10초 만에 데이트 영수증을 발행해요.',
    art: <MiniReceipt />,
  },
  {
    title: '상대는 도장으로 쾅',
    body: '영수증에 빨간 도장을 찍어 반응해요.',
    art: (
      <div className="relative">
        <MiniReceipt />
        <div className="absolute -right-6 -bottom-4">
          <Stamp mark={{ by: '', shape: 'heart', label: '또 가자!', rot: -12, x: 0, y: 0 }} size={72} />
        </div>
      </div>
    ),
  },
  {
    title: '둘만의 화이트보드',
    body: '우리 데이트가 보드에 차곡차곡 쌓여요.',
    art: (
      <div className="relative h-44 w-60 rounded-sm bg-board">
        <MiniReceipt className="absolute top-3 left-2 -rotate-6 scale-75" memo="첫 캠핑" />
        <MiniReceipt className="absolute top-1 right-0 rotate-3 scale-75" memo="한강 피크닉" />
      </div>
    ),
  },
  {
    title: '기록은 우리 손에',
    body: '이미지로 저장하고, 언제든 통째로 백업해요.',
    art: (
      <div className="flex items-end gap-3">
        <MiniReceipt />
        <div className="flex h-14 w-12 items-center justify-center rounded-sm border border-dashed border-edge font-receipt text-xs text-fade">ZIP</div>
      </div>
    ),
  },
];

/** 앱 소개 4장 (2026-11-18 사용자 결정): 옆으로 넘기기 + 점 표시 + 건너뛰기. 다음은 닉네임 */
export function IntroScreen({ nav }: { nav: Nav }) {
  const [i, setI] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const last = i === SLIDES.length - 1;

  const go = (n: number) => {
    const el = track.current;
    if (el) el.scrollTo({ left: n * el.clientWidth, behavior: scrollBehavior() });
    setI(n);
  };
  const onScroll = () => {
    const el = track.current;
    if (el) setI(Math.round(el.scrollLeft / el.clientWidth));
  };
  const finish = () => {
    onboarded.set();
    nav({ name: 'nickname' });
  };
  // 초대 링크로 들어온 사람도 같은 소개를 본다. 토큰은 pendingInvite에 남아 있다
  const invited = !!pendingInvite.get();

  return (
    <main className="flex min-h-screen flex-col pb-10">
      <div className="flex h-14 items-center justify-between px-6">
        <h1 className="text-sm font-semibold outline-none">{invited ? '초대받았어요' : '우리두리'}</h1>
        {!last && <TextButton className="text-fade" onClick={finish}>건너뛰기</TextButton>}
      </div>
      <div
        ref={track}
        onScroll={onScroll}
        className="flex flex-1 snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-roledescription="carousel"
        aria-label="앱 소개"
      >
        {SLIDES.map((s, n) => (
          <section
            key={s.title}
            className="flex w-full shrink-0 snap-center flex-col items-center justify-center gap-10 px-6"
            aria-roledescription="slide"
            aria-label={`${n + 1} / ${SLIDES.length}`}
            aria-hidden={n !== i}
          >
            <div className="flex h-48 items-center justify-center">{s.art}</div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-balance">{s.title}</h2>
              <p className="mt-2 text-sm text-fade">{s.body}</p>
            </div>
          </section>
        ))}
      </div>
      <div className="space-y-6 px-6">
        <div className="flex justify-center gap-2">
          {SLIDES.map((s, n) => (
            <button
              key={s.title}
              type="button"
              aria-label={`${n + 1}번째 소개 보기`}
              aria-current={n === i}
              onClick={() => go(n)}
              className="flex h-6 w-6 items-center justify-center"
            >
              <span className={`block h-2 rounded-full transition-all ${n === i ? 'w-5 bg-ink' : 'w-2 bg-rule'}`} />
            </button>
          ))}
        </div>
        <Button onClick={() => (last ? finish() : go(i + 1))}>{last ? '시작하기' : '다음'}</Button>
      </div>
    </main>
  );
}
