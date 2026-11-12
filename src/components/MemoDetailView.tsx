'use client';

import React, { useEffect, useState, useRef } from 'react';
import ImageWithFallback from './ImageWithFallback';
import {
  X,
  Share2,
  Sparkles,
  RefreshCw,
  Tag as TagIcon,
  MessageSquare,
  Loader2,
  Trash2,
  Pencil,
  Star,
  ChevronLeft,
  Upload,
  Check,
  Calendar as LucideCalendar,
  FileText,
  ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useSession } from 'next-auth/react';
import { memoApi, type MemoResponse, type MemoInsight } from '@/lib/memo-api';
import { scheduleApi, type ScheduleResponse } from '@/lib/schedule-api';
import MemoShareModal from './MemoShareModal';
import dynamic from 'next/dynamic';
import { markdownRehypePlugins } from '@/lib/markdown';
import { useRouter } from 'next/navigation';
import { fileToDataUrl, convertToWebP } from '@/lib/utils';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';

const EdMarkdown = dynamic(
  () => import('@uiw/react-md-editor').then((mod) => mod.default.Markdown),
  { ssr: false }
);

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });

interface MemoDetailViewProps {
  memoId: string;
  onDelete?: () => void;
  isPage?: boolean;
  onClose?: () => void;
}

function formatDateTime(iso: string) {
  return format(new Date(iso), 'M.d EEE HH:mm', { locale: ko });
}

function MemoImage({ src, alt, isEditing, onImageSelect, onImageRemove }: {
  src: string;
  alt: string;
  isEditing?: boolean;
  onImageSelect?: (file: File) => void;
  onImageRemove?: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (isEditing) {
    return (
      <div
        className="w-full border border-dashed border-line-strong rounded-2xl p-5 flex flex-col items-center justify-center gap-3 bg-canvas hover:bg-raised transition-colors duration-150 ease-out cursor-pointer mb-4 relative overflow-hidden min-h-[120px]"
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImageSelect?.(file);
          }}
        />
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt="미리보기"
            className="max-h-40 rounded-[10px] object-contain"
          />
        ) : (
          <>
            <Upload size={18} strokeWidth={1.5} className="text-ink-3" />
            <div className="text-center">
              <p className="text-sm font-medium text-ink">
                새 이미지를 끌어다 놓거나 눌러서 바꿔요
              </p>
            </div>
          </>
        )}
        {src && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onImageRemove?.();
            }}
            className="absolute top-3 right-3 text-xs text-negative bg-surface border border-line px-2 py-1 rounded-lg hover:bg-negative-soft transition-colors duration-150 ease-out"
          >
            제거
          </button>
        )}
      </div>
    );
  }

  if (!src) return null;

  if (src.startsWith('data:')) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} className="w-full max-h-48 object-cover rounded-2xl mb-4" />
    );
  }
  return (
    <ImageWithFallback
      src={src}
      alt={alt}
      fill
      sizes="(max-width: 768px) 100vw, 50vw"
      containerClassName="w-full h-full mb-4 rounded-2xl"
      className="object-contain"
    />
  );
}

import { useAlert } from '@/hooks/useAlert';

export default function MemoDetailView({
  memoId,
  onDelete,
  isPage = false,
  onClose,
}: MemoDetailViewProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const { confirm, toast } = useAlert();
  const [memo, setMemo] = useState<MemoResponse | null>(null);
  const [insight, setInsight] = useState<MemoInsight | null>(null);
  const [currentTags, setCurrentTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [loadingMemo, setLoadingMemo] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Editing states
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // 멘션 데이터 및 상태
  const [allMemos, setAllMemos] = useState<MemoResponse[]>([]);
  const [schedules, setSchedules] = useState<ScheduleResponse[]>([]);
  const [mentionState, setMentionState] = useState({
    active: false,
    query: '',
    startPos: 0,
    endPos: 0
  });

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

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
    if (!memoId || !session) return;
    fetchMemoDetail();

    // 멘션용 데이터 로드
    Promise.all([
      memoApi.getAll(session),
      scheduleApi.getAll(session)
    ]).then(([memosData, schedulesData]) => {
      setAllMemos(memosData);
      setSchedules(schedulesData);
    }).catch(console.error);
  }, [memoId, session]);

  const handleStartEdit = () => {
    if (!memo) return;
    setEditTitle(memo.title);
    setEditContent(memo.content);
    if (memo.imageUrl) {
      setEditImagePreview(memo.imageUrl.startsWith('/uploads/') ? `${apiUrl}${memo.imageUrl}` : memo.imageUrl);
    } else {
      setEditImagePreview(null);
    }
    setEditImageFile(null);
    setIsEditing(true);

    // 편집 모드 시작 시 멘션 데이터 최신 갱신
    if (session) {
      Promise.all([
        memoApi.getAll(session),
        scheduleApi.getAll(session)
      ]).then(([memosData, schedulesData]) => {
        setAllMemos(memosData);
        setSchedules(schedulesData);
      }).catch(console.error);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setMentionState({ active: false, query: '', startPos: 0, endPos: 0 });
  };

  const handleSaveEdit = async () => {
    if (!memo || !editTitle.trim()) return;
    setIsSaving(true);
    try {
      // 마크다운 파싱을 통한 자동 태그 추출
      const taggedMemoIds = Array.from(new Set([...editContent.matchAll(/\[@[^\]]+\]\(\/memo\/([a-zA-Z0-9-]+)\)/g)].map(m => m[1])));
      const taggedScheduleIds = Array.from(new Set([...editContent.matchAll(/\[@[^\]]+\]\(\/schedule\/([a-zA-Z0-9-]+)\)/g)].map(m => m[1])));

      await memoApi.update(memo.id, {
        title: editTitle,
        content: editContent,
        imageFile: editImageFile || undefined,
        tags: currentTags,
        taggedMemoIds,
        taggedScheduleIds
      }, session);

      await fetchMemoDetail();
      setIsEditing(false);
      setMentionState({ active: false, query: '', startPos: 0, endPos: 0 });
    } catch (error) {
      console.error('Failed to save memo:', error);
      toast.error('저장하지 못했어요');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageSelect = async (file: File) => {
    try {
      const webpFile = await convertToWebP(file);
      setEditImageFile(webpFile);
      const dataUrl = await fileToDataUrl(webpFile);
      setEditImagePreview(dataUrl);
    } catch (e) {
      console.error(e);
      toast.error('이미지를 처리하지 못했어요');
    }
  };

  const handleAnalyze = async () => {
    if (!memoId || !session) return;
    setLoadingInsight(true);
    try {
      const res = await memoApi.analyze(memoId, session);
      setInsight(res);
    } catch (error) {
      console.error('Failed to analyze memo:', error);
      toast.error('분석하지 못했어요');
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
      toast.error('태그를 저장하지 못했어요');
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

  const handleDelete = async () => {
    if (!(await confirm('이 메모를 삭제할까요?'))) return;
    setIsDeleting(true);
    try {
      await memoApi.delete(memoId, session);
      onDelete?.();
      if (isPage) {
        router.push('/memo');
      } else {
        onClose?.();
      }
    } catch (error) {
      console.error('Failed to delete memo:', error);
      toast.error('메모를 삭제하지 못했어요');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!memoId || !session) return;
    try {
      const updated = await memoApi.toggleFavorite(memoId, session);
      setMemo(updated);
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  // 인라인 멘션 핸들러
  const handleEditorKeyUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLTextAreaElement;
    if (target.tagName !== 'TEXTAREA') return;

    const cursor = target.selectionStart;
    const textBeforeCursor = target.value.slice(0, cursor);
    const match = textBeforeCursor.match(/@([^\s]*)$/);

    if (match) {
      setMentionState({ active: true, query: match[1], startPos: match.index!, endPos: cursor });
    } else {
      setMentionState(prev => prev.active ? { ...prev, active: false } : prev);
    }
  };

  const insertMention = (item: { id: string; title: string }, type: 'memo' | 'schedule') => {
    const link = `[@${item.title}](/${type}/${item.id}) `;
    const newContent = editContent.slice(0, mentionState.startPos) + link + editContent.slice(mentionState.endPos);
    setEditContent(newContent);
    setMentionState({ active: false, query: '', startPos: 0, endPos: 0 });
  };

  if (loadingMemo) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface p-4">
        <div className="flex items-center gap-3">
          <Loader2 size={18} strokeWidth={1.5} className="animate-spin text-ink-3" />
          <span className="text-sm text-ink-3">메모를 불러오고 있어요</span>
        </div>
      </div>
    );
  }

  if (!memo) return null;

  const imageSrc = isEditing ? editImagePreview : (memo.imageUrl ? (memo.imageUrl.startsWith('/uploads/') ? `${apiUrl}${memo.imageUrl}` : memo.imageUrl) : null);

  const matchedMemos = allMemos.filter(m => m.id !== memo.id && m.title.toLowerCase().includes(mentionState.query.toLowerCase())).slice(0, 5);
  const matchedSchedules = schedules.filter(s => s.title.toLowerCase().includes(mentionState.query.toLowerCase())).slice(0, 5);

  return (
    <div className={`flex flex-col lg:flex-row bg-surface overflow-hidden ${isPage ? 'h-[calc(100vh-64px)]' : 'h-[90vh] w-full'}`}>
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col p-6 lg:p-8 overflow-y-auto no-scrollbar border-r border-line pb-24">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3 flex-wrap flex-1">
            {isPage && !isEditing && (
              <button
                onClick={() => router.back()}
                className="btn-ghost mr-2"
                title="뒤로가기"
              >
                <ChevronLeft size={18} strokeWidth={1.5} />
              </button>
            )}

            {isEditing ? (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="제목"
                className="form-input text-2xl font-semibold flex-1"
              />
            ) : (
              <h2 className="text-2xl font-semibold text-ink">{memo.title}</h2>
            )}

            <div className="flex items-center gap-1 ml-auto">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    disabled={isSaving}
                    className="btn-primary flex items-center gap-2 disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 size={16} strokeWidth={1.5} className="animate-spin" /> : <Check size={16} strokeWidth={1.5} />}
                    저장
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    className="btn-secondary disabled:opacity-50"
                  >
                    취소
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleToggleFavorite}
                    className={`btn-ghost ${memo.isFavorite ? 'text-accent' : 'text-ink-3'}`}
                    title="즐겨찾기"
                  >
                    <Star size={18} strokeWidth={1.5} className={memo.isFavorite ? 'fill-current' : ''} />
                  </button>
                  <button
                    type="button"
                    onClick={handleStartEdit}
                    className="btn-ghost text-ink-3"
                    title="메모 수정"
                  >
                    <Pencil size={18} strokeWidth={1.5} />
                  </button>
                  {session?.user?.id === memo.authorId && (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsShareModalOpen(true)}
                        className="btn-ghost text-ink-3"
                        title="공유하기"
                      >
                        <Share2 size={18} strokeWidth={1.5} />
                      </button>
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="btn-ghost text-ink-3 hover:text-negative hover:bg-negative-soft disabled:opacity-50"
                        title="삭제하기"
                      >
                        {isDeleting ? <Loader2 size={18} strokeWidth={1.5} className="animate-spin" /> : <Trash2 size={18} strokeWidth={1.5} />}
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
          {!isPage && !isEditing && (
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost text-ink-3 lg:hidden ml-4"
            >
              <X size={18} strokeWidth={1.5} />
            </button>
          )}
        </div>

        {!isEditing && (
          <div className="space-y-1 mb-6 text-sm text-ink-3">
            <div className="flex items-center gap-2">
              <span>작성자</span>
              <span className="text-ink-2">{memo.authorNickname}</span>
            </div>
            {memo.lastModifierNickname && (
              <div className="flex items-center gap-2">
                <span>마지막 수정</span>
                <span className="text-ink-2">{memo.lastModifierNickname}</span>
              </div>
            )}
            <p className="pt-1"><span className="stamp">{formatDateTime(memo.createdAt)}</span> 작성</p>
          </div>
        )}

        {imageSrc && (
          <MemoImage
            src={imageSrc}
            alt={memo.title}
            isEditing={isEditing}
            onImageSelect={handleImageSelect}
            onImageRemove={() => {
              setEditImagePreview(null);
              setEditImageFile(null);
            }}
          />
        )}
        {!imageSrc && isEditing && (
          <MemoImage
            src={""}
            alt={""}
            isEditing={isEditing}
            onImageSelect={handleImageSelect}
          />
        )}

        <div className="text-ink leading-relaxed min-h-[400px] relative" data-color-mode="light" onKeyUp={isEditing ? handleEditorKeyUp : undefined}>
          {isEditing ? (
            <MDEditor
              previewOptions={{ rehypePlugins: markdownRehypePlugins }}
              value={editContent}
              onChange={(val) => setEditContent(val || '')}
              preview="live"
              height="100%"
              style={{ borderRadius: '0.75rem', border: '1px solid var(--color-line)' }}
            />
          ) : (
            <EdMarkdown
              rehypePlugins={markdownRehypePlugins}
              source={memo.content}
              style={{
                backgroundColor: 'transparent',
                fontSize: '1rem',
                fontWeight: 400,
                color: 'inherit'
              }}
            />
          )}

          {/* 에디터 인라인 멘션 팝업 */}
          {isEditing && mentionState.active && (matchedMemos.length > 0 || matchedSchedules.length > 0) && (
            <div className="absolute z-50 bottom-4 left-4 w-72 max-h-64 overflow-y-auto bg-surface border border-line shadow-float rounded-2xl p-2 no-scrollbar">
              {matchedSchedules.length > 0 && (
                <div className="mb-2">
                  <div className="text-xs text-ink-3 px-2 py-1">일정</div>
                  {matchedSchedules.map(s => (
                    <button key={s.id} onClick={() => insertMention(s, 'schedule')} className="w-full text-left px-3 py-2 hover:bg-raised rounded-lg text-sm text-ink flex items-center gap-2 transition-colors duration-150 ease-out">
                      <LucideCalendar size={16} strokeWidth={1.5} className="shrink-0 text-ink-3" />
                      <span className="truncate">{s.title}</span>
                    </button>
                  ))}
                </div>
              )}
              {matchedMemos.length > 0 && (
                <div>
                  <div className="text-xs text-ink-3 px-2 py-1">메모</div>
                  {matchedMemos.map(m => (
                    <button key={m.id} onClick={() => insertMention(m, 'memo')} className="w-full text-left px-3 py-2 hover:bg-raised rounded-lg text-sm text-ink flex items-center gap-2 transition-colors duration-150 ease-out">
                      <FileText size={16} strokeWidth={1.5} className="shrink-0 text-ink-3" />
                      <span className="truncate">{m.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sidebar - AI Insights & Tags */}
      <div className="w-full lg:w-[360px] bg-canvas p-6 overflow-y-auto no-scrollbar flex flex-col gap-6 shrink-0 relative">
        {!isPage && !isEditing && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-6 right-6 btn-ghost text-ink-3 hidden lg:block"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        )}

        <div className="space-y-3 pt-4 lg:pt-0">
          <div className="flex items-center gap-2 text-ink font-semibold">
            <Sparkles size={16} strokeWidth={1.5} className="text-ink-3" />
            <span className="text-base">AI 인사이트</span>
            {insight && !loadingInsight && !isEditing && (
              <button
                onClick={handleAnalyze}
                className="p-1 text-ink-3 hover:text-ink hover:bg-raised rounded-md transition-colors duration-150 ease-out ml-1"
                title="다시 분석"
              >
                <RefreshCw size={16} strokeWidth={1.5} />
              </button>
            )}
            {loadingInsight && <Loader2 size={16} strokeWidth={1.5} className="animate-spin text-ink-3 ml-1" />}
          </div>

          <div className="card p-5 space-y-4">
            {loadingInsight ? (
              <div className="flex flex-col items-center justify-center py-4 gap-2">
                <Loader2 size={18} strokeWidth={1.5} className="animate-spin text-ink-3" />
                <p className="text-xs text-ink-3">분석하고 있어요</p>
              </div>
            ) : insight ? (
              <>
                <div className="space-y-2">
                  <span className="text-xs text-ink-3">
                    요약
                  </span>
                  <p className="text-sm text-ink-2 leading-relaxed">{insight.summary}</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-3">추천 태그</span>
                    <span className="text-xs text-ink-3">눌러서 추가</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(insight.keywords ?? []).map((kw) => {
                      const isAdded = currentTags.includes(kw);
                      return (
                        <button
                          key={kw}
                          onClick={() => !isAdded && addTag(kw)}
                          disabled={isAdded}
                          className={`text-xs px-2 py-0.5 rounded-md transition-colors duration-150 ease-out ${isAdded
                            ? 'bg-raised text-ink-3 cursor-default'
                            : 'bg-accent-soft text-accent hover:bg-raised'
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
                <p className="text-sm text-ink-3">아직 분석 결과가 없어요</p>
                {!isEditing && (
                  <button
                    onClick={handleAnalyze}
                    className="btn-primary"
                  >
                    분석 시작
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-ink font-semibold">
            <TagIcon size={16} strokeWidth={1.5} className="text-ink-3" />
            <span className="text-base">태그</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {currentTags.map((tag) => (
              <span
                key={tag}
                className="text-xs text-ink-2 bg-raised rounded-md px-2 py-0.5 flex items-center gap-1.5 group/tag"
              >
                #{tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="text-ink-3 hover:text-negative transition-colors duration-150 ease-out"
                >
                  <X size={12} strokeWidth={1.5} />
                </button>
              </span>
            ))}

            <div className="relative">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTag(tagInput)}
                placeholder="태그 추가"
                className="form-input text-xs w-28 h-7 px-2"
              />
            </div>
          </div>
        </div>

        {!isEditing && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-ink font-semibold">
              <MessageSquare size={16} strokeWidth={1.5} className="text-ink-3" />
              <span className="text-base">이미지에서 읽은 글자</span>
            </div>
            <div className="card p-4 text-sm text-ink-2 leading-relaxed whitespace-pre-wrap min-h-[100px]">
              {loadingInsight ? '분석 중…' : insight?.ocrText ?? '—'}
            </div>
          </div>
        )}

        {/* Tagged Memos and Schedules */}
        {!isEditing && memo.taggedSchedules && memo.taggedSchedules.length > 0 && (
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-ink font-semibold">
              <LucideCalendar size={16} strokeWidth={1.5} className="text-ink-3" />
              <span className="text-base">연결된 일정</span>
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {memo.taggedSchedules.map((sch) => (
                <div key={sch.id} className="card flex items-center gap-3 px-4 py-3">
                  <LucideCalendar size={16} strokeWidth={1.5} className="text-ink-3 shrink-0" />
                  <h4 className="text-sm text-ink truncate flex-1">{sch.title}</h4>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isEditing && memo.taggedMemos && memo.taggedMemos.length > 0 && (
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-ink font-semibold">
              <FileText size={16} strokeWidth={1.5} className="text-ink-3" />
              <span className="text-base">연결된 메모</span>
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {memo.taggedMemos.map((m) => (
                <div key={m.id} onClick={() => router.push(`/memo/${m.id}`)} className="card flex items-center gap-3 px-4 py-3 hover:border-line-strong cursor-pointer transition-colors duration-150 ease-out">
                  <FileText size={16} strokeWidth={1.5} className="text-ink-3 shrink-0" />
                  <h4 className="text-sm text-ink truncate flex-1">{m.title}</h4>
                  <ChevronRight size={16} strokeWidth={1.5} className="text-ink-3" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <MemoShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        memoId={memo.id}
        memoTitle={memo.title}
      />
    </div>
  );
}