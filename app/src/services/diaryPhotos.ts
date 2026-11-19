// 다이어리 사진: 홈의 카메라로 찍어 붙인 사진. 사진첩(/album)에 모인다.
// 지금은 이 브라우저(IndexedDB 'uriduri-diary')에만 저장한다. 서버 저장은 묶음 5에서 영수증 사진과 같은 곳으로.
import { toIso, type IsoDate } from '../lib/dates';

export type DiaryPhoto = { id: string; roomId: string; date: IsoDate; takenAt: number; w: number; h: number };
type Row = DiaryPhoto & { blob: Blob };

const DB = 'uriduri-diary';
const STORE = 'photos';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' }).createIndex('roomId', 'roomId');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const strip = ({ blob: _b, ...meta }: Row): DiaryPhoto => meta;

/** 찍은 사진 저장 (이미 줄인 JPEG) */
export async function savePhoto(roomId: string, blob: Blob, w: number, h: number): Promise<DiaryPhoto> {
  const now = new Date();
  const row: Row = { id: `p-${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`, roomId, date: toIso(now), takenAt: now.getTime(), w, h, blob };
  await run('readwrite', (s) => s.put(row));
  return strip(row);
}

/** 방의 사진, 최근 것부터 */
export async function listPhotos(roomId: string): Promise<DiaryPhoto[]> {
  const rows = await run<Row[]>('readonly', (s) => s.index('roomId').getAll(roomId) as IDBRequest<Row[]>);
  return rows.map(strip).sort((a, b) => b.takenAt - a.takenAt);
}

const urls = new Map<string, string>();
/** 화면에 붙일 주소. 지워진 사진이면 undefined */
export async function photoUrl(id: string): Promise<string | undefined> {
  const hit = urls.get(id);
  if (hit) return hit;
  const row = await run<Row | undefined>('readonly', (s) => s.get(id) as IDBRequest<Row | undefined>);
  if (!row) return undefined;
  const url = URL.createObjectURL(row.blob);
  urls.set(id, url);
  return url;
}

export async function deletePhoto(id: string): Promise<void> {
  await run('readwrite', (s) => s.delete(id));
  const u = urls.get(id);
  if (u) { URL.revokeObjectURL(u); urls.delete(id); }
}

/** 이 브라우저의 다이어리 사진을 전부 지운다 (개발용 초기화) */
export function clearDiaryPhotos(): Promise<void> {
  urls.forEach((u) => URL.revokeObjectURL(u));
  urls.clear();
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(DB);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
}
