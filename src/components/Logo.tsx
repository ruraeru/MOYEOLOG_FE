/**
 * 서비스 로고: "모여 / 로그" 두 줄을 굵은 한 줄 선으로 그렸다. "여"의 ㅇ만 주황 점(모이는 불).
 * 선은 currentColor(기본 나무 갈색), 점은 --mark. 이름이 그림 안에 있어 글자를 따로 붙이지 않는다.
 * 기준 시안: Figma "서비스 로고 시안 (2026-11-24)" 의 S6.
 */
export function Logo({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      role="img"
      aria-label="모여로그"
      className={`shrink-0 text-accent ${className}`}
    >
      <g stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        {/* 모 */}
        <rect x="14" y="10" width="24" height="15" rx="2" />
        <path d="M26 28V38M10 40H42" />
        {/* 여 (ㅕ) */}
        <path d="M83 9V43M74 19H83M74 30H83" />
        {/* 로 */}
        <path d="M14 55H38V62H14V69H38M26 73V84M10 86H42" />
        {/* 그 */}
        <path d="M58 58H82V74M54 86H86" />
      </g>
      {/* 여 (ㅇ) */}
      <circle cx="63" cy="25" r="10" fill="var(--mark)" />
    </svg>
  );
}
