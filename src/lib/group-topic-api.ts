import { Session } from 'next-auth';
import { fetchWithAuth } from './memo-api';
import type { 
  TopicResponse, 
  TopicCommentResponse, 
  TopicDetailResponse, 
  TopicInsightResponse 
} from '@/types/topic';

export const groupTopicApi = {
  async getByGroup(groupId: string, session: Session | null): Promise<TopicResponse[]> {
    const response = await fetchWithAuth(`/api/groups/${groupId}/topics`, {}, session);
    if (!response.ok) throw new Error('Failed to fetch group topics');
    return response.json();
  },

  async create(groupId: string, data: { title: string; content: string; imageUrl?: string }, session: Session | null): Promise<TopicResponse> {
    const response = await fetchWithAuth(`/api/groups/${groupId}/topics`, {
      method: 'POST',
      body: JSON.stringify(data),
    }, session);
    if (!response.ok) throw new Error('Failed to create topic');
    return response.json();
  },

  async getById(topicId: string, session: Session | null): Promise<TopicDetailResponse> {
    const response = await fetchWithAuth(`/api/topics/${topicId}`, {}, session);
    if (!response.ok) throw new Error('Failed to fetch topic details');
    return response.json();
  },

  async update(topicId: string, data: { title: string; content: string; imageUrl?: string }, session: Session | null): Promise<TopicResponse> {
    const response = await fetchWithAuth(`/api/topics/${topicId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }, session);
    if (!response.ok) throw new Error('Failed to update topic');
    return response.json();
  },

  async delete(topicId: string, session: Session | null): Promise<void> {
    const response = await fetchWithAuth(`/api/topics/${topicId}`, {
      method: 'DELETE',
    }, session);
    if (!response.ok) throw new Error('Failed to delete topic');
  },

  async createComment(topicId: string, content: string, session: Session | null): Promise<TopicCommentResponse> {
    const response = await fetchWithAuth(`/api/topics/${topicId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }, session);
    if (!response.ok) throw new Error('Failed to create comment');
    return response.json();
  },

  async updateComment(commentId: string, content: string, session: Session | null): Promise<TopicCommentResponse> {
    const response = await fetchWithAuth(`/api/topics/comments/${commentId}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    }, session);
    if (!response.ok) throw new Error('Failed to update comment');
    return response.json();
  },

  async deleteComment(commentId: string, session: Session | null): Promise<void> {
    const response = await fetchWithAuth(`/api/topics/comments/${commentId}`, {
      method: 'DELETE',
    }, session);
    if (!response.ok) throw new Error('Failed to delete comment');
  },

  async analyze(topicId: string, session: Session | null): Promise<TopicInsightResponse> {
    const response = await fetchWithAuth(`/api/topics/${topicId}/analyze`, {
      method: 'POST',
    }, session);
    if (!response.ok) throw new Error('Failed to analyze topic');
    return response.json();
  }
};
