import { Session } from 'next-auth';
import { fetchWithAuth, type MemoResponse } from './memo-api';

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
    const response = await fetchWithAuth('/api/schedules', {}, session);
    if (!response.ok) throw new Error('Failed to fetch schedules');
    return response.json();
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
    const response = await fetchWithAuth('/api/schedules', {
      method: 'POST',
      body: JSON.stringify(data),
    }, session);

    if (!response.ok) throw new Error('Failed to create schedule');
    return response.json();
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
    const response = await fetchWithAuth(`/api/schedules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }, session);

    if (!response.ok) throw new Error('Failed to update schedule');
    return response.json();
  },

  async delete(id: string, session: Session | null): Promise<void> {
    const response = await fetchWithAuth(`/api/schedules/${id}`, {
      method: 'DELETE',
    }, session);
    if (!response.ok) throw new Error('Failed to delete schedule');
  }
};
