import type { Memo, MemoAiInsight, MemoCardView } from "@/types/memo";

const MEMOS_KEY = (userId: string) => `moyeolog:memos:${userId}`;
const INSIGHTS_KEY = (userId: string) => `moyeolog:insights:${userId}`;
const SEED_FLAG_KEY = (userId: string) => `moyeolog:seeded:${userId}`;

const SEED_MEMOS: Omit<
  Memo,
  "id" | "authorId" | "authorNickname" | "createdAt" | "updatedAt"
>[] = [
  {
    title: "React 훅 정리 노트",
    content:
      "useState, useEffect, useContext, useReducer 등 주요 훅들의 사용법과 예제를 정리했습니다. 실무에서 자주 사용하는 패턴들을 중심으로 복습합니다.",
    imageUrl:
      "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800&auto=format&fit=crop&q=60",
    tags: ["React", "Hooks", "Frontend"],
    category: "대학 동기들",
    categoryColor: "bg-blue-500",
  },
  {
    title: "독서 모임 - 클린 코드",
    content:
      '이번 달 독서 모임에서 읽은 "클린 코드"의 핵심 내용을 정리했습니다. 의미 있는 이름 짓기, 함수 작성법, 주석 사용법 등 실무에 바로 적용할 수 있는 내용입니다.',
    imageUrl:
      "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&auto=format&fit=crop&q=60",
    tags: ["클린코드", "리팩토링", "베스트프랙티스"],
    category: "독서 모임",
    categoryColor: "bg-orange-500",
  },
  {
    title: "운동 루틴 및 식단 기록",
    content:
      "헬스 크루에서 함께 진행하는 운동 프로그램과 식단 관리 내용입니다. 주 3회 웨이트, 주 2회 유산소 운동을 병행하고 있습니다.",
    imageUrl:
      "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&auto=format&fit=crop&q=60",
    tags: ["운동", "건강", "루틴"],
    category: "헬스 크루",
    categoryColor: "bg-emerald-500",
  },
  {
    title: "팀 회의록 - 2026년 4월",
    content:
      "이번 달 팀 회의 내용입니다. 프로젝트 일정 조정, 역할 분담, 다음 마일스톤까지의 목표를 설정했습니다.",
    tags: ["회의", "일정", "계획"],
    category: "대학 동기들",
    categoryColor: "bg-blue-500",
  },
  {
    title: "중간고사 대비 정리",
    content:
      "데이터구조 과목 중간고사 범위입니다. 스택, 큐, 트리, 그래프 등의 자료구조와 알고리즘 복잡도 분석 방법을 정리했습니다.",
    tags: ["데이터구조", "알고리즘", "시험"],
  },
  {
    title: "프로젝트 아이디어 브레인스토밍",
    content:
      "캡스톤 디자인 프로젝트 주제를 정하기 위한 아이디어 회의 내용입니다. AI 기반 학습 도우미, IoT 스마트홈, 헬스케어 앱 등 여러 아이디어가 나왔습니다.",
    tags: ["아이디어", "브레인스토밍", "프로젝트"],
    category: "대학 동기들",
    categoryColor: "bg-blue-500",
  },
  {
    title: "TypeScript 타입 시스템 정리",
    content:
      "TypeScript의 고급 타입 시스템에 대한 정리입니다. 제네릭, 유니온 타입, 인터섹션 타입, 유틸리티 타입 등을 예제와 함께 정리했습니다.",
    tags: ["TypeScript", "Type System", "Generic"],
    locked: true,
  },
  {
    title: "여행 계획 - 제주도",
    content:
      "여름 방학 때 친구들과 가는 제주도 여행 계획입니다. 3박 4일 일정으로 성산일출봉, 우도, 한라산 등을 방문할 예정입니다.",
    imageUrl:
      "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&auto=format&fit=crop&q=60",
    tags: ["여행", "제주도", "휴가"],
  },
];

const SEED_DATES = [
  "2026-04-05",
  "2026-04-03",
  "2026-04-01",
  "2026-03-29",
  "2026-04-04",
  "2026-04-02",
  "2026-03-30",
  "2026-03-28",
];

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

function formatDisplayDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

export function ensureSeeded(userId: string): void {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(SEED_FLAG_KEY(userId))) return;

  const now = new Date();
  const memos: Memo[] = SEED_MEMOS.map((seed, i) => {
    const created = new Date(now);
    created.setDate(created.getDate() - (SEED_MEMOS.length - i));
    const iso = created.toISOString();
    return {
      id: crypto.randomUUID(),
      authorId: userId,
      authorNickname: "나",
      ...seed,
      createdAt: SEED_DATES[i] ? new Date(SEED_DATES[i]).toISOString() : iso,
      updatedAt: iso,
    };
  });

  writeJson(MEMOS_KEY(userId), memos);
  writeJson(INSIGHTS_KEY(userId), {});
  localStorage.setItem(SEED_FLAG_KEY(userId), "1");
}

export function listMemos(userId: string): Memo[] {
  ensureSeeded(userId);
  const memos = readJson<Memo[]>(MEMOS_KEY(userId), []);
  return [...memos].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function getMemo(userId: string, memoId: string): Memo | null {
  return listMemos(userId).find((m) => m.id === memoId) ?? null;
}

export function createMemo(
  userId: string,
  data: {
    title: string;
    content: string;
    tags: string[];
    imageDataUrl?: string;
  },
): Memo {
  ensureSeeded(userId);
  const now = new Date().toISOString();
  const memo: Memo = {
    id: crypto.randomUUID(),
    authorId: userId,
    authorNickname: '나',
    title: data.title.trim(),
    content: data.content.trim(),
    tags: data.tags,
    imageDataUrl: data.imageDataUrl,
    createdAt: now,
    updatedAt: now,
  };

  const memos = readJson<Memo[]>(MEMOS_KEY(userId), []);
  memos.unshift(memo);
  writeJson(MEMOS_KEY(userId), memos);
  return memo;
}

export function getInsight(
  userId: string,
  memoId: string,
): MemoAiInsight | null {
  const insights = readJson<Record<string, MemoAiInsight>>(
    INSIGHTS_KEY(userId),
    {},
  );
  return insights[memoId] ?? null;
}

export function saveInsight(userId: string, insight: MemoAiInsight): void {
  const insights = readJson<Record<string, MemoAiInsight>>(
    INSIGHTS_KEY(userId),
    {},
  );
  insights[insight.memoId] = insight;
  writeJson(INSIGHTS_KEY(userId), insights);
}

export function memoToCardView(memo: Memo): MemoCardView {
  return {
    id: memo.id,
    title: memo.title,
    description: memo.locked
      ? "이 메모는 잠겨 있습니다. 내용을 보려면 비밀번호를 입력하세요."
      : memo.content.length > 100
        ? `${memo.content.slice(0, 100)}…`
        : memo.content,
    image: memo.imageDataUrl ?? memo.imageUrl,
    tags: memo.tags,
    category: memo.category,
    categoryColor: memo.categoryColor,
    date: formatDisplayDate(memo.updatedAt),
    locked: memo.locked,
  };
}

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export async function fileToDataUrl(file: File): Promise<string> {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("이미지는 10MB 이하여야 합니다.");
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("이미지를 읽을 수 없습니다."));
    reader.readAsDataURL(file);
  });
}
