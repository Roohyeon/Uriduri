import type { ReactNode } from 'react';
import { Doodle, MiniMonth, Sticker, TimeChip } from '../components/Stickers';
import { MOOD_NAMES, photoBg, type Receipt } from '../data';
import { useToast } from '../components/ui';
import { Stamp } from '../components/Receipt';
import { MoodFace } from '../components/MoodFace';
import { addDays, dday, nextMilestone, todayIso } from '../lib/dates';
import type { BoardData, Nav, Session } from '../App';

/*
 * 홈 '오늘' 시안 v2 (2026-11-19) — 주소 /today
 * 하루를 모눈 노트 위 스티커 콜라주로: 오려 붙인 사진·말풍선·시간 칩·달력·메모·낙서
 * 실제 데이터: 닉네임, D+, 다음 100일 기념일, 최근 영수증(사진·날짜·기분·도장·NEW)
 * 예시 데이터(아직 기능 없음): 말풍선 메모, 오늘의 질문, 버킷리스트 → '예시' 표시
 */

const SAMPLE = {
  bubble: { text: '보고 싶어 🥺', time: '오전 8:12' },
  question: '오늘 전화할까?',
  bucket: [
    { text: '일본 여행', done: false },
    { text: '커플 사진 찍기', done: false },
    { text: '플레이리스트 교환', done: false },
    { text: '한강 10km 걷기', done: true },
  ],
};

export function DeskScreen({ session, board, nav }: { session: Session; board: BoardData; nav: Nav }) {
  const [toast, showToast] = useToast();
  const room = session.room!;
  const me = session.user!.id;
  const meName = session.profile?.nickname ?? '';
  const partner = room.members.find((m) => m.id !== me);
  const partnerName = partner?.nickname ?? '상대';
  const today = todayIso();
  const [, mm, dd] = today.split('-').map(Number);
  const d = dday(room.anniversary, today);
  const ms = nextMilestone(d);
  const msDate = addDays(today, ms.left);
  const latest = board.receipts[0];
  const newCount = board.receipts.filter((r) => r.isNew).length;
  const soon = () => showToast('아직 시안이에요. 이 기능은 다음 묶음에서 만들어요.');

  return (
    <>
      <div aria-hidden="true" className="grid-paper pointer-events-none fixed inset-0 -z-10" />

      <header className="relative px-4 pt-5 text-center">
        <h1 tabIndex={-1} className="sticker-text text-[34px] leading-none font-black tracking-tight outline-none">
          {mm}월 {dd}일
        </h1>
        <p className="sticker-flat mx-auto mt-3 inline-flex items-center gap-1.5 rounded-full bg-frame px-3 py-1 text-sm font-semibold">
          {meName} <span aria-label="와" className="text-seal">♥</span> {partnerName}
          <span className="font-receipt font-bold"><span className="sr-only">사귄 지 {d}일</span><span aria-hidden="true">D+{d}</span></span>
        </p>
        <button
          type="button"
          onClick={() => nav({ name: 'settings' })}
          aria-label="설정"
          className="sticker-flat absolute top-4 right-4 grid size-11 place-items-center rounded-full bg-frame text-ink"
        >
          <Icon name="settings" size={20} />
        </button>
      </header>

      <main className="relative mx-auto h-[880px] w-full overflow-hidden pb-28">
        {/* 낙서 */}
        <Doodle kind="sparkle" style={{ left: '45%', top: 196 }} />
        <Doodle kind="heart" style={{ left: '4%', top: 470 }} />
        <Doodle kind="lines" style={{ right: '8%', top: 210 }} />
        <Doodle kind="arrow" style={{ right: '30%', top: 540 }} />

        {/* 1. 달력 스티커 — 오늘 동그라미, 기념일 하트 */}
        <Sticker left="-3%" top={14} width="max(47%, 160px)" tilt={-6} delay={0}>
          <button type="button" onClick={soon} className="sticker block w-full rounded-lg bg-frame px-3 pt-2 pb-3 text-left" aria-label={`일정 보기, 오늘 ${mm}월 ${dd}일`}>
            <MiniMonth today={today} mark={msDate} />
          </button>
        </Sticker>

        {/* 2. 상대 말풍선 + 시간 칩 (예시) */}
        <Sticker right="5%" top={24} width="44%" tilt={4} delay={80}>
          <button type="button" onClick={soon} className="block w-full text-left">
            <span className="bubble-tail sticker-flat relative block rounded-[22px] bg-frame px-4 py-3 text-lg font-bold">
              {SAMPLE.bubble.text}
            </span>
            <TimeChip who={partnerName} tone="blush" className="mt-6 ml-3">{SAMPLE.bubble.time}</TimeChip>
            <SampleTag className="mt-1 ml-3" />
          </button>
        </Sticker>

        {/* 3. 최근 영수증 폴라로이드 (실제) */}
        <Sticker left="5%" top={232} width="54%" tilt={-4} delay={160}>
          {latest ? (
            <Polaroid r={latest} newCount={newCount} onOpen={() => nav({ name: 'detail', id: latest.id })} />
          ) : (
            <button
              type="button"
              onClick={() => nav({ name: 'compose' })}
              className="sticker grid aspect-[4/5] w-full place-items-center rounded-sm bg-frame p-4 text-center"
            >
              <span>
                <span aria-hidden="true" className="block text-[30px]">📸</span>
                <span className="mt-2 block font-bold">오늘 첫 영수증 붙이기</span>
              </span>
            </button>
          )}
        </Sticker>

        {/* 4. 기분 스티커 (최근 영수증 기분) */}
        {latest?.mood && (
          <Sticker right="8%" top={250} width={104} tilt={10} delay={240}>
            <div className="text-center">
              <span
                role="img"
                aria-label={`${latest.author}의 기분: ${MOOD_NAMES[latest.mood]}`}
                className="sticker mx-auto grid size-[92px] place-items-center rounded-full bg-sun text-ink"
              >
                <MoodFace mood={latest.mood} size={60} label={false} />
              </span>
              <TimeChip who={latest.author} tone="sky" className="-mt-3">{MOOD_NAMES[latest.mood]}</TimeChip>
            </div>
          </Sticker>
        )}

        {/* 5. 기념일 입장권 (실제) */}
        <Sticker right="2%" top={452} width="max(38%, 150px)" tilt={6} delay={320}>
          <div className="sticker flex items-stretch rounded-md bg-blush" role="group" aria-label={`${ms.day}일 기념일까지 ${ms.left}일`}>
            <div className="flex-1 px-3 py-2">
              <p className="font-receipt text-[9px] tracking-wider whitespace-nowrap text-ink/70">ADMIT TWO</p>
              <p className="text-sm leading-tight font-black">{ms.left === 0 ? `오늘 ${ms.day}일!` : `${ms.day}일`}</p>
            </div>
            <div aria-hidden="true" className="my-1.5 border-l-2 border-dashed border-ink/30" />
            <p className="grid place-items-center px-2 font-receipt text-base font-bold whitespace-nowrap">{ms.left === 0 ? 'D-DAY' : `D-${ms.left}`}</p>
          </div>
        </Sticker>

        {/* 6. 오늘의 질문 투표 카드 (예시) */}
        <Sticker left="6%" top={560} width="58%" tilt={-3} delay={400}>
          <div className="sticker rounded-2xl bg-clip-sky p-1">
            <div className="rounded-xl bg-frame px-3 pt-3 pb-2 text-center">
              <p className="font-bold">{SAMPLE.question}</p>
              <div className="mt-2 flex justify-center gap-3">
                <button type="button" onClick={soon} aria-label="좋아" className="sticker-flat grid size-11 place-items-center rounded-full bg-sun text-xl">👍</button>
                <button type="button" onClick={soon} aria-label="싫어" className="sticker-flat grid size-11 place-items-center rounded-full bg-frame text-xl">👎</button>
              </div>
              <p className="mt-2 font-receipt text-[11px] text-fade">{partnerName} 답함 · 내가 답하면 열려요</p>
            </div>
          </div>
          <SampleTag className="mt-1 ml-2" />
        </Sticker>

        {/* 7. 버킷리스트 메모 (예시) */}
        <Sticker right="-4%" top={590} width="44%" tilt={7} delay={480}>
          <div className="sticker-flat bg-clip-butter px-4 pt-3 pb-4">
            <p className="text-xs font-bold text-[#a07a00]">Memo</p>
            <p className="font-black">우리 버킷리스트</p>
            <ul className="mt-1 space-y-1 text-sm">
              {SAMPLE.bucket.map((b) => (
                <li key={b.text} className="flex items-center gap-1.5">
                  <span aria-hidden="true" className={`grid size-4 shrink-0 place-items-center rounded-[3px] border ${b.done ? 'border-transparent bg-[#2fb36b] text-frame' : 'border-edge bg-frame'}`}>
                    {b.done && <Icon name="check" size={12} />}
                  </span>
                  <span className={b.done ? 'line-through decoration-ink/40' : ''}>{b.text}</span>
                  {b.done && <span className="sr-only">(완료)</span>}
                </li>
              ))}
            </ul>
            <SampleTag className="mt-2" />
          </div>
        </Sticker>
      </main>

      <TabBar current="desk" nav={nav} onSoon={soon} />
      {toast}
    </>
  );
}

function SampleTag({ className = '' }: { className?: string }) {
  return <span className={`inline-block rounded-sm border border-dashed border-edge bg-frame/80 px-1.5 text-[11px] text-fade ${className}`}>예시</span>;
}

/** 최근 영수증 → 폴라로이드 스티커 */
function Polaroid({ r, newCount, onOpen }: { r: Receipt; newCount: number; onOpen: () => void }) {
  const stamp = r.stamps[0];
  const [, m, d] = r.date.split('-').map(Number);
  return (
    <button type="button" onClick={onOpen} className="relative block w-full text-left" aria-label={`최근 영수증 열기: ${r.memo}`}>
      <span className="sticker-flat block bg-frame p-2.5 pb-3">
        <span role="img" aria-label={r.photo.label} className="block aspect-square w-full" style={{ background: photoBg(r.photo) }} />
        <span className="mt-2 line-clamp-2 block text-sm leading-snug font-semibold">“{r.memo}”</span>
      </span>
      <TimeChip who={r.author} tone="blush" className="absolute -bottom-4 left-4 -rotate-[4deg]">{m}.{d}</TimeChip>
      {newCount > 0 && (
        <span className="sticker-flat absolute -top-3 -left-2 -rotate-6 rounded-full bg-seal px-2.5 py-0.5 text-xs font-black text-paper">
          NEW {newCount}
        </span>
      )}
      {stamp && (
        <span className="pointer-events-none absolute top-1/3 -right-3">
          <Stamp mark={stamp} size={62} />
        </span>
      )}
    </button>
  );
}

type Tab = 'desk' | 'plan' | 'letter' | 'list';
const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'desk', label: '오늘', icon: 'home' },
  { id: 'plan', label: '일정', icon: 'calendar' },
  { id: 'letter', label: '쪽지', icon: 'mail' },
  { id: 'list', label: '기록', icon: 'receipt' },
];

/** 떠 있는 아래 탭 (시안). 일정·쪽지는 아직 없어서 안내만 띄운다 */
export function TabBar({ current, nav, onSoon }: { current: Tab; nav: Nav; onSoon: () => void }) {
  return (
    <nav
      aria-label="주요 화면"
      className="fixed inset-x-0 z-30 mx-auto max-w-[390px] px-4"
      style={{ bottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
    >
      <ul className="sticker-flat grid grid-cols-4 rounded-full bg-frame p-1">
        {TABS.map((t) => {
          const on = t.id === current;
          const go = () => {
            if (on) return;
            if (t.id === 'list') nav({ name: 'list' });
            else if (t.id === 'desk') nav({ name: 'desk' });
            else onSoon();
          };
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={go}
                aria-current={on ? 'page' : undefined}
                className={`flex min-h-12 w-full flex-col items-center justify-center rounded-full text-[11px] ${on ? 'bg-ink font-bold text-paper' : 'text-fade hover:text-ink'}`}
              >
                <Icon name={t.icon} size={20} />
                {t.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

type IconName = 'home' | 'calendar' | 'mail' | 'receipt' | 'settings' | 'check';
const ICONS: Record<IconName, ReactNode> = {
  home: <><path d="M4 11l8-7 8 7" /><path d="M6 10v10h12V10" /><path d="M10 20v-5h4v5" /></>,
  calendar: <><rect x="4" y="5" width="16" height="15" rx="1" /><path d="M4 10h16M9 3v4M15 3v4" /></>,
  mail: <><rect x="3" y="6" width="18" height="13" rx="1" /><path d="M3 7l9 6 9-6" /></>,
  receipt: <><path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5z" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /></>,
  check: <path d="M5 12l5 5 9-10" strokeWidth="3" />,
};
function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}
