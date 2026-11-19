import { useEffect, useMemo, useRef, useState } from 'react';
import { AppBar, Button, Notice } from '../components/ui';
import { deletePhoto, listPhotos, photoUrl, type DiaryPhoto } from '../services/diaryPhotos';
import { fmtDate } from '../lib/dates';
import type { Receipt } from '../data';
import type { Nav } from '../App';

/*
 * 사진첩 (주소 /album) — 홈 카메라로 찍은 사진(날짜별)과 영수증 사진을 모아 본다
 * - 사진을 누르면 크게 보기: 찍은 사진은 지우기, 영수증 사진은 영수증 보기
 * - 찍은 사진을 지우면 홈에 붙인 그 사진도 떨어진다 (components/diary/DecorBoard)
 */

type View = { kind: 'diary'; photo: DiaryPhoto; url: string } | { kind: 'receipt'; r: Receipt };

export function AlbumScreen({ roomId, receipts, nav }: { roomId: string; receipts: Receipt[]; nav: Nav }) {
  const [photos, setPhotos] = useState<DiaryPhoto[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    listPhotos(roomId)
      .then(async (ps) => {
        const got = await Promise.all(ps.map(async (p) => [p.id, await photoUrl(p.id)] as const));
        if (!alive) return;
        setPhotos(ps);
        setUrls(Object.fromEntries(got.filter((e): e is readonly [string, string] => !!e[1])));
      })
      .catch(() => {
        if (!alive) return;
        setPhotos([]);
        setError('사진을 불러오지 못했어요. 새로고침해 주세요.');
      });
    return () => { alive = false; };
  }, [roomId]);

  // 날짜별 묶음 (최근 날짜부터)
  const days = useMemo(() => {
    const map = new Map<string, DiaryPhoto[]>();
    for (const p of photos ?? []) map.set(p.date, [...(map.get(p.date) ?? []), p]);
    return [...map.entries()];
  }, [photos]);
  const receiptPhotos = receipts.filter((r) => r.photo.src);

  const remove = async (p: DiaryPhoto) => {
    try {
      await deletePhoto(p.id);
      setPhotos((cur) => (cur ?? []).filter((x) => x.id !== p.id));
      setView(null);
    } catch {
      setError('사진을 지우지 못했어요. 다시 시도해 주세요.');
    }
  };

  return (
    <div className="album min-h-screen bg-paper">
      <AppBar title="사진첩" onBack={() => nav({ name: 'desk' })} />
      <main className="space-y-8 px-4 pt-4 pb-16">
        {error && <Notice tone="error">{error}</Notice>}

        <section aria-labelledby="album-mine">
          <h2 id="album-mine" className="album__title">우리가 찍은 사진</h2>
          {photos === null ? (
            <p className="mt-2 text-sm text-fade" role="status">불러오는 중…</p>
          ) : photos.length === 0 ? (
            <div className="mt-2 space-y-3">
              <p className="text-sm text-fade">아직 찍은 사진이 없어요. 홈 아래 카메라 버튼으로 찍어 붙여 보세요.</p>
              <Button variant="line" onClick={() => nav({ name: 'desk' })}>홈으로 가기</Button>
            </div>
          ) : (
            days.map(([date, list]) => (
              <div key={date} className="mt-3">
                <h3 className="text-sm font-semibold text-fade">{fmtDate(date)}</h3>
                <ul className="mt-1.5 grid grid-cols-3 gap-2">
                  {list.map((p, i) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="album__thumb"
                        style={{ backgroundImage: urls[p.id] ? `url("${urls[p.id]}")` : undefined }}
                        aria-label={`${fmtDate(date)} 사진 ${i + 1} 크게 보기`}
                        onClick={() => urls[p.id] && setView({ kind: 'diary', photo: p, url: urls[p.id] })}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>

        {receiptPhotos.length > 0 && (
          <section aria-labelledby="album-receipts">
            <h2 id="album-receipts" className="album__title">영수증 사진</h2>
            <ul className="mt-2 grid grid-cols-3 gap-2">
              {receiptPhotos.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="album__thumb"
                    style={{ backgroundImage: `url("${r.photo.src}")` }}
                    aria-label={`${r.photo.label} 크게 보기`}
                    onClick={() => setView({ kind: 'receipt', r })}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      {view && (
        <PhotoViewer
          src={view.kind === 'diary' ? view.url : view.r.photo.src!}
          alt={view.kind === 'diary' ? `${fmtDate(view.photo.date)}에 찍은 사진` : view.r.photo.label}
          caption={view.kind === 'diary' ? fmtDate(view.photo.date) : `${fmtDate(view.r.date)} · ${view.r.memo}`}
          onClose={() => setView(null)}
          onDelete={view.kind === 'diary' ? () => remove(view.photo) : undefined}
          onReceipt={view.kind === 'receipt' ? () => nav({ name: 'detail', id: view.r.id }) : undefined}
        />
      )}
    </div>
  );
}

/** 크게 보기: 열리면 닫기 버튼으로 초점, Esc로 닫기, 닫으면 누른 사진으로 초점이 돌아간다 */
function PhotoViewer({ src, alt, caption, onClose, onDelete, onReceipt }: {
  src: string; alt: string; caption: string; onClose: () => void; onDelete?: () => void; onReceipt?: () => void;
}) {
  const closeBtn = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); close.current(); } };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); opener?.focus?.(); };
  }, []);
  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={alt} onClick={onClose}>
      <div className="viewer__inner" onClick={(e) => e.stopPropagation()}>
        <button ref={closeBtn} type="button" className="viewer__close" aria-label="닫기" onClick={onClose}>✕</button>
        <img className="viewer__img" src={src} alt={alt} />
        <p className="viewer__cap">{caption}</p>
        <div className="viewer__bar">
          {onReceipt && <button type="button" className="viewer__btn" onClick={onReceipt}>영수증 보기</button>}
          {onDelete && !confirm && <button type="button" className="viewer__btn" onClick={() => setConfirm(true)}>지우기</button>}
          {onDelete && confirm && (
            <>
              <span className="viewer__ask" role="alert">사진첩과 홈에서 모두 지워져요.</span>
              <button type="button" className="viewer__btn" onClick={() => setConfirm(false)}>그만두기</button>
              <button type="button" className="viewer__btn viewer__btn--danger" onClick={onDelete}>지우기</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
