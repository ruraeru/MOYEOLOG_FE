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
 * 이미지를 WEBP 포맷으로 변환하고 압축하며 리사이징합니다.
 * maxWidth, maxHeight를 초과하는 경우 비율을 유지하며 크기를 조절합니다.
 * 변환에 실패하거나 SVG/GIF인 경우 원본 파일을 반환합니다.
 */
export async function convertToWebP(
  file: File, 
  quality: number = 0.8, 
  maxWidth: number = 1200, 
  maxHeight: number = 1200
): Promise<File> {
  // SVG나 GIF(애니메이션)는 변환을 건너뜁니다.
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // 리사이징 비율 계산
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          resolve(file);
          return;
        }

        // 이미지 그리기 (리사이징 적용)
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const fileName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
              const newFile = new File([blob], fileName, {
                type: 'image/webp',
                lastModified: Date.now(),
              });
              
              // 이미 WEBP인 경우 변환/리사이징된 결과가 더 크다면 원본 반환
              if (newFile.size > file.size && file.type === 'image/webp' && img.width <= maxWidth && img.height <= maxHeight) {
                resolve(file);
              } else {
                resolve(newFile);
              }
            } else {
              resolve(file);
            }
          },
          'image/webp',
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
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
