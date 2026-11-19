import { useState } from 'react';
import { AppBar, Button, Field, Notice, Sheet, inputClass, useToast } from '../components/ui';
import { DateWheel } from '../components/WheelPicker';
import { dday, fmtDate, todayIso } from '../lib/dates';
import { LIMITS, clip, countChars, isValidText } from '../lib/text';
import { backend, PROVIDER_NAMES, type Profile, type RoomInfo, type User } from '../services';
import { copyInvite } from './AuthScreens';
import { buildBackupZip } from '../services/backup';
import { downloadFile } from '../services/exportImage';
import type { ReceiptRec } from '../services';
import type { Nav } from '../App';

/**
 * 설정 한 줄 [02-7, 03-4.1.2]
 * - 누를 수 있는 줄(onClick 있음)은 버튼: 값 + › 표시, 호버 배경
 * - 정보만 보여 주는 줄(onClick 없음)은 버튼이 아닌 일반 줄
 */
function Row({ label, value, onClick, danger }: { label: string; value?: string; onClick?: () => void; danger?: boolean }) {
  const inner = (
    <>
      <span>{label}</span>
      <span className="flex items-center gap-2 text-sm text-fade">
        {value && <span className="font-receipt tabular-nums">{value}</span>}
        {onClick && <span aria-hidden="true" className="text-base">›</span>}
      </span>
    </>
  );
  const cls = `flex min-h-13 w-full items-center justify-between gap-3 border-b border-rule text-left text-base ${danger ? 'text-seal-ink' : ''}`;
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} -mx-2 w-[calc(100%+1rem)] px-2 hover:bg-paper`}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}


/** 설정 (R1 사귄 날·닉네임, R2, R9, R13, D6, D23, D25, D39) */
export function SettingsScreen({
  user,
  profile,
  room,
  records,
  nav,
  onChanged,
}: {
  user: User;
  profile: Profile;
  room: RoomInfo;
  records: ReceiptRec[];
  nav: Nav;
  onChanged: () => Promise<unknown>;
}) {
  const TODAY = todayIso();
  const [confirmText, setConfirmText] = useState('');
  const [roomDel, setRoomDel] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState(false);
  const deleteRoom = async () => {
    setDeleting(true);
    setDeleteErr(false);
    try {
      await backend.deleteRoom(confirmText);
      await onChanged();
      nav({ name: 'noroom' }, { replace: true });
    } catch {
      setDeleteErr(true);
      setDeleting(false);
    }
  };
  const nick = profile.nickname;
  const anniv = room.anniversary;
  const [edit, setEdit] = useState<'nick' | 'anniv'>();
  const [draftNick, setDraftNick] = useState(nick);
  const [draftAnniv, setDraftAnniv] = useState(anniv);
  const [saving, setSaving] = useState(false);
  const [toast, showToast] = useToast();
  const [noleave, setNoleave] = useState(false);
  const zero = records.length === 0;
  const alone = room.members.length < 2; // 두 사람이 다 들어오면 초대 링크 메뉴를 숨김 (D25)

  // 전체 백업 (R9): 진행률을 보여 주며 ZIP을 만든다
  const [progress, setProgress] = useState<number>();
  const backing = progress !== undefined;
  const backup = async () => {
    if (backing || zero) return;
    setProgress(0);
    try {
      const file = await buildBackupZip(records, room, setProgress);
      downloadFile(file);
      showToast('백업 파일을 받았어요. 휴대폰의 파일 앱이나 컴퓨터에 보관해 주세요.');
    } catch {
      showToast('백업 파일을 만들지 못했어요. 연결을 확인하고 다시 시도해 주세요.');
    } finally {
      setProgress(undefined);
    }
  };

  const save = async (fn: () => Promise<void>, msg: string) => {
    setSaving(true);
    try {
      await fn();
      await onChanged();
      setEdit(undefined);
      showToast(msg);
    } catch {
      showToast('저장하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };
  const newLink = async () => {
    try {
      const inv = await backend.newInvite();
      await copyInvite(inv.token, () => showToast('새 초대 링크를 만들어 복사했어요. 이전 링크는 이제 쓸 수 없어요.'));
    } catch {
      showToast('초대 링크를 만들지 못했어요. 다시 시도해 주세요.');
    }
  };
  const logout = async () => {
    await backend.signOut();
    await onChanged();
    nav({ name: 'login' }, { replace: true });
  };

  return (
    <>
      <AppBar title="설정" onBack={() => nav({ name: 'desk' })} />
      <main className="space-y-8 px-4 pt-6 pb-12">
        <section className="space-y-3">
          <h2 className="text-base font-bold">전체 백업</h2>
          <p className="text-sm text-fade">
            사진, 기록 보기 파일, 데이터를 ZIP 하나로 받아요. 서비스가 멈춰도 이 파일로 언제든 기록을 열어 볼 수 있어요.
          </p>
          {backing ? (
            <div role="status" className="space-y-2">
              <p className="text-sm">백업 파일을 만드는 중이에요… <span className="font-receipt tabular-nums">{progress}%</span></p>
              <div className="h-2 w-full bg-counter" role="progressbar" aria-label="백업 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                <div className="h-full bg-ink transition-[width]" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : (
            <Button disabled={zero} onClick={backup}>전체 백업 받기</Button>
          )}
          {zero && <p className="text-sm text-fade">아직 백업할 영수증이 없어요</p>}
        </section>

        {alone && (
          <section>
            <h2 className="pb-1 text-base font-bold">초대 링크</h2>
            <Row label="새 초대 링크 만들기" onClick={newLink} />
            <p className="pt-2 text-sm text-fade">새 링크를 만들면 이전 링크는 바로 쓸 수 없게 돼요.</p>
          </section>
        )}

        <section>
          <h2 className="pb-1 text-base font-bold">계정</h2>
          {/* [임시 Q7] 닉네임은 설정에서 바꿀 수 있음 */}
          <Row label="닉네임" value={nick} onClick={() => { setDraftNick(nick); setEdit('nick'); }} />
          <Row label="사귄 날" value={`${fmtDate(anniv, false)} · D+${dday(anniv, TODAY)}`} onClick={() => { setDraftAnniv(anniv); setEdit('anniv'); }} />
          <Row label="로그인 방식" value={PROVIDER_NAMES[user.provider]} />
          <Row label="로그아웃" onClick={logout} />
          <Row label="우리 방 삭제" danger onClick={() => setRoomDel(true)} />
          {/* 방이 있으면 탈퇴할 수 없다 (R13). 방이 없으면 '우리 방' 화면에서 탈퇴 */}
          <Row label="탈퇴하기" onClick={() => setNoleave(true)} />
          {noleave && <div className="pt-3"><Notice>탈퇴하려면 먼저 우리 방을 삭제해야 해요.</Notice></div>}
        </section>
      </main>

      {edit === 'nick' && (
        <Sheet title="닉네임 바꾸기" onClose={() => setEdit(undefined)}>
          <Field id="nick-edit" label="닉네임" hint={<span className="flex justify-end font-receipt tabular-nums">{countChars(draftNick)}/{LIMITS.nickname}</span>}>
            <input id="nick-edit" name="nickname" autoComplete="nickname" spellCheck={false} className={inputClass} value={draftNick} onChange={(e) => setDraftNick(clip(e.target.value, LIMITS.nickname))} />
          </Field>
          <Button disabled={!isValidText(draftNick, LIMITS.nickname) || saving} aria-busy={saving} onClick={() => save(() => backend.saveNickname(draftNick), '닉네임을 바꿨어요')}>저장하기</Button>
          <Button variant="line" onClick={() => setEdit(undefined)}>그대로 두기</Button>
        </Sheet>
      )}

      {edit === 'anniv' && (
        <Sheet title="사귄 날 바꾸기" onClose={() => setEdit(undefined)}>
          <DateWheel value={draftAnniv} onChange={setDraftAnniv} max={TODAY} minYear={1990} />
          <p aria-live="polite" className="text-right font-receipt text-sm">
            {fmtDate(draftAnniv, false)} · <b>D+{dday(draftAnniv, TODAY)}</b>
          </p>
          <p className="text-xs text-fade">바꾸면 두 사람 화면 모두 바뀌어요.</p>
          <Button disabled={saving} aria-busy={saving} onClick={() => save(() => backend.setAnniversary(draftAnniv), '사귄 날을 바꿨어요')}>저장하기</Button>
          <Button variant="line" onClick={() => setEdit(undefined)}>그대로 두기</Button>
        </Sheet>
      )}

      {roomDel && (
        <Sheet title="우리 방을 삭제할까요?" onClose={() => setRoomDel(false)}>
          <p className="text-sm text-fade">
            두 사람의 영수증, 사진, 스탬프가 모두 삭제되고 되돌릴 수 없어요. 삭제하기 전에 전체 백업을 받아 두세요.
          </p>
          <Field id="del-confirm" label="확인을 위해 ‘삭제’라고 입력해 주세요">
            <input id="del-confirm" name="delete-confirm" autoComplete="off" spellCheck={false} className={inputClass} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
          </Field>
          {/* 버튼 순서 규칙 [02-6]: 위 = 안전한 행동(채움), 아래 = 위험한 행동 */}
          <Button disabled={zero} onClick={() => { setRoomDel(false); void backup(); }}>백업 먼저 받기</Button>
          <Button variant="line" onClick={() => setRoomDel(false)}>그대로 두기</Button>
          {deleteErr && <Notice tone="error">방을 삭제하지 못했어요. 연결을 확인하고 다시 시도해 주세요.</Notice>}
          <Button variant="seal" disabled={confirmText !== '삭제' || deleting} aria-busy={deleting} onClick={deleteRoom}>
            {deleting ? '삭제하는 중이에요…' : '방 삭제하기'}
          </Button>
        </Sheet>
      )}
      {toast}
    </>
  );
}
