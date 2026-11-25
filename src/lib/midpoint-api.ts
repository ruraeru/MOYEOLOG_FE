import { Session } from 'next-auth';
import { axiosInstance, getAuthHeaders } from './axios';

/** 다른 사람의 출발지는 이름만 온다 (좌표 없음) */
export interface MidpointEntry {
  userId: string;
  nickname: string;
  profileImage?: string | null;
  name: string;
  mine: boolean;
}

export interface MidpointPlace {
  name: string;
  latitude: number;
  longitude: number;
}

export interface MidpointResponse {
  departures: MidpointEntry[];
  /** 내가 이 일정에 적은 출발지 */
  myDeparture: MidpointPlace | null;
  /** 내가 다른 일정에 마지막으로 적은 출발지 */
  lastDeparture: MidpointPlace | null;
  /** 출발지들의 가운데 좌표. 두 명 이상 적었을 때만 온다 */
  center: { latitude: number; longitude: number } | null;
  enteredCount: number;
  expectedCount: number;
  /** 내가 장소를 정할 수 있는지 (일정을 만든 사람) */
  canConfirm: boolean;
  location: string | null;
}

export const midpointApi = {
  async get(scheduleId: string, session: Session | null): Promise<MidpointResponse> {
    const response = await axiosInstance.get<MidpointResponse>(`/api/schedules/${scheduleId}/midpoint`, {
      headers: getAuthHeaders(session),
    });
    return response.data;
  },

  async saveDeparture(scheduleId: string, place: MidpointPlace, session: Session | null): Promise<MidpointResponse> {
    const response = await axiosInstance.put<MidpointResponse>(`/api/schedules/${scheduleId}/midpoint/departure`, place, {
      headers: getAuthHeaders(session),
    });
    return response.data;
  },

  async removeDeparture(scheduleId: string, session: Session | null): Promise<MidpointResponse> {
    const response = await axiosInstance.delete<MidpointResponse>(`/api/schedules/${scheduleId}/midpoint/departure`, {
      headers: getAuthHeaders(session),
    });
    return response.data;
  },

  /** 아직 출발지를 적지 않은 사람에게 알림을 보낸다. 보낸 사람 수를 돌려준다 */
  async requestDepartures(scheduleId: string, session: Session | null): Promise<number> {
    const response = await axiosInstance.post<{ sent: number }>(`/api/schedules/${scheduleId}/midpoint/request`, null, {
      headers: getAuthHeaders(session),
    });
    return response.data.sent;
  },

  /** 고른 장소를 일정 장소로 저장한다 */
  async confirm(scheduleId: string, name: string, session: Session | null): Promise<MidpointResponse> {
    const response = await axiosInstance.post<MidpointResponse>(`/api/schedules/${scheduleId}/midpoint/confirm`, { name }, {
      headers: getAuthHeaders(session),
    });
    return response.data;
  },
};
