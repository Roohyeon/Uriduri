// 영수증 → 이미지 파일로 저장·공유 (R8). 이미지 비율은 영수증 그대로 1종 (임시 Q13)
import { toBlob } from 'html-to-image';

/** 기기 공유 창으로 파일을 보낼 수 있는 브라우저인가 — 없으면 공유 버튼을 숨긴다 (R8) */
export function canShareFiles(): boolean {
  try {
    const probe = new File([new Blob(['x'], { type: 'image/png' })], 'probe.png', { type: 'image/png' });
    return typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/** 화면의 영수증 종이를 PNG로 그린다 (선명하게 2배) */
export async function renderReceiptPng(node: HTMLElement, fileName: string): Promise<File> {
  // 보는 사람마다 다른 표시(MINE·NEW 배지)는 빼고, 홀더 그늘도 없이
  const filter = (n: HTMLElement) => !(n instanceof HTMLElement && n.dataset.noExport !== undefined);
  node.classList.add('exporting');
  let blob: Blob | null;
  try {
    // 처음 그릴 때 웹 글꼴·사진이 늦게 들어오는 경우가 있어 한 번 미리 그려 둔다
    await toBlob(node, { pixelRatio: 1, filter }).catch(() => undefined);
    blob = await toBlob(node, {
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      filter,
      // 인쇄되어 나오는 애니메이션 상태가 아니라 다 나온 모습으로
      style: { animation: 'none', transform: 'none', clipPath: 'none' },
    });
  } finally {
    node.classList.remove('exporting');
  }
  if (!blob) throw new Error('이미지를 만들지 못했어요');
  return new File([blob], fileName, { type: 'image/png' });
}

/** 파일 저장 — 휴대폰에서는 브라우저가 저장/미리보기 창을 띄운다 */
export function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** 기기 공유 창. 사용자가 닫으면 false (실패가 아님) */
export async function shareFile(file: File, title: string): Promise<boolean> {
  try {
    await navigator.share({ files: [file], title });
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return false;
    throw e;
  }
}

/** 파일 이름: uriduri-2026-11-08-0003.png */
export const receiptFileName = (date: string, no: string) => `uriduri-${date}-${no}.png`;
