/**
 * 공통 테마 색상 정의
 */
export const THEME_COLORS = {
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600', light: 'bg-indigo-50/50', border: 'border-indigo-200', soft: 'text-indigo-500', dot: 'bg-accent' },
  blue: { bg: 'bg-sky-100', text: 'text-sky-600', light: 'bg-sky-50/50', border: 'border-sky-200', soft: 'text-sky-500', dot: 'bg-sky-500' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600', light: 'bg-emerald-50/50', border: 'border-emerald-200', soft: 'text-emerald-500', dot: 'bg-emerald-500' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-600', light: 'bg-orange-50/50', border: 'border-orange-200', soft: 'text-orange-500', dot: 'bg-orange-500' },
  rose: { bg: 'bg-rose-100', text: 'text-rose-600', light: 'bg-rose-50/50', border: 'border-rose-200', soft: 'text-rose-500', dot: 'bg-rose-500' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-600', light: 'bg-amber-50/50', border: 'border-amber-200', soft: 'text-amber-500', dot: 'bg-amber-500' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-600', light: 'bg-purple-50/50', border: 'border-purple-200', soft: 'text-purple-500', dot: 'bg-purple-500' },
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

/**
 * 기기별 화면 설정(localStorage) 키와 허용 값.
 * 설정 화면이 쓰고, 메모·일정 화면이 읽습니다. 값이 없거나 잘못됐으면 기본값을 씁니다.
 */
export const PREF_KEYS = {
  memoView: 'moyeolog.memoView', // 'grid' | 'list' (기본 grid)
  scheduleView: 'moyeolog.scheduleView', // 'month' | 'week' | 'list' (기본 month)
  weekStartsOn: 'moyeolog.weekStartsOn', // '0' | '1' (0 = 일요일, 기본 0)
  hour12: 'moyeolog.hour12', // 'true' | 'false' (기본 false = 24시간)
} as const;

export const PREF_CHANGE_EVENT = 'moyeolog:prefs';

export const PREF_OPTIONS = {
  memoView: ['grid', 'list'],
  scheduleView: ['month', 'week', 'list'],
  weekStartsOn: ['0', '1'],
  hour12: ['false', 'true'],
} as const;

export type PrefName = keyof typeof PREF_KEYS;
export type PrefValue<K extends PrefName> = (typeof PREF_OPTIONS)[K][number];

/** 이미지 업로드 공통 규칙 (백엔드와 같은 10MB, JPEG/PNG/GIF/WEBP) */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
