// 글자 수 규칙 — 화면과 DB가 같은 기준(코드 포인트)으로 센다 [02-plan 1장 receipts]
export const LIMITS = {
  nickname: 10, // [임시 Q7]
  memo: 50, // R4
  place: 30, // 02-plan 7장 확정
  stamp: 6, // [임시 Q22]
} as const;

/** 글자 수 (이모지 대부분 1, 조합 이모지는 여러 개로 셀 수 있음) */
export const countChars = (s: string) => [...s].length;

/** 최대 글자 수에서 자르기 (입력칸 maxLength는 UTF-16 기준이라 따로 자른다) */
export const clip = (s: string, max: number) => [...s].slice(0, max).join('');

/** 공백만 입력한 것은 빈 값으로 본다 (R4) */
export const isBlank = (s: string | undefined | null) => !s || s.trim() === '';

/** 필수 칸 검사: 비어 있지 않고 최대 글자 수 이하 */
export const isValidText = (s: string, max: number) => !isBlank(s) && countChars(s) <= max;
