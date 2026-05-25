import { Session } from 'next-auth';

// 브라우저 환경에서는 Vercel Rewrites(Proxy)를 위해 상대 경로(/api-proxy/...)를 사용합니다.
// 서버 환경(SSR/Sync)에서는 백엔드 절대 주소를 직접 호출합니다.
const isBrowser = typeof window !== 'undefined';
const API_BASE_URL = isBrowser 
  ? '' 
  : (process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://moyeolog.kro.kr:8080');

export async function fetchWithAuth(url: string, options: RequestInit = {}, session: Session | null) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (session?.user?.accessToken) {
    headers['Authorization'] = `Bearer ${session.user.accessToken}`;
  }

  // AI 분석 등 시간이 걸리는 작업을 위해 60초 타임아웃 설정
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  // URL 변환 로직:
  // 1. 브라우저인 경우: /api/ -> /api-proxy/ (Vercel Proxy 활성화)
  // 2. 서버인 경우: /api/ 그대로 유지 (백엔드 직접 호출)
  const targetUrl = (isBrowser && url.startsWith('/api/'))
    ? url.replace('/api/', '/api-proxy/') 
    : url;

  try {
    const response = await fetch(`${API_BASE_URL}${targetUrl}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    if (response.status === 401 || response.status === 403) {
      console.error(`[fetchWithAuth] Auth Error (${response.status}) for ${url}`);
    }

    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

export interface MemoInsight {
  ocrText: string;
  summary: string;
  keywords: string[];
  analyzedAt: string;
}

export interface MemoResponse {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  groupId?: string;
  tags: string[];
  insight?: MemoInsight;
  createdAt: string;
  updatedAt: string;
}

export const memoApi = {
  async getAll(session: Session | null): Promise<MemoResponse[]> {
    const response = await fetchWithAuth('/api/memos', {}, session);
    if (!response.ok) throw new Error('Failed to fetch memos');
    return response.json();
  },

  async getById(id: string, session: Session | null): Promise<MemoResponse> {
    const response = await fetchWithAuth(`/api/memos/${id}`, {}, session);
    if (!response.ok) throw new Error('Failed to fetch memo');
    return response.json();
  },

  async create(data: { title: string; content: string; imageFile?: File; groupId?: string; tags?: string[] }, session: Session | null): Promise<MemoResponse> {
    const formData = new FormData();
    
    const memoData = {
      title: data.title,
      content: data.content,
      groupId: data.groupId,
      tags: data.tags
    };
    formData.append('memo', new Blob([JSON.stringify(memoData)], { type: 'application/json' }));

    if (data.imageFile) {
      formData.append('image', data.imageFile);
    }

    const headers: Record<string, string> = {};
    if (session?.user?.accessToken) {
      headers['Authorization'] = `Bearer ${session.user.accessToken}`;
    }

    // create에서도 동일한 Proxy 로직 적용
    const path = isBrowser ? '/api-proxy/memos' : '/api/memos';
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) throw new Error('Failed to create memo');
    return response.json();
  },

  async delete(id: string, session: Session | null): Promise<void> {
    const response = await fetchWithAuth(`/api/memos/${id}`, {
      method: 'DELETE',
    }, session);
    if (!response.ok) throw new Error('Failed to delete memo');
  },

  async share(id: string, friendIds: string[], session: Session | null): Promise<void> {
    const response = await fetchWithAuth(`/api/memos/${id}/share`, {
      method: 'POST',
      body: JSON.stringify({ friendIds }),
    }, session);
    if (!response.ok) throw new Error('Failed to share memo');
  },

  async getSharedMemos(session: Session | null): Promise<MemoResponse[]> {
    const response = await fetchWithAuth('/api/memos/shared', {}, session);
    if (!response.ok) throw new Error('Failed to fetch shared memos');
    return response.json();
  },

  async updateTags(id: string, tags: string[], session: Session | null): Promise<MemoResponse> {
    const response = await fetchWithAuth(`/api/memos/${id}/tags`, {
      method: 'PUT',
      body: JSON.stringify({ tags }),
    }, session);
    if (!response.ok) throw new Error('Failed to update tags');
    return response.json();
  },

  async getInsight(id: string, session: Session | null): Promise<MemoInsight | null> {
    const response = await fetchWithAuth(`/api/memos/${id}/insight`, {}, session);
    if (response.status === 404 || response.status === 204) return null;
    
    const text = await response.text();
    if (!text || text.trim() === '') return null;
    
    if (!response.ok) throw new Error('Failed to fetch memo insight');
    return JSON.parse(text);
  },

  async analyze(id: string, session: Session | null): Promise<MemoInsight> {
    const response = await fetchWithAuth(`/api/memos/${id}/analyze`, {
      method: 'POST',
    }, session);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'AI 분석에 실패했습니다.');
    }
    return response.json();
  }
};
