import type { MemoAiInsight } from '@/types/memo';

const POSITIVE_WORDS = ['좋', '행복', '성공', '완료', '즐거', '기대', '감사', '최고', '축하'];
const NEGATIVE_WORDS = ['힘들', '실패', '걱정', '불안', '슬프', '화나', '지연', '문제', '어렵'];

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractKeywords(title: string, content: string): string[] {
  const text = `${title} ${content}`;
  const tokens = text
    .replace(/[^\w\s가-힣#]/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^#/, '').trim())
    .filter((t) => t.length >= 2);

  const freq = new Map<string, number>();
  for (const token of tokens) {
    freq.set(token, (freq.get(token) ?? 0) + 1);
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

function detectEmotion(text: string): string {
  let positive = 0;
  let negative = 0;

  for (const w of POSITIVE_WORDS) {
    if (text.includes(w)) positive++;
  }
  for (const w of NEGATIVE_WORDS) {
    if (text.includes(w)) negative++;
  }

  if (positive > negative) return '긍정';
  if (negative > positive) return '부정';
  return '중립';
}

function summarize(content: string, maxLen = 120): string {
  const trimmed = content.trim();
  if (!trimmed) return '내용이 없습니다.';
  if (trimmed.length <= maxLen) return trimmed;

  const sentenceEnd = trimmed.slice(0, maxLen).lastIndexOf('.');
  if (sentenceEnd > 40) return `${trimmed.slice(0, sentenceEnd + 1)}`;
  return `${trimmed.slice(0, maxLen)}…`;
}

export async function analyzeMemo(input: {
  memoId: string;
  title: string;
  content: string;
  imageDataUrl?: string;
}): Promise<MemoAiInsight> {
  await delay(800);

  const fullText = `${input.title}\n${input.content}`;
  const keywords = extractKeywords(input.title, input.content);
  const emotion = detectEmotion(fullText);

  let ocrText: string;
  if (input.imageDataUrl) {
    ocrText =
      '[이미지 첨부됨] 서버 OCR 연동 전입니다. 본문과 제목을 기준으로 분석했습니다.';
    if (input.content.trim()) {
      ocrText += `\n\n인식 후보: "${input.content.trim().slice(0, 80)}${input.content.length > 80 ? '…' : ''}"`;
    }
  } else {
    ocrText = input.content.trim()
      ? input.content.trim().slice(0, 200)
      : '텍스트가 없어 OCR 결과를 생성하지 못했습니다.';
  }

  return {
    memoId: input.memoId,
    ocrText,
    summary: summarize(input.content || input.title),
    emotion,
    keywords: keywords.length > 0 ? keywords : [input.title.slice(0, 10) || '메모'],
    analyzedAt: new Date().toISOString(),
  };
}
