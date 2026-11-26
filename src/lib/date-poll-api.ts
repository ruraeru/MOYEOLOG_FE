import { Session } from 'next-auth';
import { axiosInstance, getAuthHeaders } from './axios';

export interface PollUser {
  id: string;
  nickname: string;
  profileImage: string | null;
}

export interface DatePollSummary {
  id: string;
  title: string;
  /** yyyy-MM-dd */
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'CONFIRMED';
  respondedCount: number;
  memberCount: number;
  myResponded: boolean;
  confirmedDate: string | null;
  scheduleId: string | null;
  createdAt: string;
}

export interface DatePollAi {
  /** 2~4문장 한국어 */
  summary: string;
  /** 1~3개, 후보 기간 안의 날짜만 */
  recommended: { date: string; reason: string }[];
  generatedAt: string;
  /** 추천 뒤에 누가 선택을 바꿨으면 true */
  stale: boolean;
}

export interface DatePollDetail extends DatePollSummary {
  creator: PollUser;
  myDates: string[];
  /** 후보 기간의 모든 날짜가 순서대로 들어 있다(0명인 날 포함) */
  dates: { date: string; count: number; voters: PollUser[] }[];
  /** 코드가 계산한 순위: 인원 많은 순, 같으면 이른 날짜. 1명 이상인 날만, 최대 3개 */
  best: string[];
  responded: PollUser[];
  notResponded: PollUser[];
  ai: DatePollAi | null;
}

const base = (groupId: string) => `/api/groups/${groupId}/date-polls`;

export const datePollApi = {
  async list(groupId: string, session: Session | null): Promise<DatePollSummary[]> {
    const response = await axiosInstance.get<DatePollSummary[]>(base(groupId), {
      headers: getAuthHeaders(session),
    });
    return response.data;
  },

  /** 모임장만. 날짜는 yyyy-MM-dd */
  async create(
    groupId: string,
    body: { title: string; startDate: string; endDate: string },
    session: Session | null,
  ): Promise<DatePollDetail> {
    const response = await axiosInstance.post<DatePollDetail>(base(groupId), body, {
      headers: getAuthHeaders(session),
    });
    return response.data;
  },

  async get(groupId: string, pollId: string, session: Session | null): Promise<DatePollDetail> {
    const response = await axiosInstance.get<DatePollDetail>(`${base(groupId)}/${pollId}`, {
      headers: getAuthHeaders(session),
    });
    return response.data;
  },

  /** 내 선택을 통째로 바꾼다. 빈 배열 = '가능한 날 없음' 으로 응답 */
  async vote(groupId: string, pollId: string, dates: string[], session: Session | null): Promise<DatePollDetail> {
    const response = await axiosInstance.put<DatePollDetail>(`${base(groupId)}/${pollId}/votes`, { dates }, {
      headers: getAuthHeaders(session),
    });
    return response.data;
  },

  /** AI 추천. 같은 조율에 추천이 진행 중이면 409, LLM 실패면 502/503 */
  async recommend(groupId: string, pollId: string, session: Session | null): Promise<DatePollDetail> {
    const response = await axiosInstance.post<DatePollDetail>(`${base(groupId)}/${pollId}/recommend`, {}, {
      headers: getAuthHeaders(session),
      timeout: 300000, // 로컬 LLM 은 1분을 넘길 수 있다 (nginx 도 300s)
    });
    return response.data;
  },

  /** 모임장만. 아직 응답 안 한 멤버에게 알림 */
  async remind(groupId: string, pollId: string, session: Session | null): Promise<void> {
    await axiosInstance.post(`${base(groupId)}/${pollId}/remind`, null, {
      headers: getAuthHeaders(session),
    });
  },

  /** 모임장만. 그 날로 모임 일정을 만든다. 시각은 HH:mm */
  async confirm(
    groupId: string,
    pollId: string,
    body: { date: string; startTime: string; endTime?: string },
    session: Session | null,
  ): Promise<DatePollDetail> {
    const response = await axiosInstance.post<DatePollDetail>(`${base(groupId)}/${pollId}/confirm`, body, {
      headers: getAuthHeaders(session),
    });
    return response.data;
  },

  /** 모임장만. 만들어진 일정은 지우지 않는다 */
  async remove(groupId: string, pollId: string, session: Session | null): Promise<void> {
    await axiosInstance.delete(`${base(groupId)}/${pollId}`, {
      headers: getAuthHeaders(session),
    });
  },
};
