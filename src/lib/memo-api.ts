import { Session } from 'next-auth';
import { axiosInstance, getAuthHeaders } from './axios';

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
    const response = await axiosInstance.get<MemoResponse[]>('/api/memos', {
      headers: getAuthHeaders(session),
    });
    return response.data.map(processMemoResponse);
  },

  async getById(id: string, session: Session | null): Promise<MemoResponse> {
    const response = await axiosInstance.get<MemoResponse>(`/api/memos/${id}`, {
      headers: getAuthHeaders(session),
    });
    return processMemoResponse(response.data);
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

    const response = await axiosInstance.post<MemoResponse>('/api/memos', formData, {
      headers: {
        ...getAuthHeaders(session),
        'Content-Type': 'multipart/form-data',
      },
    });

    return processMemoResponse(response.data);
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

    const response = await axiosInstance.put<MemoResponse>(`/api/memos/${id}`, formData, {
      headers: {
        ...getAuthHeaders(session),
        'Content-Type': 'multipart/form-data',
      },
    });

    return processMemoResponse(response.data);
  },

  async delete(id: string, session: Session | null): Promise<void> {
    await axiosInstance.delete(`/api/memos/${id}`, {
      headers: getAuthHeaders(session),
    });
  },

  async toggleFavorite(id: string, session: Session | null): Promise<MemoResponse> {
    const response = await axiosInstance.put<MemoResponse>(`/api/memos/${id}/favorite`, {}, {
      headers: getAuthHeaders(session),
    });
    return processMemoResponse(response.data);
  },

  async share(id: string, friendIds: string[], session: Session | null): Promise<void> {
    await axiosInstance.post(`/api/memos/${id}/share`, { friendIds }, {
      headers: getAuthHeaders(session),
    });
  },

  async getSharedMemos(session: Session | null): Promise<MemoResponse[]> {
    const response = await axiosInstance.get<MemoResponse[]>('/api/memos/shared', {
      headers: getAuthHeaders(session),
    });
    return response.data.map(processMemoResponse);
  },

  async updateTags(id: string, tags: string[], session: Session | null): Promise<MemoResponse> {
    const response = await axiosInstance.put<MemoResponse>(`/api/memos/${id}/tags`, { tags }, {
      headers: getAuthHeaders(session),
    });
    return processMemoResponse(response.data);
  },

  async getInsight(id: string, session: Session | null): Promise<MemoInsight | null> {
    try {
      const response = await axiosInstance.get<MemoInsight>(`/api/memos/${id}/insight`, {
        headers: getAuthHeaders(session),
      });
      if (response.status === 204) return null;
      return response.data;
    } catch (error) {
      const err = error as { response?: { status: number } };
      if (err.response?.status === 404) return null;
      throw error;
    }
  },

  async analyze(id: string, session: Session | null): Promise<MemoInsight> {
    const response = await axiosInstance.post<MemoInsight>(`/api/memos/${id}/analyze`, {}, {
      headers: getAuthHeaders(session),
    });
    return response.data;
  }
};