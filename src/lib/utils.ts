import { THEME_COLORS, type ThemeKey } from './constants';

/**
 * 테마 키에 해당하는 색상 객체를 반환합니다.
 */
export const getThemeColors = (theme?: string) => {
  return THEME_COLORS[theme as ThemeKey] || THEME_COLORS.indigo;
};

/**
 * 파일 경로를 실제 접근 가능한 URL로 변환합니다.
 */
export const getFileUrl = (path?: string | null) => {
  if (!path) return null;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  return path.startsWith('/uploads/') ? `${apiUrl}${path}` : path;
};

/**
 * 텍스트 요약
 */
export const truncateText = (text: string, length: number) => {
  if (text.length <= length) return text;
  return text.slice(0, length) + '...';
};
