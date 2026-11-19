import { useEffect, useRef, useState } from 'react';
import { preparePhoto, JPEG_QUALITY, MAX_SIDE } from '../../services/photos';

/*
 * 홈 카메라: 화면 안에서 바로 찍는다 (getUserMedia). 찍으면 미리 보고 '붙이기'.
 * - count > 1 (포토프레임의 빈 칸이 여러 개): '3초마다 N장' 연속 촬영을 고를 수 있다 (포토부스처럼)
 * - 카메라를 못 쓰면(권한 거절·카메라 없음·https 아님) 휴대폰 카메라 앱/갤러리로 고르는 버튼만 보인다
 * - 창이 열리면 닫기 버튼으로 초점, Esc로 닫기, 닫으면 카메라를 끈다
 */

type Shot = { blob: Blob; w: number; h: number; url: string };
export type TakenPhoto = { blob: Blob; w: number; h: number };

const BURST_SECONDS = 3;

export function CameraSheet({ count = 1, onDone, onClose }: { count?: number; onDone: (shots: TakenPhoto[]) => Promise<void>; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [state, setState] = useState<'starting' | 'live' | 'nocam'>('starting');
  const [shots, setShots] = useState<Shot[]>([]);
  const [burst, setBurst] = useState(count > 1); // 여러 칸이면 연속 촬영이 기본
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const aborted = useRef(false);
  const want = burst ? count : 1;
  const done = shots.length >= want && countdown === null;

  // 카메라 켜기 (앞뒤 바꾸면 다시)
  useEffect(() => {
    let stream: MediaStream | null = null;
    let alive = true;
    setState('starting');
    if (!navigator.mediaDevices?.getUserMedia) { setState('nocam'); return; }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1920 } }, audio: false })
      .then((s) => {
        if (!alive) { s.getTracks().forEach((t) => t.stop()); return; }
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play().catch(() => { /* 자동 재생 막힘: 화면을 누르면 다시 */ });
        }
        setState('live');
      })
      .catch(() => { if (alive) setState('nocam'); });
    return () => {
      alive = false;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [facing]);

  // 창 초점·Esc (열 때 한 번)
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    aborted.current = false; // 개발 모드에서 두 번 붙었다 떨어져도 다시 살린다
    const opener = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); close.current(); } };
    document.addEventListener('keydown', onKey);
    return () => { aborted.current = true; document.removeEventListener('keydown', onKey); opener?.focus?.(); };
  }, []);

  const shotsRef = useRef(shots);
  shotsRef.current = shots;
  useEffect(() => () => { shotsRef.current.forEach((s) => URL.revokeObjectURL(s.url)); }, []);

  /** 지금 화면을 찍어 긴 변 2048px JPEG로 */
  const grab = async (): Promise<Shot | null> => {
    const v = video.current;
    if (!v || !v.videoWidth) return null;
    const scale = Math.min(1, MAX_SIDE / Math.max(v.videoWidth, v.videoHeight));
    const w = Math.round(v.videoWidth * scale), h = Math.round(v.videoHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    if (facing === 'user') { ctx.translate(w, 0); ctx.scale(-1, 1); } // 셀카는 거울처럼 보인 그대로
    ctx.drawImage(v, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', JPEG_QUALITY));
    setFlash(true);
    window.setTimeout(() => setFlash(false), 180);
    return blob ? { blob, w, h, url: URL.createObjectURL(blob) } : null;
  };

  const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

  const shoot = async () => {
    if (!burst) {
      const s = await grab();
      if (s) setShots([s]);
      return;
    }
    // 연속 촬영: 3·2·1 세고 찍기를 N번
    const taken: Shot[] = [];
    for (let i = 0; i < count; i++) {
      for (let c = BURST_SECONDS; c > 0; c--) {
        if (aborted.current) return;
        setCountdown(c);
        await wait(1000);
      }
      const s = await grab();
      if (s) { taken.push(s); setShots([...taken]); }
    }
    setCountdown(null);
  };

  /** 카메라 앱·갤러리에서 고른 사진 (칸이 여러 개면 여러 장) */
  const fromFiles = async (files?: FileList | null) => {
    if (!files?.length) return;
    setError('');
    try {
      const picked = [...files].slice(0, count);
      const out: Shot[] = [];
      for (const f of picked) {
        const p = await preparePhoto(f);
        out.push({ ...p, url: URL.createObjectURL(p.blob) });
      }
      setShots(out);
    } catch {
      setError('이 사진은 열 수 없어요. 다른 사진을 골라 주세요.');
    }
  };

  const attach = async () => {
    if (!shots.length) return;
    setBusy(true);
    setError('');
    try {
      await onDone(shots.map(({ blob, w, h }) => ({ blob, w, h })));
    } catch {
      setError('사진을 저장하지 못했어요. 다시 시도해 주세요.');
      setBusy(false);
    }
  };

  const retake = () => {
    shots.forEach((s) => URL.revokeObjectURL(s.url));
    setShots([]);
  };

  const reviewing = shots.length > 0 && countdown === null;

  return (
    <div className="camera" role="dialog" aria-modal="true" aria-labelledby="camera-title">
      <div className="camera__top">
        <h2 id="camera-title" className="camera__title">
          {reviewing ? (shots.length > 1 ? `${shots.length}장을 붙일까요?` : '이 사진을 붙일까요?') : burst ? `연속 촬영 ${shots.length}/${count}` : '사진 찍기'}
        </h2>
        <button ref={closeBtn} type="button" className="camera__close" aria-label="카메라 닫기" onClick={onClose}>✕</button>
      </div>

      {count > 1 && !reviewing && countdown === null && state !== 'nocam' && (
        <div className="camera__modes" role="radiogroup" aria-label="찍는 방법">
          <button type="button" role="radio" aria-checked={!burst} className="camera__mode" onClick={() => setBurst(false)}>한 장</button>
          <button type="button" role="radio" aria-checked={burst} className="camera__mode" onClick={() => setBurst(true)}>{BURST_SECONDS}초마다 {count}장</button>
        </div>
      )}

      <div className="camera__view">
        {reviewing ? (
          shots.length > 1 ? (
            <div className={`camera__grid camera__grid--${shots.length}`}>
              {shots.map((s, i) => <img key={s.url} src={s.url} alt={`찍은 사진 ${i + 1}`} />)}
            </div>
          ) : (
            <img className="camera__shot" src={shots[0].url} alt="방금 찍은 사진" />
          )
        ) : (
          <>
            <video ref={video} className={`camera__video ${facing === 'user' ? 'is-mirror' : ''}`} playsInline muted autoPlay aria-label="카메라 화면" hidden={state !== 'live'} />
            {countdown !== null && <span className="camera__count" aria-live="assertive">{countdown}</span>}
            {flash && <span className="camera__flash" aria-hidden="true" />}
            {state === 'starting' && <p className="camera__msg" role="status">카메라를 켜는 중…</p>}
            {state === 'nocam' && (
              <p className="camera__msg" role="status">
                여기서는 카메라를 켤 수 없어요.
                <br />
                아래 버튼으로 휴대폰 카메라나 갤러리에서 골라 주세요.
              </p>
            )}
          </>
        )}
      </div>

      {error && <p className="camera__error" role="alert">{error}</p>}

      <div className="camera__bar">
        {reviewing ? (
          <>
            <button type="button" className="camera__btn" onClick={retake} disabled={busy}>다시 찍기</button>
            <button type="button" className="camera__btn camera__btn--main" onClick={() => void attach()} disabled={busy || (!done && burst)}>
              {busy ? '붙이는 중…' : '붙이기'}
            </button>
          </>
        ) : (
          <>
            <label className="camera__btn">
              갤러리
              <input type="file" accept="image/*" multiple={count > 1} className="sr-only" onChange={(e) => void fromFiles(e.target.files)} />
            </label>
            {state === 'nocam' ? (
              <label className="camera__btn camera__btn--main">
                카메라 앱 열기
                <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => void fromFiles(e.target.files)} />
              </label>
            ) : (
              <button type="button" className="camera__shutter" aria-label={burst ? `${BURST_SECONDS}초마다 ${count}장 찍기` : '찍기'} onClick={() => void shoot()} disabled={state !== 'live' || countdown !== null}>
                <span aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              className="camera__btn"
              onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
              disabled={state === 'nocam' || countdown !== null}
              aria-label={facing === 'environment' ? '앞 카메라로 바꾸기' : '뒤 카메라로 바꾸기'}
            >
              앞뒤
            </button>
          </>
        )}
      </div>
    </div>
  );
}
