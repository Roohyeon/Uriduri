import { useEffect, useRef, useState } from 'react';
import type { Receipt } from '../data';
import { AppBar, Button, EmptyState, Notice, useToast } from '../components/ui';
import { scrollBehavior } from '../lib/motion';
import { dday, todayIso } from '../lib/dates';
import { ReceiptRollSkeleton, WaxSeal } from '../components/Receipt';
import { Board, type BoardPos } from '../components/Board';
import { backend } from '../services';
import { copyInvite } from './AuthScreens';
import type { BoardData, Nav, Session } from '../App';

const PULL_PX = 80;
const JOIN_NOTICE_MS = 5000;

/** 영수증 목록·홈 (R4, R5, D22, D24, D26, D29, D31, D36) */
export function ListScreen({
  session,
  board,
  dropId,
  nav,
  onOpen,
  onMove,
  onRefresh,
  onJoinSeen,
}: {
  session: Session;
  board: BoardData;
  dropId?: string;
  nav: Nav;
  onOpen: (r: Receipt) => void;
  onMove: (id: string, pos: BoardPos, done: boolean) => void;
  onRefresh: () => Promise<unknown>;
  onJoinSeen: () => void;
}) {
  const [toast, showToast] = useToast();
  const room = session.room!;
  const me = session.user!.id;
  const meName = session.profile?.nickname ?? '';
  const partner = room.members.find((m) => m.id !== me);
  const alone = !partner; // D29: 상대가 들어오기 전엔 발행 불가
  const d = dday(room.anniversary, todayIso());

  // 상대 연결 알림 (D31): 방을 만든 사람에게 한 번만
  const [showJoined] = useState(() => !!partner && room.createdBy === me && !room.joinNoticeSeen);
  useEffect(() => { if (showJoined) onJoinSeen(); }, [showJoined]); // eslint-disable-line react-hooks/exhaustive-deps
  // 잠깐 보였다가 사라진다 (사용자 요청 2026-11-17): 5초 뒤 흐려지며 접히고, ✕로 바로 닫을 수도 있다 [03-2.2.1]
  const [joinPhase, setJoinPhase] = useState<'in' | 'out' | 'gone'>(showJoined ? 'in' : 'gone');
  useEffect(() => {
    if (joinPhase === 'in') { const t = window.setTimeout(() => setJoinPhase('out'), JOIN_NOTICE_MS); return () => window.clearTimeout(t); }
    if (joinPhase === 'out') { const t = window.setTimeout(() => setJoinPhase('gone'), 450); return () => window.clearTimeout(t); }
  }, [joinPhase]);

  // 발행 직후 그 영수증 자리로 (D22)
  useEffect(() => {
    if (!dropId || board.status !== 'ready') return;
    document.getElementById(`r-${dropId}`)?.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
  }, [dropId, board.status]);

  // 아래로 당겨서 새로 불러오기 (D24)
  const [refreshing, setRefreshing] = useState(false);
  const pull = useRef<number | null>(null);
  useEffect(() => {
    const start = (e: TouchEvent) => { pull.current = window.scrollY <= 0 ? e.touches[0].clientY : null; };
    const end = (e: TouchEvent) => {
      if (pull.current === null) return;
      const dy = e.changedTouches[0].clientY - pull.current;
      pull.current = null;
      if (dy > PULL_PX) {
        setRefreshing(true);
        onRefresh().finally(() => setRefreshing(false));
      }
    };
    window.addEventListener('touchstart', start, { passive: true });
    window.addEventListener('touchend', end, { passive: true });
    return () => { window.removeEventListener('touchstart', start); window.removeEventListener('touchend', end); };
  }, [onRefresh]);

  const copyLink = async () => {
    try {
      const inv = (await backend.currentInvite()) ?? (await backend.newInvite());
      await copyInvite(inv.token, showToast);
    } catch {
      showToast('초대 링크를 만들지 못했어요. 다시 시도해 주세요.');
    }
  };

  // 설정으로 가는 길 [02-1]: 상단바 오른쪽 톱니 버튼 (44px)
  const settingsBtn = (
    <button
      type="button"
      onClick={() => nav({ name: 'settings' })}
      aria-label="설정"
      className="-mr-2 grid size-11 shrink-0 place-items-center rounded-full text-ink hover:bg-counter"
    >
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
      </svg>
    </button>
  );
  const bar = (
    <AppBar
      bare
      title="우리 방"
      right={
        <span className="flex items-center gap-2">
          {alone ? (
            <span>{meName} · 상대를 기다리는 중</span>
          ) : (
            <>
              <span>{meName} ♥ {partner.nickname}</span>
              <span className="font-receipt text-base font-bold text-ink"><span className="sr-only">사귄 지 {d}일</span><span aria-hidden="true">D+{d}</span></span>
            </>
          )}
          {settingsBtn}
        </span>
      }
    />
  );

  if (alone)
    return (
      <>
        <BoardBackdrop />
        {bar}
        <main className="px-4 pt-4">
          <EmptyState mark="💌" title="상대를 기다리고 있어요" body="상대가 연결되면 영수증을 발행할 수 있어요.">
            <div className="space-y-2">
              <Button onClick={copyLink}>초대 링크 복사</Button>
              <p className="text-sm text-fade">초대 링크는 한 사람만, 24시간 안에 쓸 수 있어요.</p>
            </div>
          </EmptyState>
        </main>
        {toast}
      </>
    );

  const { status, receipts } = board;
  const newOnes = receipts.filter((r) => r.isNew);
  const firstNew = newOnes[0]; // receipts는 이미 날짜순 → 가장 위의 NEW
  const ready = status === 'ready' || (status === 'error' && receipts.length > 0);

  return (
    <>
      <BoardBackdrop />
      {bar}
      <main className="relative space-y-4 px-4 pt-4 pb-28">
        {refreshing && <p role="status" className="text-center text-sm text-fade">새로 불러오는 중이에요…</p>}
        {joinPhase !== 'gone' && (
          <div
            className="grid transition-all duration-[450ms] ease-out"
            style={{ gridTemplateRows: joinPhase === 'in' ? '1fr' : '0fr', opacity: joinPhase === 'in' ? 1 : 0, marginBottom: joinPhase === 'in' ? undefined : '-1rem' }}
          >
            {/* 도장이 꾹 찍힐 때 커지는 부분이 잘리지 않게, 접힐 때만 넘친 부분을 숨긴다 */}
            <section role="status" className={`relative flex min-h-0 items-center gap-4 ${joinPhase === 'in' ? '' : 'overflow-hidden'} bg-paper py-4 pr-12 pl-4 shadow-paper`}>
              <WaxSeal />
              <div>
                <p className="font-bold">상대방({partner.nickname})이 연결했어요!</p>
                <p className="text-sm text-fade">이제 둘이서 영수증을 쌓아 보세요.</p>
              </div>
              <button
                type="button"
                onClick={() => setJoinPhase('out')}
                aria-label="연결 알림 닫기"
                className="absolute top-1 right-1 grid size-11 place-items-center rounded-full text-fade hover:bg-counter"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </section>
          </div>
        )}
        {status === 'loading' && (
          <>
            <p className="text-sm text-fade" role="status">영수증을 불러오는 중이에요…</p>
            <ReceiptRollSkeleton />
          </>
        )}
        {status === 'error' && (
          <div className="space-y-3">
            <Notice tone="error">영수증을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.</Notice>
            <Button variant="line" onClick={() => { void onRefresh(); }}>다시 불러오기</Button>
          </div>
        )}
        {status === 'ready' && receipts.length === 0 && (
          <EmptyState mark="🧾" title="아직 영수증이 없어요" body="오늘 데이트 사진 한 장과 한 줄이면 첫 영수증이 발행돼요.">
            <Button variant="seal" onClick={() => nav({ name: 'compose' })}>첫 영수증 발행하기</Button>
            <p className="mt-6 text-sm text-fade">가끔 설정에서 전체 백업을 받아 두면 더 안심이에요.</p>
          </EmptyState>
        )}
        {ready && receipts.length > 0 && (
          <>
            {firstNew && (
              <button
                type="button"
                onClick={() => document.getElementById(`r-${firstNew.id}`)?.scrollIntoView({ behavior: scrollBehavior(), block: 'center' })}
                className="flex min-h-11 w-full items-center justify-between rounded-sm bg-ink px-4 text-sm text-paper hover:bg-ink/85"
              >
                <span>새 영수증 {newOnes.length}개</span>
                <span className="font-semibold">보러 가기</span>
              </button>
            )}
            <p className="text-center text-xs text-fade">영수증을 꾹 누르면 옮겨서 꾸밀 수 있어요</p>
            <Board items={receipts} layout={board.layout} onMove={onMove} onOpen={onOpen} dropId={dropId} />
            <p className="text-center text-xs text-fade">아래로 당기면 새로 불러와요</p>
          </>
        )}
      </main>
      {ready && receipts.length > 0 && (
        // 떠 있는 발행 버튼: 카드를 덜 가리도록 작은 둥근 버튼 + 홈 바 영역 피하기 [02-9, 04 List:125]
        <div
          className="pointer-events-none fixed inset-x-0 z-30 mx-auto flex max-w-[390px] justify-end px-4"
          style={{ bottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
        >
          <button
            type="button"
            onClick={() => nav({ name: 'compose' })}
            aria-label="영수증 발행"
            className="pointer-events-auto flex min-h-12 items-center gap-1 rounded-full bg-seal pr-4 pl-3 text-sm font-bold text-paper shadow-paper hover:bg-seal-ink"
          >
            <span aria-hidden="true" className="text-xl leading-none">＋</span>
            발행
          </button>
        </div>
      )}
      {toast}
    </>
  );
}

/** 홈 전체를 덮는 화이트보드 배경 — 화면 폭 전체, 스크롤해도 그대로 */
function BoardBackdrop() {
  return <div aria-hidden="true" className="board-page pointer-events-none fixed inset-0 -z-10" />;
}
