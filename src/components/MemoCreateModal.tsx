'use client';

import React, { useCallback, useRef, useState } from 'react';
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
} from 'lucide-react';
import { fileToDataUrl } from '@/lib/utils';
import { memoApi } from '@/lib/memo-api';
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
  groupId?: string; // groupId 추가
}

export default function MemoCreateModal({
  isOpen,
  onClose,
  userId,
  onSuccess,
  groupId, // groupId 추가
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

  const resetForm = useCallback(() => {
    setTitle('');
    setContent('');
    setTagInput('');
    setTags([]);
    setImagePreview(null);
    setImageFile(null);
    setError(null);
  }, []);

  const handleClose = () => {
    if (isSaving) return;
    resetForm();
    onClose();
  };

  const handleImageSelect = async (file: File) => {
    try {
      setImageFile(file);
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

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    setTags((prev) => [...prev, trimmed]);
    setTagInput('');
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('제목을 입력해주세요.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // 백엔드 API 호출 (FormData/파일 전송)
      await memoApi.create({
        title,
        content,
        imageFile: imageFile || undefined,
        groupId: groupId || undefined, // 주입받은 groupId 사용
        tags: tags, // 태그 추가
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

  return (
    <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto"
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
            <div className="flex-1 flex flex-col p-8 border-r border-gray-100 overflow-y-auto no-scrollbar">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="메모 제목을 입력하세요"
                className="text-2xl font-bold text-gray-900 placeholder:text-gray-300 border-none outline-none mb-6 w-full"
              />

              <div
                className="w-full border-2 border-dashed border-gray-100 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 bg-gray-50/30 hover:bg-gray-50 transition-colors cursor-pointer mb-6 group relative overflow-hidden min-h-[120px]"
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

              <div className="flex-1 min-h-[350px] border border-gray-100 rounded-2xl overflow-hidden bg-white" data-color-mode="light">
                <MDEditor
                  value={content}
                  onChange={(val) => setContent(val || '')}
                  preview="live"
                  height="100%"
                  style={{ borderRadius: '1rem' }}
                  textareaProps={{
                    placeholder: '내용을 입력하세요 (마크다운 지원)...'
                  }}
                />
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
                    className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 text-xs outline-none focus:border-blue-400 shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-700 shrink-0"
                  >
                    추가
                  </button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                  <Sparkles className="w-4 h-4 text-blue-500" />
                  <span>AI 기능</span>
                </div>
                <p className="text-[10px] text-gray-400 font-medium leading-relaxed">
                  저장 시 자동으로 요약·키워드·감정 분석이 실행됩니다. (서버 연동 전 목 분석)
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-yellow-500">
                  <Lightbulb className="w-3.5 h-3.5" />
                  <span>팁</span>
                </div>
                <ul className="text-[10px] text-gray-400 space-y-2 leading-relaxed font-medium">
                  <li>• 이미지를 첨부하면 AI가 텍스트를 추출합니다</li>
                  <li>• 태그를 활용해 메모를 쉽게 찾을 수 있어요</li>
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
                className="px-6 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-50 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-2.5 bg-[#6366F1] text-white rounded-xl text-sm font-bold hover:bg-[#5558E6] disabled:opacity-70 flex items-center gap-2"
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
