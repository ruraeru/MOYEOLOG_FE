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
import { formatStamp, useTimeFormat } from '@/lib/schedule-utils';
import { useSession } from 'next-auth/react';
import {
  memoApi,
  type MemoResponse,
  type MemoInsight,
  getMemoPermissions,
  extractMentionIds,
  matchMentionQuery,
  mentionMatches,
  MAX_IMAGE_BYTES,
  IMAGE_TOO_LARGE_MESSAGE,
} from '@/lib/memo-api';
import axios from 'axios';
import { getApiErrorMessage } from '@/lib/axios';
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
  /** 수정 중 저장하지 않은 내용이 있는지 (모달 바깥 클릭 시 확인용) */
  onDirtyChange?: (dirty: boolean) => void;
}

function formatDateTime(iso: string, tf: string) {
  return formatStamp(iso, tf);
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
      containerClassName="w-full h-64 sm:h-80 mb-4 rounded-2xl shrink-0"
      className="object-contain"
    />
  );
}

import { useAlert } from '@/hooks/useAlert';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LEAVE_MESSAGE = '저장하지 않은 내용이 있어요. 나가면 고친 내용이 사라져요. 나갈까요?';

type LoadError = { status?: number; message: string };

function getStatus(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined;
}

export default function MemoDetailView({
  memoId,
  onDelete,
  isPage = false,
  onClose,
  onDirtyChange,
}: MemoDetailViewProps) {
  const tf = useTimeFormat();
  const router = useRouter();
  const { data: session } = useSession();
  const { confirm, toast } = useAlert();
  const [memo, setMemo] = useState<MemoResponse | null>(null);
  const [insight, setInsight] = useState<MemoInsight | null>(null);
  const [currentTags, setCurrentTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [loadingMemo, setLoadingMemo] = useState(false);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Editing states
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImageRemoved, setEditImageRemoved] = useState(false);
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

  const applyMemo = (data: MemoResponse) => {
    setMemo(data);
    setCurrentTags(data.tags || []);
    if (data.insight) setInsight(data.insight);
  };

  // 화면을 갈아엎지 않고 메모만 다시 받아온다 (공유 변경 뒤 등)
  const refreshMemo = async () => {
    if (!memoId || !session) return;
    try {
      applyMemo(await memoApi.getById(memoId, session));
    } catch (error) {
      setMemo(null);
      setLoadError({ status: getStatus(error), message: getApiErrorMessage(error) });
    }
  };

  const fetchMemoDetail = async () => {
    if (!memoId || !session) return;
    if (!UUID_RE.test(memoId)) {
      setLoadError({ status: 400, message: '' });
      return;
    }
    setLoadingMemo(true);
    setLoadError(null);
    try {
      const data = await memoApi.getById(memoId, session);
      applyMemo(data);

      if (!data.insight) {
        // 인사이트가 없거나 읽을 수 없어도 메모는 보여 준다.
        try {
          const res = await memoApi.getInsight(memoId, session);
          setInsight(res);
        } catch (e) {
          console.error('Failed to fetch insight:', e);
          setInsight(null);
        }
      }
    } catch (error) {
      console.error('Failed to fetch memo detail:', error);
      setMemo(null);
      setLoadError({ status: getStatus(error), message: getApiErrorMessage(error) });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memoId, session]);

  const permissions = memo ? getMemoPermissions(memo, session?.user?.id) : null;

  const isDirty = !!memo && isEditing && (
    editTitle !== memo.title ||
    editContent !== memo.content ||
    !!editImageFile ||
    editImageRemoved
  );

  // 수정 중 이탈 경고: 새로고침·탭 닫기(beforeunload)와 화면 안 링크 이동
  useEffect(() => {
    onDirtyChange?.(isDirty);
    if (!isDirty) return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    const onClickCapture = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const href = anchor.getAttribute('href') || '';
      if (href.startsWith('#')) return;
      if (!window.confirm(LEAVE_MESSAGE)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClickCapture, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClickCapture, true);
    };
  }, [isDirty, onDirtyChange]);

  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

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
    setEditImageRemoved(false);
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

  const handleCancelEdit = async () => {
    if (isDirty && !(await confirm('고친 내용을 버리고 수정을 그만둘까요?', undefined, '버리기', '계속 고치기'))) return;
    setIsEditing(false);
    setEditImageFile(null);
    setEditImageRemoved(false);
    setMentionState({ active: false, query: '', startPos: 0, endPos: 0 });
  };

  const handleSaveEdit = async () => {
    if (!memo) return;
    if (!editTitle.trim()) {
      toast.error('제목을 입력해 주세요');
      return;
    }
    if (!editContent.trim()) {
      toast.error('내용을 입력해 주세요');
      return;
    }
    setIsSaving(true);
    try {
      // 본문 링크에서 연결을 뽑되, 본문에 링크가 없던 기존 연결(일정 화면에서 만든 연결 등)은 유지한다.
      const keepLinks = (type: 'memo' | 'schedule', existing?: { id: string }[]) => {
        const before = new Set(extractMentionIds(memo.content, type));
        const preserved = (existing ?? []).map(x => x.id).filter(id => !before.has(id));
        return Array.from(new Set([...extractMentionIds(editContent, type), ...preserved]));
      };

      const updated = await memoApi.update(memo.id, {
        title: editTitle,
        content: editContent,
        imageFile: editImageFile || undefined,
        removeImage: editImageRemoved && !editImageFile,
        version: memo.version,
        tags: currentTags,
        taggedMemoIds: keepLinks('memo', memo.taggedMemos),
        taggedScheduleIds: keepLinks('schedule', memo.taggedSchedules),
      }, session);

      applyMemo(updated);
      setIsEditing(false);
      setEditImageFile(null);
      setEditImageRemoved(false);
      setMentionState({ active: false, query: '', startPos: 0, endPos: 0 });
      toast.success('저장했어요');
    } catch (error) {
      console.error('Failed to save memo:', error);
      const status = getStatus(error);
      if (status === 409) {
        // 다른 사람이 먼저 고침: 입력은 그대로 두고 최신 내용을 불러올지 묻는다.
        const reload = await confirm(
          `${getApiErrorMessage(error, '다른 곳에서 먼저 바뀌었어요.')} 최신 내용을 불러오면 지금 고친 내용은 사라져요. 불러올까요?`,
          '먼저 바뀐 메모예요',
          '최신 내용 불러오기',
          '계속 고치기'
        );
        if (reload) {
          setIsEditing(false);
          await fetchMemoDetail();
        }
      } else if (status === 403 || status === 404) {
        toast.error(getApiErrorMessage(error));
        setIsEditing(false);
        await fetchMemoDetail();
      } else {
        toast.error(getApiErrorMessage(error, '저장하지 못했어요'));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageSelect = async (file: File) => {
    try {
      const webpFile = await convertToWebP(file);
      if (webpFile.size > MAX_IMAGE_BYTES) {
        toast.error(IMAGE_TOO_LARGE_MESSAGE);
        return;
      }
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
      toast.error(getApiErrorMessage(error, getStatus(error) ? undefined : '분석하지 못했어요'));
    } finally {
      setLoadingInsight(false);
    }
  };

  const syncTags = async (newTags: string[]) => {
    if (!memoId || !session) return;
    try {
      const updated = await memoApi.updateTags(memoId, newTags, session);
      setCurrentTags(updated.tags || newTags);
      setMemo(prev => (prev ? { ...prev, tags: updated.tags || newTags, version: updated.version ?? prev.version } : prev));
    } catch (error) {
      console.error('Failed to sync tags:', error);
      toast.error(getApiErrorMessage(error, getStatus(error) ? undefined : '태그를 저장하지 못했어요'));
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
      toast.error(getApiErrorMessage(error, getStatus(error) ? undefined : '메모를 삭제하지 못했어요'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!memoId || !session) return;
    try {
      const updated = await memoApi.toggleFavorite(memoId, session);
      setMemo(prev => (prev ? { ...prev, isFavorite: updated.isFavorite } : updated));
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      const status = getStatus(error);
      toast.error(getApiErrorMessage(error, status ? undefined : '즐겨찾기를 바꾸지 못했어요'));
      // 공유가 풀렸거나 삭제된 경우: 안내 화면으로 바꾼다.
      if (status === 403 || status === 404) await fetchMemoDetail();
    }
  };

  // 인라인 멘션 핸들러 (제목에 공백이 있어도 이어서 검색)
  const handleEditorKeyUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLTextAreaElement;
    if (target.tagName !== 'TEXTAREA') return;

    const cursor = target.selectionStart;
    const textBeforeCursor = target.value.slice(0, cursor);
    const match = matchMentionQuery(textBeforeCursor);

    if (match) {
      setMentionState({ active: true, query: match.query, startPos: match.index, endPos: cursor });
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

  const heightClass = isPage ? 'h-full' : 'h-[100dvh] sm:h-[85vh] w-full';

  if (loadError && !loadingMemo) {
    const s = loadError.status;
    const view =
      s === 400 ? { title: '주소가 올바르지 않아요', desc: '메모 주소를 다시 확인해 주세요.', retry: false } :
      s === 404 ? { title: '메모를 찾을 수 없어요', desc: '삭제됐거나 주소가 바뀐 메모예요.', retry: false } :
      s === 403 ? { title: '볼 수 없는 메모예요', desc: '작성자가 공유한 메모나 내가 속한 모임의 메모만 볼 수 있어요.', retry: false } :
      { title: '메모를 불러오지 못했어요', desc: loadError.message, retry: true };
    return (
      <div className={`flex flex-col items-center justify-center gap-2 p-8 text-center bg-surface ${heightClass}`}>
        <div className="size-10 rounded-full bg-raised flex items-center justify-center mb-2">
          <FileText size={18} strokeWidth={1.5} className="text-ink-3" />
        </div>
        <h2 className="text-base font-semibold text-ink">{view.title}</h2>
        <p className="text-sm text-ink-3 max-w-sm">{view.desc}</p>
        <div className="flex flex-wrap justify-center gap-2 mt-4">
          {view.retry && (
            <button type="button" onClick={fetchMemoDetail} className="btn-secondary flex items-center gap-1.5">
              <RefreshCw size={16} strokeWidth={1.5} />
              다시 시도
            </button>
          )}
          {isPage ? (
            <button type="button" onClick={() => router.push('/memo')} className="btn-primary">
              메모 목록으로
            </button>
          ) : (
            <button type="button" onClick={onClose} className="btn-primary">
              닫기
            </button>
          )}
        </div>
      </div>
    );
  }

  if (loadingMemo || !memo || !permissions) {
    return (
      <div className={`flex-1 flex items-center justify-center bg-surface p-4 ${heightClass}`}>
        <div className="flex items-center gap-3">
          <Loader2 size={18} strokeWidth={1.5} className="animate-spin text-ink-3" />
          <span className="text-sm text-ink-3">메모를 불러오고 있어요</span>
        </div>
      </div>
    );
  }

  const imageSrc = isEditing ? editImagePreview : (memo.imageUrl ? (memo.imageUrl.startsWith('/uploads/') ? `${apiUrl}${memo.imageUrl}` : memo.imageUrl) : null);

  const matchedMemos = allMemos.filter(m => m.id !== memo.id && mentionMatches(m.title, mentionState.query)).slice(0, 5);
  const matchedSchedules = schedules.filter(s => mentionMatches(s.title, mentionState.query)).slice(0, 5);
  const readOnly = !permissions.edit && !permissions.tag && !permissions.analyze;

  return (
    <div className={`flex flex-col lg:flex-row bg-surface overflow-y-auto lg:overflow-hidden no-scrollbar ${heightClass}`}>
      {/* Main Content Area — 모바일에서는 화면 전체가 한 번에 스크롤되도록 안쪽 스크롤을 lg 이상에서만 쓴다 */}
      <div className="lg:flex-1 flex flex-col p-5 lg:p-8 lg:overflow-y-auto no-scrollbar lg:border-r border-line lg:pb-24 shrink-0 lg:shrink min-w-0">
        <div className="flex items-start justify-between mb-6 gap-2">
          <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0">
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
                aria-label="제목"
                className="form-input text-xl lg:text-2xl font-semibold flex-1 min-w-0"
              />
            ) : (
              <h2 className="text-xl lg:text-2xl font-semibold text-ink break-words min-w-0">{memo.title}</h2>
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
                    aria-label="즐겨찾기"
                  >
                    <Star size={18} strokeWidth={1.5} className={memo.isFavorite ? 'fill-current' : ''} />
                  </button>
                  {permissions.edit && (
                    <button
                      type="button"
                      onClick={handleStartEdit}
                      className="btn-ghost text-ink-3"
                      title="메모 수정"
                      aria-label="메모 수정"
                    >
                      <Pencil size={18} strokeWidth={1.5} />
                    </button>
                  )}
                  {permissions.share && (
                    <button
                      type="button"
                      onClick={() => setIsShareModalOpen(true)}
                      className="btn-ghost text-ink-3"
                      title="공유하기"
                      aria-label="공유하기"
                    >
                      <Share2 size={18} strokeWidth={1.5} />
                    </button>
                  )}
                  {permissions.delete && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="btn-ghost text-ink-3 hover:text-negative hover:bg-negative-soft disabled:opacity-50"
                      title="삭제하기"
                      aria-label="삭제하기"
                    >
                      {isDeleting ? <Loader2 size={18} strokeWidth={1.5} className="animate-spin" /> : <Trash2 size={18} strokeWidth={1.5} />}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          {!isPage && !isEditing && (
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost text-ink-3 lg:hidden"
              aria-label="닫기"
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
            <p className="pt-1"><span className="stamp">{formatDateTime(memo.createdAt, tf)}</span> 작성</p>
            {readOnly && (
              <p className="pt-1 text-ink-3">공유받은 메모라 읽기만 할 수 있어요</p>
            )}
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
              if (memo.imageUrl) setEditImageRemoved(true);
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

        <div className="text-ink leading-relaxed min-h-[300px] lg:min-h-[400px] relative" data-color-mode="light" onKeyUp={isEditing ? handleEditorKeyUp : undefined}>
          {isEditing ? (
            <MDEditor
              previewOptions={{ rehypePlugins: markdownRehypePlugins }}
              value={editContent}
              onChange={(val) => setEditContent(val || '')}
              preview="live"
              height="100%"
              style={{ borderRadius: '0.75rem', border: '1px solid var(--color-line)', minHeight: 300 }}
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
            <div className="absolute z-50 bottom-4 left-4 w-72 max-w-[calc(100%-2rem)] max-h-64 overflow-y-auto bg-surface border border-line shadow-float rounded-2xl p-2 no-scrollbar">
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
      <div className="w-full lg:w-[360px] bg-canvas p-5 lg:p-6 lg:overflow-y-auto no-scrollbar flex flex-col gap-6 shrink-0 relative border-t lg:border-t-0 border-line pb-28 lg:pb-6">
        {!isPage && !isEditing && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-6 right-6 btn-ghost text-ink-3 hidden lg:block"
            aria-label="닫기"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        )}

        <div className="space-y-3 pt-0 lg:pt-0">
          <div className="flex items-center gap-2 text-ink font-semibold">
            <Sparkles size={16} strokeWidth={1.5} className="text-ink-3" />
            <span className="text-base">AI 인사이트</span>
            {insight && !loadingInsight && !isEditing && permissions.analyze && (
              <button
                onClick={handleAnalyze}
                className="p-1 text-ink-3 hover:text-ink hover:bg-raised rounded-md transition-colors duration-150 ease-out ml-1"
                title="다시 분석"
                aria-label="다시 분석"
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
                {(insight.analyzedAt || insight.stale) && (
                  <div className="space-y-1">
                    {insight.analyzedAt && (
                      <p className="text-xs text-ink-3"><span className="stamp">{formatDateTime(insight.analyzedAt, tf)}</span> 분석</p>
                    )}
                    {insight.stale && (
                      <p className="text-xs text-ink-2">
                        분석한 뒤 메모가 바뀌었어요.{permissions.analyze ? ' 다시 분석하면 지금 내용으로 정리해요.' : ''}
                      </p>
                    )}
                  </div>
                )}
                <div className="space-y-2">
                  <span className="text-xs text-ink-3">
                    요약
                  </span>
                  <p className="text-sm text-ink-2 leading-relaxed">{insight.summary || '—'}</p>
                </div>

                {(insight.keywords ?? []).length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-ink-3">추천 태그</span>
                      {permissions.tag && <span className="text-xs text-ink-3">눌러서 추가</span>}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(insight.keywords ?? []).map((kw) => {
                        const isAdded = currentTags.includes(kw);
                        if (!permissions.tag) {
                          return (
                            <span key={kw} className="text-xs px-2 py-0.5 rounded-md bg-raised text-ink-2">{kw}</span>
                          );
                        }
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
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-4 gap-3 text-center">
                <p className="text-sm text-ink-3">아직 분석 결과가 없어요</p>
                {!isEditing && permissions.analyze && (
                  <button
                    onClick={handleAnalyze}
                    className="btn-primary"
                  >
                    분석 시작
                  </button>
                )}
                {!permissions.analyze && (
                  <p className="text-xs text-ink-3">분석은 작성자만 할 수 있어요</p>
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
                {permissions.tag && (
                  <button
                    onClick={() => removeTag(tag)}
                    className="text-ink-3 hover:text-negative transition-colors duration-150 ease-out"
                    aria-label={`${tag} 태그 빼기`}
                  >
                    <X size={12} strokeWidth={1.5} />
                  </button>
                )}
              </span>
            ))}

            {permissions.tag ? (
              <div className="relative">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) addTag(tagInput);
                  }}
                  placeholder="태그 추가"
                  aria-label="태그 추가"
                  className="form-input text-xs w-28 h-7 px-2"
                />
              </div>
            ) : currentTags.length === 0 && (
              <p className="text-xs text-ink-3">태그가 없어요</p>
            )}
          </div>
        </div>

        {!isEditing && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-ink font-semibold">
              <MessageSquare size={16} strokeWidth={1.5} className="text-ink-3" />
              <span className="text-base">이미지에서 읽은 글자</span>
            </div>
            <div className="card p-4 text-sm text-ink-2 leading-relaxed whitespace-pre-wrap min-h-[100px]">
              {loadingInsight ? '분석 중…' : insight?.ocrText || '—'}
            </div>
          </div>
        )}

        {/* 공유한 사람 (작성자에게만 내려옴) */}
        {!isEditing && permissions.share && (memo.sharedWith?.length ?? 0) > 0 && (
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-ink font-semibold">
              <Share2 size={16} strokeWidth={1.5} className="text-ink-3" />
              <span className="text-base">공유한 친구</span>
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {memo.sharedWith!.map(u => (
                <span key={u.id} className="text-xs text-ink-2 bg-raised rounded-md px-2 py-0.5">{u.nickname}</span>
              ))}
            </div>
            <button type="button" onClick={() => setIsShareModalOpen(true)} className="text-xs text-ink-2 hover:text-ink transition-colors duration-150 ease-out">
              공유 관리
            </button>
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
                <button
                  type="button"
                  key={sch.id}
                  onClick={() => router.push(`/schedule/${sch.id}`)}
                  className="card flex items-center gap-3 px-4 py-3 text-left hover:border-line-strong cursor-pointer transition-colors duration-150 ease-out"
                >
                  <LucideCalendar size={16} strokeWidth={1.5} className="text-ink-3 shrink-0" />
                  <h4 className="text-sm text-ink truncate flex-1">{sch.title}</h4>
                  <ChevronRight size={16} strokeWidth={1.5} className="text-ink-3" />
                </button>
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
                <button
                  type="button"
                  key={m.id}
                  onClick={() => router.push(`/memo/${m.id}`)}
                  className="card flex items-center gap-3 px-4 py-3 text-left hover:border-line-strong cursor-pointer transition-colors duration-150 ease-out"
                >
                  <FileText size={16} strokeWidth={1.5} className="text-ink-3 shrink-0" />
                  <h4 className="text-sm text-ink truncate flex-1">{m.title}</h4>
                  <ChevronRight size={16} strokeWidth={1.5} className="text-ink-3" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {permissions.share && (
        <MemoShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          memoId={memo.id}
          memoTitle={memo.title}
          sharedWith={memo.sharedWith ?? []}
          onChanged={refreshMemo}
        />
      )}
    </div>
  );
}
