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
  /** 지금 친구라 보낼 수 있는지. 친구를 끊어도 대화는 목록에 남는다 (옛 백엔드는 주지 않음) */
  canSend?: boolean;
}

export const MESSAGE_MAX_LENGTH = 2000;

/** 공백과 보이지 않는 문자(폭 없는 공백, 방향 표시, 단어 결합자, BOM 등)만 있는지. 백엔드 MessageService.BLANK 와 같은 범위 */
const BLANK = /^[\s\p{Z}\u200B-\u200F\u2028-\u202F\u2060-\u2064\uFEFF]*$/u;
export const isBlankMessage = (value: string) => BLANK.test(value);

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

  /** 대화 지우기: 지금까지의 메시지를 내 쪽에서만 안 보이게 한다 (상대에게는 남는다) */
  async deleteConversation(friendId: string, session: Session | null): Promise<void> {
    await axiosInstance.delete(`/api/messages/${encodeURIComponent(friendId)}`, {
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
