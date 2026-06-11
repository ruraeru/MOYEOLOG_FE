import axios from 'axios';
import { Session } from 'next-auth';

const isBrowser = typeof window !== 'undefined';
const API_BASE_URL = isBrowser 
  ? '' 
  : (process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://moyeolog.kro.kr:8080');

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

// Response Interceptor: Error Handling
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.error('[Axios] Auth Error:', error.response.status);
    }
    return Promise.reject(error);
  }
);
