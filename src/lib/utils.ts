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

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * 파일을 Data URL(Base64) 스트링으로 변환합니다.
 */
export async function fileToDataUrl(file: File): Promise<string> {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('이미지는 10MB 이하여야 합니다.');
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('이미지를 읽을 수 없습니다.'));
    reader.readAsDataURL(file);
  });
}

/**
 * 마크다운 문법을 제거하고 순수 텍스트만 추출합니다.
 */
export const stripMarkdown = (markdown: string): string => {
  if (!markdown) return '';
  return markdown
    // 코드 블록 제거
    .replace(/```[\s\S]*?```/g, '')
    // 인라인 코드 제거
    .replace(/`([^`]+)`/g, '$1')
    // 이미지 제거
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    // 링크 처리 [텍스트](URL) -> 텍스트
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // 헤더 제거 (# Header -> Header)
    .replace(/^#{1,6}\s+/gm, '')
    // 굵게, 기울임 제거
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    // 취소선 제거
    .replace(/~~(.*?)~~/g, '$1')
    // 인용문 제거 (> text -> text)
    .replace(/^>\s+/gm, '')
    // 리스트 마커 제거 (- text, * text, 1. text)
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    // 수평선 제거
    .replace(/^---$/gm, '')
    // 줄바꿈을 공백으로
    .replace(/\s+/g, ' ')
    .trim();
};
