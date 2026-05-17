'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import {
  X,
  Share2,
  Sparkles,
  Tag as TagIcon,
  MessageSquare,
  Loader2,
} from 'lucide-react';
import { analyzeMemo } from '@/lib/memo-analyzer';
import { getInsight, getMemo, saveInsight } from '@/lib/memo-storage';
import type { Memo, MemoAiInsight } from '@/types/memo';

interface MemoDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  memoId: string | null;
  userId: string;
  authorName?: string | null;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function emotionBarClass(emotion: string) {
  if (emotion === '긍정') return { bar: 'w-[85%] bg-emerald-400', text: 'text-emerald-500' };
  if (emotion === '부정') return { bar: 'w-[35%] bg-red-400', text: 'text-red-500' };
  return { bar: 'w-[55%] bg-amber-400', text: 'text-amber-500' };
}

function MemoImage({ src, alt }: { src: string; alt: string }) {
  if (src.startsWith('data:')) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} className="w-full max-h-48 object-cover rounded-2xl mb-6" />
    );
  }
  return (
    <div className="relative w-full h-48 mb-6 rounded-2xl overflow-hidden">
      <Image src={src} alt={alt} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
    </div>
  );
}

export default function MemoDetailModal({
  isOpen,
  onClose,
  memoId,
  userId,
  authorName,
}: MemoDetailModalProps) {
  const [memo, setMemo] = useState<Memo | null>(null);
  const [insight, setInsight] = useState<MemoAiInsight | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);

  useEffect(() => {
    if (!isOpen || !memoId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMemo(null);
       
      setInsight(null);
      return;
    }

    const found = getMemo(userId, memoId);
    setMemo(found);
    if (!found) return;

    const existing = getInsight(userId, memoId);
    if (existing) {
      setInsight(existing);
      return;
    }

    let cancelled = false;
    setLoadingInsight(true);

    analyzeMemo({
      memoId: found.id,
      title: found.title,
      content: found.content,
      imageDataUrl: found.imageDataUrl,
    })
      .then((result) => {
        if (cancelled) return;
        saveInsight(userId, result);
        setInsight(result);
      })
      .finally(() => {
        if (!cancelled) setLoadingInsight(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, memoId, userId]);

  if (!isOpen || !memo) return null;

  const imageSrc = memo.imageDataUrl ?? memo.imageUrl;
  const emotionStyle = insight ? emotionBarClass(insight.emotion) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-5xl max-h-[85vh] flex shadow-2xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 flex flex-col p-10 overflow-y-auto no-scrollbar border-r border-gray-100">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-black text-gray-900">{memo.title}</h2>
              <button
                type="button"
                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"
              >
                <Share2 className="w-5 h-5" />
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 lg:hidden"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-1 mb-6 text-sm text-gray-400 font-medium">
            <p>작성자: {authorName || '나'}</p>
            <p>최종 수정: {formatDateTime(memo.updatedAt)}</p>
          </div>

          {imageSrc && <MemoImage src={imageSrc} alt={memo.title} />}

          <p className="text-lg text-gray-700 leading-relaxed font-medium whitespace-pre-wrap">
            {memo.locked
              ? '이 메모는 잠겨 있습니다. 내용을 보려면 비밀번호를 입력하세요.'
              : memo.content}
          </p>
        </div>

        <div className="w-[360px] bg-gray-50/50 p-8 overflow-y-auto no-scrollbar flex flex-col gap-8 shrink-0 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-8 right-8 p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hidden lg:block"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="space-y-4 pt-8 lg:pt-0">
            <div className="flex items-center gap-2 text-gray-900 font-bold">
              <Sparkles className="w-5 h-5 text-blue-500" />
              <span>AI 인사이트</span>
              {loadingInsight && <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />}
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
              {loadingInsight && !insight ? (
                <p className="text-xs text-gray-400 font-medium">AI 분석 중…</p>
              ) : insight ? (
                <>
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded uppercase">
                      요약
                    </span>
                    <p className="text-xs text-gray-600 leading-relaxed font-medium">{insight.summary}</p>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">주요 키워드</span>
                    <div className="flex flex-wrap gap-1.5">
                      {insight.keywords.map((kw) => (
                        <span
                          key={kw}
                          className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>

                  {emotionStyle && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase">감정 분석</span>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full ${emotionStyle.bar}`} />
                        </div>
                        <span className={`text-[10px] font-bold shrink-0 ${emotionStyle.text}`}>
                          {insight.emotion}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-gray-400">분석 결과가 없습니다.</p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-gray-900 font-bold">
              <TagIcon className="w-5 h-5 text-blue-500" />
              <span>태그</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {memo.tags.length > 0 ? (
                memo.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs font-bold text-gray-500 bg-white border border-gray-200 px-3 py-1.5 rounded-xl shadow-sm"
                  >
                    #{tag}
                  </span>
                ))
              ) : (
                <span className="text-xs text-gray-400">태그 없음</span>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-gray-900 font-bold">
              <MessageSquare className="w-5 h-5 text-blue-500" />
              <span className="text-sm">OCR 인식 텍스트</span>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-xs text-gray-500 leading-relaxed font-medium whitespace-pre-wrap">
              {loadingInsight && !insight
                ? '분석 중…'
                : insight?.ocrText ?? '—'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
