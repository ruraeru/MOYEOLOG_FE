import { format } from 'date-fns';
import {
  THEME_COLORS,
  type ThemeKey,
  PREF_KEYS,
  PREF_OPTIONS,
  PREF_CHANGE_EVENT,
  type PrefName,
  type PrefValue,
  MAX_UPLOAD_BYTES,
  ALLOWED_IMAGE_TYPES,
} from './constants';

/**
 * Date를 오프셋 없는 로컬 시각 문자열(yyyy-MM-dd'T'HH:mm:ss)로 변환합니다.
 * 일정 시간은 서버와 "벽시계 시각" 그대로 주고받으므로 toISOString()(UTC 변환)을 쓰면 안 됩니다.
 */
export const toLocalDateTimeString = (date: Date) => format(date, "yyyy-MM-dd'T'HH:mm:ss");

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
    // 체크리스트 칸 제거 ([ ] 할 일, [x] 한 일)
    .replace(/^\[[ xX]\]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    // 수평선 제거
    .replace(/^---$/gm, '')
    // 줄바꿈을 공백으로
    .replace(/\s+/g, ' ')
    .trim();
};

/** 글자 수를 코드 포인트 기준으로 셉니다 (이모지 1개 = 1자, 백엔드와 같은 규칙). */
export const codePointLength = (value: string) => [...value].length;

/**
 * 이름에 쓸 수 없는 문자(백엔드와 같은 규칙): 제어 문자(Cc), 줄·문단 구분(U+2028/2029),
 * U+200B, U+200E, U+200F, U+202A~U+202E, U+2060~U+2064, U+2066~U+2069, U+FEFF.
 * 이모지에 쓰이는 ZWJ(U+200D)·ZWNJ(U+200C)·이체 선택자(U+FE00~U+FE0F)·태그 문자(U+E0020~U+E007F)는 허용합니다.
 */
const INVISIBLE_OR_CONTROL = new RegExp(
  '[\\p{Cc}\\u200b\\u200e\\u200f\\u2028-\\u202e\\u2060-\\u2064\\u2066-\\u2069\\ufeff]',
  'u'
);

export const hasInvisibleOrControlChar = (value: string) => INVISIBLE_OR_CONTROL.test(value);

/** 공백·서식 문자·결합 문자·비어 보이는 채움 문자를 뺀 '보이는 글자'가 하나라도 있는지. */
const VISIBLE_CHAR = new RegExp('[^\\s\\p{Cc}\\p{Cf}\\p{M}\\p{Z}\\u115f\\u1160\\u3164\\uffa0\\u2800\\u180e]', 'u');

export const hasVisibleChar = (value: string) => VISIBLE_CHAR.test(value);

/** 화면에 보이는 글자(grapheme) 단위로 나눕니다. 👩‍💻 ❤️ 🏳️‍🌈 는 각각 1자. */
export const splitGraphemes = (value: string): string[] => {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter('ko', { granularity: 'grapheme' });
    return Array.from(segmenter.segment(value), (s) => s.segment);
  }
  return [...value];
};

export const graphemeLength = (value: string) => splitGraphemes(value).length;

/** 아바타 등에 쓰는 첫 글자. 이모지·조합 이모지를 쪼개지 않는다(name[0] 은 서로게이트 반쪽이 남아 '�' 가 된다). */
export const initialOf = (name: string | null | undefined, fallback = '?'): string => {
  const first = name ? splitGraphemes(name.trim())[0] : undefined;
  return first || fallback;
};

/** 앞뒤 공백을 지우고 글자(grapheme) 기준으로 max 자까지 자릅니다 (이모지를 쪼개지 않음). */
export const truncateGraphemes = (value: string, max: number) => splitGraphemes(value.trim()).slice(0, max).join('').trim();

/**
 * 업로드할 이미지 파일을 검사합니다. 문제가 없으면 null, 있으면 사용자에게 보여 줄 문구를 돌려줍니다.
 */
export const validateImageFile = (file: File): string | null => {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return 'JPG, PNG, GIF, WEBP 이미지만 올릴 수 있어요.';
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return '파일이 너무 커요. 10MB 이하로 올려 주세요.';
  }
  return null;
};

/**
 * 기기별 화면 설정을 읽습니다. 저장된 값이 없거나 허용되지 않은 값이면 기본값(첫 번째 선택지)을 돌려줍니다.
 * 서버 렌더링 중에는 항상 기본값입니다.
 */
export function getPref<K extends PrefName>(name: K): PrefValue<K> {
  const options = PREF_OPTIONS[name] as readonly string[];
  const fallback = options[0] as PrefValue<K>;
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(PREF_KEYS[name]);
    return raw !== null && options.includes(raw) ? (raw as PrefValue<K>) : fallback;
  } catch {
    return fallback;
  }
}

/** 기기별 화면 설정을 저장하고, 같은 탭의 다른 화면에도 바뀐 것을 알립니다. */
export function setPref<K extends PrefName>(name: K, value: PrefValue<K>) {
  try {
    window.localStorage.setItem(PREF_KEYS[name], value);
  } catch {
    // 저장할 수 없는 환경(사생활 보호 모드 등)에서는 이번 화면에서만 적용됩니다.
  }
  window.dispatchEvent(new Event(PREF_CHANGE_EVENT));
}

/** 시각 표시 형식(date-fns). 설정에서 12시간제를 고르면 '오후 3:05' 형태입니다. */
export const getTimeFormat = () => (getPref('hour12') === 'true' ? 'a h:mm' : 'HH:mm');
