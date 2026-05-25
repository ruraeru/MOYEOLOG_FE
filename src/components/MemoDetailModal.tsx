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
  Trash2,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { memoApi, type MemoResponse, type MemoInsight } from '@/lib/memo-api';
import MemoShareModal from './MemoShareModal';

interface MemoDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  memoId: string | null;
  userId: string;
  authorName?: string | null;
  onDelete?: () => void;
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
  onDelete,
}: MemoDetailModalProps) {
  const { data: session } = useSession();
  const [memo, setMemo] = useState<MemoResponse | null>(null);
  const [insight, setInsight] = useState<MemoInsight | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [loadingMemo, setLoadingMemo] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!isOpen || !memoId || !session) {
      setMemo(null);
      setInsight(null);
      return;
    }

    let cancelled = false;

    const fetchMemoDetail = async () => {
      setLoadingMemo(true);
      try {
        const data = await memoApi.getById(memoId, session);
        if (cancelled) return;
        setMemo(data);

        // 이미 포함된 인사이트가 있으면 세팅, 없으면 별도 조회 시도
        if (data.insight) {
          setInsight(data.insight);
        } else {
          const res = await memoApi.getInsight(memoId, session);
          if (cancelled) return;
          if (res) setInsight(res);
        }
      } catch (error) {
        console.error('Failed to fetch memo detail:', error);
      } finally {
        if (!cancelled) {
          setLoadingMemo(false);
        }
      }
    };

    fetchMemoDetail();

    return () => {
      cancelled = true;
    };
  }, [isOpen, memoId, session]);

  const handleAnalyze = async () => {
    if (!memoId || !session) return;
    setLoadingInsight(true);
    try {
      const res = await memoApi.analyze(memoId, session);
      setInsight(res);
    } catch (error) {
      console.error('Failed to analyze memo:', error);
      alert('AI 분석에 실패했습니다.');
    } finally {
      setLoadingInsight(false);
    }
  };

  if (!isOpen) return null;

  if (loadingMemo) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="bg-white rounded-3xl p-10 flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          <span className="font-bold text-gray-600">메모를 불러오는 중...</span>
        </div>
      </div>
    );
  }

  if (!memo) return null;

  const handleDelete = async () => {
    if (!confirm('정말로 이 메모를 삭제하시겠습니까?')) return;
    setIsDeleting(true);
    try {
      await memoApi.delete(memo.id, session);
      onDelete?.();
      onClose();
    } catch (error) {
      console.error('Failed to delete memo:', error);
      alert('메모 삭제에 실패했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  const imageSrc = memo.imageUrl ? (memo.imageUrl.startsWith('/uploads/') ? `${apiUrl}${memo.imageUrl}` : memo.imageUrl) : null;

  return (
    <>
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
                  onClick={() => setIsShareModalOpen(true)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"
                >
                  <Share2 className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="p-2 hover:bg-red-50 rounded-full transition-colors text-gray-400 hover:text-red-500 disabled:opacity-50"
                >
                  {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
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
              {memo.content}
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
                {loadingInsight ? (
                  <div className="flex flex-col items-center justify-center py-4 gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                    <p className="text-[10px] text-gray-400 font-bold">AI가 분석 중입니다...</p>
                  </div>
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
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-4 gap-3 text-center">
                    <p className="text-xs text-gray-400 font-medium">분석 결과가 아직 없습니다.</p>
                    <button
                      onClick={handleAnalyze}
                      className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                      AI 분석 시작하기
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-gray-900 font-bold">
                <TagIcon className="w-5 h-5 text-blue-500" />
                <span>태그</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {memo.tags && memo.tags.length > 0 ? (
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
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm text-xs text-gray-500 leading-relaxed font-medium whitespace-pre-wrap min-h-[100px]">
                {loadingInsight ? '분석 중…' : insight?.ocrText ?? '—'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <MemoShareModal 
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        memoId={memo.id}
        memoTitle={memo.title}
      />
    </>
  );
}
