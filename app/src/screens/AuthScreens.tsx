import { useEffect, useState } from 'react';
import { AppBar, Button, EmptyState, Field, Notice, Sheet, TextButton, inputClass, useToast } from '../components/ui';
import { DateWheel } from '../components/WheelPicker';
import { todayIso } from '../lib/dates';
import { LIMITS, clip, countChars, isValidText } from '../lib/text';
import { parseInviteInput, type InviteStatus } from '../lib/invite';
import {
  backend,
  lastProvider,
  pendingAnniversary,
  pendingInvite,
  pendingNickname,
  rememberProvider,
  suspectProvider,
  PROVIDER_NAMES,
  type Profile,
  type Provider,
} from '../services';
import type { Nav, Session } from '../App';

const inviteErrors: Partial<Record<InviteStatus, string>> = {
  expired: '초대 링크가 만료됐어요. 상대에게 새 링크를 요청해 주세요.',
  not_found: '초대 링크가 만료됐어요. 상대에게 새 링크를 요청해 주세요.',
  used: '이미 사용된 초대 링크예요. 상대에게 새 링크를 요청해 주세요.',
  full: '이미 두 사람이 쓰고 있는 방이에요.',
  other_room: '이미 다른 방에 들어가 있어요. 한 계정은 방 하나만 쓸 수 있어요.',
};

/** 초대 링크 복사 — 성공·실패를 안내 메시지로 */
export async function copyInvite(token: string, show: (m: string) => void) {
  const url = `${window.location.origin}/i/${token}`;
  try {
    await navigator.clipboard.writeText(url);
    show('초대 링크를 복사했어요. 카톡에 붙여 넣어 보내 주세요.');
  } catch {
    window.prompt('아래 링크를 길게 눌러 복사해 주세요', url);
  }
}

/** 지난번 로그인 방식 말풍선 — 해당 단추 위에 뜬다 */
function LastBubble({ provider }: { provider: Provider }) {
  return (
    <p id="last-login" className="pp-bubble">
      지난번엔 <b>{PROVIDER_NAMES[provider]}</b>로 로그인했어요
    </p>
  );
}

/** 로그인 (R1, D19, D28) · 초대 받음 로그인 전 (R3, D33) */
export function LoginScreen({ nav, invite = false, onSignedIn }: { nav: Nav; invite?: boolean; onSignedIn: () => Promise<unknown> }) {
  const last = lastProvider();
  // 로그인 제공자에서 취소·실패하고 돌아오면 주소에 error가 붙어 온다
  const failed = new URLSearchParams(window.location.search).has('error') || window.location.hash.includes('error');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(failed);
  const nickname = pendingNickname.get();
  const login = async (p: Provider) => {
    setBusy(true);
    setErr(false);
    try {
      suspectProvider.check(p); // 지난 방식과 다르면 "혹시 ○○로 방을 만드셨나요?"를 보여 주려고 기억
      await backend.signIn(p);
      rememberProvider(p);
      // 로그인 전에 입력한 닉네임을 계정에 저장 — 이미 계정에 닉네임이 있으면 그대로 둔다 (2026-11-18 순서 변경)
      const nick = pendingNickname.get();
      if (nick && !(await backend.getProfile())) await backend.saveNickname(nick);
      pendingNickname.clear();
      await onSignedIn(); // 다음 화면은 App이 정한다
      if (!invite) nav({ name: 'desk' }, { replace: true });
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    // 홈 다이어리와 같은 종이 바탕 · 손글씨 · 테이프 붙인 포스트잇 (index.css .paper-page, 2026-11-20)
    <div className="paper-page pp-flow">
      <main className="flex flex-1 flex-col justify-between px-6 pt-20 pb-6">
        <div>
          {/* 그림은 빼고 글자만, 시작 화면의 '우리두리' 글자 모양으로 크게 (2026-11-20 사용자 요청) */}
          <h1 className="text-center outline-none">
            <span className="pp-logo sticker-text text-[40px] font-black tracking-tight">우리두리</span>
          </h1>
          {nickname && (
            <p className="mt-6 text-center text-[16px] text-fade">
              <b className="block text-[23px] font-bold text-ink">모든 준비가 완료됐어요</b>
              이제 우리 페이지로 가볼까요?
            </p>
          )}
          {err && <div className="mt-6"><Notice tone="error">로그인하지 못했어요. 다시 시도해 주세요.</Notice></div>}
        </div>
        <div className="mt-10 space-y-3">
          {/* 약관 동의 안내 — 링크·본문은 나중에 (2026-11-20 사용자 요청) */}
          <p className="pp-legal pp-legal--consent text-center">계속하기는 개인정보 보호정책 및 서비스 약관에 동의하는 것을 의미합니다.</p>
          {/* 지난번 로그인 방식은 그 단추 위 말풍선으로 (2026-11-20 사용자 요청) */}
          <div className="relative">
            {last === 'kakao' && <LastBubble provider="kakao" />}
            <Button variant="kakao" className="pp-btn" disabled={busy} aria-describedby={last === 'kakao' ? 'last-login' : undefined} onClick={() => login('kakao')}>카카오로 계속하기</Button>
          </div>
          <div className="relative">
            {last === 'google' && <LastBubble provider="google" />}
            <Button variant="google" className="pp-btn pp-btn--white" disabled={busy} aria-describedby={last === 'google' ? 'last-login' : undefined} onClick={() => login('google')}>구글로 계속하기</Button>
          </div>
        </div>
      </main>
      {/* 푸터: 글자만, 자세한 내용은 나중에 (2026-11-20 사용자 요청) */}
      <footer className="pp-legal px-6 pb-[calc(24px+env(safe-area-inset-bottom))] text-center text-xs">
        개인정보 보호 정책 | 서비스 약관
      </footer>
    </div>
  );
}

/** 초대 링크 (R3, D33): 로그인 전이면 로그인 화면, 로그인 후면 수락 화면 */
export function InviteScreen({
  token,
  session,
  nav,
  onJoined,
  onSignedIn,
}: {
  token: string;
  session: Session;
  nav: Nav;
  onJoined: () => Promise<unknown>;
  onSignedIn: () => Promise<unknown>;
}) {
  const [peek, setPeek] = useState<{ status: InviteStatus; creatorNickname?: string }>();
  const [busy, setBusy] = useState(false);
  const loggedIn = !!session.user && !!session.profile;

  useEffect(() => { pendingInvite.set(token); }, [token]);
  useEffect(() => {
    if (!loggedIn) return;
    backend.peekInvite(token).then((p) => {
      // 이미 멤버면 안내 없이 열기 (R3). 단, 혼자 있는 방을 만든 사람이 자기 링크를 열었으면 알려 준다
      const ownLinkAlone = p.status === 'member' && session.room?.createdBy === session.user?.id && (session.room?.members.length ?? 0) < 2;
      if (p.status === 'member' && !ownLinkAlone) { pendingInvite.clear(); nav({ name: 'desk' }, { replace: true }); }
      else setPeek(p);
    }).catch(() => setPeek({ status: 'not_found' }));
  }, [loggedIn, token, nav, session]);

  if (!session.user) return <LoginScreen nav={nav} invite onSignedIn={onSignedIn} />;
  if (!peek) return <div aria-busy="true" />;

  if (peek.status === 'member') {
    return (
      <>
        <AppBar title="초대" />
        <main className="space-y-4 px-6 pt-6">
          <Notice>내가 만든 초대 링크예요. 상대가 이 링크를 열어야 우리 방에 들어올 수 있어요.</Notice>
          {backend.mode === 'local' && (
            <p className="text-sm text-fade">
              개발용 안내: 혼자 시험할 때는 왼쪽 아래 “개발용” 버튼 → 사람 바꾸기를 누른 뒤, 이 링크를 다시 열어 주세요.
            </p>
          )}
          <Button variant="line" onClick={() => { pendingInvite.clear(); nav({ name: 'desk' }, { replace: true }); }}>우리 방으로 가기</Button>
        </main>
      </>
    );
  }

  // 로컬 모드는 데이터가 이 브라우저에만 있어서, 다른 브라우저·휴대폰에서 연 링크는 찾을 수 없다
  const err = backend.mode === 'local' && peek.status === 'not_found'
    ? '이 초대 링크를 찾을 수 없어요. (개발용 안내: 지금은 로컬 모드라 링크를 만든 브라우저에서만 열려요. 같은 브라우저에서 왼쪽 아래 “개발용” 버튼 → 사람 바꾸기를 누른 뒤 열어 주세요.)'
    : inviteErrors[peek.status];
  if (err) {
    return (
      <>
        <AppBar title="초대" />
        <main className="space-y-4 px-6 pt-6">
          <Notice tone="error">{err}</Notice>
          <Button variant="line" onClick={() => { pendingInvite.clear(); nav({ name: 'desk' }, { replace: true }); }}>
            {session.room ? '우리 방으로 가기' : '처음 화면으로'}
          </Button>
        </main>
      </>
    );
  }

  const accept = async () => {
    setBusy(true);
    try {
      const res = await backend.acceptInvite(token);
      if (res.status !== 'ok') { setPeek(res); return; }
      pendingInvite.clear();
      await onJoined();
      nav({ name: 'desk' }, { replace: true });
    } catch {
      setPeek({ status: 'not_found' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AppBar title="초대 수락" />
      <main className="px-6 pt-6">
        <EmptyState mark="💌" title={`${peek.creatorNickname ?? '상대'}님의 방에 들어가요`} body="들어가면 둘이서 영수증을 쌓을 수 있어요.">
          <Button disabled={busy} aria-busy={busy} onClick={accept}>방에 들어가기</Button>
        </EmptyState>
      </main>
    </>
  );
}

/** 닉네임 입력 (D30) */
// 로그인 전(소개 다음)에는 기억만 해 두고 로그인 직후 저장한다. 로그인 후에 오면(소개를 건너뛴 경우) 바로 저장 (2026-11-18)
export function NicknameScreen({ nav, loggedIn, onSaved }: { nav: Nav; loggedIn: boolean; onSaved: () => Promise<unknown> }) {
  const [nick, setNick] = useState(() => pendingNickname.get() ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const next = async () => {
    setBusy(true);
    setErr(false);
    try {
      // 초대받은 사람은 사귄 날을 묻지 않는다 (D39)
      const token = pendingInvite.get();
      if (!loggedIn) {
        if (!isValidText(nick, LIMITS.nickname)) throw new Error('invalid');
        pendingNickname.set(nick.trim());
        nav(token ? { name: 'invite', token } : { name: 'anniversary' }); // 초대 화면은 로그인 전이면 로그인을 보여 준다
        return;
      }
      await backend.saveNickname(nick);
      await onSaved();
      nav(token ? { name: 'invite', token } : { name: 'anniversary' }, { replace: true });
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="paper-page pp-flow">
      <header className="pp-head pp-head--center">
        {/* 이전으로 돌아가기 (2026-11-20 사용자 요청) — 로그인 전이면 소개로 */}
        {/* 이전 단추는 늘 보인다 (2026-11-20 사용자 요청). 로그인 전이면 소개로, 로그인 후면 브라우저의 바로 전 화면으로 */}
        <button type="button" className="pp-close pp-back" aria-label="이전으로 돌아가기" onClick={() => (loggedIn ? window.history.back() : nav({ name: 'intro' }))}>
          <span aria-hidden="true">‹</span>
        </button>
      </header>
      <main className="pp-main pp-flow__main">
        {/* 제목과 입력칸을 화면 세로 가운데에 (2026-11-20 사용자 요청) */}
        <div className="pp-vcenter">
        <h1 tabIndex={-1} className="pp-title pp-title--plain">호칭이 무엇인가요?</h1>
        {/* [임시 Q7] 최대 10자, 설정에서 변경 가능. 보이는 이름표는 지우고 읽기용 이름만 남김 (2026-11-20 사용자 요청) */}
        <div className="space-y-1">
          <input id="nick" name="nickname" aria-label="닉네임" aria-describedby="nick-hint" className={`${inputClass} pp-input`} placeholder="닉네임" value={nick} onChange={(e) => setNick(clip(e.target.value, LIMITS.nickname))} onKeyDown={(e) => { if (e.key === 'Enter' && isValidText(nick, LIMITS.nickname)) void next(); }} autoComplete="nickname" spellCheck={false} />
          <div id="nick-hint" className="flex justify-end text-xs text-fade"><span className="font-receipt tabular-nums">{countChars(nick)}/{LIMITS.nickname}</span></div>
        </div>
        </div>
        {err && <Notice tone="error">저장하지 못했어요. 다시 시도해 주세요.</Notice>}
        <Button className="pp-publish pp-publish--glass pp-flow__next" disabled={!isValidText(nick, LIMITS.nickname) || busy} aria-busy={busy} onClick={next}>다음</Button>
      </main>
    </div>
  );
}

/** 사귄 날 입력 (D37) — 닉네임 다음. 휠 피커, 오늘 날짜에서 시작. 사귄 날 = 1일 (D38) */
// 로그인 전이면 다음은 로그인, 로그인 후면(방이 지워져 다시 만드는 경우 등) 방 만들기 (2026-11-18)
export function AnniversaryScreen({ nav, loggedIn }: { nav: Nav; loggedIn: boolean }) {
  const today = todayIso();
  const [date, setDate] = useState(pendingAnniversary.get() ?? today);
  return (
    <div className="paper-page pp-flow">
      <header className="pp-head pp-head--center">
        {/* 이전으로 돌아가기 (2026-11-20 사용자 요청) — 로그인 전이면 닉네임으로 */}
        {/* 이전 단추는 늘 보인다 (2026-11-20 사용자 요청). 로그인 전이면 닉네임으로, 로그인 후면 우리 방 만들기로 */}
        <button type="button" className="pp-close pp-back" aria-label="이전으로 돌아가기" onClick={() => nav({ name: loggedIn ? 'noroom' : 'nickname' })}>
          <span aria-hidden="true">‹</span>
        </button>
      </header>
      <main className="pp-main pp-flow__main">
        {/* 안내 문구·D+ 미리보기·초대 안내는 지움, 휠은 바탕 없이 (2026-11-20 사용자 요청) */}
        {/* 제목을 휠 바로 위에 두고 둘을 화면 세로·가로 가운데에 (닉네임 화면과 같은 배치, 2026-11-20 사용자 요청) */}
        <div className="pp-vcenter">
          <h1 tabIndex={-1} className="pp-title pp-title--plain">사귄 날이 언제인가요?</h1>
          <div className="pp-wheel pp-wheel--bare">
            <DateWheel value={date} onChange={setDate} max={today} minYear={1990} />
          </div>
        </div>
        <Button className="pp-publish pp-publish--glass pp-flow__next" onClick={() => { pendingAnniversary.set(date); nav({ name: loggedIn ? 'noroom' : 'login' }); }}>다음</Button>
      </main>
    </div>
  );
}

/** 방 없음 (R2, R13, D28) */
export function NoRoomScreen({
  profile,
  nav,
  onCreated,
  onSignedOut,
}: {
  profile: Profile;
  nav: Nav;
  onCreated: () => Promise<unknown>;
  onSignedOut: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const deleted = profile.roomDeletedNotice; // 상대가 방을 지움 (R13)
  useEffect(() => { if (deleted) void backend.clearRoomDeletedNotice(); }, [deleted]);

  const create = async () => {
    // 사귄 날을 아직 안 골랐으면(방이 지워진 뒤 다시 만드는 경우) 먼저 고른다 (D37)
    if (!pendingAnniversary.get()) { nav({ name: 'anniversary' }); return; }
    setBusy(true);
    setErr(false);
    try {
      await backend.createRoom(pendingAnniversary.get()!);
      pendingAnniversary.clear();
      await onCreated();
      nav({ name: 'created' }, { replace: true });
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  };
  const otherAccount = async () => {
    suspectProvider.clear();
    await backend.signOut();
    await onSignedOut();
    nav({ name: 'login' }, { replace: true });
  };
  // 의심될 때만 (사용자 결정 2026-11-17): 이 기기에서 지난번과 다른 방식으로 로그인했을 때
  const suspect = suspectProvider.get();

  // 탈퇴 (R13): 방이 없을 때만. 계정 정보와 사용 기록을 지운다 [임시 Q18]
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveErr, setLeaveErr] = useState(false);
  const leave = async () => {
    setLeaving(true);
    setLeaveErr(false);
    try {
      const res = await backend.deleteAccount();
      if (res !== 'ok') throw new Error(res);
      pendingAnniversary.clear();
      pendingInvite.clear();
      pendingNickname.clear();
      suspectProvider.clear();
      await onSignedOut();
      nav({ name: 'login' }, { replace: true });
    } catch {
      setLeaveErr(true);
      setLeaving(false);
    }
  };

  // 받은 초대 링크 붙여 넣기 (사용자 결정 2026-11-17)
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState('');
  const [pasteErr, setPasteErr] = useState(false);
  const openPasted = () => {
    const token = parseInviteInput(pasted);
    if (!token) { setPasteErr(true); return; }
    nav({ name: 'invite', token });
  };
  return (
    // 닉네임·사귄 날 화면과 같은 종이 바탕·가운데 정렬·유리 단추 (2026-11-20 사용자 요청)
    <div className="paper-page pp-flow">
      <header className="pp-head pp-head--center" />
      <main className="pp-main pp-flow__main">
        {deleted && <Notice>방이 삭제됐어요. 새 방을 만들거나 초대 링크를 받아 들어갈 수 있어요.</Notice>}
        {suspect && (
          <Notice>
            지난번엔 <b>{PROVIDER_NAMES[suspect]}</b>로 로그인했어요. 혹시 {PROVIDER_NAMES[suspect]}로 방을 만드셨나요?{' '}
            <TextButton onClick={otherAccount}>{PROVIDER_NAMES[suspect]}로 다시 로그인</TextButton>
          </Notice>
        )}
        <div className="pp-vcenter">
          <h1 tabIndex={-1} className="pp-title pp-title--plain">아직 우리 방이 없어요</h1>
          <p className="pp-sub">방을 만들고 초대 링크를 보내면, 둘만의 영수증을 쌓을 수 있어요.</p>
        </div>
        <div className="pp-flow__next space-y-3">
          {err && <Notice tone="error">방을 만들지 못했어요. 다시 시도해 주세요.</Notice>}
          <Button className="pp-publish pp-publish--glass" disabled={busy} aria-busy={busy} onClick={create}>우리 방 만들기</Button>
          {pasteOpen ? (
            <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); openPasted(); }}>
              <Field id="invite-link" label="받은 초대 링크" hint="카톡으로 받은 링크를 길게 눌러 복사한 뒤 붙여 넣어 주세요.">
                <input
                  id="invite-link"
                  name="invite-link"
                  type="text" // url로 하면 카톡 문구가 섞인 붙여 넣기를 브라우저가 막는다
                  inputMode="url"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  className={`${inputClass} pp-input`}
                  placeholder="https://…/i/…"
                  value={pasted}
                  aria-invalid={pasteErr}
                  onChange={(e) => { setPasted(e.target.value); setPasteErr(false); }}
                />
              </Field>
              {pasteErr && <Notice tone="error">초대 링크가 아니에요. 받은 링크를 그대로 붙여 넣어 주세요.</Notice>}
              <Button type="submit" variant="line" className="pp-btn pp-btn--white" disabled={!pasted.trim()}>이 링크로 들어가기</Button>
            </form>
          ) : (
            <Button variant="line" className="pp-btn pp-btn--white" onClick={() => setPasteOpen(true)}>초대 링크를 받았어요</Button>
          )}
          <div className="pt-3 text-center">
            <TextButton className="text-fade" onClick={() => setLeaveOpen(true)}>탈퇴하기</TextButton>
          </div>
        </div>
      </main>
      {leaveOpen && (
        <Sheet title="탈퇴할까요?" onClose={() => setLeaveOpen(false)}>
          <p className="text-sm text-fade">계정 정보와 사용 기록이 모두 지워지고 되돌릴 수 없어요. 같은 계정으로 다시 로그인하면 처음부터 시작해요.</p>
          {leaveErr && <Notice tone="error">탈퇴하지 못했어요. 다시 시도해 주세요.</Notice>}
          {/* 버튼 순서 규칙 [02-6]: 위 = 안전한 행동(채움), 아래 = 위험한 행동 */}
          <Button onClick={() => setLeaveOpen(false)}>그대로 두기</Button>
          <Button variant="seal" disabled={leaving} aria-busy={leaving} onClick={leave}>{leaving ? '탈퇴하는 중이에요…' : '탈퇴하기'}</Button>
        </Sheet>
      )}
    </div>
  );
}

/** 방 생성 완료 · 초대 링크 (R2, D25, D29) */
export function RoomCreatedScreen({ nav }: { nav: Nav }) {
  const [toast, showToast] = useToast();
  const [token, setToken] = useState<string>();
  useEffect(() => {
    backend.currentInvite().then(async (inv) => setToken((inv ?? (await backend.newInvite())).token)).catch(() => setToken(undefined));
  }, []);
  const url = token ? `${window.location.origin}/i/${token}` : '';
  return (
    // 닉네임·사귄 날·우리 방 만들기 화면과 같은 종이 바탕·가운데 정렬·유리 단추 (2026-11-20 사용자 요청)
    <div className="paper-page pp-flow">
      <header className="pp-head pp-head--center" />
      <main className="pp-main pp-flow__main">
        <div className="pp-vcenter">
          <h1 tabIndex={-1} className="pp-title pp-title--plain">방이 생겼어요!</h1>
          <p className="pp-sub">상대에게 초대 링크를 보내 주세요.</p>
          {/* 초대 링크: 입력칸과 같은 유리판. 상자를 누르기만 해도 복사, 오른쪽 위에 복사 아이콘 (2026-11-20 사용자 요청) */}
          <button type="button" className="pp-input pp-card pp-card--copy" disabled={!token} aria-label={`초대 링크 복사하기: ${url}`} onClick={() => token && copyInvite(token, showToast)}>
            <span className="pp-card__label">초대 링크</span>
            <span translate="no" className="block font-receipt text-sm break-all">{url || '…'}</span>
            <svg className="pp-card__icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="9" width="11" height="11" rx="2.5" />
              <path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15" />
            </svg>
          </button>
          <p className="pp-note">초대 링크는 한 사람만, 24시간 안에 쓸 수 있어요.<br />상대가 연결되면 영수증을 발행할 수 있어요.</p>
        </div>
        <div className="pp-flow__next space-y-3">
          <Button variant="line" className="pp-btn pp-btn--white" onClick={() => nav({ name: 'desk' })}>우리 방으로 가기</Button>
        </div>
      </main>
      {toast}
    </div>
  );
}
