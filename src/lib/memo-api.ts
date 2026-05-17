import { Session } from 'next-auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export async function fetchWithAuth(url: string, options: RequestInit = {}, session: Session | null) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (session?.user?.accessToken) {
    console.log(`[fetchWithAuth] Token found for ${url}`);
    headers['Authorization'] = `Bearer ${session.user.accessToken}`;
  } else {
    console.warn(`[fetchWithAuth] No token found for ${url}. Current session:`, !!session);
  }

  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers,
  });

  if (response.status === 401 || response.status === 403) {
    console.error(`[fetchWithAuth] Auth Error (${response.status}) for ${url}`);
  }

  return response;
}

export interface MemoResponse {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  groupId?: string;
  createdAt: string;
  updatedAt: string;
}

export const memoApi = {
  async getAll(session: Session | null): Promise<MemoResponse[]> {
    const response = await fetchWithAuth('/api/memos', {}, session);
    if (!response.ok) throw new Error('Failed to fetch memos');
    return response.json();
  },

  async create(data: { title: string; content: string; imageFile?: File; groupId?: string }, session: Session | null): Promise<MemoResponse> {
    const formData = new FormData();
    
    // JSON 데이터를 Blob으로 만들어 'memo' 파트에 넣음
    const memoData = {
      title: data.title,
      content: data.content,
      groupId: data.groupId
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

    const response = await fetch(`${API_BASE_URL}/api/memos`, {
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
  }
};
