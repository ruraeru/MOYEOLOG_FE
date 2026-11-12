'use client';

import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  X,
  Upload,
  Bold,
  Italic,
  Users,
  Tag as TagIcon,
  Sparkles,
  Loader2,
  Calendar,
  FileText
} from 'lucide-react';
import { fileToDataUrl, convertToWebP } from '@/lib/utils';
import { memoApi, type MemoResponse } from '@/lib/memo-api';
import { scheduleApi, type ScheduleResponse } from '@/lib/schedule-api';
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
  userId,
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
    } else {
      setMentionState({ active: false, query: '', startPos: 0, endPos: 0 });
    }
  }, [isOpen, session]);

  const resetForm = useCallback(() => {
    setTitle('');
    setContent('');
    setTagInput('');
    setTags([]);
    setImagePreview(null);
    setImageFile(null);
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
    const match = textBeforeCursor.match(/@([^\s]*)$/);

    if (match) {
      setMentionState({ active: true, query: match[1], startPos: match.index!, endPos: cursor });
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
      const taggedMemoIds = Array.from(new Set([...content.matchAll(/\[@[^\]]+\]\(\/memo\/([a-zA-Z0-9-]+)\)/g)].map(m => m[1])));
      const taggedScheduleIds = Array.from(new Set([...content.matchAll(/\[@[^\]]+\]\(\/schedule\/([a-zA-Z0-9-]+)\)/g)].map(m => m[1])));

      await memoApi.create({
        title,
        content,
        imageFile: imageFile || undefined,
        groupId: groupId || undefined,
        tags: tags,
        taggedMemoIds,
        taggedScheduleIds
      }, session);

      resetForm();
      onSuccess?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했어요');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  // 멘션 필터링
  const matchedMemos = allMemos.filter(m => m.title.toLowerCase().includes(mentionState.query.toLowerCase())).slice(0, 5);
  const matchedSchedules = schedules.filter(s => s.title.toLowerCase().includes(mentionState.query.toLowerCase())).slice(0, 5);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4 overflow-y-auto"
      onClick={handleClose}
    >
      <div
        className="bg-surface border border-line rounded-2xl w-full max-w-5xl flex flex-col shadow-float overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-line flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold text-ink">새 메모</h2>
          <button
            onClick={handleClose}
            disabled={isSaving}
            className="btn-ghost disabled:opacity-50"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex h-[600px]">
          <div className="flex-1 flex flex-col p-6 border-r border-line overflow-y-auto no-scrollbar relative">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목"
              className="text-2xl font-semibold text-ink bg-transparent placeholder:text-ink-3 border-none outline-none mb-4 w-full"
            />

            <div
              className="w-full border border-dashed border-line-strong rounded-2xl p-5 flex flex-col items-center justify-center gap-3 bg-canvas hover:bg-raised transition-colors duration-150 ease-out cursor-pointer mb-4 relative overflow-hidden min-h-[120px] shrink-0"
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
                  className="max-h-40 rounded-[10px] object-contain"
                />
              ) : (
                <>
                  <Upload size={18} strokeWidth={1.5} className="text-ink-3" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-ink">
                      이미지를 끌어다 놓거나 눌러서 올려요
                    </p>
                    <p className="text-xs text-ink-3 mt-1">PNG, JPG, GIF (최대 10MB)</p>
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
                  className="absolute top-3 right-3 text-xs text-negative bg-surface border border-line px-2 py-1 rounded-lg"
                >
                  제거
                </button>
              )}
            </div>

            <div className="flex-1 min-h-[250px] relative" data-color-mode="light" onKeyUp={handleEditorKeyUp}>
              <MDEditor
                previewOptions={{ rehypePlugins: markdownRehypePlugins }}
                value={content}
                onChange={(val) => setContent(val || '')}
                preview="live"
                height="100%"
                style={{ borderRadius: '0.75rem', border: '1px solid var(--color-line)' }}
                textareaProps={{
                  placeholder: '내용을 써 보세요. @를 누르면 일정이나 메모를 연결할 수 있어요'
                }}
              />

              {/* 에디터 인라인 멘션 팝업 */}
              {mentionState.active && (matchedMemos.length > 0 || matchedSchedules.length > 0) && (
                <div className="absolute z-50 bottom-4 left-4 w-72 max-h-64 overflow-y-auto bg-surface border border-line shadow-float rounded-2xl p-2 no-scrollbar">
                  {matchedSchedules.length > 0 && (
                    <div className="mb-2">
                      <div className="text-xs text-ink-3 px-2 py-1">일정</div>
                      {matchedSchedules.map(s => (
                        <button key={s.id} onClick={() => insertMention(s, 'schedule')} className="w-full text-left px-3 py-2 hover:bg-raised rounded-lg text-sm text-ink flex items-center gap-2 transition-colors duration-150 ease-out">
                          <Calendar size={16} strokeWidth={1.5} className="shrink-0 text-ink-3" />
                          <span className="truncate">{s.title}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {matchedMemos.length > 0 && (
                    <div>
                      <div className="text-xs text-ink-3 px-2 py-1">메모</div>
                      {matchedMemos.map(m => (
                        <button key={m.id} onClick={() => insertMention(m, 'memo')} className="w-full text-left px-3 py-2 hover:bg-raised rounded-lg text-sm text-ink flex items-center gap-2 transition-colors duration-150 ease-out">
                          <FileText size={16} strokeWidth={1.5} className="shrink-0 text-ink-3" />
                          <span className="truncate">{m.title}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="w-[340px] bg-canvas p-6 flex flex-col gap-6 shrink-0 overflow-y-auto no-scrollbar">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-ink">
                <Users size={16} strokeWidth={1.5} className="text-ink-3" />
                <span>공유할 모임</span>
              </div>
              <input
                type="text"
                disabled
                placeholder="아직 쓸 수 없어요"
                className="form-input w-full text-xs"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-ink">
                <TagIcon size={16} strokeWidth={1.5} className="text-ink-3" />
                <span>태그</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="태그 입력"
                  className="form-input flex-1 min-w-0"
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="btn-secondary shrink-0"
                >
                  추가
                </button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs text-ink-2 bg-raised rounded-md px-2 py-0.5 flex items-center gap-1 cursor-pointer hover:text-ink transition-colors duration-150 ease-out"
                      onClick={() => setTags(tags.filter(t => t !== tag))}
                    >
                      {tag} <X size={12} strokeWidth={1.5} className="text-ink-3" />
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-ink">
                <Sparkles size={16} strokeWidth={1.5} className="text-ink-3" />
                <span>자동 정리</span>
              </div>
              <p className="text-xs text-ink-2 leading-relaxed">
                저장하면 첨부한 이미지의 글자를 읽고 핵심 키워드를 추천해요
              </p>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-ink">쓰는 방법</div>
              <ul className="text-xs text-ink-2 space-y-2 leading-relaxed">
                <li>본문에 <span className="text-ink">@</span>를 입력하면 일정이나 다른 메모를 바로 연결할 수 있어요</li>
                <li>연결한 항목은 저장할 때 서로 이어져요</li>
              </ul>
            </div>
          </div>
        </div>

        {error && <p className="px-6 pb-2 text-sm text-negative">{error}</p>}

        <div className="border-t border-line px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 text-ink-3">
            <Bold size={16} strokeWidth={1.5} />
            <Italic size={16} strokeWidth={1.5} />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSaving}
              className="btn-secondary disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="btn-primary disabled:opacity-70 flex items-center gap-2"
            >
              {isSaving && <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />}
              {isSaving ? '저장 중…' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
