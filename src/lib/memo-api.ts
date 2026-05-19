import { Session } from 'next-auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

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

  // /api/로 시작하는 요청을 /api-proxy/로 변환 (Rewrite 매칭을 위함)
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
    
    // JSON 데이터를 Blob으로 만들어 'memo' 파트에 넣음
    const memoData = {
      title: data.title,
      content: data.content,
      groupId: data.groupId,
      tags: data.tags // tags 추가
    };
    formData.append('memo', new Blob([JSON.stringify(memoData)], { type: 'application/json' }));

    // 이미지가 있으면 'image' 파트에 넣음
    if (data.imageFile) {
      formData.append('image', data.imageFile);
    }

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
