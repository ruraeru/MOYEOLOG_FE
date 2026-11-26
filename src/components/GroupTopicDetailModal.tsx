'use client';

import { useEffect, useRef, useState } from 'react';
import ImageWithFallback from './ImageWithFallback';
import {
  X,
  RefreshCw,
  List as ListIcon,
  AtSign,
  Loader2,
  Trash2,
  Pencil,
  Send,
  Maximize2,
  Minimize2,
  Check,
  Pin,
  PinOff,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { formatStamp, useTimeFormat } from '@/lib/schedule-utils';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groupTopicApi, type TopicCommentView } from '@/lib/group-topic-api';
import { getApiErrorMessage } from '@/lib/axios';
import { memoApi, type MemoResponse } from '@/lib/memo-api';
import { groupApi, type GroupResponse } from '@/lib/group-api';
import { friendApi, type FriendResponse } from '@/lib/friend-api';
import { useMentions } from '@/hooks/useMentions';
import { useAlert, useAlertStore } from '@/hooks/useAlert';
import { MentionList, type MentionItem } from './Mentions';
import type { TopicResponse } from '@/types/topic';
import dynamic from 'next/dynamic';
import {
  markdownRehypePlugins,
  markdownListClassName,
  hasVisibleText,
  codePointLength,
  spaceSentences,
} from '@/lib/markdown';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';
import { initialOf } from '@/lib/utils';
import { EmptyState } from './ui';
import { GroupAvatar, groupStyle } from './groups/GroupIdentity';
import { useLivePollMs } from '@/lib/live';

const EdMarkdown = dynamic(
  () => import('@uiw/react-md-editor').then((mod) => mod.default.Markdown),
  { ssr: false }
);

const COMMENT_MAX = 10000;

interface GroupTopicDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  topicId: string | null;
  onDelete?: () => void;
  onEdit?: (topic: TopicResponse) => void;
  onMemoClick?: (memoId: string) => void;
  /** 이 토픽의 모임 (모임 화면에서 넘긴다). 없으면 내 모임 목록에서 찾는다 */
  group?: Pick<GroupResponse, 'id' | 'name' | 'profileImage' | 'colorTheme'> | null;
}

function formatDateTime(iso: string, tf: string) {
  return formatStamp(iso, tf);
}

function statusOf(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined;
}

/** 초 단위까지 같으면 수정되지 않은 것으로 본다. */
function isEdited(comment: TopicCommentView) {
  if (!comment.updatedAt || !comment.createdAt) return false;
  return comment.updatedAt.slice(0, 19) !== comment.createdAt.slice(0, 19);
}

/** 저장된 멘션 형식: [@이름](/profile/사용자ID) */
const MENTION_LINK = /\[@([^\]\n]+)\]\(\/profile\/([^)\s]+)\)/g;

type MentionMap = Record<string, string>; // 이름 → 사용자 ID

/** 입력칸에 보여 줄 때는 링크 원문 대신 '@이름' 으로 바꾸고, 이름→ID 를 기억해 둔다. */
function mentionsToDisplay(raw: string): { text: string; mentions: MentionMap } {
  const mentions: MentionMap = {};
  const text = raw.replace(MENTION_LINK, (_, name: string, id: string) => {
    mentions[name] = id;
    return `@${name}`;
  });
  return { text, mentions };
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 저장할 때는 기억해 둔 '@이름' 을 다시 [@이름](/profile/ID) 로 되돌린다(이미 링크인 것은 그대로). */
function displayToMentions(text: string, mentions: MentionMap): string {
  const names = Object.keys(mentions).sort((a, b) => b.length - a.length);
  if (names.length === 0) return text;
  const pattern = new RegExp(`(?<!\\[)@(${names.map(escapeRegExp).join('|')})`, 'g');
  return text.replace(pattern, (_, name: string) => `[@${name}](/profile/${mentions[name]})`);
}

function validateComment(text: string): string | null {
  if (!hasVisibleText(text)) return '댓글 내용을 입력해 주세요';
  if (codePointLength(text) > COMMENT_MAX) return `댓글은 ${COMMENT_MAX.toLocaleString()}자까지 쓸 수 있어요`;
  return null;
}

export default function GroupTopicDetailModal({
  isOpen,
  onClose,
  topicId,
  onDelete,
  onEdit,
  onMemoClick,
  group: groupProp,
}: GroupTopicDetailModalProps) {
  const tf = useTimeFormat();
  const { data: session } = useSession();
  const router = useRouter();
  const { confirm, toast } = useAlert();
  const queryClient = useQueryClient();
  const pollMs = useLivePollMs(5000);
  const [commentInput, setCommentInput] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const scrollToEndRef = useRef(false);
  // 터치 기기는 Enter 가 줄바꿈이고 보내기 버튼으로 보낸다. 데스크톱은 Enter 보내기, Shift+Enter 줄바꿈
  const [enterSends, setEnterSends] = useState(true);
  useEffect(() => {
    setEnterSends(!window.matchMedia('(pointer: coarse)').matches);
  }, []);

  // Mention states
  const [allMemos, setAllMemos] = useState<MemoResponse[]>([]);
  const [friends, setFriends] = useState<FriendResponse[]>([]);
  const [userGroups, setUserGroups] = useState<GroupResponse[]>([]);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  const [commentMentions, setCommentMentions] = useState<MentionMap>({});
  const [editingMentions, setEditingMentions] = useState<MentionMap>({});

  const cancelEdit = () => {
    setEditingCommentId(null);
    setEditingContent('');
    setEditingMentions({});
  };

  const handleClose = () => {
    cancelEdit();
    onClose();
  };

  // 1. 토픽 상세 조회 (5초마다 갱신, 없어졌거나 볼 수 없게 되면 멈춘다)
  const {
    data: topicDetail,
    isLoading: loading,
    error: topicError,
    refetch,
  } = useQuery({
    queryKey: ['topic', topicId],
    queryFn: () => groupTopicApi.getById(topicId!, session),
    enabled: !!topicId && !!session && isOpen,
    // 토픽·댓글 변경은 `group:{id}` 토픽으로 와서 LiveEvents 가 무효화한다. 폴링은 SSE 가 끊겨 있을 때 5초, 붙어 있으면 60초 안전망
    refetchInterval: (query) => (query.state.error ? false : pollMs),
    retry: (count, error) => {
      const status = statusOf(error);
      if (status === 403 || status === 404) return false;
      return count < 2;
    },
  });

  // 보고 있던 토픽이 삭제됐거나 모임에서 나가게 되면 안내 후 닫는다
  const goneHandledRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isOpen) {
      goneHandledRef.current = null;
      return;
    }
    if (!topicId || !topicError) return;
    const status = statusOf(topicError);
    if (status !== 404 && status !== 403) return;
    if (goneHandledRef.current === topicId) return;
    goneHandledRef.current = topicId;
    useAlertStore
      .getState()
      .addToast(status === 404 ? '삭제된 토픽이에요' : getApiErrorMessage(topicError, '이 토픽을 볼 수 없어요'), 'info');
    queryClient.removeQueries({ queryKey: ['topic', topicId] });
    onDelete?.();
    onClose();
  }, [isOpen, topicId, topicError, queryClient, onDelete, onClose]);

  // 2. 댓글 작성
  const createCommentMutation = useMutation({
    mutationFn: (content: string) => groupTopicApi.createComment(topicId!, content, session),
    onSuccess: () => {
      setCommentInput('');
      setCommentMentions({});
      // 새 댓글은 목록 맨 아래에 붙는다. 다시 받은 뒤 그리로 내려 보여 준다
      scrollToEndRef.current = true;
      queryClient.invalidateQueries({ queryKey: ['topic', topicId] });
      onDelete?.(); // 댓글 수 갱신
    },
    onError: (error) => {
      console.error('Failed to create comment:', error);
      toast.error(getApiErrorMessage(error, '댓글을 쓰지 못했어요'));
    },
  });

  // 3. 댓글 수정
  const updateCommentMutation = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      groupTopicApi.updateComment(id, content, session),
    onSuccess: () => {
      cancelEdit();
      queryClient.invalidateQueries({ queryKey: ['topic', topicId] });
    },
    onError: (error) => {
      console.error('Failed to update comment:', error);
      toast.error(getApiErrorMessage(error, '댓글을 고치지 못했어요'));
    },
  });

  // 4. 댓글 삭제
  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => groupTopicApi.deleteComment(commentId, session),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topic', topicId] });
      onDelete?.();
    },
    onError: (error) => {
      console.error('Failed to delete comment:', error);
      toast.error(getApiErrorMessage(error, '댓글을 지우지 못했어요'));
    },
  });

  // 5. AI 분석
  const analyzeMutation = useMutation({
    mutationFn: () => groupTopicApi.analyze(topicId!, session),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topic', topicId] });
    },
    onError: (error) => {
      console.error('Failed to analyze topic:', error);
      toast.error(getApiErrorMessage(error, '댓글을 요약하지 못했어요'));
    },
  });

  // 6. 토픽 삭제
  const deleteTopicMutation = useMutation({
    mutationFn: () => groupTopicApi.delete(topicId!, session),
    onSuccess: () => {
      toast.success('토픽을 삭제했어요');
      goneHandledRef.current = topicId;
      queryClient.removeQueries({ queryKey: ['topic', topicId] });
      onDelete?.();
      handleClose();
    },
    onError: (error) => {
      console.error('Failed to delete topic:', error);
      toast.error(getApiErrorMessage(error, '토픽을 지우지 못했어요'));
    },
  });

  // 7. 고정·해제 (방장 또는 작성자). 모임 목록 순서가 바뀌므로 목록도 다시 받는다
  const pinMutation = useMutation({
    mutationFn: (pinned: boolean) => groupTopicApi.setPinned(topicId!, pinned, session),
    onSuccess: (_, pinned) => {
      queryClient.invalidateQueries({ queryKey: ['topic', topicId] });
      onDelete?.();
      toast.success(pinned ? '토픽을 고정했어요' : '고정을 풀었어요');
    },
    onError: (error) => {
      console.error('Failed to pin topic:', error);
      toast.error(getApiErrorMessage(error, '고정을 바꾸지 못했어요'));
    },
  });

  const {
    showParticipantMentions, setShowParticipantMentions, filteredParticipants,
    handleInputChange,
  } = useMentions({
    allMemos,
    friends,
    userGroups,
    selectedGroupId: topicDetail?.topic.groupId || undefined,
    currentUserId: session?.user?.id,
  });

  useEffect(() => {
    if (isOpen && session) {
      memoApi.getAll(session).then(setAllMemos).catch(console.error);
      friendApi.getFriends(session).then(setFriends).catch(console.error);
      groupApi.getAll(session).then(setUserGroups).catch(console.error);
    }
  }, [isOpen, session]);

  // Esc: 멘션 목록 → 댓글 수정 → 모달 순서로 닫는다. 확인 창이 떠 있으면 무시
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing) return;
      if (useAlertStore.getState().modal) return;
      if (showParticipantMentions) {
        setShowParticipantMentions(false);
        return;
      }
      setEditingContent('');
      if (editingCommentId) {
        setEditingCommentId(null);
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, showParticipantMentions, setShowParticipantMentions, editingCommentId]);

  // 내가 쓴 댓글을 받아 오면 맨 아래로 내린다
  useEffect(() => {
    if (!scrollToEndRef.current || !topicDetail) return;
    scrollToEndRef.current = false;
    requestAnimationFrame(() => {
      const body = bodyRef.current;
      if (body) body.scrollTo({ top: body.scrollHeight, behavior: 'smooth' });
    });
  }, [topicDetail]);

  // 열리면 포커스를 창 안으로 옮긴다(Tab 이 뒤 화면으로 새지 않게)
  const hasDetail = !!topicDetail;
  useEffect(() => {
    if (isOpen && hasDetail) dialogRef.current?.focus({ preventScroll: true });
  }, [isOpen, hasDetail, topicId]);

  const selectMention = (m: MentionItem) => {
    const parts = commentInput.split('@');
    parts.pop();
    // 입력칸에는 '@이름' 만 보이고, 보낼 때 링크 형식으로 바꿔요.
    const name = m.nickname ?? '';
    const newVal = parts.join('@') + `@${name} `;
    setCommentInput(newVal);
    if (name) setCommentMentions((prev) => ({ ...prev, [name]: m.id }));
    setShowParticipantMentions(false);
    setMentionIndex(0);
    // 고른 뒤 바로 이어 쓰게 포커스와 커서를 끝으로
    requestAnimationFrame(() => {
      const el = commentInputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(newVal.length, newVal.length);
    });
  };

  // 댓글 칸 높이를 내용에 맞춘다(field-sizing 을 모르는 브라우저용)
  useEffect(() => {
    const el = commentInputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight + el.offsetHeight - el.clientHeight, 128)}px`;
  }, [commentInput]);

  const handleCommentKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    const items = filteredParticipants as MentionItem[];
    if (showParticipantMentions && items.length > 0) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const step = e.key === 'ArrowDown' ? 1 : -1;
        setMentionIndex((i) => (i + step + items.length) % items.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        // 목록이 열려 있으면 Enter 는 보내기가 아니라 고르기
        e.preventDefault();
        selectMention(items[Math.min(mentionIndex, items.length - 1)]);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && enterSends) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  };

  const handleAnalyze = () => analyzeMutation.mutate();

  const handleTopicDelete = async () => {
    const count = topicDetail?.comments.length ?? 0;
    const message = count > 0
      ? `이 토픽을 삭제할까요? 댓글 ${count}개도 함께 지워지고 되돌릴 수 없어요.`
      : '이 토픽을 삭제할까요? 되돌릴 수 없어요.';
    if (!(await confirm(message, undefined, '삭제', '취소'))) return;
    deleteTopicMutation.mutate();
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (createCommentMutation.isPending) return;
    // 빈 칸에서 Enter 는 조용히 무시(버튼도 비활성)
    if (!hasVisibleText(commentInput)) return;
    const content = displayToMentions(commentInput.trim(), commentMentions);
    const problem = validateComment(content);
    if (problem) {
      toast.warning(problem);
      return;
    }
    setShowParticipantMentions(false);
    createCommentMutation.mutate(content);
  };

  const startEditComment = (comment: TopicCommentView) => {
    const { text, mentions } = mentionsToDisplay(comment.content);
    setEditingCommentId(comment.id);
    setEditingContent(text);
    setEditingMentions(mentions);
    // 아래쪽 댓글이면 수정 칸·버튼이 아래 입력줄 뒤로 숨지 않게 가운데로
    requestAnimationFrame(() => {
      bodyRef.current
        ?.querySelector(`[data-comment-id="${CSS.escape(comment.id)}"]`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  };

  const submitEditComment = (comment: TopicCommentView) => {
    const next = displayToMentions(editingContent.trim(), editingMentions);
    const problem = validateComment(next);
    if (problem) {
      toast.warning(problem);
      return;
    }
    if (next === comment.content) {
      cancelEdit();
      return;
    }
    updateCommentMutation.mutate({ id: comment.id, content: next });
  };

  const handleCommentDelete = async (commentId: string) => {
    if (!(await confirm('이 댓글을 삭제할까요?', undefined, '삭제', '취소'))) return;
    deleteCommentMutation.mutate(commentId);
  };

  const markdownComponents = {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    a: ({ node, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { node?: unknown }) => {
      const isMemo = props.href?.startsWith('/memo/');
      const isProfile = props.href?.startsWith('/profile/');

      if (isMemo || isProfile) {
        return (
          <a
            {...props}
            onClick={(e) => {
              e.preventDefault();
              const id = props.href?.split('/').pop();
              if (!id) return;
              if (isMemo) onMemoClick?.(id);
              if (isProfile) router.push(`/profile/${encodeURIComponent(id)}`);
            }}
            className="text-group-ink font-medium hover:underline cursor-pointer"
          >
            {props.children}
          </a>
        );
      }
      return <a {...props} className="text-group-ink hover:underline" target="_blank" rel="noopener noreferrer" />;
    },
  };

  if (!isOpen) return null;

  if (loading && !topicDetail) {
    return (
      <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4" onClick={handleClose}>
        <div className="flex items-center gap-3 rounded-2xl bg-surface px-6 py-5">
          <Loader2 size={16} strokeWidth={1.5} className="animate-spin text-ink-3" />
          <span className="text-sm text-ink-2">토픽을 불러오는 중이에요</span>
        </div>
      </div>
    );
  }

  if (!topicDetail) {
    const status = statusOf(topicError);
    if (!topicError || status === 404 || status === 403) return null;
    return (
      <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4" onClick={handleClose}>
        <div
          role="alertdialog"
          className="w-full max-w-sm space-y-4 rounded-2xl bg-surface p-6 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-sm text-ink">{getApiErrorMessage(topicError, '토픽을 불러오지 못했어요')}</p>
          <div className="flex justify-center gap-2">
            <button type="button" onClick={handleClose} className="btn-secondary">닫기</button>
            <button type="button" onClick={() => refetch()} className="btn-primary">
              <RefreshCw size={16} strokeWidth={1.5} />
              다시 시도
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { topic, comments, insight } = topicDetail;
  const isAuthor = session?.user?.id === topic.authorId;
  // 삭제는 작성자 또는 방장. 구버전 응답(canDelete 없음)이면 작성자만
  const canDelete = topic.canDelete ?? isAuthor;
  const isDeleting = deleteTopicMutation.isPending;
  const isPinned = !!(topic.pinnedAt ?? topicDetail.pinnedAt);
  const canPin = !!(topic.canPin ?? topicDetail.canPin);
  const isCommenting = createCommentMutation.isPending;
  const loadingInsight = analyzeMutation.isPending;
  const keywords = Array.from(new Set((insight?.keywords ?? []).map((k) => k?.trim()).filter(Boolean)));
  const group = groupProp?.id === topic.groupId ? groupProp : userGroups.find((g) => g.id === topic.groupId);

  const resolveImage = (src: string) => (src.startsWith('/uploads/') ? `${apiUrl}${src}` : src);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/40 md:items-center md:p-4"
      style={group ? groupStyle(group.colorTheme) : undefined}
      onClick={handleClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={topic.title}
        className={`flex w-full flex-col overflow-hidden bg-surface outline-none ${
          isFullscreen
            ? 'h-[100dvh] lg:fixed lg:inset-0 lg:h-screen lg:rounded-none'
            : 'max-h-[92dvh] rounded-t-2xl animate-slide-up md:max-h-[88vh] md:max-w-[720px] md:rounded-2xl md:animate-scale-in'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 머리: 모임 얼굴 + '모임 · 토픽', 제목, 작성자·시각 */}
        <div className="shrink-0 border-b border-line px-5 py-4 md:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 text-xs text-ink-3">
              {group && <GroupAvatar name={group.name} src={group.profileImage} theme={group.colorTheme} size="xs" />}
              <span className="truncate">{group ? `${group.name} · 토픽` : '토픽'}</span>
              {isPinned && (
                <span className="inline-flex shrink-0 items-center gap-1 text-group-ink">
                  <Pin size={12} strokeWidth={1.5} aria-hidden />
                  고정
                </span>
              )}
            </div>
            <div className="-my-1.5 flex shrink-0 items-center gap-1 max-md:gap-2">
              {canPin && (
                <button
                  onClick={() => pinMutation.mutate(!isPinned)}
                  disabled={pinMutation.isPending}
                  className={`btn-icon max-md:size-11 ${isPinned ? 'text-group-ink' : ''}`}
                  title={isPinned ? '고정 해제' : '고정하기'}
                  aria-label={isPinned ? '고정 해제' : '고정하기'}
                  aria-pressed={isPinned}
                >
                  {pinMutation.isPending ? (
                    <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
                  ) : isPinned ? (
                    <PinOff size={16} strokeWidth={1.5} />
                  ) : (
                    <Pin size={16} strokeWidth={1.5} />
                  )}
                </button>
              )}
              {isAuthor && (
                <button
                  onClick={() => onEdit?.(topic)}
                  className="btn-icon max-md:size-11"
                  title="토픽 수정"
                  aria-label="토픽 수정"
                >
                  <Pencil size={16} strokeWidth={1.5} />
                </button>
              )}
              {canDelete && (
                <button
                  onClick={handleTopicDelete}
                  disabled={isDeleting}
                  className="btn-icon max-md:size-11 hover:!bg-negative-soft hover:!text-negative"
                  title="토픽 삭제"
                  aria-label="토픽 삭제"
                >
                  {isDeleting ? <Loader2 size={16} strokeWidth={1.5} className="animate-spin" /> : <Trash2 size={16} strokeWidth={1.5} />}
                </button>
              )}
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="btn-icon hidden lg:inline-flex"
                title={isFullscreen ? '축소하기' : '전체화면'}
                aria-label={isFullscreen ? '축소하기' : '전체화면'}
              >
                {isFullscreen ? <Minimize2 size={16} strokeWidth={1.5} /> : <Maximize2 size={16} strokeWidth={1.5} />}
              </button>
              <button onClick={handleClose} className="btn-icon max-md:size-11" title="닫기" aria-label="닫기">
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>
          </div>
          <h2 className="mt-1 break-words font-display text-xl leading-7 text-ink md:text-2xl md:leading-8">
            {topic.title}
          </h2>
          <div className="mt-2 flex min-w-0 items-center gap-2">
            <Avatar
              src={topic.authorProfileImage ? resolveImage(topic.authorProfileImage) : undefined}
              name={topic.authorNickname}
              className="size-6 text-[11px]"
            />
            {/* 닉네임은 남기고 @아이디만 줄인다 */}
            <span className="max-w-[60%] shrink-0 truncate text-[13px] text-ink-2">{topic.authorNickname}</span>
            {topic.authorCustomId && (
              <span className="min-w-0 truncate text-[13px] text-ink-3">@{topic.authorCustomId}</span>
            )}
            <span className="stamp shrink-0">{formatDateTime(topic.createdAt, tf)}</span>
          </div>
        </div>

        {/* 본문 → 이미지 → 댓글 요약 → 댓글 */}
        <div ref={bodyRef} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 md:px-6">
          <div className={`break-words leading-relaxed text-ink ${markdownListClassName}`} data-color-mode="light">
            <EdMarkdown
              rehypePlugins={markdownRehypePlugins}
              source={topic.content}
              components={markdownComponents}
              style={{
                backgroundColor: 'transparent',
                fontSize: '0.9375rem',
                fontWeight: 400,
                color: 'inherit',
              }}
            />
          </div>

          {topic.imageUrl && (
            <ImageWithFallback
              src={resolveImage(topic.imageUrl)}
              alt={topic.title}
              width={1200}
              height={600}
              containerClassName="w-full max-h-[420px] min-h-40 overflow-hidden rounded-xl border border-line bg-raised"
              className="h-auto w-full object-contain"
              unoptimized
            />
          )}

          <section aria-label="댓글 요약" className="rounded-xl bg-raised px-4 py-3">
            <div className="flex min-h-8 items-center gap-2">
              <ListIcon size={16} strokeWidth={1.5} className="shrink-0 text-ink-3" aria-hidden />
              <span className="text-[13px] font-medium text-ink">댓글 요약</span>
              <div className="ml-auto flex items-center gap-1">
                {insight?.analyzedAt && (
                  <span className="stamp">
                    {comments.length > 0 && `댓글 ${comments.length}개 · `}
                    {formatDateTime(insight.analyzedAt, tf)} 기준
                  </span>
                )}
                {insight && !loadingInsight && (
                  <button
                    onClick={handleAnalyze}
                    className="btn-icon"
                    title="다시 요약하기"
                    aria-label="AI 분석 다시하기"
                  >
                    <RefreshCw size={16} strokeWidth={1.5} />
                  </button>
                )}
                {loadingInsight && insight && (
                  <span className="inline-flex size-8 items-center justify-center">
                    <Loader2 size={16} strokeWidth={1.5} className="animate-spin text-ink-3" />
                  </span>
                )}
              </div>
            </div>

            {insight ? (
              <div className="mt-1 space-y-2.5 pb-1">
                {insight.stale && (
                  <p className="text-xs text-ink-3">요약한 뒤에 토픽이 바뀌었어요. 다시 요약해 보세요.</p>
                )}
                <p className="text-sm leading-relaxed text-ink-2">{spaceSentences(insight.summary)}</p>
                {keywords.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5" aria-label="키워드">
                    {keywords.map((k) => (
                      <li key={k} className="chip bg-surface">#{k}</li>
                    ))}
                  </ul>
                )}
                {insight.ocrText && insight.ocrText.trim() && (
                  <div className="border-t border-line pt-2.5">
                    <span className="mb-1 block text-xs text-ink-3">사진 속 글자</span>
                    <p className="line-clamp-3 text-xs leading-relaxed text-ink-2">{insight.ocrText}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2 pb-1">
                <p className="text-sm text-ink-3">아직 요약이 없어요</p>
                <button onClick={handleAnalyze} disabled={loadingInsight} className="btn-secondary btn-sm">
                  {loadingInsight && <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />}
                  {loadingInsight ? '요약하는 중' : '요약하기'}
                </button>
              </div>
            )}
          </section>

          <section aria-label="댓글">
            <h3 className="text-sm font-medium text-ink">
              댓글 <span className="tabular-nums text-ink-3">{comments.length}</span>
            </h3>

            {comments.length > 0 ? (
              <ul className="mt-3 space-y-4">
                {comments.map((comment) => {
                  const isMine = session?.user?.id === comment.authorId;
                  const isEditing = editingCommentId === comment.id;
                  return (
                    <li key={comment.id} data-comment-id={comment.id} className="flex scroll-my-24 gap-3">
                      <Avatar
                        src={comment.authorProfileImage ? resolveImage(comment.authorProfileImage) : undefined}
                        name={comment.authorNickname}
                        className="size-8 text-xs"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex min-h-6 flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="min-w-0 break-words text-[13px] font-medium text-ink">
                            {comment.authorNickname}
                          </span>
                          {comment.authorCustomId && (
                            <span className="whitespace-nowrap text-xs text-ink-3">@{comment.authorCustomId}</span>
                          )}
                          <span className="stamp whitespace-nowrap">{formatDateTime(comment.createdAt, tf)}</span>
                          {isEdited(comment) && <span className="text-xs text-ink-3">수정됨</span>}
                          {isMine && !isEditing && (
                            <div className="ml-auto flex shrink-0 items-center max-md:gap-2">
                              <button
                                onClick={() => startEditComment(comment)}
                                className="btn-icon size-7 max-md:size-11"
                                title="댓글 수정"
                                aria-label="댓글 수정"
                              >
                                <Pencil size={14} strokeWidth={1.5} />
                              </button>
                              <button
                                onClick={() => handleCommentDelete(comment.id)}
                                className="btn-icon size-7 max-md:size-11 hover:!bg-negative-soft hover:!text-negative"
                                title="댓글 삭제"
                                aria-label="댓글 삭제"
                              >
                                <Trash2 size={14} strokeWidth={1.5} />
                              </button>
                            </div>
                          )}
                        </div>
                        {isEditing ? (
                          <form
                            className="mt-1 space-y-2"
                            onSubmit={(e) => {
                              e.preventDefault();
                              submitEditComment(comment);
                            }}
                          >
                            <textarea
                              value={editingContent}
                              onChange={(e) => setEditingContent(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.nativeEvent.isComposing || e.key !== 'Enter') return;
                                // 쓰기 칸과 같게: 데스크톱은 Enter 저장(Shift+Enter 줄바꿈), Ctrl/⌘+Enter 는 어디서나 저장
                                if (e.metaKey || e.ctrlKey || (enterSends && !e.shiftKey)) {
                                  e.preventDefault();
                                  submitEditComment(comment);
                                }
                              }}
                              rows={3}
                              autoFocus
                              aria-label="댓글 수정"
                              className="form-input min-h-[72px] resize-y"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <span className="mr-auto text-xs text-ink-3">
                                {enterSends ? 'Enter 저장 · Shift+Enter 줄바꿈 · Esc 취소' : '저장을 눌러 고쳐요'}
                              </span>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                disabled={updateCommentMutation.isPending}
                                className="btn-secondary btn-sm max-md:h-11"
                              >
                                취소
                              </button>
                              <button
                                type="submit"
                                disabled={updateCommentMutation.isPending || !hasVisibleText(editingContent)}
                                className="btn-primary btn-sm max-md:h-11"
                              >
                                {updateCommentMutation.isPending
                                  ? <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
                                  : <Check size={14} strokeWidth={1.5} />}
                                저장
                              </button>
                            </div>
                          </form>
                        ) : (
                          <div
                            className={`mt-0.5 break-words text-sm leading-relaxed text-ink ${markdownListClassName}`}
                            data-color-mode="light"
                          >
                            <EdMarkdown
                              rehypePlugins={markdownRehypePlugins}
                              source={comment.content}
                              components={markdownComponents}
                              style={{ backgroundColor: 'transparent', fontSize: '0.875rem', color: 'inherit' }}
                            />
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState title="아직 댓글이 없어요" description="첫 댓글을 남겨 보세요" className="!py-8" />
            )}
          </section>
        </div>

        {/* 아래 고정: 댓글 입력칸 + 보내기. 창이 하단 탭(z-100)보다 위라 가려지지 않는다 */}
        {/* 모바일에서 댓글을 고치는 동안은 입력칸이 둘로 보이지 않게 아래 줄을 숨긴다 */}
        <div className={`shrink-0 border-t border-line px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] md:px-6 ${editingCommentId ? 'max-md:hidden' : ''}`}>
          <form onSubmit={handleCommentSubmit} className="flex items-end gap-2">
            <div className="relative min-w-0 flex-1">
              <AtSign
                size={16}
                strokeWidth={1.5}
                className="pointer-events-none absolute left-3 top-[10px] text-ink-3 max-md:top-[14px]"
                aria-hidden
              />
              {/* 여러 줄 댓글(10,000자까지). 다섯 줄까지 늘어나고 그 뒤는 칸 안에서 스크롤 */}
              <textarea
                ref={commentInputRef}
                rows={1}
                value={commentInput}
                onChange={(e) => {
                  setCommentInput(e.target.value);
                  setMentionIndex(0);
                  handleInputChange(e.target.value, 'participant');
                }}
                onKeyDown={handleCommentKeyDown}
                placeholder="댓글 남기기 · @로 멘션"
                aria-label="댓글 입력"
                className="form-input block max-h-32 min-h-9 resize-none py-2 pl-9 leading-5 max-md:min-h-11 max-md:py-[11px]"
              />

              {showParticipantMentions && (
                <MentionList
                  items={filteredParticipants as MentionItem[]}
                  activeIndex={mentionIndex}
                  onSelect={selectMention}
                />
              )}
            </div>

            <button
              type="submit"
              disabled={isCommenting || !hasVisibleText(commentInput)}
              className="btn-primary shrink-0 max-md:h-11"
              aria-label="댓글 보내기"
            >
              {isCommenting ? <Loader2 size={16} strokeWidth={1.5} className="animate-spin" /> : <Send size={16} strokeWidth={1.5} />}
              보내기
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/** 사진이 없으면 이름 첫 글자 */
function Avatar({ src, name, className }: { src?: string; name: string; className: string }) {
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-full ${className}`}>
      {src ? (
        <ImageWithFallback src={src} alt={name} fill containerClassName="w-full h-full" className="object-cover" unoptimized />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-raised text-ink-2">{initialOf(name)}</div>
      )}
    </div>
  );
}
