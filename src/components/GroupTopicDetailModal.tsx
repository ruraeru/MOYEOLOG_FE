'use client';

import { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groupTopicApi } from '@/lib/group-topic-api';
import { memoApi, type MemoResponse } from '@/lib/memo-api';
import { groupApi, type GroupResponse } from '@/lib/group-api';
import { friendApi, type FriendResponse } from '@/lib/friend-api';
import { useMentions } from '@/hooks/useMentions';
import { MentionList, type MentionItem } from './Mentions';
import type { TopicDetailResponse, TopicResponse } from '@/types/topic';
import dynamic from 'next/dynamic';
import { markdownRehypePlugins } from '@/lib/markdown';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';

const EdMarkdown = dynamic(
  () => import('@uiw/react-md-editor').then((mod) => mod.default.Markdown),
  { ssr: false }
);

interface GroupTopicDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  topicId: string | null;
  onDelete?: () => void;
  onEdit?: (topic: TopicResponse) => void;
  onMemoClick?: (memoId: string) => void;
}

function formatDateTime(iso: string) {
  return format(new Date(iso), 'M.d EEE HH:mm', { locale: ko });
}

import { useAlert } from '@/hooks/useAlert';

export default function GroupTopicDetailModal({
  isOpen,
  onClose,
  topicId,
  onDelete,
  onEdit,
  onMemoClick,
}: GroupTopicDetailModalProps) {
  const { data: session } = useSession();
  const { confirm, alert, toast } = useAlert();
  const queryClient = useQueryClient();
  const [commentInput, setCommentInput] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Mention states
  const [allMemos, setAllMemos] = useState<MemoResponse[]>([]);
  const [friends, setFriends] = useState<FriendResponse[]>([]);
  const [userGroups, setUserGroups] = useState<GroupResponse[]>([]);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  // 1. 토픽 상세 조회 Query (5초마다 자동 갱신)
  const { data: topicDetail, isLoading: loading, refetch } = useQuery({
    queryKey: ['topic', topicId],
    queryFn: () => groupTopicApi.getById(topicId!, session),
    enabled: !!topicId && !!session && isOpen,
    refetchInterval: 5000, // 5초마다 자동 확인
  });

  // 2. 댓글 작성 Mutation
  const createCommentMutation = useMutation({
    mutationFn: (content: string) => groupTopicApi.createComment(topicId!, content, session),
    onSuccess: () => {
      setCommentInput('');
      queryClient.invalidateQueries({ queryKey: ['topic', topicId] });
      onDelete?.(); // 댓글 수 업데이트를 위해 부모 리스트 갱신 호출
    },
    onError: (error) => {
      console.error('Failed to create comment:', error);
      toast.error('댓글을 쓰지 못했어요');
    }
  });

  // 3. 댓글 삭제 Mutation
  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => groupTopicApi.deleteComment(commentId, session),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topic', topicId] });
      onDelete?.(); // 댓글 수 업데이트를 위해 부모 리스트 갱신 호출
    },
    onError: (error) => {
      console.error('Failed to delete comment:', error);
      toast.error('댓글을 지우지 못했어요');
    }
  });

  // 4. AI 분석 Mutation
  const analyzeMutation = useMutation({
    mutationFn: () => groupTopicApi.analyze(topicId!, session),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['topic', topicId] });
    },
    onError: (error) => {
      console.error('Failed to analyze topic:', error);
      toast.error('AI 분석에 실패했어요');
    }
  });

  // 5. 토픽 삭제 Mutation
  const deleteTopicMutation = useMutation({
    mutationFn: () => groupTopicApi.delete(topicId!, session),
    onSuccess: () => {
      onDelete?.();
      onClose();
    },
    onError: (error) => {
      console.error('Failed to delete topic:', error);
      toast.error('토픽을 지우지 못했어요');
    }
  });

  const { 
    showParticipantMentions, setShowParticipantMentions, filteredParticipants,
    handleInputChange
  } = useMentions({ 
    allMemos, 
    friends, 
    userGroups, 
    selectedGroupId: topicDetail?.topic.groupId || undefined, 
    currentUserId: session?.user?.id 
  });

  useEffect(() => {
    if (isOpen && session) {
      memoApi.getAll(session).then(setAllMemos).catch(console.error);
      friendApi.getFriends(session).then(setFriends).catch(console.error);
      groupApi.getAll(session).then(setUserGroups).catch(console.error);
    }
  }, [isOpen, session]);

  const handleAnalyze = () => analyzeMutation.mutate();

  const handleTopicDelete = async () => {
    if (!(await confirm('이 토픽을 삭제할까요?'))) return;
    deleteTopicMutation.mutate();
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) return;
    createCommentMutation.mutate(commentInput);
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
              if (isMemo && id) onMemoClick?.(id);
              if (isProfile) toast.info('프로필은 아직 준비 중이에요');
            }}
            className="text-accent font-medium hover:underline cursor-pointer"
          >
            {props.children}
          </a>
        );
      }
      return <a {...props} className="text-accent hover:underline" target="_blank" rel="noopener noreferrer" />;
    }
  };

  if (!isOpen) return null;

  if (loading && !topicDetail) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
        <div className="bg-surface border border-line rounded-2xl shadow-float p-6 flex items-center gap-3">
          <Loader2 size={18} strokeWidth={1.5} className="animate-spin text-ink-3" />
          <span className="text-sm text-ink-2">토픽을 불러오는 중이에요</span>
        </div>
      </div>
    );
  }

  if (!topicDetail) return null;

  const { topic, comments, insight } = topicDetail;
  const isAuthor = session?.user?.id === topic.authorId;
  const isDeleting = deleteTopicMutation.isPending;
  const isCommenting = createCommentMutation.isPending;
  const loadingInsight = analyzeMutation.isPending;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className={`bg-surface flex overflow-hidden relative ${
          isFullscreen
            ? 'fixed inset-0 w-screen h-screen rounded-none z-[70]'
            : 'rounded-2xl border border-line shadow-float w-full max-w-6xl max-h-[90vh]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-line bg-surface">
          {/* Header */}
          <div className="px-6 py-4 border-b border-line flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full relative overflow-hidden shrink-0">
                {topic.authorProfileImage ? (
                  <ImageWithFallback 
                    src={topic.authorProfileImage.startsWith('/uploads/') ? `${apiUrl}${topic.authorProfileImage}` : topic.authorProfileImage} 
                    alt={topic.authorNickname} 
                    fill 
                    containerClassName="w-full h-full"
                    className="object-cover" 
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full bg-accent-soft flex items-center justify-center text-accent">
                    {topic.authorNickname[0]}
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-sm font-medium text-ink">{topic.authorNickname}</h3>
                <p className="stamp">{formatDateTime(topic.createdAt)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isAuthor && (
                <>
                  <button
                    onClick={() => onEdit?.(topic)}
                    className="btn-ghost size-9 !px-0"
                    title="토픽 수정"
                  >
                    <Pencil size={18} strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={handleTopicDelete}
                    disabled={isDeleting}
                    className="btn-ghost size-9 !px-0 hover:!text-negative hover:!bg-negative-soft"
                  >
                    {isDeleting ? <Loader2 size={18} strokeWidth={1.5} className="animate-spin" /> : <Trash2 size={18} strokeWidth={1.5} />}
                  </button>
                </>
              )}
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="btn-ghost size-9 !px-0"
                title={isFullscreen ? "축소하기" : "전체화면"}
              >
                {isFullscreen ? <Minimize2 size={18} strokeWidth={1.5} /> : <Maximize2 size={18} strokeWidth={1.5} />}
              </button>
              <button
                onClick={onClose}
                className="btn-ghost size-9 !px-0"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* Topic Content */}
          <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-6">
            <h2 className="text-2xl font-semibold text-ink">{topic.title}</h2>
            
            {topic.imageUrl && (
              <ImageWithFallback 
                src={topic.imageUrl.startsWith('/uploads/') ? `${apiUrl}${topic.imageUrl}` : topic.imageUrl} 
                alt={topic.title} 
                width={1200}
                height={600}
                containerClassName="w-full max-h-[500px] min-h-[200px] rounded-xl border border-line bg-raised overflow-hidden" 
                className="w-full h-auto object-contain" 
                unoptimized
              />
            )}

            <div className="text-ink leading-relaxed" data-color-mode="light">
              <EdMarkdown 
                rehypePlugins={markdownRehypePlugins}
                source={topic.content} 
                components={markdownComponents}
                style={{ 
                  backgroundColor: 'transparent', 
                  fontSize: '1rem', 
                  fontWeight: 400,
                  color: 'inherit'
                }} 
              />
            </div>
          </div>
        </div>

        {/* Right Sidebar - AI Insights & Comments */}
        <div className="w-96 bg-canvas flex flex-col shrink-0 overflow-hidden relative">
          {/* AI Insights Section */}
          <div className="p-6 border-b border-line shrink-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink mb-3">
              <Sparkles size={16} strokeWidth={1.5} className="text-ink-3" />
              <span>AI 스마트 요약</span>
              {insight && !loadingInsight && (
                <button
                  onClick={handleAnalyze}
                  className="btn-ghost size-8 !px-0 ml-auto"
                  title="AI 분석 다시하기"
                >
                  <RefreshCw size={16} strokeWidth={1.5} />
                </button>
              )}
              {loadingInsight && <Loader2 size={16} strokeWidth={1.5} className="animate-spin text-ink-3 ml-auto" />}
            </div>

            <div className="card p-4 min-h-[120px] flex flex-col justify-center">
              {insight ? (
                <div className="space-y-3">
                  <p className="text-sm text-ink-2 leading-relaxed">&quot;{insight.summary}&quot;</p>
                  {insight.ocrText && (
                    <div className="pt-3 border-t border-line">
                      <span className="text-xs text-ink-3 block mb-1">이미지 텍스트 추출</span>
                      <p className="text-xs text-ink-2 line-clamp-3 leading-relaxed">{insight.ocrText}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center space-y-3">
                  <p className="text-sm text-ink-3">아직 분석된 내용이 없어요</p>
                  <button
                    onClick={handleAnalyze}
                    disabled={loadingInsight}
                    className="btn-primary"
                  >
                    AI 분석 시작
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Comments Section */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 py-4 flex items-center gap-2 text-sm font-semibold text-ink">
              <MessageSquare size={16} strokeWidth={1.5} className="text-ink-3" />
              <span>댓글 <span className="text-xs font-normal text-ink-3 tabular-nums">{comments.length}</span></span>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar px-6 space-y-4 pb-24">
              {comments.length > 0 ? comments.map((comment) => (
                <div key={comment.id} className="flex gap-3 group/comment">
                  <div className="size-8 rounded-full relative shrink-0 overflow-hidden">
                    {comment.authorProfileImage ? (
                      <ImageWithFallback 
                        src={comment.authorProfileImage.startsWith('/uploads/') ? `${apiUrl}${comment.authorProfileImage}` : comment.authorProfileImage} 
                        alt={comment.authorNickname} 
                        fill 
                        containerClassName="w-full h-full"
                        className="object-cover" 
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full bg-raised flex items-center justify-center text-ink-2 text-xs">
                        {comment.authorNickname[0]}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-ink">{comment.authorNickname}</span>
                      <div className="flex items-center gap-2 opacity-0 group-hover/comment:opacity-100 transition-opacity duration-150 ease-out">
                        <span className="stamp">{formatDateTime(comment.createdAt)}</span>
                        {session?.user?.id === comment.authorId && (
                          <button 
                            onClick={() => handleCommentDelete(comment.id)}
                            className="btn-ghost size-8 !px-0 hover:!text-negative hover:!bg-negative-soft"
                          >
                            <Trash2 size={16} strokeWidth={1.5} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-ink-2 leading-relaxed bg-surface px-3 py-2 rounded-xl border border-line" data-color-mode="light">
                      <EdMarkdown 
                        rehypePlugins={markdownRehypePlugins}
                        source={comment.content} 
                        components={markdownComponents}
                        style={{ backgroundColor: 'transparent', fontSize: '0.875rem', color: 'inherit' }} 
                      />
                    </div>
                  </div>
                </div>
              )) : (
                <div className="py-16 text-center">
                  <div className="size-10 rounded-full bg-raised flex items-center justify-center mx-auto mb-3">
                    <MessageSquare size={18} strokeWidth={1.5} className="text-ink-3" />
                  </div>
                  <p className="text-sm font-medium text-ink">아직 댓글이 없어요</p>
                  <p className="text-sm text-ink-3 mt-1">첫 댓글을 남겨 보세요</p>
                </div>
              )}
            </div>

            {/* Comment Input */}
            <div className="absolute bottom-0 left-0 w-full px-6 py-4 bg-canvas border-t border-line">
              <form onSubmit={handleCommentSubmit} className="relative">
                <input
                  type="text"
                  value={commentInput}
                  onChange={(e) => {
                    setCommentInput(e.target.value);
                    handleInputChange(e.target.value, 'participant');
                  }}
                  placeholder="댓글 입력 (@로 친구 언급)"
                  className="form-input pr-12"
                />
                
                {showParticipantMentions && (
                  <MentionList 
                    items={filteredParticipants as MentionItem[]} 
                    onSelect={(m) => {
                      const parts = commentInput.split('@');
                      parts.pop();
                      const newVal = parts.join('@') + `[@${m.nickname}](/profile/${m.id}) `;
                      setCommentInput(newVal);
                      setShowParticipantMentions(false);
                    }} 
                  />
                )}

                <button
                  type="submit"
                  disabled={isCommenting || !commentInput.trim()}
                  className="btn-primary absolute right-1.5 top-1/2 -translate-y-1/2 size-8 !px-0"
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