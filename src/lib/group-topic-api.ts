import { Session } from 'next-auth';
import { axiosInstance, getAuthHeaders } from './axios';
import type { 
  TopicResponse, 
  TopicCommentResponse, 
  TopicDetailResponse, 
  TopicInsightResponse 
} from '@/types/topic';

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

  async getById(topicId: string, session: Session | null): Promise<TopicDetailResponse> {
    const response = await axiosInstance.get<TopicDetailResponse>(`/api/topics/${topicId}`, {
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

  async createComment(topicId: string, content: string, session: Session | null): Promise<TopicCommentResponse> {
    const response = await axiosInstance.post<TopicCommentResponse>(`/api/topics/${topicId}/comments`, { content }, {
      headers: getAuthHeaders(session),
    });
    return response.data;
  },

  async updateComment(commentId: string, content: string, session: Session | null): Promise<TopicCommentResponse> {
    const response = await axiosInstance.put<TopicCommentResponse>(`/api/topics/comments/${commentId}`, { content }, {
      headers: getAuthHeaders(session),
    });
    return response.data;
  },

  async deleteComment(commentId: string, session: Session | null): Promise<void> {
    await axiosInstance.delete(`/api/topics/comments/${commentId}`, {
      headers: getAuthHeaders(session),
    });
  },

  async analyze(topicId: string, session: Session | null): Promise<TopicInsightResponse> {
    const response = await axiosInstance.post<TopicInsightResponse>(`/api/topics/${topicId}/analyze`, {}, {
      headers: getAuthHeaders(session),
    });
    return response.data;
  }
};
