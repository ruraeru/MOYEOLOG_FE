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
  Pencil,
  Star,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { memoApi, type MemoResponse, type MemoInsight } from '@/lib/memo-api';
import MemoShareModal from './MemoShareModal';
import MemoEditModal from './MemoEditModal';
import dynamic from 'next/dynamic';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';

const EdMarkdown = dynamic(
  () => import('@uiw/react-md-editor').then((mod) => mod.default.Markdown),
  { ssr: false }
);

interface MemoDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  memoId: string | null;
  userId: string;
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
  onDelete,
}: MemoDetailModalProps) {
  const { data: session } = useSession();
  const [memo, setMemo] = useState<MemoResponse | null>(null);
  const [insight, setInsight] = useState<MemoInsight | null>(null);
  const [currentTags, setCurrentTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [loadingMemo, setLoadingMemo] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchMemoDetail = async () => {
    if (!memoId || !session) return;
    setLoadingMemo(true);
    try {
      const data = await memoApi.getById(memoId, session);
      setMemo(data);
      setCurrentTags(data.tags || []);

      if (data.insight) {
        setInsight(data.insight);
      } else {
        const res = await memoApi.getInsight(memoId, session);
        if (res) setInsight(res);
      }
    } catch (error) {
      console.error('Failed to fetch memo detail:', error);
    } finally {
      setLoadingMemo(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !memoId || !session) {
      setMemo(null);
      setInsight(null);
      setCurrentTags([]);
      return;
    }

    fetchMemoDetail();
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

  const syncTags = async (newTags: string[]) => {
    if (!memoId || !session) return;
    try {
      await memoApi.updateTags(memoId, newTags, session);
      setCurrentTags(newTags);
    } catch (error) {
      console.error('Failed to sync tags:', error);
      alert('태그 저장에 실패했습니다.');
    }
  };

  const addTag = (tag: string) => {
    const trimmed = tag.trim().replace(/^#/, '');
    if (!trimmed || currentTags.includes(trimmed)) return;
    const newTags = [...currentTags, trimmed];
    syncTags(newTags);
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    const newTags = currentTags.filter(t => t !== tag);
    syncTags(newTags);
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

  const handleToggleFavorite = async () => {
    if (!memo || !session) return;
    try {
      const updated = await memoApi.toggleFavorite(memo.id, session);
      setMemo(updated);
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
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
                  onClick={handleToggleFavorite}
                  className={`p-2 rounded-full hover:bg-gray-100 transition-colors ${memo.isFavorite ? 'text-amber-400' : 'text-gray-300'}`}
                  title="즐겨찾기"
                >
                  <Star className={`w-5 h-5 ${memo.isFavorite ? 'fill-amber-400' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(true)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"
                  title="메모 수정"
                >
                  <Pencil className="w-5 h-5" />
                </button>
                {userId === memo.authorId && (
                  <>
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
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 lg:hidden"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-1 mb-6 text-xs text-gray-400 font-medium">
              <div className="flex items-center gap-2">
                <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-500 font-bold">작성자</span>
                <span className="text-gray-600 font-black">{memo.authorNickname}</span>
              </div>
              {memo.lastModifierNickname && (
                <div className="flex items-center gap-2">
                  <span className="bg-gray-50 px-2 py-0.5 rounded text-gray-400 font-bold">마지막 수정</span>
                  <span className="text-gray-500 font-bold">{memo.lastModifierNickname}</span>
                </div>
              )}
              <p className="pt-1">{formatDateTime(memo.createdAt)} 작성</p>
            </div>

            {imageSrc && <MemoImage src={imageSrc} alt={memo.title} />}

            <div className="text-gray-700 leading-relaxed" data-color-mode="light">
              <EdMarkdown 
                source={memo.content} 
                style={{ 
                  backgroundColor: 'transparent', 
                  fontSize: '1.125rem', 
                  fontWeight: 500,
                  color: 'inherit'
                }} 
              />
            </div>
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
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">AI 추천 태그</span>
                        <span className="text-[8px] text-gray-300 font-medium">클릭하여 추가</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {insight.keywords.map((kw) => {
                          const isAdded = currentTags.includes(kw);
                          return (
                            <button
                              key={kw}
                              onClick={() => !isAdded && addTag(kw)}
                              disabled={isAdded}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded transition-all ${
                                isAdded 
                                  ? 'bg-gray-100 text-gray-300 cursor-default' 
                                  : 'bg-blue-50 text-blue-500 hover:bg-blue-100'
                              }`}
                            >
                              {kw}
                            </button>
                          );
                        })}
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
                {currentTags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs font-bold text-gray-500 bg-white border border-gray-200 px-3 py-1.5 rounded-xl shadow-sm flex items-center gap-1.5 group/tag"
                  >
                    #{tag}
                    <button 
                      onClick={() => removeTag(tag)}
                      className="text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                
                <div className="relative">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTag(tagInput)}
                    placeholder="태그 추가..."
                    className="text-xs font-bold text-gray-400 bg-gray-50 border border-transparent px-3 py-1.5 rounded-xl w-24 focus:w-32 focus:bg-white focus:border-blue-200 transition-all outline-none"
                  />
                </div>
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

      <MemoEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        memo={memo}
        onSuccess={fetchMemoDetail}
      />
    </>
  );
}
