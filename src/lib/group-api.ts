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
  /** 요청한 사용자의 역할 (계약 6절) */
  myRole?: 'OWNER' | 'MEMBER';
  members: Array<{
    id: string;
    customId?: string;
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

export interface GroupPreviewResponse {
  id: string;
  name: string;
  description?: string;
  colorTheme: string;
  profileImage?: string;
  memberCount: number;
  ownerNickname: string;
  alreadyMember: boolean;
  /** 강퇴되어 코드로 다시 들어올 수 없는 모임(방장 초대로만 해제). 없으면 false 로 본다. */
  blocked?: boolean;
}

/** HTTP 상태와 서버 본문을 함께 담는 오류. 화면이 상태별 안내를 고를 수 있게 한다. */
export class GroupApiError extends Error {
  status?: number;
  groupId?: string;
  constructor(message: string, status?: number, groupId?: string) {
    super(message);
    this.name = 'GroupApiError';
    this.status = status;
    this.groupId = groupId;
  }
}

function toGroupApiError(error: unknown, fallback: string): GroupApiError {
  const err = error as { response?: { status?: number; data?: { message?: unknown; groupId?: unknown } } };
  const data = err.response?.data;
  const message = typeof data?.message === 'string' && data.message.trim() ? data.message : fallback;
  const groupId = typeof data?.groupId === 'string' ? data.groupId : undefined;
  return new GroupApiError(message, err.response?.status, groupId);
}

/** 모임 이름 규칙(계약 6절): trim 후 코드 포인트 1~50자. 문제가 없으면 null. */
export const GROUP_NAME_MAX = 50;
export function validateGroupName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return '모임 이름을 입력해 주세요.';
  if ([...trimmed].length > GROUP_NAME_MAX) return `모임 이름은 ${GROUP_NAME_MAX}자까지 쓸 수 있어요.`;
  return null;
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
    const response = await axiosInstance.post<GroupResponse>('/api/groups', { ...data, name: data.name.trim() }, {
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
      name: data.name.trim(),
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

  async inviteMembers(groupId: string, userIds: string[], session: Session | null): Promise<void> {
    try {
      await axiosInstance.post(`/api/groups/${groupId}/invitations`, { userIds }, {
        headers: getAuthHeaders(session),
      });
    } catch (error) {
      throw toGroupApiError(error, '초대를 보내지 못했어요.');
    }
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

  /** 초대 코드로 모임 정보를 미리 본다. 없는 코드는 404 (GroupApiError.status). */
  async preview(code: string, session: Session | null): Promise<GroupPreviewResponse> {
    try {
      const response = await axiosInstance.get<GroupPreviewResponse>('/api/groups/preview', {
        params: { code },
        headers: getAuthHeaders(session),
      });
      return response.data;
    } catch (error) {
      throw toGroupApiError(error, '초대 코드를 확인하지 못했어요.');
    }
  },

  /** 초대 코드로 가입하고 모임 ID 를 돌려준다. 이미 멤버면 status 409 + groupId 를 담은 GroupApiError. */
  async joinByCode(code: string, session: Session | null): Promise<{ groupId?: string }> {
    try {
      const response = await axiosInstance.post<{ groupId?: string } | ''>('/api/groups/join', {}, {
        params: { code },
        headers: getAuthHeaders(session),
      });
      return typeof response.data === 'object' && response.data ? response.data : {};
    } catch (error) {
      throw toGroupApiError(error, '모임에 참여하지 못했어요. 코드를 확인해 주세요.');
    }
  },

  async leave(groupId: string, session: Session | null): Promise<void> {
    try {
      await axiosInstance.delete(`/api/groups/${groupId}/members/me`, {
        headers: getAuthHeaders(session),
      });
    } catch (error) {
      throw toGroupApiError(error, '모임에서 나가지 못했어요.');
    }
  },

  async remove(groupId: string, session: Session | null): Promise<void> {
    try {
      await axiosInstance.delete(`/api/groups/${groupId}`, {
        headers: getAuthHeaders(session),
      });
    } catch (error) {
      throw toGroupApiError(error, '모임을 삭제하지 못했어요.');
    }
  },

  async kickMember(groupId: string, memberId: string, session: Session | null): Promise<void> {
    try {
      await axiosInstance.delete(`/api/groups/${groupId}/members/${memberId}`, {
        headers: getAuthHeaders(session),
      });
    } catch (error) {
      throw toGroupApiError(error, '멤버를 내보내지 못했어요.');
    }
  },

  async getActivities(session: Session | null): Promise<GroupActivityResponse[]> {
    const response = await axiosInstance.get<GroupActivityResponse[]>('/api/groups/activities', {
      headers: getAuthHeaders(session),
    });
    return response.data;
  }
};
