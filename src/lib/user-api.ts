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
  /** 비밀번호로 로그인할 수 있는지 */
  hasPassword?: boolean;
  /** 카카오 로그인이 붙어 있는지 */
  kakaoLinked?: boolean;
  /** email 의 주인임을 메일로 확인했는지 */
  emailVerified?: boolean;
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

  /** 비밀번호 설정·변경. 이미 있으면 currentPassword 가 필요하고, 바꾸면 모든 기기에서 로그아웃됩니다. */
  async updatePassword(
    body: { currentPassword?: string; newPassword: string },
    session: Session | null
  ): Promise<void> {
    await axiosInstance.put('/api/users/me/password', body, {
      headers: getAuthHeaders(session),
    });
  },

  /** 이메일 등록·변경 요청. 인증 메일의 링크를 눌러야 바뀝니다. 비밀번호가 있는 계정은 currentPassword 가 필요합니다. */
  async requestEmailChange(
    body: { email: string; currentPassword?: string },
    session: Session | null
  ): Promise<void> {
    await axiosInstance.post('/api/users/me/email', body, {
      headers: getAuthHeaders(session),
    });
  },

  /** 카카오 연결 해제 (비밀번호와 인증된 이메일이 있어야 하고, 현재 비밀번호로 재인증합니다) */
  async unlinkKakao(currentPassword: string, session: Session | null): Promise<UserResponse> {
    const response = await axiosInstance.delete('/api/users/me/kakao', {
      headers: getAuthHeaders(session),
      data: { currentPassword },
    });
    return response.data;
  },

  /**
   * 카카오 연결 시작: 프론트 서버가 5분짜리 연결 쿠키를 심습니다.
   * 이어서 signIn('kakao') 를 부르면 로그인 대신 지금 계정에 카카오가 붙습니다.
   */
  async startKakaoLink(): Promise<void> {
    await axiosInstance.post('/api/auth/link-intent');
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
