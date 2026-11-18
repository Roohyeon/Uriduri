import type { ReactNode } from 'react';
import { MOOD_NAMES, type Mood } from '../data';

/**
 * 오늘의 기분 얼굴 아이콘 (Q10, 2026-11-17 변경) — 시스템 이모지 대신 잉크 선으로 그린 얼굴.
 * 감열지 영수증의 검정 잉크 톤과 맞추려고 색 없이 currentColor 한 가지 선만 쓴다.
 */
const FEATURES: Record<Mood, ReactNode> = {
  // 행복해: 동그란 눈 + 웃는 입
  happy: (
    <>
      <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="1" fill="currentColor" stroke="none" />
      <path d="M8.5 14.5q3.5 3 7 0" />
    </>
  ),
  // 설레: 하트 눈 + 작은 웃음
  flutter: (
    <>
      <path d="M9 11.6l-1.7-1.6a1 1 0 1 1 1.7-1.1 1 1 0 1 1 1.7 1.1z" fill="currentColor" strokeWidth="0.8" />
      <path d="M15 11.6l-1.7-1.6a1 1 0 1 1 1.7-1.1 1 1 0 1 1 1.7 1.1z" fill="currentColor" strokeWidth="0.8" />
      <path d="M9.5 15q2.5 2 5 0" />
    </>
  ),
  // 신나: 웃느라 감은 눈(^ ^) + 크게 벌린 입
  excited: (
    <>
      <path d="M7.5 10.5l1.5-1.5 1.5 1.5" />
      <path d="M13.5 10.5l1.5-1.5 1.5 1.5" />
      <path d="M8 13.5h8a4 4 0 0 1-8 0z" fill="currentColor" />
    </>
  ),
  // 편안해: 내리감은 눈 + 잔잔한 미소
  calm: (
    <>
      <path d="M7.5 10q1.5 1.2 3 0" />
      <path d="M13.5 10q1.5 1.2 3 0" />
      <path d="M9.5 15q2.5 1.4 5 0" />
    </>
  ),
  // 배불러: 감은 눈 + 혀 내민 입
  full: (
    <>
      <path d="M7.5 10.5l1.5-1.5 1.5 1.5" />
      <path d="M13.5 10.5l1.5-1.5 1.5 1.5" />
      <path d="M8.5 14h7" />
      <path d="M12.5 14v1.6a1.3 1.3 0 0 0 2.6 0V14" />
    </>
  ),
  // 피곤해: 일자 눈 + 작게 벌린 입 + z
  tired: (
    <>
      <path d="M7.5 10.5h3" />
      <path d="M13.5 10.5h3" />
      <circle cx="12" cy="15.5" r="1.2" />
      <path d="M17.5 3.5h2.5l-2.5 2.5h2.5" strokeWidth="1.1" />
    </>
  ),
  // 아쉬워: 처진 눈썹 + 내려간 입 + 눈물 한 방울
  sorry: (
    <>
      <path d="M7.5 9.6l2.5-1.2" />
      <path d="M16.5 9.6l-2.5-1.2" />
      <circle cx="9" cy="11.2" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="11.2" r="0.9" fill="currentColor" stroke="none" />
      <path d="M9.5 16.3q2.5-2 5 0" />
      <path d="M16 12.8q.9 1.3 0 1.9q-.9-.6 0-1.9z" fill="currentColor" strokeWidth="0.6" />
    </>
  ),
};

export function MoodFace({ mood, size = 20, label = true }: { mood: Mood; size?: number; label?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="inline-block shrink-0 align-[-0.2em]"
      role={label ? 'img' : undefined}
      aria-label={label ? `기분: ${MOOD_NAMES[mood]}` : undefined}
      aria-hidden={label ? undefined : true}
    >
      <circle cx="12" cy="12" r="9" />
      {FEATURES[mood]}
    </svg>
  );
}
