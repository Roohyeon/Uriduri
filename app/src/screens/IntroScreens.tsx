import { useEffect, useRef, useState, type ReactNode } from 'react';
import { TextButton } from '../components/ui';
import { CoupleMark, Stamp } from '../components/Receipt';
import { MoodFace } from '../components/MoodFace';
import { Bubble, Doodle, MiniMonth, PhotoSticker, Sticker, TimeChip } from '../components/Stickers';
import { scrollBehavior } from '../lib/motion';
import { todayIso } from '../lib/dates';
import { onboarded, pendingInvite } from '../services';
import type { Nav } from '../App';

/*
 * 스플래시·앱 소개 — 스티커 콜라주 v2 (2026-11-19 사용자 요청: 홈 '오늘'처럼 아기자기하게)
 * 모눈 노트 바탕 + 오려 붙인 사진·말풍선·시간 칩·달력·낙서
 */

/** 스플래시 (2026-11-18 사용자 결정): 로그인 전에 앱을 처음 열었을 때 로고를 잠깐 보여 준다.
 *  스티커가 다 붙는 걸 볼 수 있게 1.5초 → 2초 */
export function SplashScreen({ onDone, ms = 2000 }: { onDone: () => void; ms?: number }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, ms);
    return () => window.clearTimeout(t);
  }, [onDone, ms]);
  return (
    <main className="relative min-h-screen overflow-hidden" aria-label="우리두리">
      <GridBackdrop />
      <Sticker left="-4%" top={70} width="max(44%, 160px)" tilt={-8} delay={0}>
        <span className="sticker block rounded-lg bg-frame px-3 pt-2 pb-3"><MiniMonth today={todayIso()} mark="" /></span>
      </Sticker>
      <Sticker right="6%" top={96} width="auto" tilt={5} delay={90}>
        <Bubble>보고 싶어 🥺</Bubble>
      </Sticker>
      <Sticker right="8%" top={150} width="34%" tilt={6} delay={150}>
        <PhotoSticker tone="sky" emoji="🌅" />
        <TimeChip who="지" tone="blush" className="absolute -right-3 -bottom-4 -rotate-6">오후 7:30</TimeChip>
      </Sticker>
      <Sticker left="-5%" top={330} width={110} tilt={-6} delay={220}>
        <MoodSticker mood="happy" />
        <TimeChip who="현" tone="sky" className="-mt-3 ml-6">오전 7:30</TimeChip>
      </Sticker>

      <div className="absolute inset-x-0 top-[44%] z-10 flex -translate-y-1/2 flex-col items-center gap-2">
        <CoupleMark className="h-12 w-[4.8rem] text-ink" />
        <span className="sticker-text text-[48px] font-black tracking-tight">우리두리</span>
        <span className="sticker-flat rounded-full bg-frame px-3 py-0.5 font-receipt text-[11px] tracking-widest text-fade">DATE RECEIPT</span>
      </div>
      <Doodle kind="sparkle" style={{ left: '22%', top: '36%' }} />
      <Doodle kind="lines" style={{ right: '16%', top: '40%' }} />
      <Doodle kind="heart" style={{ right: '30%', bottom: '24%' }} />

      <Sticker left="6%" top={560} width="38%" tilt={-5} delay={300}>
        <Bubble className="mb-5">Love 😍</Bubble>
        <PhotoSticker tone="sun" emoji="🍰" />
      </Sticker>
      <Sticker right="3%" top={600} width="auto" tilt={7} delay={380}>
        <Ticket top="D+100" main="우리 100일" />
      </Sticker>
    </main>
  );
}

type Slide = { title: ReactNode; label: string; body: string; art: ReactNode };

const SLIDES: Slide[] = [
  {
    label: '사진 한 장, 한 줄이면 끝',
    title: <>사진 한 장, 한 줄이면<br />영수증 발행 끝</>,
    body: '10초 만에 오늘 데이트를 남겨요.',
    art: (
      <>
        <Sticker left="10%" top={40} width="52%" tilt={-5} delay={0}>
          <PhotoSticker tone="sun" emoji="🍰" caption="망원 케이크 맛집" />
        </Sticker>
        <Sticker right="2%" top={8} width="auto" tilt={4} delay={100}>
          <Bubble>오늘 진짜 맛있었다</Bubble>
        </Sticker>
        <Sticker left="44%" top={262} width="auto" tilt={-4} delay={200}>
          <TimeChip who="현" tone="sky">오후 7:30</TimeChip>
        </Sticker>
        <Doodle kind="sparkle" style={{ right: '12%', top: 120 }} />
        <Doodle kind="arrow" style={{ right: '18%', top: 200 }} />
      </>
    ),
  },
  {
    label: '상대는 도장으로 쾅',
    title: <>상대는<br />도장으로 쾅!</>,
    body: '영수증에 빨간 도장을 찍어 반응해요.',
    art: (
      <>
        <Sticker left="6%" top={30} width="50%" tilt={-4} delay={0}>
          <PhotoSticker tone="blush" emoji="🎡" caption="놀이공원 데이트" />
        </Sticker>
        <Sticker left="36%" top={150} width={96} tilt={0} delay={260}>
          <Stamp mark={{ by: '', shape: 'heart', label: '또 가자!', rot: -12, x: 0, y: 0 }} size={96} />
        </Sticker>
        <Sticker right="5%" top={24} width={100} tilt={10} delay={120}>
          <MoodSticker mood="flutter" />
          <TimeChip who="지" tone="blush" className="-mt-3 ml-2">오후 10:30</TimeChip>
        </Sticker>
        <Doodle kind="heart" style={{ right: '14%', top: 230 }} />
        <Doodle kind="lines" style={{ left: '2%', top: 10 }} />
      </>
    ),
  },
  {
    label: '하루하루가 우리 보드에 쌓여요',
    title: <>하루하루가<br />우리 보드에 쌓여요</>,
    body: '데이트가 날짜순으로 차곡차곡 붙어요.',
    art: (
      <>
        <Sticker left="0%" top={20} width="36%" tilt={-8} delay={0}>
          <PhotoSticker tone="sky" emoji="🌅" />
        </Sticker>
        <Sticker left="32%" top={64} width="34%" tilt={5} delay={100}>
          <PhotoSticker tone="butter" emoji="🍜" />
        </Sticker>
        <Sticker right="0%" top={14} width="32%" tilt={9} delay={200}>
          <PhotoSticker tone="blush" emoji="🎬" />
        </Sticker>
        <Sticker left="4%" top={176} width="max(42%, 160px)" tilt={-3} delay={300}>
          <span className="sticker block rounded-lg bg-frame px-3 pt-2 pb-3"><MiniMonth today={todayIso()} mark="" /></span>
        </Sticker>
        <Sticker right="0%" top={262} width="auto" tilt={6} delay={380}>
          <Ticket top="D+100" main="우리 100일" />
        </Sticker>
      </>
    ),
  },
  {
    label: '기록은 우리 손에',
    title: <>기록은<br />언제나 우리 손에</>,
    body: '이미지로 저장하고, 통째로 백업해요.',
    art: (
      <>
        <Sticker left="8%" top={30} width="50%" tilt={-4} delay={0}>
          <PhotoSticker tone="sky" emoji="🌊" caption="첫 바다 여행" />
        </Sticker>
        <Sticker right="6%" top={60} width="36%" tilt={7} delay={120}>
          <span className="sticker block rounded-xl bg-clip-butter px-3 py-4 text-center">
            <span className="block font-receipt text-[24px] font-black">ZIP</span>
            <span className="mt-1 block text-xs font-bold">전체 백업</span>
          </span>
        </Sticker>
        <Sticker right="8%" top={228} width="auto" tilt={-5} delay={240}>
          <span className="sticker-flat inline-flex items-center gap-1 rounded-full bg-frame px-3 py-1.5 text-sm font-bold">
            <span aria-hidden="true">⬇</span> 이미지 저장
          </span>
        </Sticker>
        <Doodle kind="arrow" style={{ left: '52%', top: 190 }} />
        <Doodle kind="sparkle" style={{ left: '4%', top: 270 }} />
      </>
    ),
  },
];

/** 앱 소개 4장 (2026-11-18 사용자 결정): 옆으로 넘기기 + 번호 표시 + 건너뛰기. 다음은 닉네임 */
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
    <main className="relative flex min-h-screen flex-col pb-8">
      <GridBackdrop />
      <div className="flex h-14 items-center justify-between px-6">
        <h1 className="sticker-text text-base font-black outline-none">{invited ? '초대받았어요' : '우리두리'}</h1>
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
            key={s.label}
            className="flex w-full shrink-0 snap-center flex-col items-center justify-end gap-6 px-6"
            aria-roledescription="slide"
            aria-label={`${n + 1} / ${SLIDES.length}: ${s.label}`}
            aria-hidden={n !== i}
          >
            <div aria-hidden="true" className="intro-art relative w-full max-w-[340px]">
              <div className="intro-art-inner absolute inset-x-0 top-0 h-[330px]">{s.art}</div>
            </div>
            <div className="text-center">
              <h2 className="sticker-text text-[26px] leading-tight font-black text-balance">{s.title}</h2>
              <p className="mt-2 text-sm text-fade">{s.body}</p>
            </div>
          </section>
        ))}
      </div>
      <div className="space-y-5 px-6 pt-5">
        <div className="flex justify-center gap-1">
          {SLIDES.map((s, n) => (
            <button
              key={s.label}
              type="button"
              aria-label={`${n + 1}번째 소개 보기`}
              aria-current={n === i}
              onClick={() => go(n)}
              className={`sticker-text grid size-9 place-items-center text-xl font-black transition-colors ${n === i ? 'text-ink' : 'text-rule'}`}
            >
              {n + 1}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => (last ? finish() : go(i + 1))}
          className="block min-h-14 w-full rounded-full bg-ink px-4 text-base font-bold text-paper hover:bg-ink/85"
        >
          {last ? '시작하기' : '다음'}
        </button>
      </div>
    </main>
  );
}

function GridBackdrop() {
  return <div aria-hidden="true" className="grid-paper pointer-events-none fixed inset-0 -z-10" />;
}

function MoodSticker({ mood }: { mood: 'happy' | 'flutter' }) {
  return (
    <span aria-hidden="true" className={`sticker grid size-[92px] place-items-center rounded-full text-ink ${mood === 'happy' ? 'bg-sun' : 'bg-blush'}`}>
      <MoodFace mood={mood} size={60} label={false} />
    </span>
  );
}

function Ticket({ top, main }: { top: string; main: string }) {
  return (
    <span className="sticker flex items-stretch rounded-md bg-blush">
      <span className="flex-1 px-3 py-2">
        <span className="block font-receipt text-[9px] tracking-wider whitespace-nowrap text-ink/70">ADMIT TWO</span>
        <span className="block text-sm font-black whitespace-nowrap">{main}</span>
      </span>
      <span aria-hidden="true" className="my-1.5 border-l-2 border-dashed border-ink/30" />
      <span className="grid place-items-center px-2 font-receipt text-sm font-bold whitespace-nowrap">{top}</span>
    </span>
  );
}
