import { cloneElement, isValidElement, useCallback, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'ink' | 'seal' | 'line' | 'kakao' | 'google';

// 호버는 누를 수 있을 때만 (enabled:) [04 ui:23]. 테두리는 3:1 이상인 edge 토큰 [03-1.4.11]
const variantClass: Record<Variant, string> = {
  ink: 'bg-ink text-paper enabled:hover:bg-ink/85 disabled:bg-rule disabled:text-ink/60',
  seal: 'bg-seal text-paper enabled:hover:bg-seal-ink disabled:bg-rule disabled:text-ink/60',
  line: 'bg-paper text-ink border border-edge enabled:hover:bg-counter disabled:text-ink/50',
  // 카카오 로그인 버튼은 카카오 디자인 가이드 색을 따른다 (브랜드 예외)
  kakao: 'bg-[#FEE500] text-[#191600] enabled:hover:brightness-95',
  google: 'bg-paper text-ink border border-edge enabled:hover:bg-counter',
};

export function Button({
  variant = 'ink',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`block w-full min-h-11 rounded-sm px-4 py-3 text-base font-semibold transition-colors disabled:cursor-not-allowed ${variantClass[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function TextButton({ className = '', children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`min-h-11 text-sm font-semibold text-ink underline underline-offset-4 hover:decoration-2 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

type Tone = 'error' | 'ok';
export function Notice({ tone = 'ok', children }: { tone?: Tone; children: ReactNode }) {
  // 오류 글씨는 seal-ink (오류 바탕 위 5.9:1) [03-1.4.3]
  const cls = tone === 'error' ? 'bg-error-bg text-seal-ink' : 'bg-ok-bg text-ink';
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-sm px-4 py-3 text-sm ${cls}`}>
      {children}
    </div>
  );
}

/** 기획의 열린 질문이 걸린 요소. 시안의 노란 점선은 없애고, 임시 규칙은 02-plan "열린 질문" 표를 따른다 */
export function OpenQ({ children }: { id: string; note: string; children: ReactNode }) {
  return <>{children}</>;
}

export function AppBar({ title, right, onBack, bare = false }: { title: string; right?: ReactNode; onBack?: () => void; bare?: boolean }) {
  // bare: 바탕색·아래 선 없이 (홈 화이트보드 위, 사용자 요청 2026-11-17)
  return (
    <header className={`flex min-h-14 items-center justify-between gap-2 px-4 ${bare ? '' : 'border-b border-rule bg-paper'}`}>
      <div className="flex min-w-0 items-center gap-1">
        {onBack && (
          <button type="button" onClick={onBack} aria-label="뒤로" className="-ml-2 grid size-11 place-items-center rounded-full text-xl hover:bg-counter">
            <span aria-hidden="true">‹</span>
          </button>
        )}
        {/* 화면이 바뀌면 App이 이 제목으로 초점을 옮긴다 [03-2.4.3] */}
        <h1 tabIndex={-1} className="text-lg font-bold text-balance outline-none">{title}</h1>
      </div>
      {right && <div className="text-sm text-fade">{right}</div>}
    </header>
  );
}

/** 아래 안내 메시지 — 5초 동안 보이고 닫기 버튼이 있다 [03-2.2.1]. 홈 바 영역을 피한다 [04 ui:83] */
export function Toast({ children, onClose, bottom }: { children: ReactNode; onClose?: () => void; bottom?: string }) {
  return (
    <div
      role="status"
      className="fixed inset-x-4 z-50 mx-auto flex max-w-sm items-center gap-3 rounded-sm bg-ink py-1 pr-1 pl-4 text-sm text-paper"
      style={{ bottom: bottom ?? 'calc(1.5rem + env(safe-area-inset-bottom))' }}
    >
      <span className="flex-1 py-2">{children}</span>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="안내 닫기" className="grid size-11 shrink-0 place-items-center rounded-sm hover:bg-paper/15">
          <span aria-hidden="true">✕</span>
        </button>
      )}
    </div>
  );
}

/** 안내 메시지 띄우기: const [toast, showToast] = useToast(); bottom: 아래 떠 있는 탭을 피할 때 */
export function useToast(ms = 5000, bottom?: string): [ReactNode, (msg: string) => void] {
  const [msg, setMsg] = useState('');
  const timer = useRef<number>();
  const show = useCallback((m: string) => {
    window.clearTimeout(timer.current);
    setMsg(m);
    timer.current = window.setTimeout(() => setMsg(''), ms);
  }, [ms]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const node = msg ? <Toast onClose={() => setMsg('')} bottom={bottom}>{msg}</Toast> : null;
  return [node, show];
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * 아래에서 올라오는 확인 창 [03-2.4.3, 04 ui:92]
 * - 열리면 창 안 첫 요소로 초점이 가고, Tab은 창 안에서만 돈다
 * - Esc나 바깥을 누르면 닫히고, 닫히면 열었던 버튼으로 초점이 돌아간다
 * - 버튼 순서 규칙 [02-6]: 위 = 안전한 행동(채움), 아래 = 위험한 행동
 */
export function Sheet({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const el = box.current;
    (el?.querySelector<HTMLElement>(FOCUSABLE) ?? el)?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close.current(); return; }
      if (e.key !== 'Tab' || !el) return;
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-ink/50" onClick={onClose}>
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        tabIndex={-1}
        className="sheet-box mx-auto max-h-[90vh] w-full max-w-md overflow-y-auto overflow-x-hidden overscroll-contain bg-paper px-4 pt-6 outline-none"
        style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="sheet-title" className="text-lg font-bold text-balance">
          {title}
        </h2>
        <div className="mt-2 space-y-3">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({ mark, title, body, children }: { mark: string; title: string; body: string; children?: ReactNode }) {
  return (
    <section className="px-2 py-12 text-center">
      <div aria-hidden="true" className="text-xl">
        {mark}
      </div>
      <h2 className="mt-3 text-lg font-bold text-balance">{title}</h2>
      <p className="mt-2 text-sm text-fade">{body}</p>
      {children && <div className="mt-6">{children}</div>}
    </section>
  );
}

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: ReactNode; children: ReactNode }) {
  // 안내(최대 글자 수 등)를 입력칸에 aria-describedby로 연결한다 [03-2차 1.3.1]
  const hintId = `${id}-hint`;
  const child = hint && isValidElement<{ 'aria-describedby'?: string }>(children)
    ? cloneElement(children, { 'aria-describedby': hintId })
    : children;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      {child}
      {hint && <div id={hintId} className="text-xs text-fade">{hint}</div>}
    </div>
  );
}

// 안내 글씨는 투명도 없이 fade 그대로 [03-1.4.3], 테두리는 edge [03-1.4.11]
export const inputClass =
  'block w-full min-h-11 rounded-sm border border-edge bg-paper px-3 py-2 text-base text-ink placeholder:text-fade disabled:opacity-60';
