import { Session } from 'next-auth';
import { axiosInstance, getAuthHeaders } from './axios';

export interface NoticeUser {
  id: string;
  nickname: string;
  profileImage: string | null;
}

export interface NoticeSummary {
  id: string;
  title: string;
  /** 내용 앞 100자(마크다운 기호 제거) */
  preview: string;
  author: NoticeUser;
  createdAt: string;
  updatedAt: string;
  pinnedAt: string | null;
  readCount: number;
  memberCount: number;
  /** 내가 읽었나 */
  read: boolean;
  hasPoll: boolean;
  pollClosed: boolean;
  myVoted: boolean;
  /** 방장 */
  canManage: boolean;
}

export interface NoticeDetail extends NoticeSummary {
  content: string;
  readers: NoticeUser[];
  notReaders: NoticeUser[];
  poll: null | {
    multiple: boolean;
    anonymous: boolean;
    closesAt: string | null;
    closed: boolean;
    /** 투표한 사람 수 */
    voterCount: number;
    /** 익명이면 voters 는 [] */
    options: { id: string; text: string; count: number; mine: boolean; voters: NoticeUser[] }[];
    /** 익명이면 [] */
    notVoted: NoticeUser[];
  };
}

export type NoticePoll = NonNullable<NoticeDetail['poll']>;

export interface NoticeCreateInput {
  title: string;
  content: string;
  /** 만들 때만 붙인다. closesAt 은 yyyy-MM-dd'T'HH:mm:ss(한국 시간, 오프셋 없음) */
  poll?: { options: string[]; multiple: boolean; anonymous: boolean; closesAt?: string | null };
}

const base = (groupId: string) => `/api/groups/${groupId}/notices`;

export const groupNoticeApi = {
  async list(groupId: string, session: Session | null): Promise<NoticeSummary[]> {
    const response = await axiosInstance.get<NoticeSummary[]>(base(groupId), {
      headers: getAuthHeaders(session),
    });
    return response.data;
  },

  /** 보는 사람을 읽음 처리한다 */
  async get(groupId: string, noticeId: string, session: Session | null): Promise<NoticeDetail> {
    const response = await axiosInstance.get<NoticeDetail>(`${base(groupId)}/${noticeId}`, {
      headers: getAuthHeaders(session),
    });
    return response.data;
  },

  /** 방장만 */
  async create(groupId: string, input: NoticeCreateInput, session: Session | null): Promise<NoticeDetail> {
    const response = await axiosInstance.post<NoticeDetail>(base(groupId), input, {
      headers: getAuthHeaders(session),
    });
    return response.data;
  },

  /** 방장만. 투표 내용은 바꾸지 못한다 */
  async update(
    groupId: string,
    noticeId: string,
    input: { title: string; content: string },
    session: Session | null,
  ): Promise<NoticeDetail> {
    const response = await axiosInstance.put<NoticeDetail>(`${base(groupId)}/${noticeId}`, input, {
      headers: getAuthHeaders(session),
    });
    return response.data;
  },

  /** 방장만 */
  async remove(groupId: string, noticeId: string, session: Session | null): Promise<void> {
    await axiosInstance.delete(`${base(groupId)}/${noticeId}`, {
      headers: getAuthHeaders(session),
    });
  },

  /** 방장만. 맨 위 고정/해제 */
  async setPinned(groupId: string, noticeId: string, pinned: boolean, session: Session | null): Promise<NoticeDetail> {
    const url = `${base(groupId)}/${noticeId}/pin`;
    const config = { headers: getAuthHeaders(session) };
    const response = pinned
      ? await axiosInstance.put<NoticeDetail>(url, null, config)
      : await axiosInstance.delete<NoticeDetail>(url, config);
    return response.data;
  },

  /** 내 선택을 통째로 바꾼다(빈 배열 = 취소). 단일 선택에 2개 이상이면 400, 닫혔으면 409 */
  async vote(groupId: string, noticeId: string, optionIds: string[], session: Session | null): Promise<NoticeDetail> {
    const response = await axiosInstance.put<NoticeDetail>(`${base(groupId)}/${noticeId}/poll/votes`, { optionIds }, {
      headers: getAuthHeaders(session),
    });
    return response.data;
  },

  /** 방장만 */
  async closePoll(groupId: string, noticeId: string, session: Session | null): Promise<NoticeDetail> {
    const response = await axiosInstance.post<NoticeDetail>(`${base(groupId)}/${noticeId}/poll/close`, null, {
      headers: getAuthHeaders(session),
    });
    return response.data;
  },

  /** 방장만. 아직 투표 안 한 멤버에게 알림 */
  async remindPoll(groupId: string, noticeId: string, session: Session | null): Promise<void> {
    await axiosInstance.post(`${base(groupId)}/${noticeId}/poll/remind`, null, {
      headers: getAuthHeaders(session),
    });
  },
};
