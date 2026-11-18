import { useCallback, useEffect, useRef, useState } from 'react';
import { InkFilterDefs } from './components/Receipt';
import { Button, Notice } from './components/ui';
import { parseRoute, routePath, routeTitle, type Route } from './lib/route';
import { dday, fmtDate } from './lib/dates';
import { isNew, sortReceipts } from './lib/board';
import {
  backend,
  pendingAnniversary,
  pendingInvite,
  type Position,
  type Profile,
  type ReceiptRec,
  type RoomInfo,
  type User,
} from './services';
import type { Receipt } from './data';
import { AnniversaryScreen, InviteScreen, LoginScreen, NicknameScreen, NoRoomScreen, RoomCreatedScreen } from './screens/AuthScreens';
import { ListScreen } from './screens/ListScreen';
import { ComposeScreen } from './screens/ComposeScreen';
import { DetailScreen } from './screens/DetailScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { DevPersonSwitch } from './components/DevPersonSwitch';

export type Nav = (r: Route, opts?: { replace?: boolean }) => void;

export type Session = { user: User | null; profile: Profile | null; room: RoomInfo | null };

export type BoardData = {
  status: 'loading' | 'error' | 'ready';
  receipts: Receipt[];
  records: ReceiptRec[];
  layout: Record<string, Position>;
};

/** 저장된 영수증 → 화면용 영수증 */
function toView(rec: ReceiptRec, s: Session, reads: Set<string>, src?: string): Receipt {
  const nick = (id: string) => s.room?.members.find((m) => m.id === id)?.nickname ?? '알 수 없음';
  const author = nick(rec.authorId);
  return {
    id: rec.id,
    no: String(rec.no).padStart(4, '0'),
    date: rec.date,
    place: rec.place,
    memo: rec.memo,
    mood: rec.mood,
    author,
    authorId: rec.authorId,
    dplus: s.room ? dday(s.room.anniversary, rec.date) : 1,
    // 대체 텍스트: 누가 언제 찍은 사진인지 [03-1.1.1, B15]
    photo: { from: '#e6e7e9', to: '#c9cacd', label: `${author}의 ${fmtDate(rec.date)} 데이트 사진`, emoji: '', src },
    stamps: rec.stamps.map((st) => ({ by: st.userId, byName: nick(st.userId), shape: st.shape, label: st.label, rot: st.rot, x: st.x, y: st.y })),
    isNew: isNew({ id: rec.id, authorId: rec.authorId }, s.user?.id ?? '', reads),
  };
}

/** 로그인·프로필·방 상태에 따라 갈 수 있는 화면을 정한다 (R1~R3 흐름) */
function guard(route: Route, s: Session): Route | null {
  const open = route.name === 'login' || route.name === 'invite';
  if (!s.user) return open ? null : { name: 'login' };
  if (!s.profile) return route.name === 'nickname' ? null : { name: 'nickname' };
  if (!s.room) {
    if (['anniversary', 'noroom', 'invite'].includes(route.name)) return null;
    const token = pendingInvite.get();
    if (token) return { name: 'invite', token };
    // 상대가 방을 지웠으면 안내가 있는 방 만들기 화면으로 (R13)
    return { name: pendingAnniversary.get() || s.profile.roomDeletedNotice ? 'noroom' : 'anniversary' };
  }
  if (['login', 'nickname', 'anniversary', 'noroom'].includes(route.name)) return { name: 'list' };
  return null;
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.pathname));
  const [boot, setBoot] = useState(true);
  const [sess, setSess] = useState<Session>({ user: null, profile: null, room: null });
  const [board, setBoard] = useState<BoardData>({ status: 'loading', receipts: [], records: [], layout: {} });
  const [dropId, setDropId] = useState<string>();
  const readsRef = useRef<Set<string>>(new Set());

  const navigate: Nav = useCallback((r, opts) => {
    const url = routePath(r);
    if (opts?.replace) window.history.replaceState(null, '', url);
    else if (url !== window.location.pathname) window.history.pushState(null, '', url);
    setRoute(r);
    window.scrollTo(0, 0);
  }, []);

  // 뒤로·앞으로 가기 (C4)
  useEffect(() => {
    const onPop = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const refreshSession = useCallback(async (): Promise<Session> => {
    const user = await backend.getUser();
    const profile = user ? await backend.getProfile() : null;
    // 방을 못 불러온 것(연결 문제)을 "방 없음"으로 착각하지 않게, 실패는 그대로 던진다
    const room: RoomInfo | null = profile ? await backend.getMyRoom() : null;
    const next = { user, profile, room };
    setSess(next);
    return next;
  }, []);

  const [bootErr, setBootErr] = useState(false);
  const bootUp = useCallback(() => {
    setBoot(true);
    refreshSession()
      .then(() => setBootErr(false))
      .catch(() => setBootErr(true))
      .finally(() => setBoot(false));
  }, [refreshSession]);
  useEffect(() => { bootUp(); }, [bootUp]);

  // 갈 수 없는 화면이면 갈 곳으로 바꾼다
  useEffect(() => {
    if (boot || bootErr) return;
    const to = guard(route, sess);
    if (to) navigate(to, { replace: true });
  }, [boot, bootErr, route, sess, navigate]);

  // 보드 불러오기 — 방을 열 때, 다른 앱에서 돌아올 때, 당길 때 (D24)
  const loadBoard = useCallback(async (s: Session = sess) => {
    if (!s.room) return;
    try {
      const [records, reads, layout] = await Promise.all([backend.listReceipts(), backend.listReads(), backend.listPositions()]);
      readsRef.current = new Set(reads);
      const sorted = sortReceipts(records);
      const views = await Promise.all(
        sorted.map(async (rec) => {
          const src = await backend.photoUrl(rec.photoPath).catch(() => undefined);
          return toView(rec, s, readsRef.current, src);
        }),
      );
      setBoard({ status: 'ready', receipts: views, records: sorted, layout });
    } catch {
      setBoard((b) => ({ ...b, status: 'error' }));
    }
  }, [sess]);

  const reloadAll = useCallback(async () => {
    try {
      const s = await refreshSession();
      await loadBoard(s);
    } catch {
      setBoard((b) => ({ ...b, status: 'error' })); // 지금 보던 방은 그대로 두고 오류만 알림
    }
  }, [refreshSession, loadBoard]);

  const roomId = sess.room?.id;
  useEffect(() => {
    if (!roomId) return;
    setBoard((b) => ({ ...b, status: b.records.length ? b.status : 'loading' }));
    void loadBoard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible' && sess.room) void reloadAll(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [sess.room, reloadAll]);

  // 화면이 바뀌면 탭 제목을 바꾸고, 새 화면의 제목(h1)으로 초점을 옮긴다 [03-2.4.2, 03-2.4.3]
  const screenRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  const key = routePath(route);
  useEffect(() => {
    document.title = `${routeTitle[route.name]} - 우리두리`;
    if (firstRender.current) { firstRender.current = false; return; }
    const h1 = screenRef.current?.querySelector<HTMLElement>('h1');
    if (h1) { if (!h1.hasAttribute('tabindex')) h1.tabIndex = -1; h1.focus({ preventScroll: true }); }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  // ───── 보드 동작 ─────
  const openReceipt = (r: Receipt) => {
    if (r.isNew) {
      readsRef.current.add(r.id); // D26: 눌러야 NEW가 사라짐
      setBoard((b) => ({ ...b, receipts: b.receipts.map((x) => (x.id === r.id ? { ...x, isNew: false } : x)) }));
      void backend.markRead(r.id);
    }
    navigate({ name: 'detail', id: r.id });
  };

  const saveTimers = useRef<Record<string, number>>({});
  const moveCard = (id: string, pos: { x: number; y: number; rot: number }, done: boolean) => {
    setBoard((b) => {
      const z = done ? Math.max(0, ...Object.values(b.layout).map((p) => p.z)) + 1 : b.layout[id]?.z ?? 0;
      const next = { ...pos, z };
      if (done) {
        window.clearTimeout(saveTimers.current[id]);
        saveTimers.current[id] = window.setTimeout(() => {
          backend.savePosition(id, next).catch(() => { /* 다음 불러오기 때 원래 자리로 돌아감 */ });
        }, 300);
      }
      return { ...b, layout: { ...b.layout, [id]: next } };
    });
  };

  const afterPublish = async (rec: ReceiptRec) => {
    setDropId(rec.id);
    await loadBoard();
    navigate({ name: 'list' });
  };

  const me = sess.user?.id ?? '';
  const partner = sess.room?.members.find((m) => m.id !== me);
  const detailId = route.name === 'detail' || route.name === 'edit' ? route.id : undefined;
  const detail = detailId ? board.receipts.find((r) => r.id === detailId) : undefined;
  const detailRec = detailId ? board.records.find((r) => r.id === detailId) : undefined;

  if (bootErr && !boot) {
    return (
      <div className="grain min-h-screen">
        <main className="mx-auto max-w-[390px] space-y-4 px-6 pt-20">
          <h1 className="text-xl font-bold outline-none">불러오지 못했어요</h1>
          <Notice tone="error">인터넷 연결을 확인하고 다시 시도해 주세요.</Notice>
          <Button onClick={bootUp}>다시 시도하기</Button>
        </main>
      </div>
    );
  }
  if (boot || guard(route, sess)) {
    return <div className="grain min-h-screen" aria-busy="true" />;
  }
  const boardLoading = board.status === 'loading' && !board.records.length;

  return (
    <div className="grain min-h-screen">
      <InkFilterDefs />
      <div ref={screenRef} key={key} className="relative z-0 mx-auto min-h-screen max-w-[390px]">
        {route.name === 'login' && <LoginScreen nav={navigate} onSignedIn={refreshSession} />}
        {route.name === 'invite' && <InviteScreen token={route.token} session={sess} nav={navigate} onJoined={reloadAll} onSignedIn={refreshSession} />}
        {route.name === 'nickname' && <NicknameScreen nav={navigate} onSaved={refreshSession} />}
        {route.name === 'anniversary' && <AnniversaryScreen nav={navigate} />}
        {route.name === 'noroom' && sess.profile && <NoRoomScreen profile={sess.profile} nav={navigate} onCreated={refreshSession} onSignedOut={refreshSession} />}
        {route.name === 'created' && <RoomCreatedScreen nav={navigate} />}
        {route.name === 'list' && sess.room && (
          <ListScreen
            session={sess}
            board={board}
            dropId={dropId}
            nav={navigate}
            onOpen={openReceipt}
            onMove={moveCard}
            onRefresh={reloadAll}
            onJoinSeen={() => { void backend.markJoinNoticeSeen(); }}
          />
        )}
        {route.name === 'compose' && sess.room && (
          <ComposeScreen me={sess.profile?.nickname ?? ''} anniversary={sess.room.anniversary} nav={navigate} onDone={afterPublish} />
        )}
        {route.name === 'edit' && sess.room && detailRec && detail && detailRec.authorId === me && (
          <ComposeScreen
            me={sess.profile?.nickname ?? ''}
            anniversary={sess.room.anniversary}
            nav={navigate}
            editing={{ rec: detailRec, photoSrc: detail.photo.src }}
            onDone={async () => { await loadBoard(); navigate({ name: 'detail', id: detailRec.id }, { replace: true }); }}
          />
        )}
        {route.name === 'detail' && detail && (
          <DetailScreen
            receipt={detail}
            me={me}
            meName={sess.profile?.nickname ?? ''}
            nav={navigate}
            onDeleted={async () => { await loadBoard(); navigate({ name: 'list' }, { replace: true }); }}
            onStampSaved={() => { void loadBoard(); }}
          />
        )}
        {route.name === 'settings' && sess.room && sess.profile && sess.user && (
          <SettingsScreen user={sess.user} profile={sess.profile} room={sess.room} records={board.records} nav={navigate} onChanged={reloadAll} />
        )}
        {(route.name === 'detail' || route.name === 'edit') && !detail && boardLoading && <div aria-busy="true" />}
        {(route.name === 'notfound' ||
          ((route.name === 'detail' || route.name === 'edit') && !boardLoading && (!detail || (route.name === 'edit' && detailRec?.authorId !== me)))) && (
          <NotFound onHome={() => navigate({ name: 'list' }, { replace: true })} />
        )}
      </div>
      {/* 입력칸을 가리지 않게 보드·로그인·설정에서만 */}
      {backend.mode === 'local' && ['list', 'login', 'invite', 'settings'].includes(route.name) && <DevPersonSwitch partnerName={partner?.nickname} />}
    </div>
  );
}

/** 없는 주소·지워진 영수증 */
function NotFound({ onHome }: { onHome: () => void }) {
  return (
    <main className="px-6 pt-20 text-center">
      <h1 className="text-xl font-bold text-balance outline-none">찾을 수 없는 화면이에요</h1>
      <p className="mt-2 text-sm text-fade">주소가 바뀌었거나 지워진 영수증일 수 있어요.</p>
      <div className="mt-8"><Button onClick={onHome}>우리 보드로 가기</Button></div>
    </main>
  );
}

