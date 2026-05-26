import { Session } from 'next-auth';
import { fetchWithAuth, type MemoResponse } from './memo-api';
import { type ScheduleResponse } from './schedule-api';

export interface GroupResponse {
  id: string;
  name: string;
  description: string;
  colorTheme: string;
  createdByNickname: string;
  members: Array<{
    id: string;
    nickname: string;
    profileImage?: string;
  }>;
  inviteCode: string;
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

export const groupApi = {
  async getAll(session: Session | null): Promise<GroupResponse[]> {
    const response = await fetchWithAuth('/api/groups', {}, session);
    if (!response.ok) throw new Error('Failed to fetch groups');
    return response.json();
  },

  async getById(id: string, session: Session | null): Promise<GroupResponse> {
    const response = await fetchWithAuth(`/api/groups/${id}`, {}, session);
    if (!response.ok) throw new Error('Failed to fetch group');
    return response.json();
  },

  async getGroupMemos(id: string, session: Session | null): Promise<MemoResponse[]> {
    const response = await fetchWithAuth(`/api/groups/${id}/memos`, {}, session);
    if (!response.ok) throw new Error('Failed to fetch group memos');
    return response.json();
  },

  async getGroupSchedules(id: string, session: Session | null): Promise<ScheduleResponse[]> {
    const response = await fetchWithAuth(`/api/groups/${id}/schedules`, {}, session);
    if (!response.ok) throw new Error('Failed to fetch group schedules');
    return response.json();
  },

  async create(data: { name: string; description: string; colorTheme: string }, session: Session | null): Promise<GroupResponse> {
    const response = await fetchWithAuth('/api/groups', {
      method: 'POST',
      body: JSON.stringify(data),
    }, session);

    if (!response.ok) throw new Error('Failed to create group');
    return response.json();
  },

  async inviteMembers(groupId: string, emails: string[], session: Session | null): Promise<void> {
    const response = await fetchWithAuth(`/api/groups/${groupId}/invitations`, {
      method: 'POST',
      body: JSON.stringify({ emails }),
    }, session);
    if (!response.ok) throw new Error('Failed to invite members');
  },

  async getMyInvitations(session: Session | null): Promise<GroupInvitationResponse[]> {
    const response = await fetchWithAuth('/api/groups/invitations', {}, session);
    if (!response.ok) throw new Error('Failed to fetch invitations');
    return response.json();
  },

  async acceptInvitation(invitationId: string, session: Session | null): Promise<void> {
    const response = await fetchWithAuth(`/api/groups/invitations/${invitationId}/accept`, {
      method: 'POST',
    }, session);
    if (!response.ok) throw new Error('Failed to accept invitation');
  },

  async rejectInvitation(invitationId: string, session: Session | null): Promise<void> {
    const response = await fetchWithAuth(`/api/groups/invitations/${invitationId}/reject`, {
      method: 'POST',
    }, session);
    if (!response.ok) throw new Error('Failed to reject invitation');
  },

  async joinByCode(code: string, session: Session | null): Promise<void> {
    const response = await fetchWithAuth(`/api/groups/join?code=${code}`, {
      method: 'POST',
    }, session);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || '가입에 실패했습니다. 코드를 확인해주세요.');
    }
  }
};
