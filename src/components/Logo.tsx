/**
 * 서비스 로고: 2×2 초성 아이콘(ㅁㅇㄹㄱ, 옅은 주황 타일) + 가로 한 줄 "모여로그".
 * 굵은 한 줄 선으로 그렸고 ㅇ만 주황 점(모이는 불)이다. 선은 currentColor(기본 나무 갈색), 점은 --mark.
 * 이름이 그림 안에 있어 글자를 따로 붙이지 않는다. height 는 타일 높이(글자 높이는 그 72%).
 * 탭 아이콘은 같은 2×2 를 app/icon.svg 로 쓴다.
 * 기준 시안: Figma "서비스 로고 시안 (2026-11-24)" 의 S11.
 */
export function Logo({ height = 32, className = '' }: { height?: number; className?: string }) {
  return (
    <svg
      width={(height * 249) / 64}
      height={height}
      viewBox="0 0 249 64"
      fill="none"
      role="img"
      aria-label="모여로그"
      className={`shrink-0 text-accent ${className}`}
    >
      {/* 2×2 초성 아이콘 */}
      <rect width="64" height="64" rx="15" fill="var(--accent-soft)" />
      <g transform="translate(9.5 9.5) scale(0.47)">
        <g stroke="currentColor" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
          <rect x="12" y="12" width="28" height="28" rx="10" />
          <path d="M12 56H33A7 7 0 0 1 33 70H19A7 7 0 0 0 19 84H40" />
          <path d="M54 56H74A10 10 0 0 1 84 66V84" />
        </g>
        <circle cx="68" cy="26" r="18" fill="var(--mark)" />
      </g>
      {/* 가로 한 줄 "모여로그" */}
      <g transform="translate(78 9)">
        <g stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
          {/* 모 */}
          <rect x="10.5" y="8" width="24" height="15" rx="2" />
          <path d="M22.5 26V36M6.5 38H38.5" />
          {/* 여 (ㅕ) */}
          <path d="M76.5 7V41M67.5 17H76.5M67.5 28H76.5" />
          {/* 로 */}
          <path d="M92.5 7H116.5V14H92.5V21H116.5M104.5 25V36M88.5 38H120.5" />
          {/* 그 */}
          <path d="M136.5 10H160.5V26M132.5 38H164.5" />
        </g>
        {/* 여 (ㅇ) */}
        <circle cx="56.5" cy="23" r="10" fill="var(--mark)" />
      </g>
    </svg>
  );
}
