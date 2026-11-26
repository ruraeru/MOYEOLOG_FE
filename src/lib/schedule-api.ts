import { Session } from 'next-auth';
import { axiosInstance, getAuthHeaders } from './axios';
import { type MemoResponse } from './memo-api';

export interface ScheduleResponse {
  id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  location?: string;
  /** 지도에서 고른 장소의 좌표. 직접 입력한 장소·예전 일정에는 없다. */
  latitude?: number | null;
  longitude?: number | null;
  authorId: string;
  authorNickname: string;
  groupId?: string;
  taggedMemos?: MemoResponse[];
  participants?: Array<{
    id: string;
    nickname: string;
    profileImage?: string;
  }>;
  createdAt: string;
  /** 내가 이 일정에 출발지를 적어야 하는데 아직 안 적었는지 (여럿이 만나고, 장소가 비었고, 끝나지 않은 일정) */
  departureNeeded?: boolean;
  /** 내가 만든 일정인데 아직 장소를 정하지 않았는지 (여럿이 만나고, 끝나지 않은 일정) */
  placeNeeded?: boolean;
}

/** 달력에서 붉게 표시할 까닭. 없으면 null */
export function scheduleAlert(s: Pick<ScheduleResponse, 'departureNeeded' | 'placeNeeded'>): string | null {
  if (s.departureNeeded && s.placeNeeded) return '출발지·장소 미정';
  if (s.departureNeeded) return '출발지 미입력';
  if (s.placeNeeded) return '장소 미정';
  return null;
}

export const scheduleApi = {
  async getAll(session: Session | null): Promise<ScheduleResponse[]> {
    const response = await axiosInstance.get<ScheduleResponse[]>('/api/schedules', {
      headers: getAuthHeaders(session),
    });
    return response.data;
  },

  async create(data: { 
    title: string; 
    description?: string; 
    startTime: string; 
    endTime: string; 
    location?: string; 
    latitude?: number | null;
    longitude?: number | null;
    groupId?: string;
    taggedMemoIds?: string[];
    participantIds?: string[];
  }, session: Session | null): Promise<ScheduleResponse> {
    const response = await axiosInstance.post<ScheduleResponse>('/api/schedules', data, {
      headers: getAuthHeaders(session),
    });
    return response.data;
  },

  async update(id: string, data: { 
    title: string; 
    description?: string; 
    startTime: string; 
    endTime: string; 
    location?: string; 
    latitude?: number | null;
    longitude?: number | null;
    groupId?: string;
    taggedMemoIds?: string[];
    participantIds?: string[];
  }, session: Session | null): Promise<ScheduleResponse> {
    const response = await axiosInstance.put<ScheduleResponse>(`/api/schedules/${id}`, data, {
      headers: getAuthHeaders(session),
    });
    return response.data;
  },

  async delete(id: string, session: Session | null): Promise<void> {
    await axiosInstance.delete(`/api/schedules/${id}`, {
      headers: getAuthHeaders(session),
    });
  }
};
