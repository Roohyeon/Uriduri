import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { MOODS, MOOD_NAMES, type Mood, type Receipt } from '../data';
import { MoodFace } from '../components/MoodFace';
import { AppBar, Button, Field, Notice, Sheet, inputClass } from '../components/ui';
import { ReceiptPaper } from '../components/Receipt';
import { DateWheel } from '../components/WheelPicker';
import { dday, fmtDate, todayIso, type IsoDate } from '../lib/dates';
import { LIMITS, clip, countChars, isValidText } from '../lib/text';
import { backend, type DateSource, type PreparedPhoto, type ReceiptRec } from '../services';
import { preparePhoto, readTakenDate } from '../services/photos';
import type { Nav } from '../App';

type Picked = { photo: PreparedPhoto; src: string };

/** 영수증 발행·수정 (R4, R7, D12, D20, D29) */
export function ComposeScreen({
  me,
  anniversary,
  nav,
  editing,
  onDone,
}: {
  me: string;
  anniversary: IsoDate;
  nav: Nav;
  /** 상세 보기 "수정"에서 들어옴 [02-13] */
  editing?: { rec: ReceiptRec; photoSrc?: string };
  onDone: (rec: ReceiptRec) => Promise<void>;
}) {
  const rec = editing?.rec;
  const today = todayIso();

  // 사용 기록 (R12): 작성 화면을 열 때마다 작성 회차 ID를 만들고, 열기·발행을 이 ID로 짝짓는다. 수정 화면은 기록하지 않음
  const [sessionId] = useState(() => crypto.randomUUID());
  const opened = useRef(false);
  useEffect(() => {
    if (rec || opened.current) return; // 개발 모드에서 두 번 그려져도 한 번만
    opened.current = true;
    void backend.logEvent('compose_open', { sessionId }).catch(() => undefined);
  }, [rec, sessionId]);

  // 사진 고르기: 기기의 사진 선택 창(1장)
  const fileRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked>();
  const [preparing, setPreparing] = useState(false);
  const [photoErr, setPhotoErr] = useState(false);
  // 날짜: 사진 촬영 날짜로 채우고, 없으면 오늘. 언제든 직접 바꿀 수 있다 (R4) [02-8]
  const [date, setDate] = useState<IsoDate>(rec?.date ?? today);
  const [dateFrom, setDateFrom] = useState<DateSource>(rec?.dateSource ?? 'today');
  const [dateSheet, setDateSheet] = useState(false);
  const [draftDate, setDraftDate] = useState(date);
  const [memo, setMemo] = useState(rec?.memo ?? '');
  const [place, setPlace] = useState(rec?.place ?? '');
  const [mood, setMood] = useState<Mood | undefined>(rec?.mood); // 선택 항목이라 새 발행은 비워 둔다 [02-19]
  const [confirmClose, setConfirmClose] = useState(false);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);

  // 고른 사진의 미리보기 주소는 화면을 떠날 때 정리
  useEffect(() => () => { if (picked) URL.revokeObjectURL(picked.src); }, [picked]);

  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setPreparing(true);
    setPhotoErr(false);
    try {
      // 새 사진을 고르면 날짜도 새 사진 기준으로 다시 채운다 (R4, R7)
      const [taken, photo] = await Promise.all([readTakenDate(f), preparePhoto(f)]);
      setPicked({ photo, src: URL.createObjectURL(photo.blob) });
      const d = taken && taken <= today ? taken : today;
      setDate(d);
      setDateFrom(taken && taken <= today ? 'exif' : 'today');
    } catch {
      setPhotoErr(true);
    } finally {
      setPreparing(false);
    }
  };

  const hasPhoto = !!picked || !!rec;
  const photoSrc = picked?.src ?? editing?.photoSrc;
  const dirty = editing
    ? !!picked || memo !== rec!.memo || place !== (rec!.place ?? '') || mood !== rec!.mood || date !== rec!.date
    : !!picked || memo.trim() !== '' || place.trim() !== '' || !!mood;

  // 브라우저를 닫거나 새로고침할 때 경고 (C4) — 입력이 있을 때만
  useEffect(() => {
    if (!dirty || sending) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, sending]);

  const canPublish = hasPhoto && isValidText(memo, LIMITS.memo) && !sending && !preparing;

  const preview: Receipt = useMemo(() => ({
    id: rec?.id ?? 'preview',
    no: rec ? String(rec.no).padStart(4, '0') : '----',
    date: hasPhoto ? date : '날짜',
    place: place.trim() || undefined,
    memo: memo || '오늘 데이트를 한 줄로 남겨 보세요',
    mood,
    author: me,
    authorId: '',
    dplus: dday(anniversary, date),
    photo: photoSrc
      ? { from: '#cdb596', to: '#86684a', label: `${me}의 ${fmtDate(date)} 데이트 사진`, emoji: '', src: photoSrc }
      : { from: '#e6e7e9', to: '#c9cacd', label: '아직 고른 사진 없음', emoji: '📷' },
    stamps: [],
    isNew: false,
  }), [rec, hasPhoto, date, place, memo, mood, me, anniversary, photoSrc]);

  const dateHint = {
    exif: '사진 촬영 날짜로 채웠어요. 눌러서 바꿀 수 있어요.',
    today: '촬영 정보가 없어 오늘 날짜로 채웠어요. 눌러서 바꿀 수 있어요.',
    manual: '직접 고른 날짜예요.',
  }[dateFrom];

  const leave = () => (rec ? nav({ name: 'detail', id: rec.id }, { replace: true }) : nav({ name: 'list' }, { replace: true }));
  const close = () => (dirty ? setConfirmClose(true) : leave());

  const submit = async () => {
    if (!canPublish) return;
    setSending(true);
    setFailed(false);
    try {
      const input = { date, dateSource: dateFrom, memo, place: place.trim() || undefined, mood };
      const out = rec
        ? await backend.updateReceipt(rec.id, { ...input, photo: picked?.photo })
        : await backend.publishReceipt({ ...input, photo: picked!.photo, sessionId });
      await onDone(out);
    } catch {
      // 입력한 내용은 그대로 두고 다시 시도할 수 있게 (R4)
      setFailed(true);
      setSending(false);
    }
  };

  const verb = rec ? '저장' : '발행';

  return (
    <>
      <AppBar
        title={rec ? '영수증 수정' : '영수증 발행'}
        right={
          <button type="button" className="grid size-11 place-items-center rounded-full text-lg text-ink hover:bg-counter" aria-label="닫기" onClick={close}>
            <span aria-hidden="true">✕</span>
          </button>
        }
      />
      <main className="space-y-6 px-4 pt-4 pb-10">
        {/* 첫 행동인 사진 고르기를 첫 화면 맨 위에 [02-2]. 한 번에 1장 (R4) */}
        <input ref={fileRef} type="file" accept="image/*,.heic,.heif" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={onPick} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={preparing || sending}
          aria-busy={preparing}
          className={`flex w-full items-center justify-center gap-2 rounded-sm border-2 border-dashed border-edge bg-paper text-base font-semibold enabled:hover:bg-counter disabled:cursor-wait ${hasPhoto ? 'min-h-12' : 'min-h-28'}`}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="5" width="18" height="15" rx="2" />
            <circle cx="12" cy="12.5" r="3.5" />
            <path d="M8.5 5l1.5-2h4l1.5 2" />
          </svg>
          {preparing ? '사진을 준비하는 중이에요…' : hasPhoto ? '사진 바꾸기' : '사진 고르기'}
        </button>
        {photoErr && <Notice tone="error">이 사진은 열 수 없어요. 다른 사진을 골라 주세요.</Notice>}

        <section aria-label="미리보기" className="px-2">
          <ReceiptPaper r={preview} />
        </section>

        <div className="space-y-1">
          <span id="date-label" className="block text-sm font-semibold">날짜</span>
          {hasPhoto ? (
            <>
              <button
                type="button"
                aria-labelledby="date-label date-value date-change"
                aria-describedby="date-hint"
                onClick={() => { setDraftDate(date); setDateSheet(true); }}
                className={`${inputClass} flex items-center justify-between text-left font-receipt hover:bg-counter`}
              >
                <span id="date-value">{fmtDate(date)}</span>
                <span id="date-change" className="font-body text-sm text-fade">바꾸기<span aria-hidden="true"> ›</span></span>
              </button>
              <p id="date-hint" className="text-xs text-fade">{dateHint}</p>
            </>
          ) : (
            <p className="text-sm text-fade">사진을 고르면 날짜가 채워져요</p>
          )}
        </div>

        <Field id="memo" label="한 줄 메모" hint={<span className="flex justify-end font-receipt tabular-nums">{countChars(memo)}/{LIMITS.memo}</span>}>
          <input id="memo" name="memo" autoComplete="off" className={inputClass} placeholder="오늘 데이트를 한 줄로 남겨 보세요" value={memo} onChange={(e) => setMemo(clip(e.target.value, LIMITS.memo))} />
        </Field>

        <Field id="place" label="장소 (선택)" hint={<span className="flex justify-end font-receipt tabular-nums">{countChars(place)}/{LIMITS.place}</span>}>
          <input id="place" name="place" autoComplete="off" className={inputClass} placeholder="예: 연남동 경의선숲길" value={place} onChange={(e) => setPlace(clip(e.target.value, LIMITS.place))} />
        </Field>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">오늘의 기분 (선택)</legend>
          {/* [임시 Q10] 얼굴 아이콘 7종 */}
          <div className="flex flex-wrap gap-2">
            {MOODS.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mood === m}
                aria-label={MOOD_NAMES[m]}
                title={MOOD_NAMES[m]}
                onClick={() => setMood(mood === m ? undefined : m)}
                className={`grid size-11 place-items-center rounded-full border text-ink ${mood === m ? 'border-2 border-ink bg-counter' : 'border-edge bg-paper hover:bg-counter'}`}
              >
                <MoodFace mood={m} size={26} label={false} />
              </button>
            ))}
          </div>
        </fieldset>

        {failed && (
          <Notice tone="error">
            {rec ? '저장하지 못했어요.' : '발행하지 못했어요.'} 입력한 내용은 그대로 있어요. 연결을 확인하고 다시 시도해 주세요.
          </Notice>
        )}
        {!canPublish && !sending && !preparing && <p className="text-sm text-fade">사진과 한 줄 메모를 넣으면 {verb}할 수 있어요</p>}

        <Button variant="seal" disabled={!canPublish} aria-busy={sending} onClick={submit}>
          {sending ? `${verb}하는 중이에요…` : rec ? '저장하기' : failed ? '다시 발행하기' : '영수증 발행하기'}
        </Button>
      </main>

      {dateSheet && (
        <Sheet title="날짜 바꾸기" onClose={() => setDateSheet(false)}>
          <DateWheel value={draftDate} onChange={setDraftDate} max={today} minYear={2000} />
          <p aria-live="polite" className="text-right font-receipt text-sm">{fmtDate(draftDate)}</p>
          <Button onClick={() => { setDate(draftDate); setDateFrom('manual'); setDateSheet(false); }}>이 날짜로 하기</Button>
          <Button variant="line" onClick={() => setDateSheet(false)}>그대로 두기</Button>
        </Sheet>
      )}

      {confirmClose && (
        <Sheet title={rec ? '고친 내용을 버릴까요?' : '작성 중인 영수증을 버릴까요?'} onClose={() => setConfirmClose(false)}>
          <p className="text-sm text-fade">지금 닫으면 입력한 내용이 사라져요.</p>
          {/* 버튼 순서 규칙 [02-6]: 위 = 안전한 행동(채움), 아래 = 위험한 행동 */}
          <Button onClick={() => setConfirmClose(false)}>계속 쓰기</Button>
          <Button variant="line" onClick={leave}>버리기</Button>
        </Sheet>
      )}
    </>
  );
}
