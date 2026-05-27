import { Session } from 'next-auth';
import { fetchWithAuth } from './memo-api';

export interface UserResponse {
  id: string;
  customId: string;
  email: string;
  nickname: string;
  profileImage: string;
  bio: string;
}

export const userApi = {
  async getMe(session: Session | null): Promise<UserResponse> {
    const response = await fetchWithAuth('/api/users/me', {}, session);
    if (!response.ok) throw new Error('Failed to fetch user info');
    return response.json();
  },

  async updateMe(data: { nickname?: string; bio?: string; image?: File }, session: Session | null): Promise<UserResponse> {
    const formData = new FormData();
    
    const userUpdate = {
      nickname: data.nickname,
      bio: data.bio
    };
    
    formData.append('user', new Blob([JSON.stringify(userUpdate)], { type: 'application/json' }));
    
    if (data.image) {
      formData.append('image', data.image);
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    const response = await fetch(`${apiUrl}/api/users/me`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${session?.user?.accessToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || '프로필 수정에 실패했습니다.');
    }
    
    return response.json();
  }
};
