'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import ImageWithFallback from './ImageWithFallback';
import {
  X,
  Share2,
  RefreshCw,
  Loader2,
  Trash2,
  Pencil,
  Star,
  Pin,
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
import { markdownListClassName } from '@/lib/markdown';
import { GroupAvatar } from './groups/GroupIdentity';
import { groupApi, type GroupResponse } from '@/lib/group-api';
import { useLiveTopics } from '@/lib/live';
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
  const [dragOver, setDragOver] = useState(false);

  if (isEditing) {
    return (
      <div
        className={`relative mb-5 flex min-h-30 w-full cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed p-5 transition-colors duration-150 ease-out hover:bg-raised ${dragOver ? 'border-accent bg-accent-soft' : 'border-line-strong bg-surface'}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes('Files')) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) onImageSelect?.(file);
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            // 같은 파일을 다시 골라도 onChange 가 오게 비운다
            e.target.value = '';
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
                새 이미지를 <span className="max-lg:hidden">끌어다 놓거나 </span>눌러서 바꿔요
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

import { useAlert, useAlertStore } from '@/hooks/useAlert';

/** 받을 수 있는 이미지인지 실제로 디코드해 본다(확장자만 이미지인 파일 거르기) */
async function canDecodeImage(file: File): Promise<boolean> {
  if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type)) return false;
  try {
    const bitmap = await createImageBitmap(file);
    bitmap.close();
    return true;
  } catch {
    return false;
  }
}

/** LLM 요약의 '11 월 28 일', '50 만 원' 같은 숫자·단위 띄어쓰기를 붙인다 */
function tidySummary(text: string): string {
  return text.replace(/(\d)\s+(?=(?:년|월|일|시|분|초|명|개|원|만|천|억|주|%))/g, '$1');
}

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
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  /** 수정 중 다른 곳에서 메모가 바뀌었는지 (실시간 이벤트로 알게 됨) */
  const [remoteChanged, setRemoteChanged] = useState(false);
  const [group, setGroup] = useState<GroupResponse | null>(null);
  /** 수정 중 고칠 권한이 없어졌거나 메모가 사라짐(실시간 이벤트·저장 403 으로 알게 됨). 입력은 남겨 둔다 */
  const [editBlocked, setEditBlocked] = useState<string | null>(null);
  /** 작성자가 이 메모를 공유한 모임 (공유한 모임 칸) */
  const [sharedGroups, setSharedGroups] = useState<GroupResponse[]>([]);
  const titleRef = useRef<HTMLInputElement>(null);
  const asideRef = useRef<HTMLElement>(null);

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

  // 모임 메모면 어느 모임인지 보여 준다
  const memoGroupId = memo?.groupId;
  useEffect(() => {
    if (!memoGroupId || !session) {
      setGroup(null);
      return;
    }
    let alive = true;
    groupApi.getById(memoGroupId, session).then(g => { if (alive) setGroup(g); }).catch(() => { if (alive) setGroup(null); });
    return () => { alive = false; };
  }, [memoGroupId, session]);

  // 다른 사람의 변경: 보는 중이면 조용히 다시 받고, 수정 중이면 입력은 두고 바뀌었다고만 알린다
  useLiveTopics(['memos'], () => {
    if (!memo || !session) return;
    memoApi.getById(memo.id, session).then(latest => {
      if (isEditing) {
        if ((latest.version ?? 0) !== (memo.version ?? 0)) setRemoteChanged(true);
        setEditBlocked(getMemoPermissions(latest, session.user?.id).edit ? null : '고칠 권한이 없어졌어요. 쓴 내용을 복사해 두세요.');
      } else {
        applyMemo(latest);
      }
    }).catch(error => {
      const status = getStatus(error);
      if (status !== 403 && status !== 404) return; // 잠깐의 네트워크 오류는 보던 내용 유지
      if (isEditing) {
        setEditBlocked(status === 404 ? '삭제된 메모예요. 쓴 내용을 복사해 두세요.' : '고칠 권한이 없어졌어요. 쓴 내용을 복사해 두세요.');
      } else {
        setMemo(null);
        setLoadError({ status, message: getApiErrorMessage(error) });
      }
    });
  }, !!memo && !!session);

  // 공유한 모임 이름·아바타 (작성자에게만 sharedGroupIds 가 내려온다)
  const sharedGroupKey = (memo?.sharedGroupIds ?? []).join(',');
  useEffect(() => {
    if (!sharedGroupKey || !session) {
      setSharedGroups([]);
      return;
    }
    const ids = sharedGroupKey.split(',');
    let alive = true;
    groupApi.getAll(session)
      .then(all => { if (alive) setSharedGroups(all.filter(g => ids.includes(g.id))); })
      .catch(() => { if (alive) setSharedGroups([]); });
    return () => { alive = false; };
  }, [sharedGroupKey, session]);

  // 수정을 시작하면 제목 칸에 커서
  useEffect(() => {
    if (isEditing) titleRef.current?.focus();
  }, [isEditing]);

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
    setRemoteChanged(false);
    setEditBlocked(null);
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
    if (editBlocked) {
      toast.error(editBlocked);
      return;
    }
    if (!editTitle.trim()) {
      toast.error('제목을 입력해 주세요');
      titleRef.current?.focus();
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
      setRemoteChanged(false);
      toast.success('저장했어요');
    } catch (error) {
      console.error('Failed to save memo:', error);
      const status = getStatus(error);
      if (status === 409) {
        // 다른 사람이 먼저 고침: 입력은 그대로 두고 최신 내용을 불러올지, 내 내용을 지킬지 묻는다.
        setIsSaving(false);
        const reload = await confirm(
          '내가 고치는 동안 다른 곳에서 이 메모가 바뀌었어요.\n최신 내용을 불러오면 지금 고친 내용은 사라져요. 내 내용 유지를 고르고 다시 저장하면 다른 곳에서 바뀐 내용을 내 내용으로 덮어써요.',
          '먼저 바뀐 메모예요',
          '최신 내용 불러오기',
          '내 내용 유지'
        );
        if (reload) {
          setIsEditing(false);
          setRemoteChanged(false);
          await fetchMemoDetail();
        } else {
          // 최신 판 번호를 받아 두면 다음 저장이 내 내용으로 덮어쓴다(입력은 그대로).
          try {
            applyMemo(await memoApi.getById(memo.id, session));
            setRemoteChanged(false);
            toast.info('다시 저장하면 내 내용으로 저장돼요');
          } catch (e) {
            toast.error(getApiErrorMessage(e));
          }
        }
      } else if (status === 403) {
        // 권한이 없어졌어도 쓴 내용은 남겨 두고 저장만 막는다
        setEditBlocked('고칠 권한이 없어졌어요. 쓴 내용을 복사해 두세요.');
        toast.error('고칠 권한이 없어졌어요. 쓴 내용을 복사해 두세요');
      } else if (status === 404) {
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
    if (!(await canDecodeImage(file))) {
      toast.error('JPG·PNG·GIF·WEBP 이미지 파일만 올릴 수 있어요');
      return;
    }
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
    setAnalyzeError(null);
    try {
      const res = await memoApi.analyze(memoId, session);
      setInsight(res);
    } catch (error) {
      console.error('Failed to analyze memo:', error);
      const message = getApiErrorMessage(error, getStatus(error) ? undefined : '분석하지 못했어요');
      toast.error(message);
      setAnalyzeError(message);
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
    if (!trimmed) return;
    if (currentTags.includes(trimmed)) {
      toast.info('이미 붙은 태그예요');
      setTagInput('');
      return;
    }
    const newTags = [...currentTags, trimmed];
    syncTags(newTags);
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    const newTags = currentTags.filter(t => t !== tag);
    syncTags(newTags);
  };

  const handleDelete = async () => {
    const sharedNote = (memo?.sharedWith?.length || memo?.sharedGroupIds?.length) ? ' 공유받은 사람도 더 볼 수 없어요.' : '';
    const othersNote = memo && memo.authorId !== session?.user?.id ? `${memo.authorNickname} 님의 메모예요. ` : '';
    if (!(await confirm(`${othersNote}삭제하면 되돌릴 수 없어요.${sharedNote}`, `'${memo?.title ?? ''}' 메모를 삭제할까요?`, '삭제', '취소'))) return;
    setIsDeleting(true);
    try {
      await memoApi.delete(memoId, session);
      toast.success('메모를 삭제했어요');
      onDelete?.();
      if (isPage) {
        router.push(memo?.groupId ? `/groups/${memo.groupId}?tab=memos` : '/memo');
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

  const handleTogglePin = async () => {
    if (!memoId || !session || !memo) return;
    try {
      // 모임 메모는 모임 고정만, 개인 메모는 내 고정
      const updated = memo.groupId
        ? await memoApi.setGroupPinned(memoId, !memo.groupPinnedAt, session)
        : await memoApi.setPinned(memoId, !memo.pinnedAt, session);
      setMemo(prev => (prev
        ? { ...prev, pinnedAt: updated.pinnedAt ?? null, groupPinnedAt: updated.groupPinnedAt ?? null }
        : updated));
    } catch (error) {
      console.error('Failed to toggle pin:', error);
      const status = getStatus(error);
      toast.error(getApiErrorMessage(error, status ? undefined : '고정을 바꾸지 못했어요'));
      if (status === 403 || status === 404) await fetchMemoDetail();
    }
  };

  // 수정 중 Esc = 취소, Ctrl/Cmd+S = 저장 (확인 창이 떠 있으면 그 창에 맡긴다)
  const editKeysRef = useRef({ save: handleSaveEdit, cancel: handleCancelEdit, saving: isSaving });
  editKeysRef.current = { save: handleSaveEdit, cancel: handleCancelEdit, saving: isSaving };
  useEffect(() => {
    if (!isEditing) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || useAlertStore.getState().modal) return;
      const k = editKeysRef.current;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (!k.saving) k.save();
      } else if (e.key === 'Escape' && !k.saving) {
        e.preventDefault();
        k.cancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isEditing]);

  const handleBack = () => {
    // 주소로 바로 열었으면 돌아갈 곳이 없다 → 메모 목록
    if (window.history.length > 1) router.back();
    else router.push('/memo');
  };

  const heightClass = isPage ? 'h-full' : 'h-[100dvh] sm:h-[85vh] w-full';

  if (loadError && !loadingMemo) {
    const s = loadError.status;
    const view =
      s === 400 ? { title: '메모를 찾을 수 없어요', desc: '주소가 잘못됐거나 삭제된 메모예요.', retry: false } :
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

  // 모임 메모 상세에는 모임 고정 버튼만, 개인 메모는 내 고정
  const pinned = memo.groupId ? !!memo.groupPinnedAt : !!memo.pinnedAt;
  const canPin = memo.groupId ? permissions.groupPin : permissions.pin;
  const pinLabel = memo.groupId
    ? (pinned ? '모임 고정 해제' : '모임에 고정')
    : (pinned ? '고정 해제' : '고정');

  return (
    <div className={`flex flex-col lg:flex-row bg-surface overflow-y-auto lg:overflow-hidden no-scrollbar ${heightClass}`}>
      {/* 본문 — 모바일에서는 화면 전체가 한 번에 스크롤되도록 안쪽 스크롤을 lg 이상에서만 쓴다 */}
      <div className="lg:flex-1 flex flex-col px-5 py-4 lg:px-8 lg:py-6 lg:overflow-y-auto no-scrollbar lg:border-r border-line lg:pb-24 shrink-0 lg:shrink min-w-0">
        <div className={`mb-3 flex items-center gap-2 lg:gap-1 ${isEditing ? 'sticky top-0 z-20 -mx-5 bg-surface px-5 py-2 lg:static lg:mx-0 lg:p-0' : ''}`}>
          {isPage && !isEditing && (
            <button
              type="button"
              onClick={handleBack}
              className="btn-icon -ml-2 max-lg:size-11"
              title="뒤로가기"
              aria-label="뒤로가기"
            >
              <ChevronLeft size={18} strokeWidth={1.5} />
            </button>
          )}

          <div className="ml-auto flex items-center gap-2 lg:gap-1">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="btn-secondary max-lg:h-11"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={isSaving || !!editBlocked}
                  className="btn-primary max-lg:h-11"
                >
                  {isSaving ? <Loader2 size={16} strokeWidth={1.5} className="animate-spin" /> : <Check size={16} strokeWidth={1.5} />}
                  저장
                </button>
              </>
            ) : (
              <>
                {canPin ? (
                  <button
                    type="button"
                    onClick={handleTogglePin}
                    className={`btn-icon max-lg:size-11 ${pinned ? 'text-accent hover:text-accent' : ''}`}
                    title={pinLabel}
                    aria-label={pinLabel}
                    aria-pressed={pinned}
                  >
                    <Pin size={18} strokeWidth={1.5} className={pinned ? 'fill-current' : ''} />
                  </button>
                ) : pinned && (
                  <span className="inline-flex size-8 items-center justify-center text-ink-2 max-lg:size-11" title={memo.groupId ? '모임 고정됨' : '고정됨'}>
                    <Pin size={18} strokeWidth={1.5} className="fill-current" aria-label={memo.groupId ? '모임 고정됨' : '고정됨'} />
                  </span>
                )}
                {/* 모임 메모 상세에는 즐겨찾기 별을 두지 않는다(/memo 목록에서만) */}
                {!memo.groupId && (
                  <button
                    type="button"
                    onClick={handleToggleFavorite}
                    className={`btn-icon max-lg:size-11 ${memo.isFavorite ? 'text-accent hover:text-accent' : ''}`}
                    title="즐겨찾기"
                    aria-label="즐겨찾기"
                  >
                    <Star size={18} strokeWidth={1.5} className={memo.isFavorite ? 'fill-current' : ''} />
                  </button>
                )}
                {permissions.edit && (
                  <button
                    type="button"
                    onClick={handleStartEdit}
                    disabled={loadingInsight}
                    className="btn-icon max-lg:size-11"
                    title={loadingInsight ? '분석이 끝나면 고칠 수 있어요' : '메모 수정'}
                    aria-label="메모 수정"
                  >
                    <Pencil size={18} strokeWidth={1.5} />
                  </button>
                )}
                {permissions.share && (
                  <button
                    type="button"
                    onClick={() => setIsShareModalOpen(true)}
                    className="btn-icon max-lg:size-11"
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
                    disabled={isDeleting || loadingInsight}
                    className="btn-icon hover:bg-negative-soft hover:text-negative max-lg:size-11"
                    title={loadingInsight ? '분석이 끝나면 삭제할 수 있어요' : '삭제하기'}
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
                      className="btn-icon max-lg:size-11"
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
          <>
            {editBlocked && (
              <div role="alert" className="mb-3 rounded-lg bg-negative-soft px-4 py-2.5 text-[13px] text-negative">
                {editBlocked}
              </div>
            )}
            {remoteChanged && !editBlocked && (
              <div role="status" className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-raised px-4 py-2.5 text-[13px] text-ink-2">
                <span>고치는 동안 다른 곳에서 이 메모가 바뀌었어요. 저장하면 어떻게 할지 물어봐요.</span>
              </div>
            )}
            <input
              ref={titleRef}
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              maxLength={255}
              placeholder="제목"
              aria-label="제목"
              className="form-input h-12 font-display text-2xl"
            />
            <p className={`mb-5 mt-1 text-right text-xs ${editTitle.length >= 255 ? 'text-negative' : 'text-ink-3'}`}>
              <span className="stamp">{editTitle.length}/255</span>
            </p>
          </>
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
            {memo.groupId && group && (
              <Link
                href={`/groups/${group.id}?tab=memos`}
                className="mt-2 inline-flex max-w-full items-center gap-1.5 self-start text-[13px] text-ink-2 hover:text-ink"
              >
                <GroupAvatar name={group.name} src={group.profileImage} theme={group.colorTheme} size="xs" />
                <span className="truncate">{group.name}</span>
                <span className="shrink-0 text-ink-3">모임 메모</span>
              </Link>
            )}
            <button
              type="button"
              onClick={() => asideRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="btn-ghost btn-sm -ml-2 mt-1 self-start lg:hidden"
            >
              분석·태그 보기
              <ChevronRight size={16} strokeWidth={1.5} className="rotate-90" />
            </button>
            {readOnly && (
              <p className="mt-2 text-[13px] text-ink-3">공유받은 메모라 읽기만 할 수 있어요</p>
            )}
            {!readOnly && !memo.groupId && memo.authorId !== session?.user?.id && (
              <p className="mt-2 text-[13px] text-ink-3">수정할 수 있게 공유받은 메모예요 (삭제·공유는 작성자만)</p>
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

        <div className={`text-ink lg:min-h-100 relative ${isEditing ? '' : markdownListClassName}`} data-color-mode="light">
          {isEditing ? (
            <RichEditor
              value={editContent}
              onChange={setEditContent}
              mentions={{ memos: allMemos.filter((m) => m.id !== memo.id), schedules }}
              className="min-h-[300px] lg:h-[60vh]"
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
      <aside ref={asideRef} className="scroll-mt-4 w-full lg:w-[340px] bg-canvas px-5 pt-5 pb-24 lg:p-6 lg:overflow-y-auto no-scrollbar flex flex-col gap-6 shrink-0 border-t lg:border-t-0 border-line">
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
                  className="btn-icon -mr-2 hover:bg-surface max-lg:size-11"
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
              <p className="text-sm leading-relaxed text-ink">{insight.summary ? tidySummary(insight.summary) : '—'}</p>

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
                          className={`inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs transition-colors max-lg:h-11 max-lg:px-3 duration-150 ease-out ${isAdded
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
              {analyzeError ? (
                <p role="alert" className="text-[13px] text-negative">분석하지 못했어요. {analyzeError}</p>
              ) : (
                <p className="text-[13px] text-ink-3">아직 분석 결과가 없어요</p>
              )}
              {!isEditing && permissions.analyze && (
                <button onClick={handleAnalyze} className="btn-secondary btn-sm">
                  {analyzeError ? '다시 분석' : '분석 시작'}
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
          {isEditing && permissions.tag && (
            <p className="text-xs text-ink-3">태그는 바꾸는 즉시 저장돼요. 수정을 취소해도 그대로예요.</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            {currentTags.map((tag) => (
              <span key={tag} className="chip gap-1">
                #{tag}
                {permissions.tag && (
                  <button
                    onClick={() => removeTag(tag)}
                    type="button"
                    className="relative -mr-0.5 text-ink-3 transition-colors duration-150 ease-out after:absolute after:-inset-4 after:content-[''] hover:text-negative lg:after:-inset-1.5"
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

        {!isEditing && ((loadingInsight && memo.imageUrl) || insight?.ocrText) && (
          <section className="space-y-2.5">
            <h3 className="text-[13px] font-medium text-ink-3">이미지에서 읽은 글자</h3>
            <p className="card p-4 text-[13px] leading-relaxed text-ink-2 whitespace-pre-wrap">
              {loadingInsight ? '분석 중…' : insight?.ocrText}
            </p>
          </section>
        )}

        {/* 공유한 사람 (작성자에게만 내려옴) */}
        {!isEditing && permissions.share && sharedGroups.length > 0 && (
          <section className="space-y-1.5">
            <div className="flex items-center gap-2">
              <h3 className="text-[13px] font-medium text-ink-3">공유한 모임</h3>
              <span className="stamp">{sharedGroups.length}</span>
              {(memo.sharedWith?.length ?? 0) === 0 && (
                <button type="button" onClick={() => setIsShareModalOpen(true)} className="btn-ghost btn-sm -mr-2 ml-auto">
                  공유 관리
                </button>
              )}
            </div>
            <ul>
              {sharedGroups.map(g => (
                <li key={g.id}>
                  <Link href={`/groups/${g.id}?tab=memos`} className="flex h-10 items-center gap-2.5 hover:text-ink">
                    <GroupAvatar name={g.name} src={g.profileImage} theme={g.colorTheme} size="sm" />
                    <span className="truncate font-display text-[15px] text-ink">{g.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

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
                  {sch.startTime && <span className="stamp shrink-0">{formatDateTime(sch.startTime, tf)}</span>}
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
