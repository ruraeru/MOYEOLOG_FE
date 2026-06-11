import { Session } from 'next-auth';
import { axiosInstance, getAuthHeaders } from './axios';

export interface FriendResponse {
  id: string; // 관계 ID
  userId: string; // 상대방 유저 ID
  customId: string;
  nickname: string;
  email: string;
  profileImage?: string;
  status: 'PENDING' | 'ACCEPTED';
}

export const friendApi = {
  async getFriends(session: Session | null): Promise<FriendResponse[]> {
    const response = await axiosInstance.get<FriendResponse[]>('/api/friends', {
      headers: getAuthHeaders(session),
    });
    return response.data;
  },

  async getRequests(session: Session | null): Promise<FriendResponse[]> {
    const response = await axiosInstance.get<FriendResponse[]>('/api/friends/requests', {
      headers: getAuthHeaders(session),
    });
    return response.data;
  },

  async sendRequest(customId: string, session: Session | null): Promise<void> {
    await axiosInstance.post('/api/friends/request', { customId }, {
      headers: getAuthHeaders(session),
    });
  },

  async acceptRequest(requestId: string, session: Session | null): Promise<void> {
    await axiosInstance.put(`/api/friends/accept/${requestId}`, {}, {
      headers: getAuthHeaders(session),
    });
  },

  async deleteFriendship(id: string, session: Session | null): Promise<void> {
    await axiosInstance.delete(`/api/friends/${id}`, {
      headers: getAuthHeaders(session),
    });
  }
};
