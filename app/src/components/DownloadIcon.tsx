/**
 * "Download arrow" 모션 아이콘 — 화살표가 트레이로 떨어지고, 트레이가 살짝 눌렸다가,
 * 화살표가 다시 위에서 내려온다. 한 바퀴 2.8초. 움직임 줄이기 설정이면 멈춘 완성 모습만 보인다.
 * 색은 currentColor라 버튼 글자색(ink)을 그대로 따른다.
 */
export function DownloadIcon({ size = 132, stroke = 1.8 }: { size?: number; stroke?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="dl-icon shrink-0 overflow-visible"
    >
      <g className="dl-arrow">
        <path d="M12 3.5v10" vectorEffect="non-scaling-stroke" />
        <path d="M8 9.5l4 4 4-4" vectorEffect="non-scaling-stroke" />
      </g>
      <path className="dl-tray" d="M4 15v3.5a1.5 1.5 0 0 0 1.5 1.5h13a1.5 1.5 0 0 0 1.5-1.5V15" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
