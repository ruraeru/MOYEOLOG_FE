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
