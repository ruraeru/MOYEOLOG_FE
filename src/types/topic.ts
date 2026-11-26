export interface TopicResponse {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  authorId: string;
  authorNickname: string;
  authorProfileImage?: string;
  authorCustomId?: string | null;
  groupId: string;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  /** 고정 시각(오프셋 없는 한국 시간). 고정 안 됐으면 null */
  pinnedAt?: string | null;
  /** 보는 사람이 고정·해제할 수 있는가(방장 또는 작성자) */
  canPin?: boolean;
  /** 보는 사람이 삭제할 수 있는가(작성자 또는 방장) */
  canDelete?: boolean;
}

export interface TopicCommentResponse {
  id: string;
  content: string;
  authorId: string;
  authorNickname: string;
  authorProfileImage?: string;
  authorCustomId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TopicInsightResponse {
  ocrText: string;
  summary: string;
  analyzedAt?: string;
  keywords?: string[];
  stale?: boolean;
}

export interface TopicDetailResponse {
  topic: TopicResponse;
  comments: TopicCommentResponse[];
  insight?: TopicInsightResponse;
  /** 계약상 '최상위' 가 상세 응답 최상위일 수도 있어 같이 받는다 */
  pinnedAt?: string | null;
  canPin?: boolean;
}
