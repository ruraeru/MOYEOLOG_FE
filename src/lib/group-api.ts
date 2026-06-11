import { Session } from 'next-auth';
import { axiosInstance, getAuthHeaders } from './axios';
import { type MemoResponse } from './memo-api';
import { type ScheduleResponse } from './schedule-api';

export interface GroupResponse {
  id: string;
  name: string;
  description: string;
  colorTheme: string;
  createdById: string;
  createdByNickname: string;
  members: Array<{
    id: string;
    nickname: string;
    profileImage?: string;
  }>;
  inviteCode: string;
  profileImage?: string;
  backgroundImage?: string;
  memberCount: number;
  createdAt: string;
}

export interface GroupInvitationResponse {
  id: string;
  groupId: string;
  groupName: string;
  inviterNickname: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  invitedAt: string;
}

export interface GroupActivityResponse {
  type: 'MEMO' | 'TOPIC' | 'SCHEDULE' | 'COMMENT';
  groupId: string;
  groupName: string;
  id: string;
  title: string;
  contentSnippet: string;
  authorNickname: string;
  authorProfileImage?: string;
  createdAt: string;
}

export const groupApi = {
  async getAll(session: Session | null): Promise<GroupResponse[]> {
    const response = await axiosInstance.get<GroupResponse[]>('/api/groups', {
      headers: getAuthHeaders(session),
    });
    return response.data;
  },

  async getById(id: string, session: Session | null): Promise<GroupResponse> {
    const response = await axiosInstance.get<GroupResponse>(`/api/groups/${id}`, {
      headers: getAuthHeaders(session),
    });
    return response.data;
  },

  async getGroupMemos(id: string, session: Session | null): Promise<MemoResponse[]> {
    const response = await axiosInstance.get<MemoResponse[]>(`/api/groups/${id}/memos`, {
      headers: getAuthHeaders(session),
    });
    return response.data;
  },

  async getGroupSchedules(id: string, session: Session | null): Promise<ScheduleResponse[]> {
    const response = await axiosInstance.get<ScheduleResponse[]>(`/api/groups/${id}/schedules`, {
      headers: getAuthHeaders(session),
    });
    return response.data;
  },

  async create(data: { name: string; description: string; colorTheme: string }, session: Session | null): Promise<GroupResponse> {
    const response = await axiosInstance.post<GroupResponse>('/api/groups', data, {
      headers: getAuthHeaders(session),
    });
    return response.data;
  },

  async update(id: string, data: { 
    name: string; 
    description: string; 
    colorTheme: string;
    image?: File;
    bgImage?: File;
  }, session: Session | null): Promise<GroupResponse> {
    const formData = new FormData();
    formData.append('group', new Blob([JSON.stringify({
      name: data.name,
      description: data.description,
      colorTheme: data.colorTheme
    })], { type: 'application/json' }));

    if (data.image) formData.append('image', data.image);
    if (data.bgImage) formData.append('bgImage', data.bgImage);

    const response = await axiosInstance.put<GroupResponse>(`/api/groups/${id}`, formData, {
      headers: {
        ...getAuthHeaders(session),
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  },

  async inviteMembers(groupId: string, emails: string[], session: Session | null): Promise<void> {
    await axiosInstance.post(`/api/groups/${groupId}/invitations`, { emails }, {
      headers: getAuthHeaders(session),
    });
  },

  async getMyInvitations(session: Session | null): Promise<GroupInvitationResponse[]> {
    const response = await axiosInstance.get<GroupInvitationResponse[]>('/api/groups/invitations', {
      headers: getAuthHeaders(session),
    });
    return response.data;
  },

  async acceptInvitation(invitationId: string, session: Session | null): Promise<void> {
    await axiosInstance.post(`/api/groups/invitations/${invitationId}/accept`, {}, {
      headers: getAuthHeaders(session),
    });
  },

  async rejectInvitation(invitationId: string, session: Session | null): Promise<void> {
    await axiosInstance.post(`/api/groups/invitations/${invitationId}/reject`, {}, {
      headers: getAuthHeaders(session),
    });
  },

  async joinByCode(code: string, session: Session | null): Promise<void> {
    try {
      await axiosInstance.post(`/api/groups/join?code=${code}`, {}, {
        headers: getAuthHeaders(session),
      });
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      const message = err.response?.data?.message || '가입에 실패했습니다. 코드를 확인해주세요.';
      throw new Error(message);
    }
  },

  async kickMember(groupId: string, memberId: string, session: Session | null): Promise<void> {
    try {
      await axiosInstance.delete(`/api/groups/${groupId}/members/${memberId}`, {
        headers: getAuthHeaders(session),
      });
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      const message = err.response?.data?.message || '멤버 내보내기에 실패했습니다.';
      throw new Error(message);
    }
  },

  async getActivities(session: Session | null): Promise<GroupActivityResponse[]> {
    const response = await axiosInstance.get<GroupActivityResponse[]>('/api/groups/activities', {
      headers: getAuthHeaders(session),
    });
    return response.data;
  }
};
