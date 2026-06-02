'use client';

import React, { useRef, useState, useEffect } from 'react';
import {
  X,
  Upload,
  Bold,
  Italic,
  Tag as TagIcon,
  Sparkles,
  Lightbulb,
  Loader2,
} from 'lucide-react';
import { fileToDataUrl } from '@/lib/utils';
import { memoApi, type MemoResponse } from '@/lib/memo-api';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import '@uiw/react-md-editor/markdown-editor.css';
import '@uiw/react-markdown-preview/markdown.css';

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });

interface MemoEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  memo: MemoResponse;
  onSuccess?: () => void;
}

export default function MemoEditModal({
  isOpen,
  onClose,
  memo,
  onSuccess,
}: MemoEditModalProps) {
  const { data: session } = useSession();
  const [title, setTitle] = useState(memo.title);
  const [content, setContent] = useState(memo.content);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(memo.tags);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  useEffect(() => {
    if (isOpen) {
      setTitle(memo.title);
      setContent(memo.content);
      setTags(memo.tags);
      if (memo.imageUrl) {
        setImagePreview(memo.imageUrl.startsWith('/uploads/') ? `${apiUrl}${memo.imageUrl}` : memo.imageUrl);
      } else {
        setImagePreview(null);
      }
      setImageFile(null);
      setError(null);
    }
  }, [isOpen, memo, apiUrl]);

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

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('제목을 입력해주세요.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await memoApi.update(memo.id, {
        title,
        content,
        imageFile: imageFile || undefined,
        tags: tags,
      }, session);

      onSuccess?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '수정에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
        className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-3xl w-full max-w-5xl flex flex-col shadow-2xl overflow-hidden relative"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between shrink-0 text-gray-800">
            <h2 className="text-xl font-bold">메모 수정</h2>
            <button
              onClick={onClose}
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
                        새 이미지를 드래그하거나 클릭하여 교체
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1">기존 이미지를 유지하려면 그대로 두세요</p>
                    </div>
                  </>
                )}
                {imagePreview && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setImagePreview(null);
                      setImageFile(null);
                    }}
                    className="absolute top-3 right-3 text-xs font-bold text-red-500 bg-white px-2 py-1 rounded-lg shadow-sm hover:bg-red-50 transition-colors"
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
                />
              </div>
            </div>

            <div className="w-[340px] bg-gray-50/30 p-8 flex flex-col gap-8 shrink-0 overflow-y-auto no-scrollbar">
              <div className="space-y-3 text-gray-800">
                <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                  <TagIcon className="w-4 h-4" />
                  <span>태그 관리</span>
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
                        className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded-md flex items-center gap-1 group/tag"
                      >
                        {tag}
                        <X 
                          className="w-2.5 h-2.5 cursor-pointer opacity-0 group-hover/tag:opacity-100 transition-opacity" 
                          onClick={() => removeTag(tag)}
                        />
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                  <Sparkles className="w-4 h-4 text-blue-500" />
                  <span>AI 정보</span>
                </div>
                <p className="text-[10px] text-gray-400 font-medium leading-relaxed">
                  메모를 수정해도 기존 AI 분석 결과는 유지됩니다. 필요 시 다시 분석을 실행하세요.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-yellow-500">
                  <Lightbulb className="w-3.5 h-3.5" />
                  <span>도움말</span>
                </div>
                <ul className="text-[10px] text-gray-400 space-y-2 leading-relaxed font-medium">
                  <li>• 수정된 내용은 실시간으로 공유 멤버에게 반영됩니다</li>
                  <li>• 이미지를 바꾸면 AI 텍스트 추출을 다시 할 수 있습니다</li>
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
                onClick={onClose}
                disabled={isSaving}
                className="px-6 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-50 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-2.5 bg-[#6366F1] text-white rounded-xl text-sm font-bold hover:bg-[#5558E6] disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSaving ? '수정 중…' : '수정 완료'}
              </button>
            </div>
          </div>
        </div>
      </div>
  );
}
