export type Memo = {
  id: string;
  authorId: string;
  title: string;
  content: string;
  imageDataUrl?: string;
  imageUrl?: string;
  tags: string[];
  category?: string;
  categoryColor?: string;
  locked?: boolean;
  isFavorite?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MemoAiInsight = {
  memoId: string;
  ocrText: string;
  summary: string;
  keywords: string[];
  analyzedAt: string;
};

export type MemoCardView = {
  id: string;
  title: string;
  description: string;
  image?: string;
  tags: string[];
  category?: string;
  categoryColor?: string;
  date: string;
  locked?: boolean;
  isFavorite?: boolean;
};
