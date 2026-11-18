// 사진 준비 (R4, D20): 촬영 날짜 읽기 → 긴 변 2048px JPEG로 다시 그리기 (HEIC 포함)
// 다시 그린 JPEG에는 촬영 정보(위치 등)가 남지 않는다 (02-plan 1장 "저장하지 않는 것")
import { exifToIso, type IsoDate } from '../lib/dates';
import type { PreparedPhoto } from './types';

export const MAX_SIDE = 2048;
export const JPEG_QUALITY = 0.85;

/** 촬영 날짜. 없거나 읽지 못하면 undefined → 화면이 오늘 날짜로 채운다 */
export async function readTakenDate(file: Blob): Promise<IsoDate | undefined> {
  try {
    const { default: exifr } = await import('exifr');
    const tags = await exifr.parse(file, { pick: ['DateTimeOriginal', 'CreateDate'] });
    return exifToIso(tags?.DateTimeOriginal ?? tags?.CreateDate);
  } catch {
    return undefined;
  }
}

const isHeic = (f: File) => /image\/hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name);

async function decode(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob, { imageOrientation: 'from-image' });
}

/** 줄이고 JPEG로 바꾼다. 브라우저가 HEIC를 못 그리면 그때만 heic2any를 불러온다 */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  let bmp: ImageBitmap;
  try {
    bmp = await decode(file);
  } catch (e) {
    if (!isHeic(file)) throw e;
    const { default: heic2any } = await import('heic2any');
    const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: JPEG_QUALITY });
    bmp = await decode(Array.isArray(out) ? out[0] : out);
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/jpeg', JPEG_QUALITY),
  );
  return { blob, w, h };
}
