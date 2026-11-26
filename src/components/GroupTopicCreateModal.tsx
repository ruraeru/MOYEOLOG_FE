'use client';

import React, { useRef, useState, useEffect } from 'react';
import {
  X,
  Upload,
  Loader2,
  Check,
} from 'lucide-react';
import { fileToDataUrl, convertToWebP, MAX_IMAGE_BYTES } from '@/lib/utils';
import { getApiErrorMessage } from '@/lib/axios';
import { useAlertStore } from '@/hooks/useAlert';
import { groupTopicApi } from '@/lib/group-topic-api';
import type { MemoResponse } from '@/lib/memo-api';
import { groupApi, type GroupResponse } from '@/lib/group-api';
import { friendApi, type FriendResponse } from '@/lib/friend-api';
import { useMentions } from '@/hooks/useMentions';
import { MentionList, type MentionItem } from './Mentions';
import { useSession } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';
import RichEditor from './RichEditor';
import { hasVisibleText } from '@/lib/markdown';
import type { TopicResponse } from '@/types/topic';


const IMAGE_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp';
const NOT_IMAGE_MESSAGE = 'JPG, PNG, GIF, WEBP 이미지만 올릴 수 있어요';

/** 파일 앞부분(매직 바이트)으로 JPEG/PNG/GIF/WEBP 인지 확인한다. 확장자·MIME 은 믿지 않는다. */
async function isSupportedImage(file: File): Promise<boolean> {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (b.length < 4) return false;
  const jpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const gif = b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38;
  const webp = b.length >= 12
    && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
    && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
  return jpeg || png || gif || webp;
}

/** 브라우저가 실제로 그릴 수 있는 이미지인지 확인한다(헤더만 맞고 깨진 파일 거르기). */
function canDecode(dataUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth > 0 && img.naturalHeight > 0);
    img.onerror = () => resolve(false);
    img.src = dataUrl;
  });
}

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
  const titleRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

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
      // 데스크톱은 제목칸에 바로 쓸 수 있게. 터치 기기는 키보드가 화면을 덮어 두지 않는다
      if (typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches) {
        requestAnimationFrame(() => titleRef.current?.focus());
      }
    }
  }, [isOpen, initialTopic]);

  const isDirty = initialTopic
    ? title !== initialTopic.title || content !== initialTopic.content || imagePreview !== (initialTopic.imageUrl || null)
    : !!(title.trim() || content.trim() || imagePreview);

  const handleClose = async () => {
    if (isSaving) return;
    if (isDirty && !(await useAlertStore.getState().confirm('작성 중인 내용이 사라져요. 닫을까요?', undefined, '닫기', '계속 쓰기'))) {
      return;
    }
    onClose();
  };

  // Esc 로 닫기. 상세 모달 위에 열려 있을 수 있어 캡처 단계에서 먼저 받아 아래로 전달하지 않는다
  const handleCloseRef = useRef(handleClose);
  useEffect(() => {
    handleCloseRef.current = handleClose;
  });
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.isComposing) return;
      if (useAlertStore.getState().modal) return;
      e.preventDefault();
      e.stopPropagation();
      handleCloseRef.current();
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen]);

  const handleImageSelect = async (file: File) => {
    try {
      if (file.size > MAX_IMAGE_BYTES) {
        setError('파일이 너무 커요. 10MB 이하로 올려 주세요.');
        return;
      }
      if (!(await isSupportedImage(file))) {
        setError(NOT_IMAGE_MESSAGE);
        return;
      }
      const webpFile = await convertToWebP(file);
      const dataUrl = await fileToDataUrl(webpFile);
      if (!(await canDecode(dataUrl))) {
        setError('이미지를 열 수 없어요. 다른 파일을 골라 주세요');
        return;
      }
      setImagePreview(dataUrl);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '이미지를 처리하지 못했어요');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleImageSelect(file);
  };

  const handleSave = async () => {
    if (!hasVisibleText(title)) {
      setError('제목을 입력해 주세요');
      titleRef.current?.focus();
      return;
    }
    if (!hasVisibleText(content)) {
      setError('내용을 입력해 주세요');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const payload = {
        title: title.trim(),
        content,
        imageUrl: imagePreview || undefined,
      };

      if (initialTopic) {
        await groupTopicApi.update(initialTopic.id, payload, session);
        // 뒤에 열려 있는 상세가 바로 새 내용을 보이게
        queryClient.invalidateQueries({ queryKey: ['topic', initialTopic.id] });
        useAlertStore.getState().addToast('토픽을 고쳤어요', 'success');
      } else {
        await groupTopicApi.create(groupId, payload, session);
        useAlertStore.getState().addToast('토픽을 올렸어요', 'success');
      }

      onSuccess?.();
      onClose();
    } catch (e) {
      setError(getApiErrorMessage(e, '저장하지 못했어요'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40 md:items-center md:p-4"
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={initialTopic ? '토픽 수정' : '새 토픽 작성'}
        className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface animate-slide-up md:max-h-[88vh] md:max-w-[720px] md:rounded-2xl md:animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 머리 */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-4 md:px-6">
          <h2 className="font-display text-xl leading-7 text-ink">
            {initialTopic ? '토픽 수정' : '토픽 올리기'}
          </h2>
          <button
            onClick={handleClose}
            disabled={isSaving}
            className="btn-icon"
            aria-label="닫기"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* 본문 */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 md:px-6">
          <div className="space-y-1.5">
            <label htmlFor="topic-title" className="text-[13px] font-medium text-ink-2">제목</label>
            <input
              id="topic-title"
              type="text"
              value={title}
              ref={titleRef}
              onChange={(e) => { setTitle(e.target.value); setError(null); }}
              placeholder="무엇을 이야기할까요"
              maxLength={255}
              aria-label="토픽 제목"
              className="form-input h-10 font-display text-base"
            />
          </div>

          {/* 본문 편집기 */}
          <div className="space-y-1.5">
            <span className="text-[13px] font-medium text-ink-2">내용</span>
            <RichEditor
              value={content}
              onChange={(v) => { setContent(v); setError(null); }}
              placeholder="자유롭게 써 주세요"
              className="h-[300px] md:h-[340px]"
            />
          </div>

          {/* 사진 */}
          <div className="space-y-1.5">
            <span className="text-[13px] font-medium text-ink-2">사진</span>
            <div
              className="group relative flex min-h-24 w-full cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-[10px] border border-dashed border-line-strong p-4 transition-colors hover:bg-raised"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={IMAGE_ACCEPT}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageSelect(file);
                }}
              />
              {imagePreview ? (
                <div className="relative max-h-56 w-full overflow-hidden rounded-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="Preview" className="h-full w-full bg-raised object-contain" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                    <p className="rounded-lg bg-black/50 px-3 py-1.5 text-[13px] text-white">사진 바꾸기</p>
                  </div>
                </div>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ink">
                    <Upload size={16} strokeWidth={1.5} className="text-ink-3" />
                    사진 추가
                  </span>
                  <p className="text-xs text-ink-3">끌어다 놓거나 눌러서 올려요. 사진 속 글자는 요약할 때 함께 읽어요</p>
                </>
              )}
              {imagePreview && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setImagePreview(null);
                  }}
                  aria-label="사진 빼기"
                  className="btn-icon absolute right-2 top-2 z-10 border border-line-strong bg-surface hover:!bg-negative-soft hover:!text-negative"
                >
                  <X size={16} strokeWidth={1.5} />
                </button>
              )}
            </div>
          </div>

          {/* 멘션 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="relative space-y-1.5">
              <label className="text-[13px] font-medium text-ink-2">멤버 언급</label>
              <div className="relative">
                <input
                  type="text"
                  value={participantInput}
                  onChange={(e) => {
                    setParticipantInput(e.target.value);
                    handleInputChange(e.target.value, 'participant');
                  }}
                  placeholder="@이름으로 찾기"
                  className="form-input"
                />
                {showParticipantMentions && (
                  <MentionList
                    items={filteredParticipants as MentionItem[]}
                    placement="bottom"
                    onSelect={(m) => {
                      setError(null);
                      setContent(prev => `${prev}\n[@${m.nickname}](/profile/${m.id}) `);
                      setShowParticipantMentions(false);
                      setParticipantInput('');
                    }}
                  />
                )}
              </div>
            </div>

            <div className="relative space-y-1.5">
              <label className="text-[13px] font-medium text-ink-2">메모 언급</label>
              <div className="relative">
                <input
                  type="text"
                  value={memoMentionInput}
                  onChange={(e) => {
                    setMemoMentionInput(e.target.value);
                    handleInputChange(e.target.value, 'memo');
                  }}
                  placeholder="@제목으로 찾기"
                  className="form-input"
                />
                {showMemoMentions && (
                  <MentionList
                    items={filteredMemos as MentionItem[]}
                    placement="bottom"
                    onSelect={(m) => {
                      setError(null);
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

        {/* 오류는 스크롤 밖에 둬서 어디까지 내려가 있든 보인다 */}
        {error && (
          <p role="alert" className="mx-5 mt-3 shrink-0 rounded-[10px] bg-negative-soft px-3 py-2.5 text-sm text-negative md:mx-6">
            {error}
          </p>
        )}

        {/* 아래 */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] md:px-6">
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
            {isSaving ? '저장하는 중' : (initialTopic ? '저장' : '올리기')}
          </button>
        </div>
      </div>
    </div>
  );
}
