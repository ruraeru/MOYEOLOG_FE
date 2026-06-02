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
import { getFileUrl, fileToDataUrl } from '@/lib/utils';
import { groupTopicApi } from '@/lib/group-topic-api';
import { memoApi, type MemoResponse } from '@/lib/memo-api';
import { groupApi, type GroupResponse } from '@/lib/group-api';
import { friendApi, type FriendResponse } from '@/lib/friend-api';
import { useMentions } from '@/hooks/useMentions';
import { MentionList, type MentionItem } from './Mentions';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
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
      const dataUrl = await fileToDataUrl(file);
      setImagePreview(dataUrl);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '이미지 처리에 실패했습니다.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) handleImageSelect(file);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('제목을 입력해주세요.');
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
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-[2.5rem] w-full max-w-5xl flex flex-col shadow-2xl overflow-hidden relative max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-10 py-6 border-b border-gray-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
              <Sparkles className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-black text-gray-900 tracking-tight">
              {initialTopic ? '토픽 수정하기' : '새 토픽 작성'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isSaving}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main Editor Section */}
          <div className="flex-1 flex flex-col p-10 overflow-y-auto no-scrollbar border-r border-gray-50 bg-white">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="토픽 제목을 입력하세요"
              className="text-3xl font-black text-gray-900 placeholder:text-gray-200 border-none outline-none mb-8 w-full bg-transparent"
            />

            {/* Image Upload Area */}
            <div
              className="w-full border-2 border-dashed border-gray-100 rounded-[2rem] p-8 flex flex-col items-center justify-center gap-4 bg-gray-50/30 hover:bg-gray-50 transition-all cursor-pointer mb-8 group relative overflow-hidden min-h-[160px]"
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
                <div className="relative w-full max-h-64 rounded-2xl overflow-hidden shadow-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-contain bg-black/5" />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <p className="text-white font-bold text-sm bg-black/40 px-4 py-2 rounded-full backdrop-blur-sm">이미지 교체하기</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center shadow-md text-gray-400 group-hover:text-indigo-600 group-hover:scale-110 transition-all duration-300">
                    <Upload className="w-7 h-7" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-black text-gray-600">대표 이미지를 추가해보세요</p>
                    <p className="text-[11px] text-gray-400 mt-1 font-medium">드래그 앤 드롭 또는 클릭하여 업로드</p>
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
                  className="absolute top-4 right-4 z-10 p-2 bg-white/90 backdrop-blur-sm text-red-500 rounded-xl shadow-lg hover:scale-110 transition-all active:scale-95"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Markdown Editor */}
            <div className="flex-1 min-h-[400px] rounded-3xl overflow-hidden border border-gray-100 shadow-sm" data-color-mode="light">
              <MDEditor
                value={content}
                onChange={(val) => setContent(val || '')}
                preview="live"
                height="100%"
                className="no-scrollbar"
                textareaProps={{
                  placeholder: '이 토픽에 대해 자유롭게 의견을 나누어보세요 (마크다운 지원)...'
                }}
              />
            </div>

            {/* Mentions Section */}
            <div className="mt-8 pt-8 border-t border-gray-50 grid grid-cols-2 gap-6">
              <div className="space-y-2 relative">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 flex items-center gap-1"><Users className="w-3 h-3" /> 친구 언급 (@)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={participantInput}
                    onChange={(e) => {
                      setParticipantInput(e.target.value);
                      handleInputChange(e.target.value, 'participant');
                    }}
                    placeholder="@이름으로 친구 찾기"
                    className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-4 py-3 text-xs focus:bg-white focus:border-indigo-500 transition-all outline-none font-bold shadow-sm"
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
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 flex items-center gap-1"><FileText className="w-3 h-3" /> 메모 언급 (@)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={memoMentionInput}
                    onChange={(e) => {
                      setMemoMentionInput(e.target.value);
                      handleInputChange(e.target.value, 'memo');
                    }}
                    placeholder="@제목으로 메모 찾기"
                    className="w-full bg-gray-50 border-2 border-transparent rounded-2xl px-4 py-3 text-xs focus:bg-white focus:border-indigo-500 transition-all outline-none font-bold shadow-sm"
                  />
                  {showMemoMentions && (
                    <MentionList 
                      items={filteredMemos as MentionItem[]} 
                      onSelect={(m) => {
                        setContent(prev => `${prev}\n[📝 ${m.title}](/memo/${m.id}) `);
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
          <div className="w-[340px] bg-gray-50/50 p-10 flex flex-col gap-10 shrink-0 overflow-y-auto no-scrollbar">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-black text-gray-800">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>AI 스마트 기능</span>
              </div>
              <div className="bg-white rounded-[1.5rem] p-6 border border-gray-100 shadow-sm space-y-3">
                <p className="text-xs text-gray-500 leading-relaxed font-medium">
                  이미지를 첨부하면 AI가 사진 속 텍스트를 자동으로 추출해드립니다.
                </p>
                <div className="h-px bg-gray-50 w-full" />
                <p className="text-xs text-gray-500 leading-relaxed font-medium">
                  작성 후 버튼 하나로 긴 내용을 3줄로 요약할 수 있습니다.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-black text-amber-500 uppercase tracking-widest">
                <Lightbulb className="w-4 h-4" />
                <span>Writing Tips</span>
              </div>
              <ul className="text-xs text-gray-400 space-y-4 leading-relaxed font-medium px-1">
                <li className="flex gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-200 mt-1.5 shrink-0" />
                  <span>마크다운 문법을 활용해 내용을 구조화해보세요.</span>
                </li>
                <li className="flex gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-200 mt-1.5 shrink-0" />
                  <span>@멘션을 통해 특정 메모나 친구를 언급할 수 있습니다. (준비 중)</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-10 py-8 border-t border-gray-50 bg-white flex items-center justify-between shrink-0">
          <div className="text-xs text-gray-400 font-medium italic">
            {isSaving ? '서버에 저장하는 중입니다...' : '모든 변경사항이 실시간으로 반영됩니다.'}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSaving}
              className="px-8 py-3 bg-white border-2 border-gray-100 text-gray-500 rounded-2xl text-sm font-black hover:bg-gray-50 transition-all active:scale-95 disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-10 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-black hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95 disabled:opacity-70 flex items-center gap-2"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-5 h-5" />}
              {isSaving ? '저장 중…' : (initialTopic ? '수정 완료' : '토픽 게시하기')}
            </button>
          </div>
        </div>

        {error && (
          <div className="absolute bottom-24 right-10 bg-red-50 text-red-500 px-6 py-3 rounded-2xl text-xs font-bold border border-red-100 shadow-xl animate-bounce">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
