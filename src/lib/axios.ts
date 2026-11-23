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

export const ERROR_MESSAGES = {
  network: '서버에 연결할 수 없어요. 인터넷 연결을 확인하고 다시 시도해 주세요.',
  timeout: '응답이 너무 오래 걸려요. 잠시 후 다시 시도해 주세요.',
  server: '서버에 문제가 생겼어요. 잠시 후 다시 시도해 주세요.',
  unknown: '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.',
} as const;

const FALLBACK_ERROR_MESSAGES: Record<number, string> = {
  400: '입력한 내용을 다시 확인해 주세요.',
  401: '로그인이 필요해요. 다시 로그인해 주세요.',
  403: '이 작업을 할 권한이 없어요.',
  404: '찾는 정보가 없어요. 이미 삭제됐을 수 있어요.',
  409: '다른 곳에서 먼저 바뀌었어요. 새로고침 후 다시 시도해 주세요.',
  413: '파일이 너무 커요. 10MB 이하로 올려 주세요.',
  415: '지원하지 않는 파일 형식이에요.',
  429: '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.',
};

/** 응답 상태 코드 (응답이 없으면 undefined) */
export const getApiErrorStatus = (error: unknown): number | undefined =>
  axios.isAxiosError(error) ? error.response?.status : undefined;

/**
 * API 오류에서 사용자에게 보여줄 메시지를 추출합니다.
 * 백엔드가 내려주는 message 필드를 우선 사용하고, 없으면 상태 코드에 맞는 한국어 문구를 반환합니다.
 * (413·429 는 nginx 가 HTML 을 줄 수도 있어 message 가 없을 때 상태 코드 문구를 씁니다.)
 */
export const getApiErrorMessage = (error: unknown, fallback?: string): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: unknown } | undefined;
    if (data && typeof data === 'object' && typeof data.message === 'string' && data.message.trim()) {
      return data.message;
    }
    const status = error.response?.status;
    // 413·429·네트워크 오류는 화면별 문구보다 원인을 알려 주는 공통 문구가 더 정확합니다.
    if (status === 413 || status === 429) return FALLBACK_ERROR_MESSAGES[status];
    if (!status) {
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') return ERROR_MESSAGES.timeout;
      if (error.code === 'ERR_CANCELED') return fallback || ERROR_MESSAGES.unknown;
      return ERROR_MESSAGES.network;
    }
    if (fallback) return fallback;
    if (status >= 500) return ERROR_MESSAGES.server;
    return FALLBACK_ERROR_MESSAGES[status] || ERROR_MESSAGES.unknown;
  }
  if (fallback) return fallback;
  return error instanceof Error && error.message ? error.message : ERROR_MESSAGES.unknown;
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
