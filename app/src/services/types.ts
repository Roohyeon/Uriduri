// 화면이 부르는 데이터 함수의 모양 (02-plan 3장).
// 묶음 2~4는 로컬 구현(local.ts), 묶음 5에서 같은 모양으로 Supabase 구현을 끼운다.
import type { Mood, StampShape } from '../data';
import type { IsoDate } from '../lib/dates';
import type { InviteStatus } from '../lib/invite';

export type Provider = 'kakao' | 'google';
export const PROVIDER_NAMES: Record<Provider, string> = { kakao: '카카오', google: '구글' };

export type User = { id: string; provider: Provider };
export type Profile = { id: string; nickname: string; roomDeletedNotice: boolean };
export type Member = { id: string; nickname: string };
export type RoomInfo = {
  id: string;
  createdBy: string;
  anniversary: IsoDate;
  joinNoticeSeen: boolean;
  members: Member[];
};

export type DateSource = 'exif' | 'today' | 'manual';

export type StampRec = { userId: string; shape: StampShape; label: string; rot: number; x: number; y: number };

export type ReceiptRec = {
  id: string;
  roomId: string;
  authorId: string;
  no: number;
  date: IsoDate;
  dateSource: DateSource;
  memo: string;
  place?: string;
  mood?: Mood;
  photoPath: string;
  photoW: number;
  photoH: number;
  createdAt: number;
  updatedAt: number;
  stamps: StampRec[];
};

/** 보드 위 자리 (두 사람이 함께 씀 — 임시 Q23) */
export type Position = { x: number; y: number; rot: number; z: number };

export type PreparedPhoto = { blob: Blob; w: number; h: number };

export type ReceiptInput = {
  date: IsoDate;
  dateSource: DateSource;
  memo: string;
  place?: string;
  mood?: Mood;
  /** 새 발행은 필수, 수정은 사진을 바꿀 때만 */
  photo?: PreparedPhoto;
};

/** 사용 기록 (R12): 작성 화면 열기 · 발행 완료 · 이미지 저장/공유 버튼 누름 */
export type EventKind = 'compose_open' | 'publish' | 'image_save' | 'image_share';
export type EventRec = { kind: EventKind; userId: string; at: number; sessionId?: string; receiptId?: string };

/** 도장 찍기 입력 — 찍는 사람은 로그인한 나 */
export type StampInput = Omit<StampRec, 'userId'>;

export type PeekResult = { status: InviteStatus; creatorNickname?: string };
export type Invite = { token: string; expiresAt: number };

export interface Backend {
  readonly mode: 'local' | 'supabase';

  // 로그인 (R1)
  getUser(): Promise<User | null>;
  signIn(provider: Provider): Promise<void>;
  signOut(): Promise<void>;

  // 사람 (D30)
  getProfile(): Promise<Profile | null>;
  saveNickname(nickname: string): Promise<void>;
  clearRoomDeletedNotice(): Promise<void>;

  // 방·초대 (R2, R3, D25, D31, D37~D39)
  getMyRoom(): Promise<RoomInfo | null>;
  createRoom(anniversary: IsoDate): Promise<Invite>;
  currentInvite(): Promise<Invite | null>;
  newInvite(): Promise<Invite>;
  peekInvite(token: string): Promise<PeekResult>;
  acceptInvite(token: string): Promise<PeekResult>;
  setAnniversary(date: IsoDate): Promise<void>;
  markJoinNoticeSeen(): Promise<void>;

  // 영수증 (R4, R5, R7)
  listReceipts(): Promise<ReceiptRec[]>;
  listReads(): Promise<string[]>;
  markRead(receiptId: string): Promise<void>;
  listPositions(): Promise<Record<string, Position>>;
  savePosition(receiptId: string, pos: Position): Promise<void>;
  /** sessionId: 작성 화면을 열 때 만든 작성 회차 ID (R12) */
  publishReceipt(input: ReceiptInput & { photo: PreparedPhoto; sessionId?: string }): Promise<ReceiptRec>;
  updateReceipt(id: string, input: ReceiptInput): Promise<ReceiptRec>;
  deleteReceipt(id: string): Promise<void>;

  // 도장 (R6, D32, D34, D35): 상대 영수증에만, 한 사람당 영수증 하나에 1개(다시 찍으면 바뀜, 임시 Q12)
  setStamp(receiptId: string, stamp: StampInput): Promise<StampRec>;
  /** 내 도장만 지울 수 있다 */
  removeStamp(receiptId: string): Promise<void>;

  // 사용 기록 (R12) — 실패해도 화면 동작은 막지 않는다
  logEvent(kind: EventKind, extra?: { sessionId?: string; receiptId?: string }): Promise<void>;

  // 방 삭제 (R13): confirm이 '삭제'일 때만. 사진 → 방 순서, 상대에게 "방이 삭제되었어요" 표시
  deleteRoom(confirm: string): Promise<void>;

  // 탈퇴 (R13): 방이 없을 때만. 계정 정보와 사용 기록을 지우고 로그아웃 [임시 Q18]
  deleteAccount(): Promise<'ok' | 'has_room'>;

  // 사진 (R10) — 화면에 붙일 수 있는 주소, 백업용 파일
  photoUrl(path: string): Promise<string>;
  photoBlob(path: string): Promise<Blob>;
}

/** 실패를 화면에 알릴 때 쓰는 오류 */
export class BackendError extends Error {
  constructor(public code: string, message = code) {
    super(message);
  }
}
