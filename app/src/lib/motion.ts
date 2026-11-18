/** 움직임 줄이기 설정이면 부드러운 스크롤 대신 바로 이동 [04 List:111, Wheel:35] */
export const scrollBehavior = (): ScrollBehavior =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
