import axios from 'axios';
import { Session } from 'next-auth';

const isBrowser = typeof window !== 'undefined';
const API_BASE_URL = isBrowser 
  ? '' 
  : (process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://app:8080');

export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000,
});

/**
 * 세션 객체를 받아 인증 헤더를 반환하는 유틸리티입니다.
 */
export const getAuthHeaders = (session: Session | null) => {
  if (session?.user?.accessToken) {
    return { Authorization: `Bearer ${session.user.accessToken}` };
  }
  return {};
};

/** 401 응답을 받았을 때 브라우저에 알리는 이벤트 이름 (SessionGuard가 수신해 세션을 재확인합니다). */
export const UNAUTHORIZED_EVENT = 'moyeolog:unauthorized';

const FALLBACK_ERROR_MESSAGES: Record<number, string> = {
  400: '잘못된 요청입니다.',
  401: '로그인이 필요합니다. 다시 로그인해주세요.',
  403: '권한이 없습니다.',
  404: '요청한 정보를 찾을 수 없습니다.',
  409: '이미 처리된 요청입니다.',
  413: '파일 용량이 너무 큽니다.',
};

/**
 * API 오류에서 사용자에게 보여줄 메시지를 추출합니다.
 * 백엔드가 내려주는 message 필드를 우선 사용하고, 없으면 상태 코드에 맞는 한국어 문구를 반환합니다.
 */
export const getApiErrorMessage = (error: unknown, fallback?: string): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: unknown } | undefined;
    if (data && typeof data.message === 'string' && data.message.trim()) {
      return data.message;
    }
    if (fallback) return fallback;
    const status = error.response?.status;
    if (!status) return '서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.';
    if (status >= 500) return '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
    return FALLBACK_ERROR_MESSAGES[status] || '요청을 처리하지 못했습니다.';
  }
  if (fallback) return fallback;
  return error instanceof Error && error.message ? error.message : '요청을 처리하지 못했습니다.';
};

// Response Interceptor: Error Handling
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error)) {
      // "Request failed with status code 500" 대신 백엔드 메시지(또는 한국어 기본 문구)를 노출합니다.
      error.message = getApiErrorMessage(error);

      if (error.response?.status === 401 && isBrowser) {
        // 세션 재확인(토큰 갱신 또는 로그아웃)은 SessionGuard가 처리합니다.
        window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
      }
    }
    return Promise.reject(error);
  }
);
