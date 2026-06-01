import type { MemoAiInsight } from "@/types/memo";

// ─── 상수 정의 ──────────────────────────────────────────────────

const SUMMARIZE_MAX_LEN = 120;
const SENTENCE_MIN_LEN = 40;
const OCR_PREVIEW_LIMIT = 80;
const OCR_TEXT_LIMIT = 200;

// 한국어 불용어 (Keywords 추출 시 제외)
const STOPWORDS = new Set([
  "이", "그", "저", "을", "를", "은", "는", "가", "이", "에", "와", "과", "도", 
  "이다", "있다", "하다", "것", "들", "의", "에서", "으로", "로", "등", "때"
]);

// ─── 타입 정의 ──────────────────────────────────────────────────

export interface AnalyzeMemoInput {
  memoId: string;
  title: string;
  content: string;
  imageDataUrl?: string;
}

// ─── 유틸리티 함수 ───────────────────────────────────────────────

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 텍스트에서 주요 키워드를 추출합니다.
 * 불용어를 필터링하며, 결과가 없을 경우 제목을 기반으로 폴백을 생성합니다.
 */
function extractKeywords(title: string, content: string, fallbackTitle: string): string[] {
  const text = `${title} ${content}`;
  const tokens = text
    .replace(/[^\w\s가-힣#]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^#/, "").trim())
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));

  const freq = new Map<string, number>();
  for (const token of tokens) {
    freq.set(token, (freq.get(token) ?? 0) + 1);
  }

  const result = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);

  // 키워드가 없을 경우 폴백 처리
  if (result.length === 0) {
    return [fallbackTitle.slice(0, 10) || "메모"];
  }

  return result;
}

/**
 * 긴 텍스트를 요약합니다. 
 * 가급적 문장 단위로 끊으며, 너무 길 경우 말줄임표를 추가합니다.
 */
function summarize(content: string, maxLen = SUMMARIZE_MAX_LEN): string {
  const trimmed = content.trim();
  if (!trimmed) return "내용이 없습니다.";
  if (trimmed.length <= maxLen) return trimmed;

  const sentenceEnd = trimmed.slice(0, maxLen).lastIndexOf(".");
  if (sentenceEnd > SENTENCE_MIN_LEN) {
    return trimmed.slice(0, sentenceEnd + 1);
  }
  
  return trimmed.slice(0, maxLen) + "…";
}

/**
 * 이미지 존재 여부에 따라 OCR 텍스트 결과를 결정합니다.
 * TODO: 실제 OCR API 연동 시 이 함수 내부 로직을 교체하십시오.
 */
function resolveOcrText(imageDataUrl?: string, content?: string): string {
  if (imageDataUrl) {
    let ocrText = "[이미지 첨부됨] 서버 OCR 연동 전입니다. 본문과 제목을 기준으로 분석했습니다.";
    if (content?.trim()) {
      const preview = content.trim().slice(0, OCR_PREVIEW_LIMIT);
      const ellipsis = content.length > OCR_PREVIEW_LIMIT ? "…" : "";
      ocrText += `\n\n인식 후보: "${preview}${ellipsis}"`;
    }
    return ocrText;
  }

  return content?.trim()
    ? content.trim().slice(0, OCR_TEXT_LIMIT)
    : "텍스트가 없어 OCR 결과를 생성하지 못했습니다.";
}

// ─── 메인 분석 함수 ─────────────────────────────────────────────

/**
 * 메모 내용을 분석하여 AI 인사이트를 생성합니다.
 */
export async function analyzeMemo(input: AnalyzeMemoInput): Promise<MemoAiInsight> {
  // TODO: 실제 서비스 운영 시 API 응답 속도에 따라 지연 시간 제거 검토 필요
  if (process.env.NODE_ENV !== "production") {
    await delay(800);
  }

  const keywords = extractKeywords(input.title, input.content, input.title);
  const ocrText = resolveOcrText(input.imageDataUrl, input.content);

  return {
    memoId: input.memoId,
    ocrText,
    summary: summarize(input.content || input.title),
    keywords,
    analyzedAt: new Date().toISOString(),
  };
}
