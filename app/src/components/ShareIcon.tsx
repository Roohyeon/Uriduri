/**
 * 공유 아이콘 — "Download arrow"의 짝. 호버하면 화살표가 상자 밖으로 위로 날아가고,
 * 상자가 살짝 눌렸다가, 화살표가 다시 아래에서 올라온다. 한 바퀴 2.8초.
 * 색은 currentColor라 버튼 글자색을 따른다. 움직임은 부모의 .dl-trigger 호버/포커스에서만 켜진다.
 */
export function ShareIcon({ size = 132, stroke = 1.8 }: { size?: number; stroke?: number }) {
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
      className="shrink-0 overflow-visible"
    >
      <g className="sh-arrow">
        <path d="M12 14V3.5" vectorEffect="non-scaling-stroke" />
        <path d="M8 7.5l4-4 4 4" vectorEffect="non-scaling-stroke" />
      </g>
      <path className="sh-box" d="M8.5 10.5H6.5A1.5 1.5 0 0 0 5 12v6.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V12a1.5 1.5 0 0 0-1.5-1.5h-2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
