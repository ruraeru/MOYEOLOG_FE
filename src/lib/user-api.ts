import { Session } from 'next-auth';
import { axiosInstance, getAuthHeaders } from './axios';

export interface UserResponse {
  id: string;
  customId: string;
  email: string | null;
  nickname: string;
  profileImage: string | null;
  bio: string | null;
  emailVisible: boolean;
  createdAt?: string;
}

/** PUT /api/users/me 에 보낼 값. 넣은 필드만 바뀝니다. */
export interface UserUpdate {
  nickname?: string;
  bio?: string;
  emailVisible?: boolean;
}

export interface LoginSession {
  id: string | number;
  createdAt: string;
  lastUsedAt: string | null;
  current: boolean;
}

export interface NotificationPreferences {
  friendRequest: boolean;
  groupInvite: boolean;
  memoShared: boolean;
  topicComment: boolean;
  scheduleParticipant: boolean;
  message: boolean;
}

export const userApi = {
  async getMe(session: Session | null): Promise<UserResponse> {
    const response = await axiosInstance.get('/api/users/me', {
      headers: getAuthHeaders(session),
    });
    return response.data;
  },

  /**
   * 프로필을 바꿉니다. `fields` 에 넣은 값만 보내므로, 다른 탭에서 바꾼 필드를 덮어쓰지 않습니다.
   */
  async updateMe(fields: UserUpdate, image: File | null, session: Session | null): Promise<UserResponse> {
    const formData = new FormData();
    const userUpdate: UserUpdate = {};
    if (fields.nickname !== undefined) userUpdate.nickname = fields.nickname;
    if (fields.bio !== undefined) userUpdate.bio = fields.bio;
    if (fields.emailVisible !== undefined) userUpdate.emailVisible = fields.emailVisible;

    formData.append('user', new Blob([JSON.stringify(userUpdate)], { type: 'application/json' }));
    if (image) {
      formData.append('image', image);
    }

    const response = await axiosInstance.put('/api/users/me', formData, {
      headers: {
        ...getAuthHeaders(session),
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async deleteProfileImage(session: Session | null): Promise<UserResponse> {
    const response = await axiosInstance.delete('/api/users/me/profile-image', {
      headers: getAuthHeaders(session),
    });
    return response.data;
  },

  /** 회원 탈퇴 */
  async deleteMe(session: Session | null): Promise<void> {
    await axiosInstance.delete('/api/users/me', {
      headers: getAuthHeaders(session),
    });
  },

  /**
   * 로그인 세션 목록. 지금 기기를 표시하려면 리프레시 토큰이 필요한데 브라우저에는 없으므로,
   * 프론트 서버의 /api/auth/sessions 가 세션 쿠키에서 꺼내 백엔드에 대신 보냅니다.
   */
  async getSessions(): Promise<LoginSession[]> {
    const response = await axiosInstance.get('/api/auth/sessions');
    return Array.isArray(response.data) ? response.data : [];
  },

  /** 모든 기기에서 로그아웃 (모든 리프레시 토큰 폐기) */
  async logoutAllSessions(session: Session | null): Promise<void> {
    await axiosInstance.delete('/api/users/me/sessions', {
      headers: getAuthHeaders(session),
    });
  },

  async getNotificationPreferences(session: Session | null): Promise<NotificationPreferences> {
    const response = await axiosInstance.get('/api/notifications/preferences', {
      headers: getAuthHeaders(session),
    });
    return response.data;
  },

  async updateNotificationPreferences(
    prefs: NotificationPreferences,
    session: Session | null
  ): Promise<NotificationPreferences> {
    const response = await axiosInstance.put('/api/notifications/preferences', prefs, {
      headers: getAuthHeaders(session),
    });
    return response.data;
  },
};
