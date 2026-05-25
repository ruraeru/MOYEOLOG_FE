import { Session } from 'next-auth';
import { fetchWithAuth } from './memo-api';

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
    const response = await fetchWithAuth('/api/friends', {}, session);
    if (!response.ok) throw new Error('Failed to fetch friends');
    return response.json();
  },

  async getRequests(session: Session | null): Promise<FriendResponse[]> {
    const response = await fetchWithAuth('/api/friends/requests', {}, session);
    if (!response.ok) throw new Error('Failed to fetch friend requests');
    return response.json();
  },

  async sendRequest(customId: string, session: Session | null): Promise<void> {
    const response = await fetchWithAuth('/api/friends/request', {
      method: 'POST',
      body: JSON.stringify({ customId }),
    }, session);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to send friend request');
    }
  },

  async acceptRequest(requestId: string, session: Session | null): Promise<void> {
    const response = await fetchWithAuth(`/api/friends/accept/${requestId}`, {
      method: 'PUT',
    }, session);
    if (!response.ok) throw new Error('Failed to accept friend request');
  },

  async deleteFriendship(id: string, session: Session | null): Promise<void> {
    const response = await fetchWithAuth(`/api/friends/${id}`, {
      method: 'DELETE',
    }, session);
    if (!response.ok) throw new Error('Failed to delete friendship');
  }
};
