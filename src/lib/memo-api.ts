import { Session } from 'next-auth';

// 브라우저에서는 상대 경로를 사용하여 Vercel Proxy(Rewrite)를 거치게 하고, 
// 서버 사이드(Next.js)에서만 절대 주소를 사용하도록 설정합니다.
const API_BASE_URL = typeof window === 'undefined' 
  ? (process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://moyeolog.kro.kr:8080')
  : '';

export async function fetchWithAuth(url: string, options: RequestInit = {}, session: Session | null) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (session?.user?.accessToken) {
    headers['Authorization'] = `Bearer ${session.user.accessToken}`;
  }

  // 10초 타임아웃 설정
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  // /api/로 시작하는 요청을 /api-proxy/로 변환 (Vercel Rewrite 매칭)
  const targetUrl = url.startsWith('/api/') 
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

export interface MemoResponse {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  groupId?: string;
  tags: string[];
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

    // FormData 전송 시에는 JSON Content-Type이 들어가면 안 되므로 fetchWithAuth 대신 직접 fetch 호출
    // 단, 주소는 Proxy를 타도록 구성
    const headers: Record<string, string> = {};
    if (session?.user?.accessToken) {
      headers['Authorization'] = `Bearer ${session.user.accessToken}`;
    }

    const response = await fetch(`${API_BASE_URL}/api-proxy/memos`, {
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
  }
};
