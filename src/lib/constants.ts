/**
 * 공통 테마 색상 정의
 */
export const THEME_COLORS = {
  indigo: { bg: 'bg-indigo-600', text: 'text-indigo-600', light: 'bg-indigo-50', border: 'border-indigo-100', soft: 'text-indigo-800' },
  blue: { bg: 'bg-blue-600', text: 'text-blue-600', light: 'bg-blue-50', border: 'border-blue-100', soft: 'text-blue-800' },
  emerald: { bg: 'bg-emerald-600', text: 'text-emerald-600', light: 'bg-emerald-50', border: 'border-emerald-100', soft: 'text-emerald-800' },
  orange: { bg: 'bg-orange-600', text: 'text-orange-600', light: 'bg-orange-50', border: 'border-orange-100', soft: 'text-orange-800' },
  rose: { bg: 'bg-rose-600', text: 'text-rose-600', light: 'bg-rose-50', border: 'border-rose-100', soft: 'text-rose-800' },
  amber: { bg: 'bg-amber-600', text: 'text-amber-600', light: 'bg-amber-50', border: 'border-amber-100', soft: 'text-amber-800' },
  purple: { bg: 'bg-purple-600', text: 'text-purple-600', light: 'bg-purple-50', border: 'border-purple-100', soft: 'text-purple-800' },
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
