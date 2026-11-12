'use client';

import React, { useRef, useState, useEffect } from 'react';
import {
  X,
  Upload,
  Bold,
  Italic,
  Tag as TagIcon,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { fileToDataUrl, convertToWebP } from '@/lib/utils';
import { memoApi, type MemoResponse } from '@/lib/memo-api';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import { markdownRehypePlugins } from '@/lib/markdown';
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

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('제목을 입력해 주세요');
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
      setError(e instanceof Error ? e.message : '수정하지 못했어요');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-line rounded-2xl w-full max-w-5xl flex flex-col shadow-float overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-line flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold text-ink">메모 수정</h2>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="btn-ghost disabled:opacity-50"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex h-[600px]">
          <div className="flex-1 flex flex-col p-6 border-r border-line overflow-y-auto no-scrollbar">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목"
              className="text-2xl font-semibold text-ink bg-transparent placeholder:text-ink-3 border-none outline-none mb-4 w-full"
            />

            <div
              className="w-full border border-dashed border-line-strong rounded-2xl p-5 flex flex-col items-center justify-center gap-3 bg-canvas hover:bg-raised transition-colors duration-150 ease-out cursor-pointer mb-4 relative overflow-hidden min-h-[120px]"
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
                      새 이미지를 끌어다 놓거나 눌러서 바꿔요
                    </p>
                    <p className="text-xs text-ink-3 mt-1">기존 이미지를 유지하려면 그대로 두세요</p>
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
                  className="absolute top-3 right-3 text-xs text-negative bg-surface border border-line px-2 py-1 rounded-lg hover:bg-negative-soft transition-colors duration-150 ease-out"
                >
                  제거
                </button>
              )}
            </div>

            <div className="flex-1 min-h-[350px] border border-line rounded-xl overflow-hidden bg-surface" data-color-mode="light">
              <MDEditor
                previewOptions={{ rehypePlugins: markdownRehypePlugins }}
                value={content}
                onChange={(val) => setContent(val || '')}
                preview="live"
                height="100%"
                style={{ borderRadius: '0.75rem' }}
              />
            </div>
          </div>

          <div className="w-[340px] bg-canvas p-6 flex flex-col gap-6 shrink-0 overflow-y-auto no-scrollbar">
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
                      className="text-xs text-ink-2 bg-raised rounded-md px-2 py-0.5 flex items-center gap-1 group/tag"
                    >
                      {tag}
                      <X
                        size={12}
                        strokeWidth={1.5}
                        className="cursor-pointer text-ink-3 opacity-0 group-hover/tag:opacity-100 transition-opacity duration-150 ease-out"
                        onClick={() => removeTag(tag)}
                      />
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
                메모를 고쳐도 기존 분석 결과는 그대로 남아요. 필요하면 다시 분석해 주세요
              </p>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium text-ink">알아두세요</div>
              <ul className="text-xs text-ink-2 space-y-2 leading-relaxed">
                <li>고친 내용은 공유 멤버에게 바로 보여요</li>
                <li>이미지를 바꾸면 글자 추출을 다시 할 수 있어요</li>
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
              onClick={onClose}
              disabled={isSaving}
              className="btn-secondary disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="btn-primary disabled:opacity-70 flex items-center justify-center gap-2"
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
