import { Session } from 'next-auth';
import { axiosInstance, getAuthHeaders } from './axios';

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
    const response = await axiosInstance.get('/api/users/me', {
      headers: getAuthHeaders(session),
    });
    return response.data;
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

    const response = await axiosInstance.put('/api/users/me', formData, {
      headers: {
        ...getAuthHeaders(session),
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  }
};
