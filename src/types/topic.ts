export interface TopicResponse {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  authorId: string;
  authorNickname: string;
  authorProfileImage?: string;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TopicCommentResponse {
  id: string;
  content: string;
  authorId: string;
  authorNickname: string;
  authorProfileImage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TopicInsightResponse {
  ocrText: string;
  summary: string;
  analyzedAt: string;
}

export interface TopicDetailResponse {
  topic: TopicResponse;
  comments: TopicCommentResponse[];
  insight?: TopicInsightResponse;
}
