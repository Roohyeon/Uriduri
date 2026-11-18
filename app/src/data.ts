// 화면에서 쓰는 영수증 모양(뷰 모델)과 상수. 저장 형식은 services/types.ts
import { dday as ddayOf, fmtDate, isIsoDate, todayIso } from './lib/dates';

/** x, y: 영수증 안에서 도장이 찍힌 위치(%) — 화면 크기가 달라도 같은 자리에 남는다 */
export type StampShape = 'circle' | 'heart' | 'triangle';
/** label: 사용자가 직접 쓴 문구 (D35) */
/** by: 찍은 사람 id, byName: 닉네임 (화면 읽기용) */
export type StampMark = { by: string; byName?: string; shape: StampShape; label: string; rot: number; x: number; y: number };

export type Receipt = {
  id: string;
  no: string;
  date: string; // 영수증 날짜 값 'YYYY-MM-DD' (D12, D22 정렬 기준). 표시는 showDate() [C4]
  place?: string;
  memo: string;
  mood?: Mood;
  author: string; // 닉네임 (D30)
  authorId: string;
  /** 사귄 날부터 이 영수증 날짜까지 D+ (사귄 날 = 1일) */
  dplus: number;
  photo: { from: string; to: string; label: string; emoji: string; src?: string }; // src: 사용자가 고른 실제 사진
  stamps: StampMark[];
  isNew: boolean;
};

// 도장 문구 예시 (D35: 문구는 직접 쓰고, 예시는 토글로 보여 줌)
export const STAMP_MAX = 6; // [열린 질문 Q22] 도장 문구 최대 글자 수
export const STAMP_EXAMPLES = ['최고야!', '또 가자!', '웃겨!', '사랑해!', '맛있었어!', '고마워!'];
// [열린 질문 Q10] 기분 아이콘 — 잉크 선으로 그린 얼굴 7종 (2026-11-17, 이모지에서 변경). 그림은 components/MoodFace.tsx
export type Mood = 'happy' | 'flutter' | 'excited' | 'calm' | 'full' | 'tired' | 'sorry';
export const MOOD_NAMES: Record<Mood, string> = {
  happy: '행복해',
  flutter: '설레',
  excited: '신나',
  calm: '편안해',
  full: '배불러',
  tired: '피곤해',
  sorry: '아쉬워',
};
export const MOODS = Object.keys(MOOD_NAMES) as Mood[];

/** 사진 칸 배경: 실제 사진이 있으면 사진, 없으면 시안용 그라데이션 */
export function photoBg(p: Receipt['photo']): string {
  return p.src ? `center / cover no-repeat url("${p.src}")` : `linear-gradient(135deg, ${p.from}, ${p.to})`;
}

// 사귄 날 (D37, D38). 사귄 날을 1일로 센다
/** 오늘(기기 시간 기준) — 앱을 연 날 */
export const TODAY = todayIso();
/** 사귄 날을 1일로 센 D+ (D38). 계산은 lib/dates.ts */
export function dday(start: string, on: string = todayIso()): number {
  return ddayOf(start, on);
}
/** 영수증 날짜 표시: 값('YYYY-MM-DD')이면 '2026.11.15 (일)', 아니면(미리보기 자리 글자) 그대로 */
export function showDate(v: string, withWeekday = true): string {
  return isIsoDate(v) ? fmtDate(v, withWeekday) : v;
}

/** 문자열 id → 작은 숫자 (집게 색·기울기를 영수증마다 고르게 나누는 용도) */
export function hashId(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}
