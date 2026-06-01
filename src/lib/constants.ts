/**
 * 공통 테마 색상 정의
 */
export const THEME_COLORS = {
  indigo: { bg: 'bg-indigo-500', text: 'text-indigo-500', light: 'bg-indigo-50', border: 'border-indigo-200', soft: 'text-indigo-700' },
  blue: { bg: 'bg-blue-500', text: 'text-blue-500', light: 'bg-blue-50', border: 'border-blue-200', soft: 'text-blue-700' },
  emerald: { bg: 'bg-emerald-500', text: 'text-emerald-500', light: 'bg-emerald-50', border: 'border-emerald-200', soft: 'text-emerald-700' },
  orange: { bg: 'bg-orange-500', text: 'text-orange-500', light: 'bg-orange-50', border: 'border-orange-200', soft: 'text-orange-700' },
  rose: { bg: 'bg-rose-500', text: 'text-rose-500', light: 'bg-rose-50', border: 'border-rose-200', soft: 'text-rose-700' },
  amber: { bg: 'bg-amber-500', text: 'text-amber-500', light: 'bg-amber-50', border: 'border-amber-200', soft: 'text-amber-700' },
  purple: { bg: 'bg-purple-500', text: 'text-purple-500', light: 'bg-purple-50', border: 'border-purple-200', soft: 'text-purple-700' },
} as const;

export type ThemeKey = keyof typeof THEME_COLORS;

/**
 * 기본 위치 (서울시청)
 */
export const DEFAULT_LOCATION = {
  lat: 37.5665,
  lng: 126.9780,
};

/**
 * 카카오 지도 관련 설정
 */
export const KAKAO_MAP_CONFIG = {
  MAX_RETRIES: 30,
  RETRY_INTERVAL: 500,
  DEFAULT_LEVEL: 3,
};
