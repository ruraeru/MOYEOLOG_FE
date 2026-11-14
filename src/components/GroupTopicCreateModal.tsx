'use client';

import React, { useRef, useState, useEffect } from 'react';
import {
  X,
  Upload,
  Sparkles,
  Lightbulb,
  Loader2,
  Check,
  Users,
  FileText
} from 'lucide-react';
import { getFileUrl, fileToDataUrl, convertToWebP } from '@/lib/utils';
import { groupTopicApi } from '@/lib/group-topic-api';
import { memoApi, type MemoResponse } from '@/lib/memo-api';
import { groupApi, type GroupResponse } from '@/lib/group-api';
import { friendApi, type FriendResponse } from '@/lib/friend-api';
import { useMentions } from '@/hooks/useMentions';
import { MentionList, type MentionItem } from './Mentions';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import { markdownRehypePlugins } from '@/lib/markdown';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';
import type { TopicResponse } from '@/types/topic';

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });

interface GroupTopicCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  onSuccess?: () => void;
  initialTopic?: TopicResponse | null;
}

export default function GroupTopicCreateModal({
  isOpen,
  onClose,
  groupId,
  onSuccess,
  initialTopic,
}: GroupTopicCreateModalProps) {
  const { data: session } = useSession();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mention states
  const [allMemos, setAllMemos] = useState<MemoResponse[]>([]);
  const [friends, setFriends] = useState<FriendResponse[]>([]);
  const [userGroups, setUserGroups] = useState<GroupResponse[]>([]);
  const [participantInput, setParticipantInput] = useState('');
  const [memoMentionInput, setMemoMentionInput] = useState('');

  const { 
    showMemoMentions, setShowMemoMentions, filteredMemos,
    showParticipantMentions, setShowParticipantMentions, filteredParticipants,
    handleInputChange
  } = useMentions({ 
    allMemos, 
    friends, 
    userGroups, 
    selectedGroupId: groupId, 
    currentUserId: session?.user?.id 
  });

  useEffect(() => {
    if (isOpen && session) {
      // 그룹 정보와 메모 목록 가져오기
      Promise.all([
        groupApi.getById(groupId, session),
        groupApi.getGroupMemos(groupId, session),
        friendApi.getFriends(session)
      ]).then(([groupData, memoData, friendData]) => {
        setUserGroups([groupData]);
        setAllMemos(memoData);
        setFriends(friendData);
      }).catch(console.error);
    }
  }, [isOpen, groupId, session]);

  useEffect(() => {
    if (isOpen) {
      if (initialTopic) {
        setTitle(initialTopic.title);
        setContent(initialTopic.content);
        setImagePreview(initialTopic.imageUrl || null);
      } else {
        setTitle('');
        setContent('');
        setImagePreview(null);
      }
      setError(null);
    }
  }, [isOpen, initialTopic]);

  const handleClose = () => {
    if (isSaving) return;
    onClose();
  };

  const handleImageSelect = async (file: File) => {
    try {
      const webpFile = await convertToWebP(file);
      const dataUrl = await fileToDataUrl(webpFile);
      setImagePreview(dataUrl);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '이미지를 처리하지 못했어요');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) handleImageSelect(file);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('제목을 입력해 주세요');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const payload = {
        title,
        content,
        imageUrl: imagePreview || undefined,
      };

      if (initialTopic) {
        await groupTopicApi.update(initialTopic.id, payload, session);
      } else {
        await groupTopicApi.create(groupId, payload, session);
      }

      onSuccess?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했어요');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4"
      onClick={handleClose}
    >
      <div
        className="bg-surface border border-line rounded-2xl w-full max-w-5xl flex flex-col shadow-float overflow-hidden relative max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-line flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold text-ink">
            {initialTopic ? '토픽 수정' : '새 토픽 작성'}
          </h2>
          <button
            onClick={handleClose}
            disabled={isSaving}
            className="btn-ghost"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main Editor Section */}
          <div className="flex-1 flex flex-col p-6 overflow-y-auto no-scrollbar border-r border-line bg-surface">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="토픽 제목"
              className="text-2xl font-semibold text-ink placeholder:text-ink-3 border-none outline-none mb-6 w-full bg-transparent"
            />

            {/* Image Upload Area */}
            <div
              className="w-full border border-dashed border-line-strong rounded-xl p-6 flex flex-col items-center justify-center gap-3 bg-raised hover:bg-canvas transition-colors duration-150 ease-out cursor-pointer mb-6 group relative overflow-hidden min-h-[160px]"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageSelect(file);
                }}
              />
              {imagePreview ? (
                <div className="relative w-full max-h-64 rounded-lg overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-contain bg-raised" />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <p className="text-white text-sm bg-black/50 px-4 py-2 rounded-lg">이미지 바꾸기</p>
                  </div>
                </div>
              ) : (
                <>
                  <Upload size={18} strokeWidth={1.5} className="text-ink-3" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-ink">대표 이미지 추가</p>
                    <p className="text-xs text-ink-3 mt-1">끌어다 놓거나 눌러서 올릴 수 있어요</p>
                  </div>
                </>
              )}
              {imagePreview && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setImagePreview(null);
                  }}
                  className="btn-secondary absolute top-3 right-3 z-10 size-9 !px-0 text-negative shadow-float"
                >
                  <X size={16} strokeWidth={1.5} />
                </button>
              )}
            </div>

            {/* Markdown Editor */}
            <div className="flex-1 min-h-[400px] rounded-xl overflow-hidden border border-line" data-color-mode="light">
              <MDEditor
                previewOptions={{ rehypePlugins: markdownRehypePlugins }}
                value={content}
                onChange={(val) => setContent(val || '')}
                preview="live"
                height="100%"
                className="no-scrollbar"
                textareaProps={{
                  placeholder: '이 토픽에 대해 자유롭게 이야기해 보세요 (마크다운 지원)'
                }}
              />
            </div>

            {/* Mentions Section */}
            <div className="mt-6 pt-6 border-t border-line grid grid-cols-2 gap-4">
              <div className="space-y-2 relative">
                <label className="text-sm font-medium text-ink flex items-center gap-2"><Users size={16} strokeWidth={1.5} className="text-ink-3" /> 친구 언급 (@)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={participantInput}
                    onChange={(e) => {
                      setParticipantInput(e.target.value);
                      handleInputChange(e.target.value, 'participant');
                    }}
                    placeholder="@이름으로 친구 찾기"
                    className="form-input"
                  />
                  {showParticipantMentions && (
                    <MentionList 
                      items={filteredParticipants as MentionItem[]} 
                      onSelect={(m) => {
                        setContent(prev => `${prev}\n[@${m.nickname}](/profile/${m.id}) `);
                        setShowParticipantMentions(false);
                        setParticipantInput('');
                      }} 
                    />
                  )}
                </div>
              </div>

              <div className="space-y-2 relative">
                <label className="text-sm font-medium text-ink flex items-center gap-2"><FileText size={16} strokeWidth={1.5} className="text-ink-3" /> 메모 언급 (@)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={memoMentionInput}
                    onChange={(e) => {
                      setMemoMentionInput(e.target.value);
                      handleInputChange(e.target.value, 'memo');
                    }}
                    placeholder="@제목으로 메모 찾기"
                    className="form-input"
                  />
                  {showMemoMentions && (
                    <MentionList 
                      items={filteredMemos as MentionItem[]} 
                      onSelect={(m) => {
                        setContent(prev => `${prev}\n[${m.title}](/memo/${m.id}) `);
                        setShowMemoMentions(false);
                        setMemoMentionInput('');
                      }} 
                      isMemo
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar - Info & Tips */}
          <div className="w-80 bg-canvas p-6 flex flex-col gap-6 shrink-0 overflow-y-auto no-scrollbar">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Sparkles size={16} strokeWidth={1.5} className="text-ink-3" />
                <span>AI 스마트 기능</span>
              </div>
              <div className="card p-4 space-y-3">
                <p className="text-sm text-ink-2 leading-relaxed">
                  이미지를 첨부하면 AI가 사진 속 텍스트를 자동으로 뽑아 줘요.
                </p>
                <div className="h-px bg-line w-full" />
                <p className="text-sm text-ink-2 leading-relaxed">
                  작성 후 버튼 하나로 긴 내용을 3줄로 요약할 수 있어요.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Lightbulb size={16} strokeWidth={1.5} className="text-ink-3" />
                <span>작성 팁</span>
              </div>
              <ul className="text-sm text-ink-2 space-y-3 leading-relaxed">
                <li className="flex gap-3">
                  <span className="size-1.5 rounded-full bg-line-strong mt-2 shrink-0" />
                  <span>마크다운 문법으로 내용을 구조화해 보세요.</span>
                </li>
                <li className="flex gap-3">
                  <span className="size-1.5 rounded-full bg-line-strong mt-2 shrink-0" />
                  <span>@멘션으로 특정 메모나 친구를 언급할 수 있어요 (준비 중)</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-line flex items-center justify-between shrink-0">
          <div className="text-xs text-ink-3">
            {isSaving ? '저장하는 중이에요' : '저장하면 바로 반영돼요'}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSaving}
              className="btn-secondary"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="btn-primary"
            >
              {isSaving ? <Loader2 size={16} strokeWidth={1.5} className="animate-spin" /> : <Check size={16} strokeWidth={1.5} />}
              {isSaving ? '저장 중…' : (initialTopic ? '수정 완료' : '토픽 게시')}
            </button>
          </div>
        </div>

        {error && (
          <div className="absolute bottom-20 right-6 bg-negative-soft text-negative px-4 py-3 rounded-lg text-sm shadow-float">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
