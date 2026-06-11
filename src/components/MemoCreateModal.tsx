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
  Lightbulb,
  Loader2,
  Calendar,
  FileText
} from 'lucide-react';
import { fileToDataUrl, convertToWebP } from '@/lib/utils';
import { memoApi, type MemoResponse } from '@/lib/memo-api';
import { scheduleApi, type ScheduleResponse } from '@/lib/schedule-api';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
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
      setError(e instanceof Error ? e.message : '이미지 처리에 실패했습니다.');
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
      setError('제목을 입력해주세요.');
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
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.');
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
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-5xl flex flex-col shadow-2xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h2 className="text-xl font-bold text-gray-800">새 메모 작성</h2>
          <button
            onClick={handleClose}
            disabled={isSaving}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex h-[600px]">
          <div className="flex-1 flex flex-col p-8 border-r border-gray-100 overflow-y-auto no-scrollbar relative">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="메모 제목을 입력하세요"
              className="text-2xl font-bold text-gray-900 placeholder:text-gray-300 border-none outline-none mb-6 w-full"
            />

            <div
              className="w-full border-2 border-dashed border-gray-100 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 bg-gray-50/30 hover:bg-gray-50 transition-colors cursor-pointer mb-6 group relative overflow-hidden min-h-[120px] shrink-0"
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
                  className="max-h-40 rounded-xl object-contain"
                />
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm text-gray-400 group-hover:text-blue-500 transition-all">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-gray-600">
                      이미지를 드래그하거나 클릭하여 업로드
                    </p>
                    <p className="text-[11px] text-gray-400 mt-1">PNG, JPG, GIF (최대 10MB)</p>
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
                  className="absolute top-3 right-3 text-xs font-bold text-red-500 bg-white px-2 py-1 rounded-lg shadow-sm"
                >
                  제거
                </button>
              )}
            </div>

            <div className="flex-1 min-h-[250px] relative" data-color-mode="light" onKeyUp={handleEditorKeyUp}>
              <MDEditor
                value={content}
                onChange={(val) => setContent(val || '')}
                preview="live"
                height="100%"
                style={{ borderRadius: '1rem', border: '1px solid #F3F4F6' }}
                textareaProps={{
                  placeholder: '내용을 입력하세요 (@를 입력하여 일정이나 메모를 바로 태그할 수 있습니다)...'
                }}
              />
              
              {/* 에디터 인라인 멘션 팝업 */}
              {mentionState.active && (matchedMemos.length > 0 || matchedSchedules.length > 0) && (
                <div className="absolute z-50 bottom-4 left-4 w-72 max-h-64 overflow-y-auto bg-white border border-gray-100 shadow-2xl rounded-2xl p-2 no-scrollbar">
                  {matchedSchedules.length > 0 && (
                    <div className="mb-2">
                      <div className="text-[10px] font-bold text-gray-400 px-2 py-1 uppercase tracking-wider">일정 결과</div>
                      {matchedSchedules.map(s => (
                        <button key={s.id} onClick={() => insertMention(s, 'schedule')} className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 rounded-xl text-sm font-bold text-gray-700 flex items-center gap-2.5 transition-colors">
                          <div className="w-6 h-6 bg-indigo-100 rounded-md flex items-center justify-center shrink-0 text-indigo-500">
                            <Calendar className="w-3.5 h-3.5" />
                          </div>
                          <span className="truncate">{s.title}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {matchedMemos.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold text-gray-400 px-2 py-1 uppercase tracking-wider">메모 결과</div>
                      {matchedMemos.map(m => (
                        <button key={m.id} onClick={() => insertMention(m, 'memo')} className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 rounded-xl text-sm font-bold text-gray-700 flex items-center gap-2.5 transition-colors">
                          <div className="w-6 h-6 bg-indigo-100 rounded-md flex items-center justify-center shrink-0 text-indigo-500">
                            <FileText className="w-3.5 h-3.5" />
                          </div>
                          <span className="truncate">{m.title}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="w-[340px] bg-gray-50/30 p-8 flex flex-col gap-8 shrink-0 overflow-y-auto no-scrollbar">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                <Users className="w-4 h-4" />
                <span>공유할 그룹 선택</span>
              </div>
              <input
                type="text"
                disabled
                placeholder="서버 연동 후 사용 가능"
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-xs text-gray-400 shadow-sm"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                <TagIcon className="w-4 h-4" />
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
                  className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 text-xs outline-none focus:border-indigo-400 shadow-sm transition-colors"
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 shrink-0 shadow-sm"
                >
                  추가
                </button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer hover:bg-indigo-100 transition-colors"
                      onClick={() => setTags(tags.filter(t => t !== tag))}
                    >
                      {tag} <X className="w-3 h-3 opacity-50" />
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                <Sparkles className="w-4 h-4 text-blue-500" />
                <span>AI 스마트 기능</span>
              </div>
              <p className="text-[10px] text-gray-400 font-medium leading-relaxed bg-white p-3 rounded-xl border border-gray-100">
                저장 시 첨부된 이미지의 텍스트를 추출하고 자동으로 핵심 키워드를 추천합니다.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-yellow-500">
                <Lightbulb className="w-3.5 h-3.5" />
                <span>에디터 활용 팁</span>
              </div>
              <ul className="text-[10px] text-gray-500 space-y-2.5 leading-relaxed font-medium bg-yellow-50/50 p-4 rounded-xl border border-yellow-100/50">
                <li className="flex gap-1.5">
                  <span className="text-yellow-500">•</span>
                  에디터 본문에 <strong className="text-gray-700">@</strong>를 입력하여 일정이나 다른 메모를 즉시 멘션할 수 있습니다.
                </li>
                <li className="flex gap-1.5">
                  <span className="text-yellow-500">•</span>
                  멘션된 항목들은 저장 시 자동으로 일정 및 메모 정보와 양방향 연결됩니다.
                </li>
              </ul>
            </div>
          </div>
        </div>

        {error && <p className="px-8 pb-2 text-sm font-medium text-red-500">{error}</p>}

        <div className="border-t border-gray-100 p-6 px-8 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-6 text-gray-400">
            <Bold className="w-5 h-5" />
            <Italic className="w-5 h-5" />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSaving}
              className="px-6 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-70 flex items-center gap-2 shadow-sm transition-colors"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSaving ? '저장 중…' : '메모 저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}