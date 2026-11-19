import { useEffect, useRef, useState } from 'react';
import { STAMP_EXAMPLES, STAMP_MAX, type Receipt, type StampMark, type StampShape } from '../data';
import { AppBar, Button, Field, Notice, OpenQ, Sheet, TextButton, inputClass, useToast } from '../components/ui';
import { backend, type StampInput } from '../services';
import { canShareFiles, downloadFile, receiptFileName, renderReceiptPng, shareFile } from '../services/exportImage';
import { RollReceipt, SHAPE_NAMES, Stamp } from '../components/Receipt';
import { DownloadIcon } from '../components/DownloadIcon';
import { ShareIcon } from '../components/ShareIcon';
import type { Nav } from '../App';

/** 영수증 상세 보기 (R6, R7, R8, D4, D27, D32, D34, D35) — 끈에 매달린 영수증, 원하는 자리에 도장 찍기 */
export function DetailScreen({
  receipt,
  me,
  meName,
  nav,
  onDeleted,
  onStampSaved,
}: {
  receipt: Receipt;
  me: string;
  meName: string;
  nav: Nav;
  onDeleted: () => Promise<void>;
  /** 도장이 저장되면 보드도 새로 그린다 */
  onStampSaved: () => void;
}) {
  const ME = me;
  const mine = receipt.authorId === me; // R7: 작성자만 수정·삭제
  const [myStamp, setMyStamp] = useState<StampMark | undefined>(receipt.stamps.find((s) => s.by === me));
  const [animate, setAnimate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState(false);
  const [toast, flash] = useToast(); // 5초 + 닫기 버튼 [03-2.2.1]
  const [stampFailed, setStampFailed] = useState(false);

  // 도장 저장 (R6): 내 화면에 바로 찍고, 저장에 실패하면 되돌리고 안내한다
  const commitStamp = async (next: StampMark | undefined) => {
    const prev = myStamp;
    setMyStamp(next);
    setStampFailed(false);
    try {
      if (next) {
        const input: StampInput = { shape: next.shape, label: next.label, rot: next.rot, x: next.x, y: next.y };
        await backend.setStamp(receipt.id, input);
      } else {
        await backend.removeStamp(receipt.id);
      }
      onStampSaved();
    } catch {
      setMyStamp(prev);
      setStampFailed(true);
    }
  };

  // 이미지로 저장·공유 (R8)
  const paperRef = useRef<HTMLElement>(null);
  const [canShare] = useState(canShareFiles);
  const [exporting, setExporting] = useState<'save' | 'share'>();
  useEffect(() => () => setExporting(undefined), []);
  const exportImage = async (how: 'save' | 'share') => {
    if (!paperRef.current || exporting) return;
    void backend.logEvent(how === 'save' ? 'image_save' : 'image_share', { receiptId: receipt.id }).catch(() => undefined); // R12: 누르면 기록(완료 여부와 무관)
    setExporting(how);
    try {
      const file = await renderReceiptPng(paperRef.current, receiptFileName(receipt.date, receipt.no));
      if (how === 'save') {
        downloadFile(file);
        flash('이미지를 저장했어요');
      } else {
        await shareFile(file, '우리두리 영수증');
      }
    } catch {
      flash(how === 'save' ? '이미지를 만들지 못했어요. 다시 시도해 주세요.' : '공유하지 못했어요. 이미지로 저장해서 보내 주세요.');
    } finally {
      setExporting(undefined);
    }
  };
  const remove = async () => {
    setDeleting(true);
    setDeleteErr(false);
    try {
      await backend.deleteReceipt(receipt.id);
      await onDeleted();
    } catch {
      setDeleteErr(true);
      setDeleting(false);
    }
  };
  const rot = () => Math.round(Math.random() * 24 - 12);

  // 도장 만들기 (D34·D35): 모양 3가지 중 고르고, 문구는 직접 쓴다
  const [shape, setShape] = useState<StampShape>(myStamp?.shape ?? 'circle');
  const [label, setLabel] = useState(myStamp?.label ?? '');
  const thud = () => { setAnimate(false); requestAnimationFrame(() => setAnimate(true)); };

  // "도장 찍기": 기본 자리(사진 오른쪽 아래)에 바로 찍힌다 → 키보드로도 찍을 수 있음
  const press = () => {
    if (!label.trim()) return;
    void commitStamp({ by: ME, byName: meName, shape, label: label.trim(), rot: rot(), x: myStamp?.x ?? 72, y: myStamp?.y ?? 48 });
    thud();
  };
  // 영수증 위를 누르면 내 도장을 그 자리로 옮겨 찍는다
  const stampAt = (x: number, y: number) => {
    if (!myStamp) return;
    void commitStamp({ ...myStamp, x, y, rot: rot() });
    thud();
  };

  // 도장 자리를 키보드로도 고르기 (3×3 칸) [03-2.1.1, 04 Receipt:241]
  const SPOTS = [
    { name: '왼쪽 위', x: 25, y: 22 }, { name: '가운데 위', x: 50, y: 22 }, { name: '오른쪽 위', x: 75, y: 22 },
    { name: '왼쪽 가운데', x: 25, y: 48 }, { name: '가운데', x: 50, y: 48 }, { name: '오른쪽 가운데', x: 75, y: 48 },
    { name: '왼쪽 아래', x: 25, y: 74 }, { name: '가운데 아래', x: 50, y: 74 }, { name: '오른쪽 아래', x: 75, y: 74 },
  ];
  const nearest = myStamp ? SPOTS.reduce((a, b) => (Math.hypot(b.x - myStamp.x, b.y - myStamp.y) < Math.hypot(a.x - myStamp.x, a.y - myStamp.y) ? b : a)) : undefined;

  const shown: Receipt = { ...receipt, stamps: [...receipt.stamps.filter((s) => s.by !== ME), ...(myStamp ? [myStamp] : [])] };

  return (
    <>
      <AppBar title="영수증" onBack={() => nav({ name: 'desk' })} />
      <main className="space-y-6 px-3 pb-12">
        <RollReceipt r={shown} mine={mine} stampingLabel={!mine ? myStamp?.label : undefined} onStampAt={stampAt} animateBy={animate ? ME : undefined} exportRef={paperRef} />

        {!mine && (
          <section className="space-y-3 px-1" aria-labelledby="stamp-h">
            <h2 id="stamp-h" className="text-base font-bold">스탬프 찍기</h2>
            {/* 1. 모양 */}
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">모양</legend>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(SHAPE_NAMES) as StampShape[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={shape === k}
                    onClick={() => setShape(k)}
                    className={`flex min-h-24 flex-col items-center justify-center gap-1 rounded-sm border bg-paper py-2 ${shape === k ? 'border-seal border-2' : 'border-edge hover:bg-counter'}`}
                  >
                    <Stamp mark={{ by: ME, shape: k, label: '', rot: 0, x: 0, y: 0 }} size={48} ink={false} />
                    <span className="text-sm">{SHAPE_NAMES[k]}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            {/* 2. 문구 — 직접 쓰기 + 미리보기 */}
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <OpenQ id="Q22" note="최대 글자 수">
                  <Field id="stamp-text" label="도장 문구" hint={<span className="flex justify-end font-receipt">{[...label].length}/{STAMP_MAX}</span>}>
                    <input
                      id="stamp-text"
                      name="stamp-text"
                      autoComplete="off"
                      className={inputClass}
                      maxLength={STAMP_MAX}
                      placeholder="예: 또 가자!"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') press(); }}
                    />
                  </Field>
                </OpenQ>
              </div>
              <div className="grid size-[84px] shrink-0 place-items-center">
                <Stamp mark={{ by: ME, shape, label: label || '문구', rot: -8, x: 0, y: 0 }} size={80} ink={false} />
              </div>
            </div>

            {/* 3. 예시 — 토글 */}
            <details className="group rounded-sm border border-rule bg-paper">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 text-sm font-semibold">
                문구 예시 보기
                <span aria-hidden="true" className="transition-transform group-open:rotate-180">⌄</span>
              </summary>
              <div className="flex flex-wrap gap-2 px-4 pb-4">
                {STAMP_EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setLabel(ex)}
                    className={`min-h-11 rounded-full border px-4 text-sm ${label === ex ? 'border-seal text-seal-ink' : 'border-edge hover:bg-counter'}`}
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </details>

            <Button variant="seal" disabled={!label.trim()} onClick={press}>
              {myStamp ? '도장 다시 찍기' : '도장 찍기'}
            </Button>
            <p className="text-sm text-fade">
              {myStamp
                ? '영수증 위 다른 곳을 누르거나 아래 도장 자리를 고르면 그 자리로 옮겨 찍어요.'
                : '문구를 쓰고 도장 찍기를 누르면 영수증에 꾹 찍혀요.'}
            </p>
            {myStamp && (
              <fieldset>
                <legend className="mb-2 text-sm font-semibold">도장 자리</legend>
                <div className="grid w-40 grid-cols-3 gap-1">
                  {SPOTS.map((sp) => (
                    <button
                      key={sp.name}
                      type="button"
                      aria-label={sp.name}
                      aria-pressed={nearest?.name === sp.name}
                      onClick={() => stampAt(sp.x, sp.y)}
                      className={`grid size-11 place-items-center rounded-sm border ${nearest?.name === sp.name ? 'border-2 border-seal bg-paper' : 'border-edge bg-paper hover:bg-counter'}`}
                    >
                      <span aria-hidden="true" className={`size-2.5 rounded-full ${nearest?.name === sp.name ? 'bg-seal' : 'bg-rule'}`} />
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            {myStamp && <TextButton onClick={() => { void commitStamp(undefined); }}>내 도장 지우기</TextButton>}
            {stampFailed && <Notice tone="error">스탬프를 찍지 못했어요. 다시 시도해 주세요.</Notice>}
          </section>
        )}

        {/* [임시 Q13] 이미지 비율은 영수증 그대로 1종 */}
        <div className={`grid gap-2 px-1 ${canShare ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <Button variant="line" className="dl-trigger flex items-center justify-center gap-2" disabled={!!exporting} aria-busy={exporting === 'save'} onClick={() => exportImage('save')}>
            <DownloadIcon size={20} />
            {exporting === 'save' ? '만드는 중…' : '이미지로 저장'}
          </Button>
          {canShare && (
            <Button variant="line" className="dl-trigger flex items-center justify-center gap-2" disabled={!!exporting} aria-busy={exporting === 'share'} onClick={() => exportImage('share')}>
              <ShareIcon size={20} />
              {exporting === 'share' ? '만드는 중…' : '공유하기'}
            </Button>
          )}
        </div>

        {mine && (
          <div className="grid grid-cols-2 gap-2 px-1">
            <Button variant="line" onClick={() => nav({ name: 'edit', id: receipt.id })}>수정</Button>
            <Button variant="line" className="text-seal-ink" onClick={() => setConfirmDelete(true)}>삭제</Button>
          </div>
        )}
      </main>

      {confirmDelete && (
        <Sheet title="이 영수증을 삭제할까요?" onClose={() => setConfirmDelete(false)}>
          <p className="text-sm text-fade">사진과 스탬프도 함께 삭제되고 되돌릴 수 없어요.</p>
          {/* 버튼 순서 규칙 [02-6]: 위 = 안전한 행동(채움), 아래 = 위험한 행동 */}
          <Button onClick={() => setConfirmDelete(false)}>그대로 두기</Button>
          {deleteErr && <Notice tone="error">삭제하지 못했어요. 연결을 확인하고 다시 시도해 주세요.</Notice>}
          <Button variant="seal" disabled={deleting} aria-busy={deleting} onClick={remove}>{deleting ? '삭제하는 중이에요…' : '삭제하기'}</Button>
        </Sheet>
      )}
      {toast}
    </>
  );
}
