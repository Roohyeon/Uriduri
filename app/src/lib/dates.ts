// 날짜 규칙 — 순수 함수 (화면·네트워크 없음). 테스트: tests/dates.test.ts
// 날짜는 'YYYY-MM-DD' 값으로 저장하고, 보여 줄 때만 형식을 입힌다 [디자인 보류 C4, 02-plan 1장]

export type IsoDate = string; // 'YYYY-MM-DD'

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(v: string): boolean {
  const m = ISO_RE.exec(v);
  if (!m) return false;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** 기기 시간 기준 오늘 (R4 "기기 시간 기준") */
export function todayIso(now: Date = new Date()): IsoDate {
  return toIso(now);
}

/** Date(기기 시간대) → 'YYYY-MM-DD' */
export function toIso(d: Date): IsoDate {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 'YYYY-MM-DD'의 자정(UTC) 밀리초 — 날짜끼리 빼기용 */
function utcMs(iso: IsoDate): number {
  const m = ISO_RE.exec(iso);
  if (!m) throw new Error(`날짜 형식이 아니에요: ${iso}`);
  return Date.UTC(+m[1], +m[2] - 1, +m[3]);
}

/** 사귄 날을 1일로 센다 (D38). 기획 예: 2025-09-30 → 2026-11-16 = D+413 */
export function dday(start: IsoDate, on: IsoDate): number {
  return Math.round((utcMs(on) - utcMs(start)) / 86_400_000) + 1;
}

/**
 * 영수증 합계 표시. 사귄 날보다 앞선 날짜(사귀기 전 추억)는 음수가 되므로 D-로 보인다.
 * 1 → 'D+1', 0 → 'D-1'(사귄 날 하루 전), -8 → 'D-9'
 */
export function fmtDplus(n: number): { short: string; long: string } {
  return n >= 1
    ? { short: `D+${n}`, long: `이날 함께한 지 ${n}일째` }
    : { short: `D-${1 - n}`, long: `사귄 날 ${1 - n}일 전` };
}

const weekdayFmt = new Intl.DateTimeFormat('ko-KR', { weekday: 'short', timeZone: 'UTC' });

/** 화면 표시: '2026.11.15 (일)' — 디자인 05-handoff 7장 형식. 요일은 Intl로 */
export function fmtDate(iso: IsoDate, withWeekday = true): string {
  const [y, m, d] = iso.split('-');
  const base = `${y}.${m}.${d}`;
  return withWeekday ? `${base} (${weekdayFmt.format(new Date(utcMs(iso)))})` : base;
}

/** 촬영 정보(EXIF)의 시각 → 날짜. 시간대 변환 없이 찍힌 날짜 그대로 (02-plan 7장) */
export function exifToIso(v: Date | string | undefined | null): IsoDate | undefined {
  if (!v) return undefined;
  if (typeof v === 'string') {
    // 'YYYY:MM:DD HH:MM:SS'
    const m = /^(\d{4})[:-](\d{2})[:-](\d{2})/.exec(v);
    const iso = m ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
    return iso && isIsoDate(iso) ? iso : undefined;
  }
  // exifr는 촬영 시각을 기기 시간대의 Date로 돌려준다 → 기기 시간대 기준으로 날짜만
  return Number.isNaN(v.getTime()) ? undefined : toIso(v);
}

/** a가 b보다 나중인가 */
export const isAfter = (a: IsoDate, b: IsoDate) => utcMs(a) > utcMs(b);

/**
 * 다음 100일 단위 기념일 (홈 '오늘의 책상' 시안).
 * 오늘이 딱 기념일이면 left 0. 예: D+412 → { day: 500, left: 88 }
 */
export function nextMilestone(dplus: number, step = 100): { day: number; left: number } {
  const day = dplus >= 1 && dplus % step === 0 ? dplus : Math.max(step, Math.ceil(dplus / step) * step);
  return { day, left: day - dplus };
}

/** 날짜에 n일 더하기 */
export function addDays(iso: IsoDate, n: number): IsoDate {
  const d = new Date(utcMs(iso) + n * 86_400_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
