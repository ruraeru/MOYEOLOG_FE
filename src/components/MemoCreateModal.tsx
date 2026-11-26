'use client';

import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  X,
  Upload,
  Loader2
} from 'lucide-react';
import { Modal } from '@/components/ui';
import { fileToDataUrl, convertToWebP } from '@/lib/utils';
import {
  memoApi,
  type MemoResponse,
  extractMentionIds,
  MAX_IMAGE_BYTES,
  IMAGE_TOO_LARGE_MESSAGE,
} from '@/lib/memo-api';
import { scheduleApi, type ScheduleResponse } from '@/lib/schedule-api';
import { groupApi, type GroupResponse } from '@/lib/group-api';
import { getApiErrorMessage } from '@/lib/axios';
import { useSession } from 'next-auth/react';
import RichEditor from '@/components/RichEditor';
import { useAlert } from '@/hooks/useAlert';

// 서버 MemoRequest 와 같은 한도(@CodePointSize). 입력에서 먼저 막는다
const TITLE_MAX = 255;
const TAG_MAX = 50;

interface MemoCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSuccess?: () => void;
  groupId?: string;
}

export default function MemoCreateModal({
  isOpen,
  onClose,
  onSuccess,
  groupId,
}: MemoCreateModalProps) {
  const { data: session } = useSession();
  const { confirm, toast } = useAlert();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<GroupResponse[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorWrapRef = useRef<HTMLDivElement>(null);
  // 같은 렌더 안에서 저장이 여러 번 눌려도 한 번만 보낸다(isSaving 은 다음 렌더부터 막는다)
  const savingRef = useRef(false);
  const closingRef = useRef(false);

  // 데이터 로드
  const [allMemos, setAllMemos] = useState<MemoResponse[]>([]);
  const [schedules, setSchedules] = useState<ScheduleResponse[]>([]);

  useEffect(() => {
    if (isOpen && session) {
      Promise.all([
        memoApi.getAll(session),
        scheduleApi.getAll(session)
      ]).then(([memosData, schedulesData]) => {
        setAllMemos(memosData);
        setSchedules(schedulesData);
      }).catch(console.error);
      // 모임 화면에서 연 경우(groupId 고정)가 아니면 모임 메모로 쓸 수 있게 내 모임을 불러온다.
      if (!groupId) {
        groupApi.getAll(session).then(setGroups).catch(() => setGroups([]));
      }
    }
  }, [isOpen, session, groupId]);

  const resetForm = useCallback(() => {
    setTitle('');
    setContent('');
    setTagInput('');
    setTags([]);
    setImagePreview(null);
    setImageFile(null);
    setSelectedGroupId('');
    setError(null);
  }, []);

  const isDirty = !!(title.trim() || content.trim() || tags.length || tagInput.trim() || imageFile);

  // Esc·배경·취소·X 모두 여기로 온다. 쓰던 내용이 있으면 버릴지 묻는다
  const handleClose = async () => {
    if (isSaving || closingRef.current) return;
    if (isDirty) {
      closingRef.current = true;
      const discard = await confirm('쓰던 메모를 버리고 닫을까요?', undefined, '버리기', '계속 쓰기');
      closingRef.current = false;
      if (!discard) return;
    }
    resetForm();
    onClose();
  };

  const handleImageSelect = async (file: File) => {
    try {
      const webpFile = await convertToWebP(file);
      if (webpFile.size > MAX_IMAGE_BYTES) {
        setError(IMAGE_TOO_LARGE_MESSAGE);
        return;
      }
      setImageFile(webpFile);
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

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (!trimmed) return;
    if (tags.includes(trimmed)) {
      // 이미 있는 태그: 입력만 비우고 알려 준다
      setTagInput('');
      setError(`#${trimmed} 태그는 이미 있어요`);
      return;
    }
    setTags((prev) => [...prev, trimmed]);
    setTagInput('');
    setError(null);
  };

  const handleSave = async () => {
    if (savingRef.current) return;
    if (!title.trim()) {
      setError('제목을 입력해 주세요');
      return;
    }
    // 서버는 빈 본문을 400 으로 거절한다. 보내기 전에 알려 준다
    if (!content.trim()) {
      setError('내용을 입력해 주세요');
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    setError(null);

    try {
      // 마크다운 파싱을 통한 자동 태그 추출
      const taggedMemoIds = extractMentionIds(content, 'memo');
      const taggedScheduleIds = extractMentionIds(content, 'schedule');

      await memoApi.create({
        title,
        content,
        imageFile: imageFile || undefined,
        groupId: groupId || selectedGroupId || undefined,
        tags: tags,
        taggedMemoIds,
        taggedScheduleIds
      }, session);

      resetForm();
      onSuccess?.();
      onClose();
      toast.success('메모를 저장했어요');
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      title="새 메모"
      size="lg"
      footer={
        <>
          {/* 오류는 늘 보이는 버튼 줄 왼쪽에 둔다(본문 아래에 두면 창 스크롤 밖이라 안 보였다) */}
          {error && <p role="alert" className="mr-auto min-w-0 text-sm text-negative">{error}</p>}
          <button type="button" onClick={handleClose} disabled={isSaving} className="btn-secondary">
            취소
          </button>
          <button type="button" onClick={handleSave} disabled={isSaving} className="btn-primary">
            {isSaving && <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />}
            {isSaving ? '저장 중…' : '저장'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            // 제목에서 Enter 는 본문으로 넘어간다(한글 조합 중 Enter 는 건너뜀)
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault();
              editorWrapRef.current?.querySelector<HTMLElement>('[contenteditable="true"]')?.focus();
            }
          }}
          maxLength={TITLE_MAX}
          autoFocus
          placeholder="제목"
          aria-label="제목"
          className="form-input h-11 font-display text-lg"
        />

        <div className={`grid gap-4 ${!groupId ? 'sm:grid-cols-2' : ''}`}>
          {!groupId && (
            <div className="space-y-1.5">
              <label htmlFor="memo-create-group" className="block text-[13px] font-medium text-ink-2">
                모임
              </label>
              <select
                id="memo-create-group"
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="form-input h-9 py-0"
              >
                <option value="">개인 메모</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              <p className="text-xs text-ink-3">모임을 고르면 멤버가 함께 보고 고칠 수 있어요</p>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="memo-create-tag" className="block text-[13px] font-medium text-ink-2">
              태그
            </label>
            <div className="flex gap-2">
              <input
                id="memo-create-tag"
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                maxLength={TAG_MAX}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="태그 입력 후 Enter"
                className="form-input h-9 min-w-0 flex-1 py-0"
              />
              <button type="button" onClick={addTag} className="btn-secondary shrink-0">
                추가
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="chip cursor-pointer gap-1 transition-colors hover:text-ink"
                    onClick={() => setTags(tags.filter(t => t !== tag))}
                  >
                    #{tag} <X size={12} strokeWidth={1.5} className="text-ink-3" />
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-[13px] font-medium text-ink-2">사진</p>
          <div
            className="relative flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed border-line-strong bg-surface p-4 transition-colors hover:bg-raised"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageSelect(file);
              }}
            />
            {imagePreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imagePreview}
                alt="미리보기"
                className="max-h-40 rounded-lg object-contain"
              />
            ) : (
              <>
                <Upload size={16} strokeWidth={1.5} className="text-ink-3" />
                <p className="text-sm text-ink-2">이미지를 끌어다 놓거나 눌러서 올려요</p>
                <p className="text-xs text-ink-3">PNG, JPG, GIF, WEBP (최대 10MB)</p>
              </>
            )}
            {imagePreview && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setImagePreview(null);
                  setImageFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="btn-danger btn-sm absolute right-3 top-3"
              >
                제거
              </button>
            )}
          </div>
        </div>

        <div ref={editorWrapRef} className="space-y-1.5">
          <p className="text-[13px] font-medium text-ink-2">내용 <span className="text-ink-3">(필수)</span></p>
          <RichEditor
            value={content}
            onChange={setContent}
            placeholder="내용을 써 보세요. @를 누르면 일정이나 메모를 연결할 수 있어요"
            mentions={{ memos: allMemos, schedules }}
            className="h-80"
          />
          <p className="text-xs leading-relaxed text-ink-3">
            @로 연결한 일정·메모는 저장할 때 서로 이어져요. 저장한 뒤 메모 화면에서 분석을 시작하면 이미지 글자를 읽고 요약과 키워드를 추천해요.
          </p>
        </div>

      </div>
    </Modal>
  );
}
