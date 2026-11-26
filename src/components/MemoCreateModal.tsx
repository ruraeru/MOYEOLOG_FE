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
import { hasVisibleText } from '@/lib/markdown';

const TITLE_MAX = 255;
const TAG_MAX = 50;
const TAG_COUNT_MAX = 50;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const NOT_IMAGE_MESSAGE = 'PNG, JPG, GIF, WEBP 이미지만 올릴 수 있어요';

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
  const titleRef = useRef<HTMLInputElement>(null);
  const [tagError, setTagError] = useState<string | null>(null);
  const closingRef = useRef(false);
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
    setTagError(null);
  }, []);

  const isDirty = !!(title.trim() || hasVisibleText(content) || tags.length || tagInput.trim() || imageFile || selectedGroupId);

  // 쓰던 내용이 있으면 버릴지 묻는다(바깥 클릭·X·취소·Esc 모두)
  const handleClose = async () => {
    if (isSaving || closingRef.current) return;
    if (isDirty) {
      closingRef.current = true;
      const ok = await confirm('쓰던 메모를 버릴까요?', undefined, '버리기', '계속 쓰기');
      closingRef.current = false;
      if (!ok) return;
    }
    resetForm();
    onClose();
  };
  const handleCloseRef = useRef(handleClose);
  useEffect(() => {
    handleCloseRef.current = handleClose;
  });

  // Modal 의 Esc 는 포커스 위치(편집기 안)에 따라 동작이 달라 직접 받는다. @ 목록이 열려 있으면 편집기가 먼저 받아 목록만 닫는다.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.isComposing) handleCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  // 이미지가 아닌 파일은 고를 때 바로 알린다(그리지 못하면 이미지가 아니다)
  const isDecodableImage = async (file: File) => {
    if (!IMAGE_TYPES.includes(file.type)) return false;
    try {
      const bitmap = await createImageBitmap(file);
      bitmap.close();
      return true;
    } catch {
      return false;
    }
  };

  const handleImageSelect = async (file: File) => {
    try {
      if (!(await isDecodableImage(file))) {
        setError(NOT_IMAGE_MESSAGE);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
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
    if (file) handleImageSelect(file);
  };

  const addTag = () => {
    // 앞의 # 는 칩에 붙여 보여 주므로 뺀다(## 로 보이지 않게)
    const trimmed = tagInput.trim().replace(/^#+/, '').trim();
    if (!trimmed) {
      setTagInput('');
      return;
    }
    if (tags.includes(trimmed)) {
      setTagError(`'${trimmed}' 태그는 이미 있어요`);
      setTagInput('');
      return;
    }
    if (tags.length >= TAG_COUNT_MAX) {
      setTagError(`태그는 ${TAG_COUNT_MAX}개까지 달 수 있어요`);
      return;
    }
    setTags((prev) => [...prev, trimmed]);
    setTagInput('');
    setTagError(null);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('제목을 입력해 주세요');
      titleRef.current?.focus();
      return;
    }
    if (!hasVisibleText(content)) {
      setError('내용을 입력해 주세요');
      document.querySelector<HTMLElement>('[role=dialog] .ProseMirror')?.focus();
      return;
    }

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
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      closeOnEsc={false}
      title="새 메모"
      size="lg"
      footer={
        <>
          {/* 오류는 늘 보이는 버튼 줄에 둔다(본문 아래에 두면 스크롤 밖이라 안 보였다) */}
          {error && (
            <p role="alert" className="mr-auto min-w-0 flex-1 text-sm text-negative">
              {error}
            </p>
          )}
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
          ref={titleRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목"
          aria-label="제목"
          maxLength={TITLE_MAX}
          autoFocus
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
                className="form-input h-9 py-0 pointer-coarse:h-11"
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
                onChange={(e) => {
                  setTagInput(e.target.value);
                  setTagError(null);
                }}
                onKeyDown={(e) => {
                  // 한글 조합 중 Enter 는 글자 확정용이다(여기서 넣으면 마지막 글자가 입력칸에 남는다)
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="태그 입력 후 Enter"
                maxLength={TAG_MAX}
                aria-describedby={tagError ? 'memo-create-tag-error' : undefined}
                className="form-input h-9 min-w-0 flex-1 py-0 pointer-coarse:h-11"
              />
              <button type="button" onClick={addTag} className="btn-secondary shrink-0 pointer-coarse:h-11 pointer-coarse:px-4">
                추가
              </button>
            </div>
            {tagError && (
              <p id="memo-create-tag-error" className="text-xs text-negative">
                {tagError}
              </p>
            )}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1 pointer-coarse:gap-2">
                {tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    aria-label={`태그 ${tag} 지우기`}
                    title={`#${tag}`}
                    className="chip max-w-full min-w-0 cursor-pointer gap-1 transition-colors hover:text-ink pointer-coarse:h-11 pointer-coarse:px-3"
                    onClick={() => setTags(tags.filter(t => t !== tag))}
                  >
                    <span className="truncate">#{tag}</span>
                    <X size={12} strokeWidth={1.5} className="shrink-0 text-ink-3" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-[13px] font-medium text-ink-2">사진</p>
          <div
            role="button"
            tabIndex={0}
            aria-label={imagePreview ? '사진 바꾸기' : '사진 올리기'}
            className="relative flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed border-line-strong bg-surface p-4 outline-none transition-colors hover:bg-raised focus-visible:border-accent"
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
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
                // 아주 가는 사진도 알아볼 수 있게 최소 폭을 두고 넘치는 부분은 자른다
                className="max-h-40 min-w-24 rounded-lg object-cover"
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
                className="btn-danger btn-sm absolute right-3 top-3 pointer-coarse:h-11 pointer-coarse:px-4"
              >
                제거
              </button>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-[13px] font-medium text-ink-2">내용</p>
          <RichEditor
            value={content}
            onChange={setContent}
            placeholder="내용을 써 보세요. @를 누르면 일정이나 메모를 연결할 수 있어요"
            mentions={{ memos: allMemos, schedules }}
            // 데스크톱은 창 안에 다 보이는 높이. 모바일은 내용만큼 늘고 창 본문 하나만 스크롤한다(도구 막대는 위에 붙음).
            className="h-80 md:h-64 max-md:h-auto max-md:min-h-60 max-md:overflow-visible max-md:[&_.ProseMirror]:min-h-48"
          />
          <p className="text-xs leading-relaxed text-ink-3">
            @로 연결한 일정·메모는 저장할 때 서로 이어져요. 저장한 뒤 메모 화면에서 분석을 시작하면 이미지 글자를 읽고 요약과 키워드를 추천해요.
          </p>
        </div>

      </div>
    </Modal>
  );
}
