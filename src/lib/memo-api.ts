import { Session } from 'next-auth';
import { axiosInstance, getAuthHeaders } from './axios';

export interface MemoInsight {
  ocrText?: string;
  summary?: string;
  keywords: string[];
  analyzedAt?: string;
  /** 분석 뒤 메모가 바뀌었으면 true */
  stale?: boolean;
}

/** 요청한 사용자 기준 권한 (계약 4절) */
export interface MemoPermissions {
  edit: boolean;
  delete: boolean;
  share: boolean;
  tag: boolean;
  analyze: boolean;
  /** 내 고정·해제 (읽을 수 있는 누구나, 모든 메모. 본인에게만 보임) */
  pin: boolean;
  /** 모임 고정·해제 (모임 메모만, 방장·작성자. 멤버 모두에게 보임) */
  groupPin: boolean;
}

export interface MemoSharedUser {
  id: string;
  nickname: string;
  profileImage?: string | null;
  /** 이 사람이 메모를 고칠 수 있게 공유했는가 (기본 읽기 전용) */
  canEdit?: boolean;
}

export interface MemoResponse {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  authorId: string;
  authorNickname: string;
  authorProfileImage?: string;
  lastModifierId?: string;
  lastModifierNickname?: string;
  groupId?: string;
  tags: string[];
  taggedMemos?: { id: string; title: string }[];
  taggedSchedules?: { id: string; title: string }[];
  insight?: MemoInsight;
  isFavorite: boolean;
  /** 내 고정 시각(오프셋 없는 한국 시간, 보는 사람 기준). 고정 안 됐으면 null */
  pinnedAt?: string | null;
  /** 모임 고정 시각(모임 메모만, 멤버 모두 같은 값). 고정 안 됐으면 null */
  groupPinnedAt?: string | null;
  /** 작성자에게만 채워짐 */
  sharedWith?: MemoSharedUser[];
  /** 이 개인 메모를 공유한 모임 (작성자에게만 채워짐) */
  sharedGroupIds?: string[];
  version?: number;
  permissions?: MemoPermissions;
  createdAt: string;
  updatedAt: string;
}

/**
 * 서버가 permissions 를 주지 않는 경우(구버전 응답)를 위한 보수적 기본값.
 * 작성자: 모두 허용(모임 고정은 모임 메모만), 모임 메모 멤버: 수정·태그·내 고정만(방장 권한은 알 수 없어 끈다),
 * 그 밖(공유받은 개인 메모): 내 고정만 허용. 내 고정은 읽을 수 있으면 누구나.
 */
export function getMemoPermissions(memo: MemoResponse, userId?: string | null): MemoPermissions {
  if (memo.permissions) return memo.permissions;
  if (userId && memo.authorId === userId) {
    return { edit: true, delete: true, share: true, tag: true, analyze: true, pin: true, groupPin: !!memo.groupId };
  }
  if (memo.groupId) {
    return { edit: true, delete: false, share: false, tag: true, analyze: false, pin: true, groupPin: false };
  }
  return { edit: false, delete: false, share: false, tag: false, analyze: false, pin: true, groupPin: false };
}

function compareAt(a?: string | null, b?: string | null): number {
  if (a && b) return a < b ? 1 : a > b ? -1 : 0;
  return a ? -1 : b ? 1 : 0;
}

/** 정렬용(내 고정): 고정된 것을 먼저(고정 시각 최신순), 나머지는 순서를 그대로 둔다(안정 정렬). */
export function comparePinned(a: MemoResponse, b: MemoResponse): number {
  return compareAt(a.pinnedAt, b.pinnedAt);
}

/** 정렬용(모임 고정): comparePinned 와 같은 방식으로 groupPinnedAt 을 본다. */
export function compareGroupPinned(a: MemoResponse, b: MemoResponse): number {
  return compareAt(a.groupPinnedAt, b.groupPinnedAt);
}

/** 내가 다른 사람(친구·모임)에게 공유한 메모인가. 공유 목록은 작성자에게만 내려온다. */
export function isSharedByMe(memo: MemoResponse, userId?: string | null): boolean {
  return !!userId && memo.authorId === userId
    && ((memo.sharedWith?.length ?? 0) > 0 || (memo.sharedGroupIds?.length ?? 0) > 0);
}

/** 메모 본문의 [@제목](/memo|schedule/id) 링크에서 id 를 뽑는다. */
export function extractMentionIds(content: string, type: 'memo' | 'schedule'): string[] {
  const regex = type === 'memo'
    ? /\[@[^\]]+\]\(\/memo\/([a-zA-Z0-9-]+)\)/g
    : /\[@[^\]]+\]\(\/schedule\/([a-zA-Z0-9-]+)\)/g;
  return Array.from(new Set([...(content || '').matchAll(regex)].map(m => m[1])));
}

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const IMAGE_TOO_LARGE_MESSAGE = '파일이 너무 커요. 10MB 이하로 올려 주세요.';

/**
 * 메모 본문 내의 마크다운 멘션([@제목](/memo/id))을 최신 제목으로 치환합니다.
 */
function syncMentionTitles(content: string, taggedMemos?: {id:string, title:string}[], taggedSchedules?: {id:string, title:string}[]) {
  if (!content) return content;
  let updatedContent = content;

  taggedMemos?.forEach(m => {
    // 마크다운 형식 [@[^\\]]+](/memo/${m.id}) 를 찾아서 최신 제목으로 변경
    const regex = new RegExp(`\\[@[^\\]]+\\]\\(\\/memo\\/${m.id}\\)`, 'g');
    updatedContent = updatedContent.replace(regex, `[@${m.title}](/memo/${m.id})`);
  });

  taggedSchedules?.forEach(s => {
    // 마크다운 형식 [@[^\\]]+](/schedule/${s.id}) 를 찾아서 최신 제목으로 변경
    const regex = new RegExp(`\\[@[^\\]]+\\]\\(\\/schedule\\/${s.id}\\)`, 'g');
    updatedContent = updatedContent.replace(regex, `[@${s.title}](/schedule/${s.id})`);
  });

  return updatedContent;
}

/**
 * 백엔드 응답을 받아 본문을 파싱하여 멘션 제목을 최신화한 뒤 반환합니다.
 */
function processMemoResponse(memo: MemoResponse): MemoResponse {
  return {
    ...memo,
    insight: memo.insight ? normalizeInsight(memo.insight) : memo.insight,
    content: syncMentionTitles(memo.content, memo.taggedMemos, memo.taggedSchedules)
  };
}

/**
 * 인사이트 응답의 keywords가 null로 내려와도 화면이 깨지지 않도록 빈 배열로 보정합니다.
 */
function normalizeInsight(insight: MemoInsight): MemoInsight {
  return { ...insight, keywords: Array.isArray(insight.keywords) ? insight.keywords : [] };
}

export const memoApi = {
  async getAll(session: Session | null): Promise<MemoResponse[]> {
    const response = await axiosInstance.get<MemoResponse[]>('/api/memos', {
      headers: getAuthHeaders(session),
    });
    return response.data.map(processMemoResponse);
  },

  async getById(id: string, session: Session | null): Promise<MemoResponse> {
    const response = await axiosInstance.get<MemoResponse>(`/api/memos/${id}`, {
      headers: getAuthHeaders(session),
    });
    return processMemoResponse(response.data);
  },

  async create(data: { title: string; content: string; imageFile?: File; groupId?: string; tags?: string[]; taggedMemoIds?: string[]; taggedScheduleIds?: string[] }, session: Session | null): Promise<MemoResponse> {
    const formData = new FormData();

    const memoData = {
      title: data.title,
      content: data.content,
      groupId: data.groupId,
      tags: data.tags,
      taggedMemoIds: data.taggedMemoIds,
      taggedScheduleIds: data.taggedScheduleIds
    };
    formData.append('memo', new Blob([JSON.stringify(memoData)], { type: 'application/json' }));

    if (data.imageFile) {
      formData.append('image', data.imageFile);
    }

    const response = await axiosInstance.post<MemoResponse>('/api/memos', formData, {
      headers: {
        ...getAuthHeaders(session),
        'Content-Type': 'multipart/form-data',
      },
    });

    return processMemoResponse(response.data);
  },

  async update(id: string, data: { title: string; content: string; imageFile?: File; removeImage?: boolean; version?: number; tags?: string[]; taggedMemoIds?: string[]; taggedScheduleIds?: string[] }, session: Session | null): Promise<MemoResponse> {
    const formData = new FormData();

    // taggedScheduleIds 를 보내지 않으면(undefined) 서버는 기존 연결을 유지한다.
    const memoData: Record<string, unknown> = {
      title: data.title,
      content: data.content,
      tags: data.tags,
      taggedMemoIds: data.taggedMemoIds,
      taggedScheduleIds: data.taggedScheduleIds,
    };
    if (data.version !== undefined) memoData.version = data.version;
    if (data.removeImage && !data.imageFile) memoData.removeImage = true;
    formData.append('memo', new Blob([JSON.stringify(memoData)], { type: 'application/json' }));

    if (data.imageFile) {
      formData.append('image', data.imageFile);
    }

    const response = await axiosInstance.put<MemoResponse>(`/api/memos/${id}`, formData, {
      headers: {
        ...getAuthHeaders(session),
        'Content-Type': 'multipart/form-data',
      },
    });

    return processMemoResponse(response.data);
  },

  async delete(id: string, session: Session | null): Promise<void> {
    await axiosInstance.delete(`/api/memos/${id}`, {
      headers: getAuthHeaders(session),
    });
  },

  async toggleFavorite(id: string, session: Session | null): Promise<MemoResponse> {
    const response = await axiosInstance.put<MemoResponse>(`/api/memos/${id}/favorite`, {}, {
      headers: getAuthHeaders(session),
    });
    return processMemoResponse(response.data);
  },

  /** 내 고정(pinned=true)·해제. 모든 메모, 고정한 본인에게만 고정으로 보인다 */
  async setPinned(id: string, pinned: boolean, session: Session | null): Promise<MemoResponse> {
    const url = `/api/memos/${id}/pin`;
    const config = { headers: getAuthHeaders(session) };
    const response = pinned
      ? await axiosInstance.put<MemoResponse>(url, {}, config)
      : await axiosInstance.delete<MemoResponse>(url, config);
    return processMemoResponse(response.data);
  },

  /** 모임 고정(pinned=true)·해제. 모임 메모만(방장·작성자), 멤버 모두에게 고정으로 보인다 */
  async setGroupPinned(id: string, pinned: boolean, session: Session | null): Promise<MemoResponse> {
    const url = `/api/memos/${id}/group-pin`;
    const config = { headers: getAuthHeaders(session) };
    const response = pinned
      ? await axiosInstance.put<MemoResponse>(url, {}, config)
      : await axiosInstance.delete<MemoResponse>(url, config);
    return processMemoResponse(response.data);
  },

  /** canEdit: 받은 사람이 고칠 수 있게. 이미 공유한 사람에게 보내면 권한만 바뀐다 */
  async share(id: string, friendIds: string[], canEdit: boolean, session: Session | null): Promise<void> {
    await axiosInstance.post(`/api/memos/${id}/share`, { friendIds, canEdit }, {
      headers: getAuthHeaders(session),
    });
  },

  /** 내 개인 메모를 내가 속한 모임에 공유 (멤버는 읽기만) */
  async shareToGroup(id: string, groupId: string, session: Session | null): Promise<void> {
    await axiosInstance.post(`/api/memos/${id}/group-share/${groupId}`, null, {
      headers: getAuthHeaders(session),
    });
  },

  async unshareFromGroup(id: string, groupId: string, session: Session | null): Promise<void> {
    await axiosInstance.delete(`/api/memos/${id}/group-share/${groupId}`, {
      headers: getAuthHeaders(session),
    });
  },


  async unshare(id: string, targetUserId: string, session: Session | null): Promise<void> {
    await axiosInstance.delete(`/api/memos/${id}/share/${targetUserId}`, {
      headers: getAuthHeaders(session),
    });
  },

  /** 내가 즐겨찾기했고 지금 볼 수 있는 모든 메모(내 메모·공유받은 메모·모임 메모) */
  async getFavorites(session: Session | null): Promise<MemoResponse[]> {
    const response = await axiosInstance.get<MemoResponse[]>('/api/memos/favorites', {
      headers: getAuthHeaders(session),
    });
    return response.data.map(processMemoResponse);
  },

  /** 모임의 메모(다른 멤버가 쓴 것 포함) */
  async getGroupMemos(groupId: string, session: Session | null): Promise<MemoResponse[]> {
    const response = await axiosInstance.get<MemoResponse[]>(`/api/groups/${groupId}/memos`, {
      headers: getAuthHeaders(session),
    });
    return response.data.map(processMemoResponse);
  },

  async getSharedMemos(session: Session | null): Promise<MemoResponse[]> {
    const response = await axiosInstance.get<MemoResponse[]>('/api/memos/shared', {
      headers: getAuthHeaders(session),
    });
    return response.data.map(processMemoResponse);
  },

  async updateTags(id: string, tags: string[], session: Session | null): Promise<MemoResponse> {
    const response = await axiosInstance.put<MemoResponse>(`/api/memos/${id}/tags`, { tags }, {
      headers: getAuthHeaders(session),
    });
    return processMemoResponse(response.data);
  },

  async getInsight(id: string, session: Session | null): Promise<MemoInsight | null> {
    try {
      const response = await axiosInstance.get<MemoInsight | ''>(`/api/memos/${id}/insight`, {
        headers: getAuthHeaders(session),
      });
      // 인사이트가 없으면 백엔드는 204(본문 없음)를 반환합니다. 빈 200 본문도 동일하게 취급합니다.
      if (response.status === 204 || !response.data || typeof response.data !== 'object') return null;
      return normalizeInsight(response.data);
    } catch (error) {
      const err = error as { response?: { status: number } };
      if (err.response?.status === 404) return null;
      throw error;
    }
  },

  async analyze(id: string, session: Session | null): Promise<MemoInsight> {
    const response = await axiosInstance.post<MemoInsight>(`/api/memos/${id}/analyze`, {}, {
      timeout: 300000, // 로컬 LLM 분석은 1분을 넘길 수 있다 (nginx 도 300s)
      headers: getAuthHeaders(session),
    });
    return normalizeInsight(response.data);
  }
};

/**
 * 커서 앞 글자에서 진행 중인 멘션(@검색어)을 찾는다. 제목에 공백이 있어도 이어서 검색할 수 있게
 * 공백을 허용하고, 줄바꿈·이미 삽입된 링크 문법([ ] ( ))·40자를 넘으면 멘션이 끝난 것으로 본다.
 */
export function matchMentionQuery(textBeforeCursor: string): { query: string; index: number } | null {
  const match = textBeforeCursor.match(/@([^\n@[\]()]{0,40})$/);
  if (!match || match.index === undefined) return null;
  return { query: match[1], index: match.index };
}

/** 멘션 후보 필터: 앞뒤 공백을 무시하고 대소문자 구분 없이 포함 검색 */
export function mentionMatches(title: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  return !q || title.toLowerCase().includes(q);
}
