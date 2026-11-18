import { useState } from 'react';
import { localPerson, resetAllLocal, resetLocalPerson, switchLocalPerson } from '../services/local';

/**
 * 로컬 모드 전용 개발 도구 (묶음 5에서 없어짐).
 * - 한 브라우저에서 두 사람(A, B)을 번갈아 흉내 내서 초대·NEW·도장을 확인한다.
 * - 꼬였을 때: 지금 사람만 초기화 / 전부 초기화
 */
export function DevPersonSwitch({ partnerName }: { partnerName?: string }) {
  const p = localPerson();
  const [open, setOpen] = useState(false);
  const other = p === 'A' ? 'B' : 'A';
  const item = 'block min-h-11 w-full px-3 text-left text-sm hover:bg-counter';
  return (
    <div className="fixed left-2 z-[70] text-xs" style={{ bottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}>
      {open && (
        <div role="menu" aria-label="개발용 도구" className="mb-2 w-64 overflow-hidden rounded-sm border border-edge bg-paper shadow-paper">
          <button type="button" role="menuitem" className={item} onClick={() => { switchLocalPerson(); window.location.assign('/'); }}>
            {partnerName ? `${partnerName}(${other})` : `사람 ${other}`}(으)로 바꾸기
          </button>
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              if (!window.confirm(`사람 ${p}의 계정(카카오·구글)과 방 참여를 모두 지울까요? 방에 아무도 안 남으면 방도 지워져요.`)) return;
              void resetLocalPerson().then(() => window.location.assign('/'));
            }}
          >
            지금 사람({p}) 초기화
          </button>
          <button
            type="button"
            role="menuitem"
            className={`${item} text-seal-ink`}
            onClick={() => {
              if (!window.confirm('A·B 모두, 이 브라우저에 저장된 우리두리 데이터를 전부 지울까요?')) return;
              void resetAllLocal().then(() => window.location.assign('/'));
            }}
          >
            전부 초기화
          </button>
        </div>
      )}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="min-h-11 rounded-full border border-dashed border-edge bg-paper/90 px-3 text-fade hover:bg-counter"
      >
        개발용 · 지금 {p} {open ? '▾' : '▸'}
      </button>
    </div>
  );
}
