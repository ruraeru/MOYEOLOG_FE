/**
 * 공통 테마 색상 정의
 */
export const THEME_COLORS = {
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600', light: 'bg-indigo-50/50', border: 'border-indigo-200', soft: 'text-indigo-500' },
  blue: { bg: 'bg-sky-100', text: 'text-sky-600', light: 'bg-sky-50/50', border: 'border-sky-200', soft: 'text-sky-500' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600', light: 'bg-emerald-50/50', border: 'border-emerald-200', soft: 'text-emerald-500' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-600', light: 'bg-orange-50/50', border: 'border-orange-200', soft: 'text-orange-500' },
  rose: { bg: 'bg-rose-100', text: 'text-rose-600', light: 'bg-rose-50/50', border: 'border-rose-200', soft: 'text-rose-500' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-600', light: 'bg-amber-50/50', border: 'border-amber-200', soft: 'text-amber-500' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-600', light: 'bg-purple-50/50', border: 'border-purple-200', soft: 'text-purple-500' },
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
