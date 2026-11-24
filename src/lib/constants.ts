/**
 * 공통 테마 색상 정의
 */
// 모임 색. 키는 DB 에 저장된 값이라 바꾸지 않는다
// 모임 화면 안에서는 components/groups/GroupIdentity 의 groupStyle() 로 --group 변수를 깔고 bg-group / text-group-ink / bg-group-wash 를 쓴다
// hex: 띠·점 인라인 색, ink: 글자로 쓸 때 진한 톤(surface 위 4.5:1), dot: 점 클래스, text: ink 의 클래스판, soft: 아주 옅은 바탕
export const THEME_COLORS = {
  indigo: { hex: '#573c2d', ink: '#573c2d', dot: 'bg-[#573c2d]', text: 'text-[#573c2d]', soft: 'bg-[#573c2d]/10', bg: 'bg-[#573c2d]/10', light: 'bg-[#573c2d]/5', border: 'border-[#573c2d]/30' },
  blue: { hex: '#6f9fc9', ink: '#3f6f99', dot: 'bg-[#6f9fc9]', text: 'text-[#3f6f99]', soft: 'bg-[#6f9fc9]/12', bg: 'bg-[#6f9fc9]/12', light: 'bg-[#6f9fc9]/6', border: 'border-[#6f9fc9]/40' },
  emerald: { hex: '#8db478', ink: '#4f7a3a', dot: 'bg-[#8db478]', text: 'text-[#4f7a3a]', soft: 'bg-[#8db478]/15', bg: 'bg-[#8db478]/15', light: 'bg-[#8db478]/8', border: 'border-[#8db478]/40' },
  orange: { hex: '#fe804d', ink: '#b4501f', dot: 'bg-[#fe804d]', text: 'text-[#b4501f]', soft: 'bg-[#fe804d]/12', bg: 'bg-[#fe804d]/12', light: 'bg-[#fe804d]/6', border: 'border-[#fe804d]/40' },
  rose: { hex: '#e58a8a', ink: '#a84848', dot: 'bg-[#e58a8a]', text: 'text-[#a84848]', soft: 'bg-[#e58a8a]/15', bg: 'bg-[#e58a8a]/15', light: 'bg-[#e58a8a]/8', border: 'border-[#e58a8a]/40' },
  amber: { hex: '#f4c679', ink: '#8a6416', dot: 'bg-[#f4c679]', text: 'text-[#8a6416]', soft: 'bg-[#f4c679]/20', bg: 'bg-[#f4c679]/20', light: 'bg-[#f4c679]/10', border: 'border-[#f4c679]/50' },
  purple: { hex: '#a58fc9', ink: '#6a5596', dot: 'bg-[#a58fc9]', text: 'text-[#6a5596]', soft: 'bg-[#a58fc9]/15', bg: 'bg-[#a58fc9]/15', light: 'bg-[#a58fc9]/8', border: 'border-[#a58fc9]/40' },
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
