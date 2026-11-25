/**
 * 서비스 로고(가로 한 줄): "모여로그" 네 글자를 굵은 한 줄 선으로 그렸다. "여"의 ㅇ만 주황 점(모이는 불).
 * 선은 currentColor(기본 나무 갈색), 점은 --mark. 이름이 그림 안에 있어 글자를 따로 붙이지 않는다.
 * 정사각형 자리(탭 아이콘)는 app/icon.svg 의 2×2 초성(ㅁㅇㄹㄱ)을 쓴다.
 * 기준 시안: Figma "서비스 로고 시안 (2026-11-24)" 의 S11.
 */
export function Logo({ height = 24, className = '' }: { height?: number; className?: string }) {
  return (
    <svg
      width={(height * 171) / 46}
      height={height}
      viewBox="0 0 171 46"
      fill="none"
      role="img"
      aria-label="모여로그"
      className={`shrink-0 text-accent ${className}`}
    >
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
    </svg>
  );
}
