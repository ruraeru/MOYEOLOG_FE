'use client';

import { useEffect, useState, useCallback } from 'react';
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
import { groupTopicApi } from '@/lib/group-topic-api';
import { memoApi, type MemoResponse } from '@/lib/memo-api';
import { groupApi, type GroupResponse } from '@/lib/group-api';
import { friendApi, type FriendResponse } from '@/lib/friend-api';
import { useMentions } from '@/hooks/useMentions';
import { MentionList, type MentionItem } from './Mentions';
import type { TopicDetailResponse, TopicResponse } from '@/types/topic';
import dynamic from 'next/dynamic';
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
  const d = new Date(iso);
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function GroupTopicDetailModal({
  isOpen,
  onClose,
  topicId,
  onDelete,
  onEdit,
  onMemoClick,
}: GroupTopicDetailModalProps) {
  const { data: session } = useSession();
  const [data, setData] = useState<TopicDetailResponse | null>(null);
  const [commentInput, setCommentInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCommenting, setIsCommenting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Mention states
  const [allMemos, setAllMemos] = useState<MemoResponse[]>([]);
  const [friends, setFriends] = useState<FriendResponse[]>([]);
  const [userGroups, setUserGroups] = useState<GroupResponse[]>([]);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  const { 
    showParticipantMentions, setShowParticipantMentions, filteredParticipants,
    handleInputChange
  } = useMentions({ 
    allMemos, 
    friends, 
    userGroups, 
    selectedGroupId: data?.topic.groupId || undefined, 
    currentUserId: session?.user?.id 
  });

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
              if (isProfile) alert('프로필 기능 준비 중입니다.');
            }}
            className="text-indigo-600 font-black hover:underline cursor-pointer"
          >
            {props.children}
          </a>
        );
      }
      return <a {...props} className="text-indigo-600 hover:underline" target="_blank" rel="noopener noreferrer" />;
    }
  };

  const fetchDetail = useCallback(async () => {
    if (!topicId || !session) return;
    setLoading(true);
    try {
      const res = await groupTopicApi.getById(topicId, session);
      setData(res);
    } catch (error) {
      console.error('Failed to fetch topic detail:', error);
    } finally {
      setLoading(false);
    }
  }, [topicId, session]);

  useEffect(() => {
    if (isOpen && topicId) {
      fetchDetail();
      if (session) {
        memoApi.getAll(session).then(setAllMemos).catch(console.error);
        friendApi.getFriends(session).then(setFriends).catch(console.error);
        groupApi.getAll(session).then(setUserGroups).catch(console.error);
      }
    } else {
      setData(null);
    }
  }, [isOpen, topicId, fetchDetail, session]);

  const handleAnalyze = async () => {
    if (!topicId || !session) return;
    setLoadingInsight(true);
    try {
      const insight = await groupTopicApi.analyze(topicId, session);
      setData(prev => prev ? { ...prev, insight } : null);
    } catch (error) {
      console.error('Failed to analyze topic:', error);
      alert('AI 분석에 실패했습니다.');
    } finally {
      setLoadingInsight(false);
    }
  };

  const handleTopicDelete = async () => {
    if (!topicId || !session || !confirm('정말로 이 토픽을 삭제하시겠습니까?')) return;
    setIsDeleting(true);
    try {
      await groupTopicApi.delete(topicId, session);
      onDelete?.();
      onClose();
    } catch (error) {
      console.error('Failed to delete topic:', error);
      alert('토픽 삭제에 실패했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicId || !session || !commentInput.trim()) return;
    setIsCommenting(true);
    try {
      const newComment = await groupTopicApi.createComment(topicId, commentInput, session);
      setData(prev => prev ? { ...prev, comments: [...prev.comments, newComment] } : null);
      setCommentInput('');
    } catch (error) {
      console.error('Failed to create comment:', error);
      alert('댓글 작성에 실패했습니다.');
    } finally {
      setIsCommenting(false);
    }
  };

  const handleCommentDelete = async (commentId: string) => {
    if (!session || !confirm('댓글을 삭제하시겠습니까?')) return;
    try {
      await groupTopicApi.deleteComment(commentId, session);
      setData(prev => prev ? { ...prev, comments: prev.comments.filter(c => c.id !== commentId) } : null);
    } catch (error) {
      console.error('Failed to delete comment:', error);
      alert('댓글 삭제에 실패했습니다.');
    }
  };

  if (!isOpen) return null;

  if (loading && !data) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <div className="bg-white rounded-3xl p-10 flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          <span className="font-bold text-gray-600">토픽을 불러오는 중...</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { topic, comments, insight } = data;
  const isAuthor = session?.user?.id === topic.authorId;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className={`bg-white flex shadow-2xl overflow-hidden relative transition-all duration-300 ${
          isFullscreen
            ? 'fixed inset-0 w-screen h-screen rounded-none z-[70]'
            : 'rounded-[2.5rem] w-full max-w-6xl max-h-[90vh]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-gray-100 bg-white">
          {/* Header */}
          <div className="px-10 py-8 border-b border-gray-50 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full relative border-2 border-gray-100 flex items-center justify-center overflow-hidden">
                {topic.authorProfileImage ? (
                  <ImageWithFallback 
                    src={topic.authorProfileImage.startsWith('/uploads/') ? `${apiUrl}${topic.authorProfileImage}` : topic.authorProfileImage} 
                    alt={topic.authorNickname} 
                    fill 
                    className="object-cover" 
                  />
                ) : (
                  <div className="w-full h-full bg-indigo-50 flex items-center justify-center text-indigo-500 font-bold">
                    {topic.authorNickname[0]}
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900">{topic.authorNickname}</h3>
                <p className="text-xs text-gray-400 font-medium">{formatDateTime(topic.createdAt)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isAuthor && (
                <>
                  <button
                    onClick={() => onEdit?.(topic)}
                    className="p-2.5 hover:bg-gray-100 rounded-2xl transition-colors text-gray-400 hover:text-indigo-600"
                    title="토픽 수정"
                  >
                    <Pencil className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleTopicDelete}
                    disabled={isDeleting}
                    className="p-2.5 hover:bg-red-50 rounded-2xl transition-colors text-gray-400 hover:text-red-500 disabled:opacity-50"
                  >
                    {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                  </button>
                </>
              )}
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-2.5 hover:bg-gray-100 rounded-2xl transition-colors text-gray-400"
                title={isFullscreen ? "축소하기" : "전체화면"}
              >
                {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </button>
              <button
                onClick={onClose}
                className="p-2.5 hover:bg-gray-100 rounded-2xl transition-colors text-gray-400"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Topic Content */}
          <div className="flex-1 overflow-y-auto no-scrollbar p-10 space-y-8">
            <h2 className="text-4xl font-black text-gray-900 leading-tight tracking-tight">{topic.title}</h2>
            
            {topic.imageUrl && (
              <ImageWithFallback 
                src={topic.imageUrl.startsWith('/uploads/') ? `${apiUrl}${topic.imageUrl}` : topic.imageUrl} 
                alt={topic.title} 
                width={1200}
                height={600}
                containerClassName="w-full max-h-[500px] min-h-[200px] rounded-3xl shadow-xl border border-gray-100 bg-gray-50" 
                className="w-full h-auto object-contain" 
              />
            )}

            <div className="text-gray-700 leading-relaxed" data-color-mode="light">
              <EdMarkdown 
                source={topic.content} 
                components={markdownComponents}
                style={{ 
                  backgroundColor: 'transparent', 
                  fontSize: '1.25rem', 
                  fontWeight: 500,
                  color: 'inherit'
                }} 
              />
            </div>
          </div>
        </div>

        {/* Right Sidebar - AI Insights & Comments */}
        <div className="w-[420px] bg-gray-50/50 flex flex-col shrink-0 overflow-hidden relative">
          {/* AI Insights Section */}
          <div className="p-8 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2 font-black text-gray-800 mb-4">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              <span>AI 스마트 요약</span>
              {insight && !loadingInsight && (
                <button
                  onClick={handleAnalyze}
                  className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all ml-1"
                  title="AI 분석 다시하기"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
              {loadingInsight && <Loader2 className="w-4 h-4 animate-spin text-indigo-500 ml-1" />}
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 min-h-[120px] flex flex-col justify-center">
              {insight ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 leading-relaxed font-bold italic">&quot;{insight.summary}&quot;</p>
                  {insight.ocrText && (
                    <div className="pt-4 border-t border-gray-50">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">이미지 텍스트 추출</span>
                      <p className="text-[11px] text-gray-500 line-clamp-3 leading-relaxed">{insight.ocrText}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <p className="text-xs text-gray-400 font-medium">아직 분석된 내용이 없습니다.</p>
                  <button
                    onClick={handleAnalyze}
                    disabled={loadingInsight}
                    className="px-6 py-2.5 bg-indigo-600 text-white text-xs font-black rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95 disabled:opacity-50"
                  >
                    AI 분석 시작하기
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Comments Section */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-8 py-6 flex items-center gap-2 font-black text-gray-800">
              <MessageSquare className="w-5 h-5 text-indigo-600" />
              <span>댓글 <span className="text-indigo-500">{comments.length}</span></span>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar px-8 space-y-6 pb-24">
              {comments.length > 0 ? comments.map((comment) => (
                <div key={comment.id} className="flex gap-4 group/comment">
                  <div className="w-10 h-10 rounded-2xl relative shrink-0 border border-gray-100 shadow-sm flex items-center justify-center overflow-hidden">
                    {comment.authorProfileImage ? (
                      <ImageWithFallback 
                        src={comment.authorProfileImage.startsWith('/uploads/') ? `${apiUrl}${comment.authorProfileImage}` : comment.authorProfileImage} 
                        alt={comment.authorNickname} 
                        fill 
                        className="object-cover" 
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs font-bold">
                        {comment.authorNickname[0]}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-gray-800">{comment.authorNickname}</span>
                      <div className="flex items-center gap-2 opacity-0 group-hover/comment:opacity-100 transition-opacity">
                        <span className="text-[10px] text-gray-300 font-medium">{formatDateTime(comment.createdAt)}</span>
                        {session?.user?.id === comment.authorId && (
                          <button 
                            onClick={() => handleCommentDelete(comment.id)}
                            className="p-1 hover:bg-red-50 text-gray-300 hover:text-red-500 rounded-lg transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 leading-relaxed font-medium bg-white p-4 rounded-2xl rounded-tl-none shadow-sm border border-gray-50" data-color-mode="light">
                      <EdMarkdown 
                        source={comment.content} 
                        components={markdownComponents}
                        style={{ backgroundColor: 'transparent', fontSize: '0.875rem', color: 'inherit' }} 
                      />
                    </div>
                  </div>
                </div>
              )) : (
                <div className="py-20 text-center">
                  <MessageSquare className="w-12 h-12 text-gray-100 mx-auto mb-4" />
                  <p className="text-xs text-gray-400 font-medium">첫 번째 댓글을 남겨보세요!</p>
                </div>
              )}
            </div>

            {/* Comment Input */}
            <div className="absolute bottom-0 left-0 w-full p-6 bg-gray-50/80 backdrop-blur-md border-t border-gray-100">
              <form onSubmit={handleCommentSubmit} className="relative">
                <input
                  type="text"
                  value={commentInput}
                  onChange={(e) => {
                    setCommentInput(e.target.value);
                    handleInputChange(e.target.value, 'participant');
                  }}
                  placeholder="댓글을 입력하세요... (@로 친구 언급)"
                  className="w-full bg-white border border-gray-200 rounded-2xl pl-6 pr-14 py-4 text-sm font-bold focus:border-indigo-500 outline-none shadow-sm transition-all"
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
                  className="absolute right-2 top-2 p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all active:scale-90 disabled:opacity-50 shadow-md shadow-indigo-100"
                >
                  {isCommenting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}