import { useEffect, useState } from 'react';
import { AppBar, Button, EmptyState, Field, Notice, Sheet, TextButton, inputClass, useToast } from '../components/ui';
import { CoupleMark } from '../components/Receipt';
import { DateWheel } from '../components/WheelPicker';
import { dday, fmtDate, todayIso } from '../lib/dates';
import { LIMITS, clip, countChars, isValidText } from '../lib/text';
import { parseInviteInput, type InviteStatus } from '../lib/invite';
import {
  backend,
  lastProvider,
  pendingAnniversary,
  pendingInvite,
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

/** 로그인 (R1, D19, D28) · 초대 받음 로그인 전 (R3, D33) */
export function LoginScreen({ nav, invite = false, onSignedIn }: { nav: Nav; invite?: boolean; onSignedIn: () => Promise<unknown> }) {
  const last = lastProvider();
  // 로그인 제공자에서 취소·실패하고 돌아오면 주소에 error가 붙어 온다
  const failed = new URLSearchParams(window.location.search).has('error') || window.location.hash.includes('error');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(failed);
  const login = async (p: Provider) => {
    setBusy(true);
    setErr(false);
    try {
      suspectProvider.check(p); // 지난 방식과 다르면 "혹시 ○○로 방을 만드셨나요?"를 보여 주려고 기억
      await backend.signIn(p);
      rememberProvider(p);
      await onSignedIn(); // 다음 화면은 App이 정한다
      if (!invite) nav({ name: 'list' }, { replace: true });
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="flex min-h-screen flex-col justify-between px-6 pt-20 pb-10">
      <div>
        {/* 첫 화면의 주인공: 우리두리 로고 (사용자 요청 2026-11-18) */}
        <h1 className="flex flex-col items-center gap-3 outline-none">
          <CoupleMark className="h-16 w-[6.4rem] text-ink" />
          <span className="text-2xl font-bold tracking-tight">우리두리</span>
        </h1>
        {err && <div className="mt-6"><Notice tone="error">로그인하지 못했어요. 다시 시도해 주세요.</Notice></div>}
      </div>
      <div className="mt-10 space-y-2">
        {last && <p className="pb-1 text-center text-sm text-fade">지난번엔 <b className="text-ink">{PROVIDER_NAMES[last]}</b>로 로그인했어요</p>}
        <Button variant="kakao" disabled={busy} onClick={() => login('kakao')}>카카오로 시작하기</Button>
        <Button variant="google" disabled={busy} onClick={() => login('google')}>구글로 시작하기</Button>
        {/* [임시 Q18] 4주 테스트 동안 약관 링크 생략. 외부 공개 전에 넣는다 */}
      </div>
    </main>
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
      if (p.status === 'member' && !ownLinkAlone) { pendingInvite.clear(); nav({ name: 'list' }, { replace: true }); }
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
          <Button variant="line" onClick={() => { pendingInvite.clear(); nav({ name: 'list' }, { replace: true }); }}>우리 방으로 가기</Button>
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
          <Button variant="line" onClick={() => { pendingInvite.clear(); nav({ name: 'list' }, { replace: true }); }}>
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
      nav({ name: 'list' }, { replace: true });
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
export function NicknameScreen({ nav, onSaved }: { nav: Nav; onSaved: () => Promise<unknown> }) {
  const [nick, setNick] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const next = async () => {
    setBusy(true);
    setErr(false);
    try {
      await backend.saveNickname(nick);
      await onSaved();
      // 초대받은 사람은 사귄 날을 묻지 않는다 (D39)
      const token = pendingInvite.get();
      nav(token ? { name: 'invite', token } : { name: 'anniversary' }, { replace: true });
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <AppBar title="닉네임 정하기" />
      <main className="space-y-6 px-6 pt-10">
        <div>
          <h2 className="text-xl font-bold text-balance">닉네임을 정해 주세요</h2>
          <p className="mt-2 text-sm text-fade">영수증과 알림에 이 닉네임으로 보여요.</p>
        </div>
        {/* [임시 Q7] 최대 10자, 설정에서 변경 가능 */}
        <Field id="nick" label="닉네임" hint={<span className="flex justify-between"><span>최대 {LIMITS.nickname}자</span><span className="font-receipt tabular-nums">{countChars(nick)}/{LIMITS.nickname}</span></span>}>
          <input id="nick" name="nickname" className={inputClass} placeholder="예: 민지" value={nick} onChange={(e) => setNick(clip(e.target.value, LIMITS.nickname))} onKeyDown={(e) => { if (e.key === 'Enter' && isValidText(nick, LIMITS.nickname)) void next(); }} autoComplete="nickname" spellCheck={false} />
        </Field>
        {err && <Notice tone="error">저장하지 못했어요. 다시 시도해 주세요.</Notice>}
        <Button disabled={!isValidText(nick, LIMITS.nickname) || busy} aria-busy={busy} onClick={next}>다음</Button>
      </main>
    </>
  );
}

/** 사귄 날 입력 (D37) — 닉네임 다음. 휠 피커, 오늘 날짜에서 시작. 사귄 날 = 1일 (D38) */
export function AnniversaryScreen({ nav }: { nav: Nav }) {
  const today = todayIso();
  const [date, setDate] = useState(pendingAnniversary.get() ?? today);
  return (
    <>
      <AppBar title="사귄 날" />
      <main className="space-y-6 px-6 pt-10">
        <div>
          <h2 className="text-xl font-bold text-balance">우리가 사귄 날을 알려 주세요</h2>
          <p className="mt-2 text-sm text-fade">위아래로 굴려서 고르고, 가운데 숫자를 누르면 직접 쓸 수 있어요.</p>
        </div>
        <DateWheel value={date} onChange={setDate} max={today} minYear={1990} />
        {/* 고르는 대로 영수증 한 줄처럼 미리 보여 준다 */}
        <div aria-live="polite" className="bg-paper px-5 py-4 font-receipt shadow-paper">
          <div className="flex justify-between text-sm"><span>사귄 날</span><span>{fmtDate(date, false)}</span></div>
          <div className="perforation mt-2 flex items-baseline justify-between pt-2">
            <span className="text-sm">오늘</span>
            <span className="text-xl font-semibold">D+{dday(date, today)}</span>
          </div>
          <p className="mt-1 text-right text-xs text-fade">사귄 날을 1일로 세요</p>
        </div>
        <p className="text-xs text-fade">초대받은 상대에게는 묻지 않아요. 설정에서 둘 다 고칠 수 있어요.</p>
        <Button onClick={() => { pendingAnniversary.set(date); nav({ name: 'noroom' }); }}>다음</Button>
      </main>
    </>
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
    <>
      <AppBar title="우리 방" />
      <main className="space-y-4 px-6 pt-6">
        {deleted && <Notice>방이 삭제됐어요. 새 방을 만들거나 초대 링크를 받아 들어갈 수 있어요.</Notice>}
        {suspect && (
          <Notice>
            지난번엔 <b>{PROVIDER_NAMES[suspect]}</b>로 로그인했어요. 혹시 {PROVIDER_NAMES[suspect]}로 방을 만드셨나요?{' '}
            <TextButton onClick={otherAccount}>{PROVIDER_NAMES[suspect]}로 다시 로그인</TextButton>
          </Notice>
        )}
        <EmptyState mark="🧾" title="아직 우리 방이 없어요" body="방을 만들고 초대 링크를 보내면, 둘만의 영수증을 쌓을 수 있어요." />
        {err && <Notice tone="error">방을 만들지 못했어요. 다시 시도해 주세요.</Notice>}
        <Button disabled={busy} aria-busy={busy} onClick={create}>우리 방 만들기</Button>
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
                className={inputClass}
                placeholder="https://…/i/…"
                value={pasted}
                aria-invalid={pasteErr}
                onChange={(e) => { setPasted(e.target.value); setPasteErr(false); }}
              />
            </Field>
            {pasteErr && <Notice tone="error">초대 링크가 아니에요. 받은 링크를 그대로 붙여 넣어 주세요.</Notice>}
            <Button type="submit" variant="line" disabled={!pasted.trim()}>이 링크로 들어가기</Button>
          </form>
        ) : (
          <Button variant="line" onClick={() => setPasteOpen(true)}>초대 링크를 받았어요</Button>
        )}
        <div className="pt-6 text-center">
          <TextButton className="text-fade" onClick={() => setLeaveOpen(true)}>탈퇴하기</TextButton>
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
    </>
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
    <>
      <AppBar title="방 만들기 완료" />
      <main className="space-y-5 px-6 pt-6">
        <Notice><b>방이 생겼어요!</b> 상대에게 초대 링크를 보내 주세요.</Notice>
        <div className="space-y-3 bg-paper p-4 shadow-paper">
          <p className="text-sm text-fade">초대 링크</p>
          <p translate="no" className="font-receipt text-sm break-all">{url || '…'}</p>
          <Button disabled={!token} onClick={() => token && copyInvite(token, showToast)}>초대 링크 복사</Button>
          <p className="text-sm text-fade">초대 링크는 한 사람만, 24시간 안에 쓸 수 있어요.</p>
        </div>
        <p className="text-sm text-fade">상대가 연결되면 영수증을 발행할 수 있어요.</p>
        <Button variant="line" onClick={() => nav({ name: 'list' })}>우리 방으로 가기</Button>
      </main>
      {toast}
    </>
  );
}
