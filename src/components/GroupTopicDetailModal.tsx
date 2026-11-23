'use client';

import { useEffect, useRef, useState } from 'react';
import ImageWithFallback from './ImageWithFallback';
import {
  X,
  Sparkles,
  RefreshCw,
  MessageSquare,
  Loader2,
  Trash2,
  Pencil,
  Send,
  Maximize2,
  Minimize2,
  Check,
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
}: GroupTopicDetailModalProps) {
  const tf = useTimeFormat();
  const { data: session } = useSession();
  const router = useRouter();
  const { confirm, toast } = useAlert();
  const queryClient = useQueryClient();
  const [commentInput, setCommentInput] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

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
    refetchInterval: (query) => (query.state.error ? false : 5000),
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
      toast.error(getApiErrorMessage(error, 'AI 분석에 실패했어요'));
    },
  });

  // 6. 토픽 삭제
  const deleteTopicMutation = useMutation({
    mutationFn: () => groupTopicApi.delete(topicId!, session),
    onSuccess: () => {
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

  const handleAnalyze = () => analyzeMutation.mutate();

  const handleTopicDelete = async () => {
    if (!(await confirm('이 토픽을 삭제할까요?'))) return;
    deleteTopicMutation.mutate();
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
    if (!(await confirm('이 댓글을 삭제할까요?'))) return;
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
            className="text-accent font-medium hover:underline cursor-pointer"
          >
            {props.children}
          </a>
        );
      }
      return <a {...props} className="text-accent hover:underline" target="_blank" rel="noopener noreferrer" />;
    },
  };

  if (!isOpen) return null;

  if (loading && !topicDetail) {
    return (
      <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4" onClick={handleClose}>
        <div className="bg-surface border border-line rounded-2xl shadow-float p-6 flex items-center gap-3">
          <Loader2 size={18} strokeWidth={1.5} className="animate-spin text-ink-3" />
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
          className="bg-surface border border-line rounded-2xl shadow-float p-6 w-full max-w-sm text-center space-y-4"
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
  const isDeleting = deleteTopicMutation.isPending;
  const isCommenting = createCommentMutation.isPending;
  const loadingInsight = analyzeMutation.isPending;
  const keywords = Array.from(new Set((insight?.keywords ?? []).map((k) => k?.trim()).filter(Boolean)));

  const resolveImage = (src: string) => (src.startsWith('/uploads/') ? `${apiUrl}${src}` : src);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-0 lg:p-4"
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={topic.title}
        className={`bg-surface flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden relative w-full h-[100dvh] ${
          isFullscreen
            ? 'lg:fixed lg:inset-0 lg:w-screen lg:h-screen lg:rounded-none'
            : 'lg:h-auto lg:rounded-2xl lg:border lg:border-line lg:shadow-float lg:max-w-6xl lg:max-h-[90vh]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Main Content Area */}
        {/* 모바일에서는 contents 로 풀어서 머리말·댓글 입력칸이 대화상자 기준으로 붙어 있게 한다 */}
        <div className="contents lg:flex lg:flex-1 lg:min-w-0 lg:flex-col lg:overflow-hidden lg:border-r lg:border-line lg:bg-surface">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-surface px-4 lg:px-6 py-3 lg:py-4 border-b border-line flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-10 rounded-full relative overflow-hidden shrink-0">
                {topic.authorProfileImage ? (
                  <ImageWithFallback
                    src={resolveImage(topic.authorProfileImage)}
                    alt={topic.authorNickname}
                    fill
                    containerClassName="w-full h-full"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full bg-accent-soft flex items-center justify-center text-accent">
                    {initialOf(topic.authorNickname)}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-medium text-ink truncate">
                  {topic.authorNickname}
                  {topic.authorCustomId && (
                    <span className="ml-1.5 text-xs font-normal text-ink-3">@{topic.authorCustomId}</span>
                  )}
                </h3>
                <p className="stamp">{formatDateTime(topic.createdAt, tf)}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 lg:gap-2 shrink-0">
              {isAuthor && (
                <>
                  <button
                    onClick={() => onEdit?.(topic)}
                    className="btn-ghost size-9 !px-0"
                    title="토픽 수정"
                    aria-label="토픽 수정"
                  >
                    <Pencil size={18} strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={handleTopicDelete}
                    disabled={isDeleting}
                    className="btn-ghost size-9 !px-0 hover:!text-negative hover:!bg-negative-soft"
                    title="토픽 삭제"
                    aria-label="토픽 삭제"
                  >
                    {isDeleting ? <Loader2 size={18} strokeWidth={1.5} className="animate-spin" /> : <Trash2 size={18} strokeWidth={1.5} />}
                  </button>
                </>
              )}
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="btn-ghost size-9 !px-0 hidden lg:inline-flex"
                title={isFullscreen ? '축소하기' : '전체화면'}
                aria-label={isFullscreen ? '축소하기' : '전체화면'}
              >
                {isFullscreen ? <Minimize2 size={18} strokeWidth={1.5} /> : <Maximize2 size={18} strokeWidth={1.5} />}
              </button>
              <button onClick={handleClose} className="btn-ghost size-9 !px-0" title="닫기" aria-label="닫기">
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* Topic Content */}
          <div className="shrink-0 lg:shrink lg:flex-1 lg:overflow-y-auto no-scrollbar p-4 lg:p-6 space-y-6">
            <h2 className="text-xl lg:text-2xl font-semibold text-ink break-words">{topic.title}</h2>

            {topic.imageUrl && (
              <ImageWithFallback
                src={resolveImage(topic.imageUrl)}
                alt={topic.title}
                width={1200}
                height={600}
                containerClassName="w-full max-h-[500px] min-h-[200px] rounded-xl border border-line bg-raised overflow-hidden"
                className="w-full h-auto object-contain"
                unoptimized
              />
            )}

            <div className={`text-ink leading-relaxed break-words ${markdownListClassName}`} data-color-mode="light">
              <EdMarkdown
                rehypePlugins={markdownRehypePlugins}
                source={topic.content}
                components={markdownComponents}
                style={{
                  backgroundColor: 'transparent',
                  fontSize: '1rem',
                  fontWeight: 400,
                  color: 'inherit',
                }}
              />
            </div>
          </div>
        </div>

        {/* Right Sidebar - AI Insights & Comments */}
        <div className="contents lg:flex lg:w-96 lg:flex-col lg:shrink-0 lg:overflow-hidden relative bg-canvas">
          {/* AI Insights Section */}
          <div className="p-4 lg:p-6 bg-canvas border-t lg:border-t-0 border-b border-line shrink-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink mb-3">
              <Sparkles size={16} strokeWidth={1.5} className="text-ink-3" />
              <span>AI 스마트 요약</span>
              {insight && !loadingInsight && (
                <button
                  onClick={handleAnalyze}
                  className="btn-ghost size-8 !px-0 ml-auto"
                  title="AI 분석 다시하기"
                  aria-label="AI 분석 다시하기"
                >
                  <RefreshCw size={16} strokeWidth={1.5} />
                </button>
              )}
              {loadingInsight && <Loader2 size={16} strokeWidth={1.5} className="animate-spin text-ink-3 ml-auto" />}
            </div>

            <div className="card p-4 min-h-[120px] flex flex-col justify-center">
              {insight ? (
                <div className="space-y-3">
                  {(insight.stale || insight.analyzedAt) && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {insight.analyzedAt && <span className="stamp">{formatDateTime(insight.analyzedAt, tf)} 분석</span>}
                      {insight.stale && (
                        <span className="text-xs text-ink-3">분석 뒤에 토픽이 바뀌었어요. 다시 분석해 보세요</span>
                      )}
                    </div>
                  )}
                  <p className="text-sm text-ink-2 leading-relaxed">{spaceSentences(insight.summary)}</p>
                  {keywords.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5" aria-label="키워드">
                      {keywords.map((k) => (
                        <li key={k} className="text-xs text-ink-2 bg-raised border border-line rounded-full px-2 py-0.5">
                          #{k}
                        </li>
                      ))}
                    </ul>
                  )}
                  {insight.ocrText && insight.ocrText.trim() && (
                    <div className="pt-3 border-t border-line">
                      <span className="text-xs text-ink-3 block mb-1">이미지 텍스트 추출</span>
                      <p className="text-xs text-ink-2 line-clamp-3 leading-relaxed">{insight.ocrText}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center space-y-3">
                  <p className="text-sm text-ink-3">아직 분석된 내용이 없어요</p>
                  <button onClick={handleAnalyze} disabled={loadingInsight} className="btn-primary">
                    {loadingInsight ? '분석하는 중…' : 'AI 분석 시작'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Comments Section */}
          <div className="contents lg:flex lg:flex-1 lg:flex-col lg:overflow-hidden">
            <div className="px-4 lg:px-6 py-4 bg-canvas shrink-0 flex items-center gap-2 text-sm font-semibold text-ink">
              <MessageSquare size={16} strokeWidth={1.5} className="text-ink-3" />
              <span>댓글 <span className="text-xs font-normal text-ink-3 tabular-nums">{comments.length}</span></span>
            </div>

            <div className="flex-1 lg:overflow-y-auto no-scrollbar bg-canvas px-4 lg:px-6 space-y-4 pb-6 lg:pb-24">
              {comments.length > 0 ? comments.map((comment) => {
                const isMine = session?.user?.id === comment.authorId;
                const isEditing = editingCommentId === comment.id;
                return (
                  <div key={comment.id} className="flex gap-3">
                    <div className="size-8 rounded-full relative shrink-0 overflow-hidden">
                      {comment.authorProfileImage ? (
                        <ImageWithFallback
                          src={resolveImage(comment.authorProfileImage)}
                          alt={comment.authorNickname}
                          fill
                          containerClassName="w-full h-full"
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full bg-raised flex items-center justify-center text-ink-2 text-xs">
                          {initialOf(comment.authorNickname)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      {/* 좁은 칸에서는 시각·버튼 묶음이 다음 줄로 내려가 이름·@ID 가 잘리지 않게 한다 */}
                      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                        <span className="min-w-0 text-sm font-medium text-ink break-words">
                          {comment.authorNickname}
                          {comment.authorCustomId && (
                            <span className="ml-1 text-xs font-normal text-ink-3 whitespace-nowrap">@{comment.authorCustomId}</span>
                          )}
                        </span>
                        <div className="flex items-center gap-1 shrink-0 ml-auto">
                          <span className="stamp whitespace-nowrap">
                            {formatDateTime(comment.createdAt, tf)}
                            {isEdited(comment) && ' · 수정됨'}
                          </span>
                          {isMine && !isEditing && (
                            <>
                              <button
                                onClick={() => startEditComment(comment)}
                                className="btn-ghost size-8 !px-0"
                                title="댓글 수정"
                                aria-label="댓글 수정"
                              >
                                <Pencil size={15} strokeWidth={1.5} />
                              </button>
                              <button
                                onClick={() => handleCommentDelete(comment.id)}
                                className="btn-ghost size-8 !px-0 hover:!text-negative hover:!bg-negative-soft"
                                title="댓글 삭제"
                                aria-label="댓글 삭제"
                              >
                                <Trash2 size={15} strokeWidth={1.5} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      {isEditing ? (
                        <form
                          className="space-y-2"
                          onSubmit={(e) => {
                            e.preventDefault();
                            submitEditComment(comment);
                          }}
                        >
                          <textarea
                            value={editingContent}
                            onChange={(e) => setEditingContent(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                e.preventDefault();
                                submitEditComment(comment);
                              }
                            }}
                            rows={3}
                            autoFocus
                            aria-label="댓글 수정"
                            className="form-input resize-y min-h-[72px]"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={cancelEdit}
                              disabled={updateCommentMutation.isPending}
                              className="btn-secondary"
                            >
                              취소
                            </button>
                            <button
                              type="submit"
                              disabled={updateCommentMutation.isPending || !hasVisibleText(editingContent)}
                              className="btn-primary"
                            >
                              {updateCommentMutation.isPending
                                ? <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
                                : <Check size={16} strokeWidth={1.5} />}
                              저장
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div
                          className={`text-sm text-ink-2 leading-relaxed bg-surface px-3 py-2 rounded-xl border border-line break-words ${markdownListClassName}`}
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
                  </div>
                );
              }) : (
                <div className="py-10 lg:py-16 text-center">
                  <div className="size-10 rounded-full bg-raised flex items-center justify-center mx-auto mb-3">
                    <MessageSquare size={18} strokeWidth={1.5} className="text-ink-3" />
                  </div>
                  <p className="text-sm font-medium text-ink">아직 댓글이 없어요</p>
                  <p className="text-sm text-ink-3 mt-1">첫 댓글을 남겨 보세요</p>
                </div>
              )}
            </div>

            {/* Comment Input: 모바일은 화면 아래에 붙고, 모달이 하단 탭(z-100)보다 위라 가려지지 않는다 */}
            <div className="sticky bottom-0 z-10 lg:absolute lg:bottom-0 lg:left-0 w-full px-4 lg:px-6 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:py-4 bg-canvas border-t border-line">
              <form onSubmit={handleCommentSubmit} className="relative">
                <input
                  type="text"
                  value={commentInput}
                  onChange={(e) => {
                    setCommentInput(e.target.value);
                    handleInputChange(e.target.value, 'participant');
                  }}
                  placeholder="댓글 입력 (@로 멤버 언급)"
                  aria-label="댓글 입력"
                  className="form-input pr-12"
                />

                {showParticipantMentions && (
                  <MentionList
                    items={filteredParticipants as MentionItem[]}
                    onSelect={(m) => {
                      const parts = commentInput.split('@');
                      parts.pop();
                      // 입력칸에는 '@이름' 만 보이고, 보낼 때 링크 형식으로 바꿔요.
                      const name = m.nickname ?? '';
                      const newVal = parts.join('@') + `@${name} `;
                      setCommentInput(newVal);
                      if (name) setCommentMentions((prev) => ({ ...prev, [name]: m.id }));
                      setShowParticipantMentions(false);
                    }}
                  />
                )}

                <button
                  type="submit"
                  disabled={isCommenting || !hasVisibleText(commentInput)}
                  className="btn-primary absolute right-1.5 top-1/2 -translate-y-1/2 size-8 !px-0"
                  aria-label="댓글 보내기"
                >
                  {isCommenting ? <Loader2 size={16} strokeWidth={1.5} className="animate-spin" /> : <Send size={16} strokeWidth={1.5} />}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
