import { safeCallbackPath } from './url-safety';

/**
 * 초대 링크 등에서 가입하러 온 사람이 가입 메일 인증 뒤 원래 화면으로 돌아가게,
 * 가입 화면의 ?callbackUrl 을 이 브라우저에 잠시(1시간) 기억해 둔다.
 * 메일 링크는 새 탭으로 열리므로 sessionStorage 가 아니라 localStorage 를 쓴다.
 */
const KEY = 'moyeolog.afterSignup';
const TTL_MS = 60 * 60 * 1000;

/** 현재 주소의 ?callbackUrl (안전한 사이트 안 경로일 때만). 없으면 null */
export function callbackFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('callbackUrl');
  const path = safeCallbackPath(raw, '');
  return path || null;
}

export function rememberAfterSignup(path: string | null) {
  try {
    if (path) localStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() }));
  } catch {
    // 저장소를 못 쓰면 기본(홈)으로 간다
  }
}

/** 기억해 둔 경로(만료 전). 꺼내면 지운다 */
export function takeAfterSignup(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    localStorage.removeItem(KEY);
    const { path, at } = JSON.parse(raw) as { path?: string; at?: number };
    if (!path || !at || Date.now() - at > TTL_MS) return null;
    return safeCallbackPath(path, '') || null;
  } catch {
    return null;
  }
}

/** 로그인 화면 주소(돌아갈 곳이 있으면 붙인다) */
export const loginHref = (path: string | null) => (path ? `/?callbackUrl=${encodeURIComponent(path)}` : '/');
