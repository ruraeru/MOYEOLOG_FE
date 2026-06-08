import { Session } from 'next-auth';

// 브라우저 환경에서는 Vercel Rewrites(Proxy)를 위해 상대 경로(/api-proxy/...)를 사용합니다.
// 서버 환경(SSR/Sync)에서는 백엔드 절대 주소를 직접 호출합니다.
const isBrowser = typeof window !== 'undefined';
const API_BASE_URL = isBrowser ? '' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080');

export interface MemoInsight {
  ocrText?: string;
  summary?: string;
  keywords: string[];
  analyzedAt: string;
}

export interface MemoResponse {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  authorId: string;
  authorNickname: string;
  authorProfileImage?: string;
  lastModifierId?: string;
  lastModifierNickname?: string;
  groupId?: string;
  tags: string[];
  taggedMemos?: { id: string; title: string }[];
  taggedSchedules?: { id: string; title: string }[];
  insight?: MemoInsight;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function fetchWithAuth(url: string, options: RequestInit = {}, session: Session | null) {
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };

  if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (session?.user?.accessToken) {
    headers['Authorization'] = `Bearer ${session.user.accessToken}`;
  }

  const path = isBrowser ? `/api-proxy${url.replace('/api', '')}` : url;
  const fullUrl = `${API_BASE_URL}${path}`;

  return fetch(fullUrl, {
    ...options,
    headers,
  });
}

/**
 * 메모 본문 내의 마크다운 멘션([@제목](/memo/id))을 최신 제목으로 치환합니다.
 */
function syncMentionTitles(content: string, taggedMemos?: {id:string, title:string}[], taggedSchedules?: {id:string, title:string}[]) {
  if (!content) return content;
  let updatedContent = content;
  
  taggedMemos?.forEach(m => {
    // 마크다운 형식 [@[^\\]]+](/memo/${m.id}) 를 찾아서 최신 제목으로 변경
    const regex = new RegExp(`\\[@[^\\]]+\\]\\(\\/memo\\/${m.id}\\)`, 'g');
    updatedContent = updatedContent.replace(regex, `[@${m.title}](/memo/${m.id})`);
  });
  
  taggedSchedules?.forEach(s => {
    // 마크다운 형식 [@[^\\]]+](/schedule/${s.id}) 를 찾아서 최신 제목으로 변경
    const regex = new RegExp(`\\[@[^\\]]+\\]\\(\\/schedule\\/${s.id}\\)`, 'g');
    updatedContent = updatedContent.replace(regex, `[@${s.title}](/schedule/${s.id})`);
  });
  
  return updatedContent;
}

/**
 * 백엔드 응답을 받아 본문을 파싱하여 멘션 제목을 최신화한 뒤 반환합니다.
 */
function processMemoResponse(memo: MemoResponse): MemoResponse {
  return {
    ...memo,
    content: syncMentionTitles(memo.content, memo.taggedMemos, memo.taggedSchedules)
  };
}

export const memoApi = {
  async getAll(session: Session | null): Promise<MemoResponse[]> {
    const response = await fetchWithAuth('/api/memos', {}, session);
    if (!response.ok) throw new Error('Failed to fetch memos');
    const data: MemoResponse[] = await response.json();
    return data.map(processMemoResponse);
  },

  async getById(id: string, session: Session | null): Promise<MemoResponse> {
    const response = await fetchWithAuth(`/api/memos/${id}`, {}, session);
    if (!response.ok) throw new Error('Failed to fetch memo detail');
    const data: MemoResponse = await response.json();
    return processMemoResponse(data);
  },

  async create(data: { title: string; content: string; imageFile?: File; groupId?: string; tags?: string[]; taggedMemoIds?: string[]; taggedScheduleIds?: string[] }, session: Session | null): Promise<MemoResponse> {
    const formData = new FormData();
    
    const memoData = {
      title: data.title,
      content: data.content,
      groupId: data.groupId,
      tags: data.tags,
      taggedMemoIds: data.taggedMemoIds,
      taggedScheduleIds: data.taggedScheduleIds
    };
    formData.append('memo', new Blob([JSON.stringify(memoData)], { type: 'application/json' }));

    if (data.imageFile) {
      formData.append('image', data.imageFile);
    }

    const headers: Record<string, string> = {};
    if (session?.user?.accessToken) {
      headers['Authorization'] = `Bearer ${session.user.accessToken}`;
    }

    const path = isBrowser ? '/api-proxy/memos' : '/api/memos';
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) throw new Error('Failed to create memo');
    const responseData: MemoResponse = await response.json();
    return processMemoResponse(responseData);
  },

  async update(id: string, data: { title: string; content: string; imageFile?: File; tags?: string[]; taggedMemoIds?: string[]; taggedScheduleIds?: string[] }, session: Session | null): Promise<MemoResponse> {
    const formData = new FormData();
    
    const memoData = {
      title: data.title,
      content: data.content,
      tags: data.tags,
      taggedMemoIds: data.taggedMemoIds,
      taggedScheduleIds: data.taggedScheduleIds
    };
    formData.append('memo', new Blob([JSON.stringify(memoData)], { type: 'application/json' }));

    if (data.imageFile) {
      formData.append('image', data.imageFile);
    }

    const headers: Record<string, string> = {};
    if (session?.user?.accessToken) {
      headers['Authorization'] = `Bearer ${session.user.accessToken}`;
    }

    const path = isBrowser ? `/api-proxy/memos/${id}` : `/api/memos/${id}`;
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'PUT',
      headers,
      body: formData,
    });

    if (!response.ok) throw new Error('Failed to update memo');
    const responseData: MemoResponse = await response.json();
    return processMemoResponse(responseData);
  },

  async delete(id: string, session: Session | null): Promise<void> {
    const response = await fetchWithAuth(`/api/memos/${id}`, {
      method: 'DELETE',
    }, session);
    if (!response.ok) throw new Error('Failed to delete memo');
  },

  async toggleFavorite(id: string, session: Session | null): Promise<MemoResponse> {
    const response = await fetchWithAuth(`/api/memos/${id}/favorite`, {
      method: 'PUT',
    }, session);
    if (!response.ok) throw new Error('Failed to toggle favorite');
    const data: MemoResponse = await response.json();
    return processMemoResponse(data);
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
    const data: MemoResponse[] = await response.json();
    return data.map(processMemoResponse);
  },

  async updateTags(id: string, tags: string[], session: Session | null): Promise<MemoResponse> {
    const response = await fetchWithAuth(`/api/memos/${id}/tags`, {
      method: 'PUT',
      body: JSON.stringify({ tags }),
    }, session);
    if (!response.ok) throw new Error('Failed to update tags');
    const data: MemoResponse = await response.json();
    return processMemoResponse(data);
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