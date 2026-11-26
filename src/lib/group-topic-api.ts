import { Session } from 'next-auth';
import { axiosInstance, getAuthHeaders } from './axios';
import type { 
  TopicResponse, 
  TopicCommentResponse, 
  TopicDetailResponse, 
  TopicInsightResponse 
} from '@/types/topic';

/** 백엔드가 추가로 내려줄 수 있는 필드(계약 5·6절). 없으면 화면에서 생략한다. */
export type TopicInsightView = TopicInsightResponse & {
  keywords?: string[];
  stale?: boolean;
};

export type TopicCommentView = TopicCommentResponse & {
  authorCustomId?: string | null;
};

export type TopicDetailView = Omit<TopicDetailResponse, 'comments' | 'insight'> & {
  topic: TopicResponse & { authorCustomId?: string | null };
  comments: TopicCommentView[];
  insight?: TopicInsightView | null;
};

export const groupTopicApi = {
  async getByGroup(groupId: string, session: Session | null): Promise<TopicResponse[]> {
    const response = await axiosInstance.get<TopicResponse[]>(`/api/groups/${groupId}/topics`, {
      headers: getAuthHeaders(session),
    });
    return response.data;
  },

  async create(groupId: string, data: { title: string; content: string; imageUrl?: string }, session: Session | null): Promise<TopicResponse> {
    const response = await axiosInstance.post<TopicResponse>(`/api/groups/${groupId}/topics`, data, {
      headers: getAuthHeaders(session),
    });
    return response.data;
  },

  async getById(topicId: string, session: Session | null): Promise<TopicDetailView> {
    const response = await axiosInstance.get<TopicDetailView>(`/api/topics/${topicId}`, {
      headers: getAuthHeaders(session),
    });
    return response.data;
  },

  async update(topicId: string, data: { title: string; content: string; imageUrl?: string }, session: Session | null): Promise<TopicResponse> {
    const response = await axiosInstance.put<TopicResponse>(`/api/topics/${topicId}`, data, {
      headers: getAuthHeaders(session),
    });
    return response.data;
  },

  async delete(topicId: string, session: Session | null): Promise<void> {
    await axiosInstance.delete(`/api/topics/${topicId}`, {
      headers: getAuthHeaders(session),
    });
  },

  /** 고정(PUT)·해제(DELETE). 방장 또는 작성자만, 아니면 403 */
  async setPinned(topicId: string, pinned: boolean, session: Session | null): Promise<TopicResponse> {
    const response = await axiosInstance.request<TopicResponse>({
      url: `/api/topics/${topicId}/pin`,
      method: pinned ? 'PUT' : 'DELETE',
      headers: getAuthHeaders(session),
    });
    return response.data;
  },

  async createComment(topicId: string, content: string, session: Session | null): Promise<TopicCommentResponse> {
    const response = await axiosInstance.post<TopicCommentResponse>(`/api/topics/${topicId}/comments`, { content }, {
      headers: getAuthHeaders(session),
    });
    return response.data;
  },

  async updateComment(commentId: string, content: string, session: Session | null): Promise<TopicCommentView> {
    const response = await axiosInstance.put<TopicCommentView>(`/api/topics/comments/${commentId}`, { content }, {
      headers: getAuthHeaders(session),
    });
    return response.data;
  },

  async deleteComment(commentId: string, session: Session | null): Promise<void> {
    await axiosInstance.delete(`/api/topics/comments/${commentId}`, {
      headers: getAuthHeaders(session),
    });
  },

  async analyze(topicId: string, session: Session | null): Promise<TopicInsightView> {
    const response = await axiosInstance.post<TopicInsightView>(`/api/topics/${topicId}/analyze`, {}, {
      timeout: 300000, // 로컬 LLM 분석은 1분을 넘길 수 있다 (nginx 도 300s)
      headers: getAuthHeaders(session),
    });
    return response.data;
  }
};
