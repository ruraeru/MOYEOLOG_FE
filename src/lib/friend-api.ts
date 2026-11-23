import { Session } from 'next-auth';
import { axiosInstance, getAuthHeaders } from './axios';

export interface FriendResponse {
  id: string; // 관계(요청) ID
  userId: string; // 상대방 유저 ID
  customId: string;
  nickname: string;
  email?: string | null;
  profileImage?: string;
  status: 'PENDING' | 'ACCEPTED';
}

export type FriendStatus = 'NONE' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'FRIEND' | 'SELF';

/** 다른 사용자 프로필 (GET /api/users/{id}, GET /api/users/by-custom-id/{customId}) */
export interface UserProfileResponse {
  id: string;
  customId: string;
  nickname: string;
  profileImage?: string | null;
  bio?: string | null;
  friendStatus: FriendStatus;
  mutualGroups: { id: string; name: string }[];
}

/** 백엔드가 주는 `/uploads/...` 경로를 이미지 주소로 바꿉니다. */
export const resolveImageUrl = (src?: string | null): string | undefined => {
  if (!src) return undefined;
  if (src.startsWith('/uploads/')) {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    return `${apiUrl}${src}`;
  }
  return src;
};

export const friendApi = {
  async getFriends(session: Session | null): Promise<FriendResponse[]> {
    const response = await axiosInstance.get<FriendResponse[]>('/api/friends', {
      headers: getAuthHeaders(session),
    });
    return response.data;
  },

  /** 내가 받은 대기 중인 요청 */
  async getRequests(session: Session | null): Promise<FriendResponse[]> {
    const response = await axiosInstance.get<FriendResponse[]>('/api/friends/requests', {
      headers: getAuthHeaders(session),
    });
    return response.data;
  },

  /** 내가 보낸 대기 중인 요청. 취소는 deleteFriendship(요청 ID) */
  async getSentRequests(session: Session | null): Promise<FriendResponse[]> {
    const response = await axiosInstance.get<FriendResponse[]>('/api/friends/requests/sent', {
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

  /** 친구 끊기·받은 요청 거절·보낸 요청 취소 */
  async deleteFriendship(id: string, session: Session | null): Promise<void> {
    await axiosInstance.delete(`/api/friends/${id}`, {
      headers: getAuthHeaders(session),
    });
  },

  async getUserProfile(userId: string, session: Session | null): Promise<UserProfileResponse> {
    const response = await axiosInstance.get<UserProfileResponse>(`/api/users/${encodeURIComponent(userId)}`, {
      headers: getAuthHeaders(session),
    });
    return response.data;
  },

  async getUserByCustomId(customId: string, session: Session | null): Promise<UserProfileResponse> {
    const response = await axiosInstance.get<UserProfileResponse>(
      `/api/users/by-custom-id/${encodeURIComponent(customId)}`,
      { headers: getAuthHeaders(session) },
    );
    return response.data;
  },
};
