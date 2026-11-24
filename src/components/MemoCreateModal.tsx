'use client';

import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  X,
  Upload,
  Loader2,
  Calendar,
  FileText
} from 'lucide-react';
import { Modal } from '@/components/ui';
import { fileToDataUrl, convertToWebP } from '@/lib/utils';
import {
  memoApi,
  type MemoResponse,
  extractMentionIds,
  matchMentionQuery,
  mentionMatches,
  MAX_IMAGE_BYTES,
  IMAGE_TOO_LARGE_MESSAGE,
} from '@/lib/memo-api';
import { scheduleApi, type ScheduleResponse } from '@/lib/schedule-api';
import { groupApi, type GroupResponse } from '@/lib/group-api';
import { getApiErrorMessage } from '@/lib/axios';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import { markdownRehypePlugins } from '@/lib/markdown';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });

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

  // 인라인 멘션 상태
  const [mentionState, setMentionState] = useState({
    active: false,
    query: '',
    startPos: 0,
    endPos: 0
  });

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
    } else {
      setMentionState({ active: false, query: '', startPos: 0, endPos: 0 });
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
    setMentionState({ active: false, query: '', startPos: 0, endPos: 0 });
  }, []);

  const handleClose = () => {
    if (isSaving) return;
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
    if (!trimmed || tags.includes(trimmed)) return;
    setTags((prev) => [...prev, trimmed]);
    setTagInput('');
  };

  // 인라인 멘션 키보드 감지 로직
  const handleEditorKeyUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLTextAreaElement;
    if (target.tagName !== 'TEXTAREA') return;

    const cursor = target.selectionStart;
    const textBeforeCursor = target.value.slice(0, cursor);
    const match = matchMentionQuery(textBeforeCursor);

    if (match) {
      setMentionState({ active: true, query: match.query, startPos: match.index, endPos: cursor });
    } else {
      setMentionState(prev => prev.active ? { ...prev, active: false } : prev);
    }
  };

  // 마크다운 링크 삽입 로직
  const insertMention = (item: { id: string; title: string }, type: 'memo' | 'schedule') => {
    const link = `[@${item.title}](/${type}/${item.id}) `;
    const newContent = content.slice(0, mentionState.startPos) + link + content.slice(mentionState.endPos);
    setContent(newContent);
    setMentionState({ active: false, query: '', startPos: 0, endPos: 0 });
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('제목을 입력해 주세요');
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
    } catch (e) {
      setError(getApiErrorMessage(e));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  // 멘션 필터링
  const matchedMemos = allMemos.filter(m => mentionMatches(m.title, mentionState.query)).slice(0, 5);
  const matchedSchedules = schedules.filter(s => mentionMatches(s.title, mentionState.query)).slice(0, 5);

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      title="새 메모"
      size="lg"
      footer={
        <>
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
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

        <div className="space-y-1.5">
          <p className="text-[13px] font-medium text-ink-2">내용</p>
          <div className="relative" data-color-mode="light" onKeyUp={handleEditorKeyUp}>
            <MDEditor
              previewOptions={{ rehypePlugins: markdownRehypePlugins }}
              value={content}
              onChange={(val) => setContent(val || '')}
              preview="live"
              height={320}
              style={{ borderRadius: '10px', border: '1px solid var(--line-strong)', boxShadow: 'none' }}
              textareaProps={{
                placeholder: '내용을 써 보세요. @를 누르면 일정이나 메모를 연결할 수 있어요'
              }}
            />

            {/* 에디터 인라인 멘션 팝업 */}
            {mentionState.active && (matchedMemos.length > 0 || matchedSchedules.length > 0) && (
              <div className="absolute bottom-4 left-4 z-50 max-h-64 w-72 overflow-y-auto rounded-xl border border-line bg-surface p-1.5 shadow-float no-scrollbar">
                {matchedSchedules.length > 0 && (
                  <div className="mb-1">
                    <div className="px-2.5 py-1 text-xs font-medium text-ink-3">일정</div>
                    {matchedSchedules.map(s => (
                      <button key={s.id} onClick={() => insertMention(s, 'schedule')} className="flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm text-ink transition-colors hover:bg-raised">
                        <Calendar size={16} strokeWidth={1.5} className="shrink-0 text-ink-3" />
                        <span className="truncate">{s.title}</span>
                      </button>
                    ))}
                  </div>
                )}
                {matchedMemos.length > 0 && (
                  <div>
                    <div className="px-2.5 py-1 text-xs font-medium text-ink-3">메모</div>
                    {matchedMemos.map(m => (
                      <button key={m.id} onClick={() => insertMention(m, 'memo')} className="flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm text-ink transition-colors hover:bg-raised">
                        <FileText size={16} strokeWidth={1.5} className="shrink-0 text-ink-3" />
                        <span className="truncate">{m.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <p className="text-xs leading-relaxed text-ink-3">
            @로 연결한 일정·메모는 저장할 때 서로 이어져요. 저장한 뒤 메모 화면에서 분석을 시작하면 이미지 글자를 읽고 요약과 키워드를 추천해요.
          </p>
        </div>

        {error && <p className="text-sm text-negative">{error}</p>}
      </div>
    </Modal>
  );
}
