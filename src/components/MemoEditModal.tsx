'use client';

import React, { useRef, useState, useEffect } from 'react';
import { X, Upload, Loader2 } from 'lucide-react';
import { Modal } from './ui';
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

  return (
    <Modal
      open={isOpen}
      onClose={() => {
        if (!isSaving) onClose();
      }}
      size="xl"
      title="메모 수정"
      zIndex="z-[70]"
      bodyClassName="p-0! md:p-0!"
      footer={
        <>
          {error && <p className="mr-auto text-sm text-negative">{error}</p>}
          <button
            type="button"
            onClick={onClose}
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
            {isSaving && <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />}
            {isSaving ? '저장 중…' : '저장'}
          </button>
        </>
      }
    >
      <div className="flex flex-col md:h-[600px] md:flex-row">
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto no-scrollbar p-5 md:border-r md:border-line md:p-6">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목"
            className="form-input h-11 font-display text-xl"
          />

          <div
            className="relative flex min-h-30 w-full cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed border-line-strong bg-surface p-5 transition-colors duration-150 ease-out hover:bg-raised"
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
                <Upload size={16} strokeWidth={1.5} className="text-ink-3" />
                <div className="text-center">
                  <p className="text-sm font-medium text-ink">
                    새 이미지를 끌어다 놓거나 눌러서 바꿔요
                  </p>
                  <p className="mt-1 text-xs text-ink-3">기존 이미지를 유지하려면 그대로 두세요</p>
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
                className="btn-danger btn-sm absolute right-3 top-3"
              >
                제거
              </button>
            )}
          </div>

          <div className="min-h-[352px] flex-1 overflow-hidden rounded-xl border border-line-strong bg-surface" data-color-mode="light">
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

        <div className="flex w-full shrink-0 flex-col gap-6 overflow-y-auto no-scrollbar border-t border-line bg-canvas p-5 md:w-[320px] md:border-t-0 md:p-6">
          <section className="space-y-2">
            <h3 className="text-[13px] font-medium text-ink-3">태그</h3>
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
                className="form-input h-9 min-w-0 flex-1"
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
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tags.map((tag) => (
                  <span key={tag} className="chip gap-1">
                    #{tag}
                    <X
                      size={12}
                      strokeWidth={1.5}
                      className="cursor-pointer text-ink-3 hover:text-ink"
                      onClick={() => removeTag(tag)}
                    />
                  </span>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="text-[13px] font-medium text-ink-3">분석</h3>
            <p className="text-[13px] leading-relaxed text-ink-2">
              메모를 고쳐도 기존 분석 결과는 그대로 남아요. 필요하면 다시 분석해 주세요.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-[13px] font-medium text-ink-3">알아두세요</h3>
            <ul className="space-y-1.5 text-[13px] leading-relaxed text-ink-2">
              <li>고친 내용은 공유 멤버에게 바로 보여요</li>
              <li>이미지를 바꾸면 글자 추출을 다시 할 수 있어요</li>
            </ul>
          </section>
        </div>
      </div>
    </Modal>
  );
}
