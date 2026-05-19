import { Session } from 'next-auth';
import { fetchWithAuth } from './memo-api';

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
    taggedMemoIds?: string[]; // 추가
  }, session: Session | null): Promise<ScheduleResponse> {
    const response = await fetchWithAuth('/api/schedules', {
      method: 'POST',
      body: JSON.stringify(data),
    }, session);

    if (!response.ok) throw new Error('Failed to create schedule');
    return response.json();
  },

  async delete(id: string, session: Session | null): Promise<void> {
    const response = await fetchWithAuth(`/api/schedules/${id}`, {
      method: 'DELETE',
    }, session);
    if (!response.ok) throw new Error('Failed to delete schedule');
  }
};
