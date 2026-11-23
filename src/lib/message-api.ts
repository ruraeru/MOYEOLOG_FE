import { Session } from 'next-auth';
import { axiosInstance, getAuthHeaders } from './axios';

export interface MessageResponse {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  read: boolean;
}

export interface ConversationResponse {
  friend: { id: string; nickname: string; profileImage?: string | null; customId: string };
  lastMessage: { id: string; content: string; senderId: string; createdAt: string } | null;
  unreadCount: number;
}

export const MESSAGE_MAX_LENGTH = 2000;

export const messageApi = {
  async getConversations(session: Session | null): Promise<ConversationResponse[]> {
    const response = await axiosInstance.get<ConversationResponse[]>('/api/messages/conversations', {
      headers: getAuthHeaders(session),
    });
    return response.data;
  },

  /** 오래된 순(마지막이 최신). before 를 주면 그 시각 이전 메시지 */
  async getMessages(
    friendId: string,
    session: Session | null,
    opts: { before?: string; size?: number } = {},
  ): Promise<MessageResponse[]> {
    const response = await axiosInstance.get<MessageResponse[]>(`/api/messages/${encodeURIComponent(friendId)}`, {
      headers: getAuthHeaders(session),
      params: { size: opts.size ?? 50, ...(opts.before ? { before: opts.before } : {}) },
    });
    return response.data;
  },

  async send(friendId: string, content: string, session: Session | null): Promise<MessageResponse> {
    const response = await axiosInstance.post<MessageResponse>(
      `/api/messages/${encodeURIComponent(friendId)}`,
      { content },
      { headers: getAuthHeaders(session) },
    );
    return response.data;
  },

  async markRead(friendId: string, session: Session | null): Promise<void> {
    await axiosInstance.put(`/api/messages/${encodeURIComponent(friendId)}/read`, {}, {
      headers: getAuthHeaders(session),
    });
  },

  async getUnreadCount(session: Session | null): Promise<number> {
    const response = await axiosInstance.get<{ count: number }>('/api/messages/unread-count', {
      headers: getAuthHeaders(session),
    });
    return response.data?.count ?? 0;
  },
};
