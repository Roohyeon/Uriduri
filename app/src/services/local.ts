// 로컬 모드 (묶음 2~4): 이 브라우저 안에만 저장한다. 묶음 5에서 supabase.ts로 바뀐다.
// - 데이터: localStorage 'uriduri.local.db'
// - 사진: IndexedDB 'uriduri-local' / 'photos'
// - 로그인: 가짜. 개발용 "사람 바꾸기"(A ↔ B)로 두 사람을 한 브라우저에서 흉내 낸다.
// - 실패 흉내: localStorage 'uriduri.local.fail' = 'publish' | 'load'(목록) | 'room'(방 정보) | 'delete' | 'update'
import { inviteStatus, newToken, INVITE_TTL_MS } from '../lib/invite';
import { LIMITS, isValidText, countChars } from '../lib/text';
import type { StampShape } from '../data';
import { isIsoDate } from '../lib/dates';
import { clearDiaryPhotos } from './diaryPhotos';
import {
  BackendError,
  type Backend,
  type Invite,
  type PeekResult,
  type Position,
  type Profile,
  type Provider,
  type ReceiptInput,
  type ReceiptRec,
  type RoomInfo,
  type User,
  type EventRec,
  type StampRec,
} from './types';

type InviteRow = { token: string; roomId: string; createdAt: number; usedBy?: string; revokedAt?: number };
type RoomRow = { id: string; createdBy: string; anniversary: string; nextNo: number; joinNoticeSeen: boolean };
type DB = {
  profiles: Record<string, Profile>;
  rooms: Record<string, RoomRow>;
  members: { roomId: string; userId: string; joinedAt: number }[];
  invites: Record<string, InviteRow>;
  receipts: Record<string, ReceiptRec>;
  positions: Record<string, Position>;
  reads: { userId: string; receiptId: string }[];
  events: EventRec[];
};

const DB_KEY = 'uriduri.local.db';
const SHAPES: StampShape[] = ['circle', 'heart', 'triangle'];
const PERSON_KEY = 'uriduri.local.person';
const empty = (): DB => ({ profiles: {}, rooms: {}, members: [], invites: {}, receipts: {}, positions: {}, reads: [], events: [] });

function load(): DB {
  try {
    const raw = localStorage.getItem(DB_KEY);
    return raw ? { ...empty(), ...JSON.parse(raw) } : empty();
  } catch {
    return empty();
  }
}
function save(db: DB) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}
const uid = () => crypto.randomUUID();

/** 개발용: 지금 흉내 내는 사람 (A 또는 B) */
export function localPerson(): 'A' | 'B' {
  return localStorage.getItem(PERSON_KEY) === 'B' ? 'B' : 'A';
}
export function switchLocalPerson() {
  localStorage.setItem(PERSON_KEY, localPerson() === 'A' ? 'B' : 'A');
}
const sessionKey = () => `uriduri.local.session.${localPerson()}`;

function failIf(op: string) {
  if (localStorage.getItem('uriduri.local.fail') === op) throw new BackendError('network', `로컬 실패 흉내: ${op}`);
}

// ───────── 사진 저장 (IndexedDB) ─────────
function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('uriduri-local', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('photos');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbDo<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction('photos', mode).objectStore('photos'));
    // 연결을 닫아 둬야 "전부 초기화"가 막히지 않는다
    req.onsuccess = () => { resolve(req.result); db.close(); };
    req.onerror = () => { reject(req.error); db.close(); };
  });
}
const urlCache = new Map<string, string>();

// ───────── 개발용 초기화 ─────────
/** 방 하나와 딸린 데이터·사진을 지운다 */
async function wipeRoom(db: DB, roomId: string) {
  const recs = Object.values(db.receipts).filter((r) => r.roomId === roomId);
  for (const r of recs) await idbDo('readwrite', (s) => s.delete(r.photoPath));
  const ids = new Set(recs.map((r) => r.id));
  ids.forEach((id) => { delete db.receipts[id]; delete db.positions[id]; });
  db.reads = db.reads.filter((r) => !ids.has(r.receiptId));
  db.members = db.members.filter((m) => m.roomId !== roomId);
  Object.keys(db.invites).forEach((t) => { if (db.invites[t].roomId === roomId) delete db.invites[t]; });
  delete db.rooms[roomId];
}

/** 지금 흉내 내는 사람(A 또는 B)의 계정(카카오·구글 둘 다)을 지운다. 방에 아무도 안 남으면 방도 지운다 */
export async function resetLocalPerson() {
  const person = localPerson();
  const db = load();
  const mine = (id: string) => id.startsWith(`${person}-`);
  const rooms = new Set(db.members.filter((m) => mine(m.userId)).map((m) => m.roomId));
  db.members = db.members.filter((m) => !mine(m.userId));
  for (const roomId of rooms) {
    if (!db.members.some((m) => m.roomId === roomId)) await wipeRoom(db, roomId);
  }
  Object.keys(db.profiles).forEach((id) => { if (mine(id)) delete db.profiles[id]; });
  db.reads = db.reads.filter((r) => !mine(r.userId));
  save(db);
  localStorage.removeItem(`uriduri.local.session.${person}`);
  sessionStorage.clear();
}

/** 이 브라우저의 우리두리 데이터를 전부 지운다 */
export async function resetAllLocal() {
  Object.keys(localStorage).filter((k) => k.startsWith('uriduri.')).forEach((k) => localStorage.removeItem(k));
  sessionStorage.clear();
  urlCache.forEach((u) => URL.revokeObjectURL(u));
  urlCache.clear();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('uriduri-local');
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
  await clearDiaryPhotos(); // 홈 카메라로 찍은 사진
}

// ───────── 구현 ─────────
export function createLocalBackend(): Backend {
  const me = (): string => {
    const p = localStorage.getItem(sessionKey());
    if (!p) throw new BackendError('auth', '로그인이 필요해요');
    return `${localPerson()}-${p}`;
  };
  const myRoomId = (db: DB) => db.members.find((m) => m.userId === me())?.roomId;
  const roomOrThrow = (db: DB) => {
    const id = myRoomId(db);
    if (!id || !db.rooms[id]) throw new BackendError('no_room');
    return db.rooms[id];
  };
  const membersOf = (db: DB, roomId: string) => db.members.filter((m) => m.roomId === roomId);
  const activeInvite = (db: DB, roomId: string) =>
    Object.values(db.invites).find((i) => i.roomId === roomId && !i.usedBy && i.revokedAt === undefined);
  const makeInvite = (db: DB, roomId: string): Invite => {
    Object.values(db.invites).forEach((i) => { if (i.roomId === roomId && !i.usedBy && i.revokedAt === undefined) i.revokedAt = Date.now(); });
    const row: InviteRow = { token: newToken(), roomId, createdAt: Date.now() };
    db.invites[row.token] = row;
    return { token: row.token, expiresAt: row.createdAt + INVITE_TTL_MS };
  };
  const checkInput = (input: ReceiptInput) => {
    if (!isValidText(input.memo, LIMITS.memo)) throw new BackendError('invalid', '메모');
    if (input.place && countChars(input.place) > LIMITS.place) throw new BackendError('invalid', '장소');
    if (!isIsoDate(input.date)) throw new BackendError('invalid', '날짜');
  };
  const peek = (db: DB, token: string): PeekResult => {
    const inv = db.invites[token];
    const roomId = inv?.roomId;
    const status = inviteStatus(inv, {
      now: Date.now(),
      userId: me(),
      userRoomId: myRoomId(db),
      memberCount: roomId ? membersOf(db, roomId).length : 0,
    });
    const creator = roomId ? db.rooms[roomId]?.createdBy : undefined;
    return { status, creatorNickname: creator ? db.profiles[creator]?.nickname : undefined };
  };

  return {
    mode: 'local',

    async getUser(): Promise<User | null> {
      const p = localStorage.getItem(sessionKey()) as Provider | null;
      return p ? { id: `${localPerson()}-${p}`, provider: p } : null;
    },
    async signIn(provider) {
      localStorage.setItem(sessionKey(), provider);
    },
    async signOut() {
      localStorage.removeItem(sessionKey());
    },

    async getProfile() {
      return load().profiles[me()] ?? null;
    },
    async saveNickname(nickname) {
      if (!isValidText(nickname, LIMITS.nickname)) throw new BackendError('invalid', '닉네임');
      const db = load();
      const prev = db.profiles[me()];
      db.profiles[me()] = { id: me(), nickname: nickname.trim(), roomDeletedNotice: prev?.roomDeletedNotice ?? false };
      save(db);
    },
    async clearRoomDeletedNotice() {
      const db = load();
      if (db.profiles[me()]) db.profiles[me()].roomDeletedNotice = false;
      save(db);
    },

    async getMyRoom(): Promise<RoomInfo | null> {
      failIf('room');
      const db = load();
      const id = myRoomId(db);
      const room = id ? db.rooms[id] : undefined;
      if (!room) return null;
      return {
        id: room.id,
        createdBy: room.createdBy,
        anniversary: room.anniversary,
        joinNoticeSeen: room.joinNoticeSeen,
        members: membersOf(db, room.id).map((m) => ({ id: m.userId, nickname: db.profiles[m.userId]?.nickname ?? '' })),
      };
    },
    async createRoom(anniversary) {
      const db = load();
      if (myRoomId(db)) throw new BackendError('has_room');
      if (!isIsoDate(anniversary)) throw new BackendError('invalid', '사귄 날');
      const room: RoomRow = { id: uid(), createdBy: me(), anniversary, nextNo: 1, joinNoticeSeen: false };
      db.rooms[room.id] = room;
      db.members.push({ roomId: room.id, userId: me(), joinedAt: Date.now() });
      const inv = makeInvite(db, room.id);
      save(db);
      return inv;
    },
    async currentInvite() {
      const db = load();
      const room = roomOrThrow(db);
      const inv = activeInvite(db, room.id);
      if (!inv || Date.now() - inv.createdAt >= INVITE_TTL_MS) return null;
      return { token: inv.token, expiresAt: inv.createdAt + INVITE_TTL_MS };
    },
    async newInvite() {
      const db = load();
      const room = roomOrThrow(db);
      if (membersOf(db, room.id).length >= 2) throw new BackendError('full');
      const inv = makeInvite(db, room.id);
      save(db);
      return inv;
    },
    async peekInvite(token) {
      return peek(load(), token);
    },
    async acceptInvite(token) {
      const db = load();
      const res = peek(db, token);
      if (res.status !== 'ok') return res;
      const inv = db.invites[token];
      inv.usedBy = me();
      db.members.push({ roomId: inv.roomId, userId: me(), joinedAt: Date.now() });
      save(db);
      return res;
    },
    async setAnniversary(date) {
      if (!isIsoDate(date)) throw new BackendError('invalid', '사귄 날');
      const db = load();
      roomOrThrow(db).anniversary = date;
      save(db);
    },
    async markJoinNoticeSeen() {
      const db = load();
      roomOrThrow(db).joinNoticeSeen = true;
      save(db);
    },

    async listReceipts() {
      failIf('load');
      const db = load();
      const roomId = roomOrThrow(db).id;
      return Object.values(db.receipts).filter((r) => r.roomId === roomId);
    },
    async listReads() {
      return load().reads.filter((r) => r.userId === me()).map((r) => r.receiptId);
    },
    async markRead(receiptId) {
      const db = load();
      if (!db.reads.some((r) => r.userId === me() && r.receiptId === receiptId)) db.reads.push({ userId: me(), receiptId });
      save(db);
    },
    async listPositions() {
      const db = load();
      const roomId = roomOrThrow(db).id;
      return Object.fromEntries(Object.entries(db.positions).filter(([id]) => db.receipts[id]?.roomId === roomId));
    },
    async savePosition(receiptId, pos) {
      const db = load();
      if (db.receipts[receiptId]?.roomId !== roomOrThrow(db).id) throw new BackendError('forbidden');
      db.positions[receiptId] = pos;
      save(db);
    },
    async publishReceipt(input) {
      failIf('publish');
      checkInput(input);
      const db = load();
      const room = roomOrThrow(db);
      if (membersOf(db, room.id).length < 2) throw new BackendError('alone'); // D29
      const id = uid();
      const photoPath = `${room.id}/${id}.jpg`;
      await idbDo('readwrite', (s) => s.put(input.photo.blob, photoPath));
      const now = Date.now();
      const rec: ReceiptRec = {
        id,
        roomId: room.id,
        authorId: me(),
        no: room.nextNo,
        date: input.date,
        dateSource: input.dateSource,
        memo: input.memo.trim(),
        place: input.place?.trim() || undefined,
        mood: input.mood,
        photoPath,
        photoW: input.photo.w,
        photoH: input.photo.h,
        createdAt: now,
        updatedAt: now,
        stamps: [],
      };
      const fresh = load(); // 사진 저장을 기다리는 동안 바뀌었을 수 있어 다시 읽는다
      fresh.rooms[room.id].nextNo += 1;
      fresh.receipts[id] = rec;
      fresh.events.push({ kind: 'publish', userId: me(), at: now, sessionId: input.sessionId, receiptId: id }); // R12
      save(fresh);
      return rec;
    },
    async updateReceipt(id, input) {
      failIf('update');
      checkInput(input);
      const db = load();
      const rec = db.receipts[id];
      if (!rec || rec.authorId !== me()) throw new BackendError('forbidden'); // R7: 작성자만
      if (input.photo) {
        await idbDo('readwrite', (s) => s.put(input.photo!.blob, rec.photoPath));
        const old = urlCache.get(rec.photoPath);
        if (old) { URL.revokeObjectURL(old); urlCache.delete(rec.photoPath); }
      }
      const fresh = load();
      const next: ReceiptRec = {
        ...fresh.receipts[id],
        date: input.date,
        dateSource: input.dateSource,
        memo: input.memo.trim(),
        place: input.place?.trim() || undefined,
        mood: input.mood,
        ...(input.photo ? { photoW: input.photo.w, photoH: input.photo.h } : {}),
        updatedAt: Date.now(), // 도장은 그대로 (R7)
      };
      fresh.receipts[id] = next;
      save(fresh);
      return next;
    },
    async deleteReceipt(id) {
      failIf('delete');
      const db = load();
      const rec = db.receipts[id];
      if (!rec || rec.authorId !== me()) throw new BackendError('forbidden');
      // 사진 → 행 순서 (02-plan 2장)
      await idbDo('readwrite', (s) => s.delete(rec.photoPath));
      const fresh = load();
      delete fresh.receipts[id];
      delete fresh.positions[id];
      fresh.reads = fresh.reads.filter((r) => r.receiptId !== id);
      save(fresh);
    },

    async setStamp(receiptId, input) {
      failIf('stamp');
      const db = load();
      const rec = db.receipts[receiptId];
      if (!rec || rec.roomId !== roomOrThrow(db).id) throw new BackendError('forbidden');
      if (rec.authorId === me()) throw new BackendError('forbidden', '내 영수증에는 찍지 않아요'); // 임시 Q12
      if (!SHAPES.includes(input.shape)) throw new BackendError('invalid', '모양');
      if (!isValidText(input.label, LIMITS.stamp)) throw new BackendError('invalid', '도장 문구');
      const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v)));
      const st: StampRec = {
        userId: me(),
        shape: input.shape,
        label: input.label.trim(),
        rot: clamp(input.rot, -20, 20),
        x: clamp(input.x, 0, 100),
        y: clamp(input.y, 0, 100),
      };
      rec.stamps = [...rec.stamps.filter((s) => s.userId !== me()), st];
      save(db);
      return st;
    },
    async removeStamp(receiptId) {
      failIf('stamp');
      const db = load();
      const rec = db.receipts[receiptId];
      if (!rec || rec.roomId !== roomOrThrow(db).id) throw new BackendError('forbidden');
      rec.stamps = rec.stamps.filter((s) => s.userId !== me()); // 상대 도장은 못 지움 (R6)
      save(db);
    },
    async logEvent(kind, extra) {
      const db = load();
      db.events.push({ kind, userId: me(), at: Date.now(), ...extra });
      save(db);
    },

    async deleteRoom(confirm) {
      failIf('roomdel');
      if (confirm !== '삭제') throw new BackendError('invalid', '확인 문구');
      const db = load();
      const room = roomOrThrow(db);
      const recs = Object.values(db.receipts).filter((r) => r.roomId === room.id);
      // ① 사진 먼저 지운다. 실패하면 방은 남겨 두고 다시 시도하게 (02-plan 2장)
      for (const r of recs) {
        await idbDo('readwrite', (s) => s.delete(r.photoPath));
        const u = urlCache.get(r.photoPath);
        if (u) { URL.revokeObjectURL(u); urlCache.delete(r.photoPath); }
      }
      // ② 방과 딸린 것 모두 (DB에서는 cascade)
      const fresh = load();
      const ids = new Set(recs.map((r) => r.id));
      fresh.members.filter((m) => m.roomId === room.id && m.userId !== me()).forEach((m) => {
        if (fresh.profiles[m.userId]) fresh.profiles[m.userId].roomDeletedNotice = true; // R13: 상대에게 한 번 안내
      });
      fresh.members = fresh.members.filter((m) => m.roomId !== room.id);
      Object.keys(fresh.invites).forEach((t) => { if (fresh.invites[t].roomId === room.id) delete fresh.invites[t]; });
      ids.forEach((id) => { delete fresh.receipts[id]; delete fresh.positions[id]; });
      fresh.reads = fresh.reads.filter((r) => !ids.has(r.receiptId));
      delete fresh.rooms[room.id];
      save(fresh);
    },

    async deleteAccount() {
      failIf('leave');
      const db = load();
      if (myRoomId(db)) return 'has_room';
      const id = me();
      delete db.profiles[id];
      db.events = db.events.filter((e) => e.userId !== id); // 사용 기록까지 [임시 Q18]
      db.reads = db.reads.filter((r) => r.userId !== id);
      save(db);
      localStorage.removeItem(sessionKey());
      return 'ok';
    },

    async photoBlob(path) {
      const blob = await idbDo<Blob | undefined>('readonly', (s) => s.get(path) as IDBRequest<Blob | undefined>);
      if (!blob) throw new BackendError('no_photo');
      return blob;
    },

    async photoUrl(path) {
      const hit = urlCache.get(path);
      if (hit) return hit;
      const blob = await idbDo<Blob | undefined>('readonly', (s) => s.get(path) as IDBRequest<Blob | undefined>);
      if (!blob) throw new BackendError('no_photo');
      const url = URL.createObjectURL(blob);
      urlCache.set(path, url);
      return url;
    },
  };
}
