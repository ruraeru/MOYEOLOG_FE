import axios from 'axios';
import { getSession } from 'next-auth/react';

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

// Request Interceptor: Add Authorization Token
axiosInstance.interceptors.request.use(async (config) => {
  const session = await getSession();
  
  if (session?.user?.accessToken) {
    config.headers.Authorization = `Bearer ${session.user.accessToken}`;
  }

  // URL Transformation for Proxy (Client Side only)
  if (isBrowser && config.url?.startsWith('/api/')) {
    config.url = config.url.replace('/api/', '/api-proxy/');
  }

  return config;
});

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
