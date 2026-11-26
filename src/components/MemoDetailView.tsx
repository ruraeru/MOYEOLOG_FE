'use client';

import React, { useEffect, useState, useRef } from 'react';
import ImageWithFallback from './ImageWithFallback';
import {
  X,
  Share2,
  RefreshCw,
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
import { fileToDataUrl, convertToWebP, initialOf } from '@/lib/utils';
import { EmptyState } from './ui';
import RichEditor from './RichEditor';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';

const EdMarkdown = dynamic(
  () => import('@uiw/react-md-editor').then((mod) => mod.default.Markdown),
  { ssr: false }
);


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
        className="relative mb-5 flex min-h-30 w-full cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed border-line-strong bg-surface p-5 transition-colors duration-150 ease-out hover:bg-raised"
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
            <Upload size={16} strokeWidth={1.5} className="text-ink-3" />
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
            className="btn-danger btn-sm absolute right-3 top-3"
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
      <img src={src} alt={alt} className="mb-5 max-h-48 w-full rounded-xl object-cover" />
    );
  }
  return (
    <ImageWithFallback
      src={src}
      alt={alt}
      fill
      sizes="(max-width: 768px) 100vw, 50vw"
      containerClassName="mb-5 h-56 w-full shrink-0 rounded-xl bg-raised sm:h-80"
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

  const heightClass = isPage ? 'h-full' : 'h-[100dvh] sm:h-[85vh] w-full';

  if (loadError && !loadingMemo) {
    const s = loadError.status;
    const view =
      s === 400 ? { title: '주소가 올바르지 않아요', desc: '메모 주소를 다시 확인해 주세요.', retry: false } :
      s === 404 ? { title: '메모를 찾을 수 없어요', desc: '삭제됐거나 주소가 바뀐 메모예요.', retry: false } :
      s === 403 ? { title: '볼 수 없는 메모예요', desc: '작성자가 공유한 메모나 내가 속한 모임의 메모만 볼 수 있어요.', retry: false } :
      { title: '메모를 불러오지 못했어요', desc: loadError.message, retry: true };
    return (
      <div className={`flex items-center justify-center bg-surface ${heightClass}`}>
        <EmptyState
          title={view.title}
          description={view.desc}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {view.retry && (
                <button type="button" onClick={fetchMemoDetail} className="btn-secondary">
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
          }
        />
      </div>
    );
  }

  if (loadingMemo || !memo || !permissions) {
    return (
      <div className={`flex-1 flex items-center justify-center bg-surface p-4 ${heightClass}`}>
        <div className="flex items-center gap-2">
          <Loader2 size={16} strokeWidth={1.5} className="animate-spin text-ink-3" />
          <span className="text-sm text-ink-3">메모를 불러오고 있어요</span>
        </div>
      </div>
    );
  }

  const imageSrc = isEditing ? editImagePreview : (memo.imageUrl ? (memo.imageUrl.startsWith('/uploads/') ? `${apiUrl}${memo.imageUrl}` : memo.imageUrl) : null);

  const readOnly = !permissions.edit && !permissions.tag && !permissions.analyze;

  return (
    <div className={`flex flex-col lg:flex-row bg-surface overflow-y-auto lg:overflow-hidden no-scrollbar ${heightClass}`}>
      {/* 본문 — 모바일에서는 화면 전체가 한 번에 스크롤되도록 안쪽 스크롤을 lg 이상에서만 쓴다 */}
      <div className="lg:flex-1 flex flex-col px-5 py-4 lg:px-8 lg:py-6 lg:overflow-y-auto no-scrollbar lg:border-r border-line lg:pb-24 shrink-0 lg:shrink min-w-0">
        <div className="mb-3 flex items-center gap-1">
          {isPage && !isEditing && (
            <button
              onClick={() => router.back()}
              className="btn-icon -ml-2"
              title="뒤로가기"
            >
              <ChevronLeft size={18} strokeWidth={1.5} />
            </button>
          )}

          <div className="ml-auto flex items-center gap-1">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="btn-secondary"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="btn-primary"
                >
                  {isSaving ? <Loader2 size={16} strokeWidth={1.5} className="animate-spin" /> : <Check size={16} strokeWidth={1.5} />}
                  저장
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleToggleFavorite}
                  className={`btn-icon ${memo.isFavorite ? 'text-accent hover:text-accent' : ''}`}
                  title="즐겨찾기"
                  aria-label="즐겨찾기"
                >
                  <Star size={18} strokeWidth={1.5} className={memo.isFavorite ? 'fill-current' : ''} />
                </button>
                {permissions.edit && (
                  <button
                    type="button"
                    onClick={handleStartEdit}
                    className="btn-icon"
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
                    className="btn-icon"
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
                    className="btn-icon hover:bg-negative-soft hover:text-negative"
                    title="삭제하기"
                    aria-label="삭제하기"
                  >
                    {isDeleting ? <Loader2 size={18} strokeWidth={1.5} className="animate-spin" /> : <Trash2 size={18} strokeWidth={1.5} />}
                  </button>
                )}
                {!isPage && (
                  <>
                    <span aria-hidden className="mx-1 h-5 w-px bg-line-strong" />
                    <button
                      type="button"
                      onClick={onClose}
                      className="btn-icon"
                      aria-label="닫기"
                    >
                      <X size={18} strokeWidth={1.5} />
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {isEditing ? (
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="제목"
            aria-label="제목"
            className="form-input mb-5 h-12 font-display text-2xl"
          />
        ) : (
          <>
            <h2 className="font-display text-2xl leading-8 text-ink break-words lg:text-[28px] lg:leading-9">{memo.title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-3">
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="flex size-5 items-center justify-center rounded-full bg-raised text-[11px] font-medium text-ink-2">
                  {initialOf(memo.authorNickname)}
                </span>
                <span className="text-ink-2">{memo.authorNickname}</span>
              </span>
              <span className="stamp">{formatDateTime(memo.createdAt, tf)}</span>
              {memo.lastModifierNickname && (
                <>
                  <span aria-hidden>·</span>
                  <span>마지막 수정 <span className="text-ink-2">{memo.lastModifierNickname}</span></span>
                </>
              )}
            </div>
            {readOnly && (
              <p className="mt-2 text-[13px] text-ink-3">공유받은 메모라 읽기만 할 수 있어요</p>
            )}
            <div aria-hidden className="mb-5 mt-4 h-px bg-line" />
          </>
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

        <div className="text-ink min-h-50 lg:min-h-100 relative" data-color-mode="light">
          {isEditing ? (
            <RichEditor
              value={editContent}
              onChange={setEditContent}
              mentions={{ memos: allMemos.filter((m) => m.id !== memo.id), schedules }}
              className="h-[60vh] min-h-[300px]"
            />
          ) : (
            <EdMarkdown
              rehypePlugins={markdownRehypePlugins}
              source={memo.content}
              style={{
                backgroundColor: 'transparent',
                fontSize: '15px',
                lineHeight: 1.75,
                fontWeight: 400,
                color: 'inherit'
              }}
            />
          )}

        </div>
      </div>

      {/* 오른쪽: 분석·태그·공유·연결 */}
      <aside className="w-full lg:w-[340px] bg-canvas px-5 pt-5 pb-24 lg:p-6 lg:overflow-y-auto no-scrollbar flex flex-col gap-6 shrink-0 border-t lg:border-t-0 border-line">
        <section className="rounded-xl bg-raised p-4">
          <div className="flex h-8 items-center gap-2">
            <h3 className="text-[13px] font-medium text-ink-2">분석</h3>
            <div className="ml-auto flex items-center gap-1">
              {insight?.analyzedAt && !loadingInsight && (
                <span className="stamp">{formatDateTime(insight.analyzedAt, tf)} 기준</span>
              )}
              {insight && !loadingInsight && !isEditing && permissions.analyze && (
                <button
                  onClick={handleAnalyze}
                  className="btn-icon -mr-2 hover:bg-surface"
                  title="다시 분석"
                  aria-label="다시 분석"
                >
                  <RefreshCw size={16} strokeWidth={1.5} />
                </button>
              )}
            </div>
          </div>

          {loadingInsight ? (
            <p className="mt-2 flex items-center gap-2 text-[13px] text-ink-3">
              <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
              분석하고 있어요
            </p>
          ) : insight ? (
            <div className="mt-2 space-y-4">
              {insight.stale && (
                <p className="text-xs leading-relaxed text-ink-2">
                  분석한 뒤 메모가 바뀌었어요.{permissions.analyze ? ' 다시 분석하면 지금 내용으로 정리해요.' : ''}
                </p>
              )}
              <p className="text-sm leading-relaxed text-ink">{insight.summary || '—'}</p>

              {(insight.keywords ?? []).length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-ink-3">추천 태그</span>
                    {permissions.tag && <span className="text-xs text-ink-3">눌러서 추가</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(insight.keywords ?? []).map((kw) => {
                      const isAdded = currentTags.includes(kw);
                      if (!permissions.tag) {
                        return (
                          <span key={kw} className="inline-flex h-6 items-center rounded-md bg-surface px-2 text-xs text-ink-2">#{kw}</span>
                        );
                      }
                      return (
                        <button
                          key={kw}
                          onClick={() => !isAdded && addTag(kw)}
                          disabled={isAdded}
                          className={`inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs transition-colors duration-150 ease-out ${isAdded
                            ? 'text-ink-3 cursor-default'
                            : 'border border-line-strong bg-surface text-ink-2 hover:text-ink'
                            }`}
                        >
                          {isAdded && <Check size={12} strokeWidth={1.5} />}
                          #{kw}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-1 space-y-3">
              <p className="text-[13px] text-ink-3">아직 분석 결과가 없어요</p>
              {!isEditing && permissions.analyze && (
                <button onClick={handleAnalyze} className="btn-secondary btn-sm">
                  분석 시작
                </button>
              )}
              {!permissions.analyze && (
                <p className="text-xs text-ink-3">분석은 작성자만 할 수 있어요</p>
              )}
            </div>
          )}
        </section>

        <section className="space-y-2.5">
          <h3 className="text-[13px] font-medium text-ink-3">태그</h3>
          <div className="flex flex-wrap items-center gap-1.5">
            {currentTags.map((tag) => (
              <span key={tag} className="chip gap-1">
                #{tag}
                {permissions.tag && (
                  <button
                    onClick={() => removeTag(tag)}
                    className="-mr-0.5 text-ink-3 transition-colors duration-150 ease-out hover:text-negative"
                    aria-label={`${tag} 태그 빼기`}
                  >
                    <X size={12} strokeWidth={1.5} />
                  </button>
                )}
              </span>
            ))}

            {permissions.tag ? (
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) addTag(tagInput);
                }}
                placeholder="태그 추가"
                aria-label="태그 추가"
                className="form-input h-8 w-28 px-2.5 py-0 text-xs"
              />
            ) : currentTags.length === 0 && (
              <p className="text-[13px] text-ink-3">태그가 없어요</p>
            )}
          </div>
        </section>

        {!isEditing && (loadingInsight || insight?.ocrText) && (
          <section className="space-y-2.5">
            <h3 className="text-[13px] font-medium text-ink-3">이미지에서 읽은 글자</h3>
            <p className="card p-4 text-[13px] leading-relaxed text-ink-2 whitespace-pre-wrap">
              {loadingInsight ? '분석 중…' : insight?.ocrText}
            </p>
          </section>
        )}

        {/* 공유한 사람 (작성자에게만 내려옴) */}
        {!isEditing && permissions.share && (memo.sharedWith?.length ?? 0) > 0 && (
          <section className="space-y-1.5">
            <div className="flex items-center gap-2">
              <h3 className="text-[13px] font-medium text-ink-3">공유한 친구</h3>
              <span className="stamp">{memo.sharedWith!.length}</span>
              <button type="button" onClick={() => setIsShareModalOpen(true)} className="btn-ghost btn-sm -mr-2 ml-auto">
                공유 관리
              </button>
            </div>
            <ul>
              {memo.sharedWith!.map(u => (
                <li key={u.id} className="flex h-10 items-center gap-2.5">
                  <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-raised text-xs font-medium text-ink-2">
                    {initialOf(u.nickname)}
                  </span>
                  <span className="truncate font-display text-[15px] text-ink">{u.nickname}</span>
                  {u.canEdit && <span className="chip ml-auto shrink-0">수정 가능</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 연결된 일정·메모 */}
        {!isEditing && memo.taggedSchedules && memo.taggedSchedules.length > 0 && (
          <section className="space-y-2.5">
            <h3 className="text-[13px] font-medium text-ink-3">연결된 일정</h3>
            <div className="card overflow-hidden divide-y divide-line">
              {memo.taggedSchedules.map((sch) => (
                <button
                  type="button"
                  key={sch.id}
                  onClick={() => router.push(`/schedule/${sch.id}`)}
                  className="flex h-12 w-full items-center gap-3 px-4 text-left transition-colors duration-150 ease-out hover:bg-raised"
                >
                  <LucideCalendar size={16} strokeWidth={1.5} className="shrink-0 text-ink-3" />
                  <h4 className="flex-1 truncate text-sm text-ink">{sch.title}</h4>
                  <ChevronRight size={16} strokeWidth={1.5} className="text-ink-3" />
                </button>
              ))}
            </div>
          </section>
        )}

        {!isEditing && memo.taggedMemos && memo.taggedMemos.length > 0 && (
          <section className="space-y-2.5">
            <h3 className="text-[13px] font-medium text-ink-3">연결된 메모</h3>
            <div className="card overflow-hidden divide-y divide-line">
              {memo.taggedMemos.map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => router.push(`/memo/${m.id}`)}
                  className="flex h-12 w-full items-center gap-3 px-4 text-left transition-colors duration-150 ease-out hover:bg-raised"
                >
                  <FileText size={16} strokeWidth={1.5} className="shrink-0 text-ink-3" />
                  <h4 className="flex-1 truncate text-sm text-ink">{m.title}</h4>
                  <ChevronRight size={16} strokeWidth={1.5} className="text-ink-3" />
                </button>
              ))}
            </div>
          </section>
        )}
      </aside>

      {permissions.share && (
        <MemoShareModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          memoId={memo.id}
          memoTitle={memo.title}
          sharedWith={memo.sharedWith ?? []}
          groupId={memo.groupId}
          sharedGroupIds={memo.sharedGroupIds ?? []}
          onChanged={refreshMemo}
        />
      )}
    </div>
  );
}
