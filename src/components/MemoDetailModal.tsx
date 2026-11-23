'use client';

import { useCallback, useEffect, useRef } from 'react';
import MemoDetailView from './MemoDetailView';

interface MemoDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  memoId: string | null;
  userId: string;
  onDelete?: () => void;
}

const LEAVE_MESSAGE = '저장하지 않은 내용이 있어요. 닫으면 고친 내용이 사라져요. 닫을까요?';

export default function MemoDetailModal({
  isOpen,
  onClose,
  memoId,
  onDelete,
}: MemoDetailModalProps) {
  const dirtyRef = useRef(false);
  const handleDirtyChange = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
  }, []);

  const requestClose = useCallback(() => {
    if (dirtyRef.current && !window.confirm(LEAVE_MESSAGE)) return;
    dirtyRef.current = false;
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, requestClose]);

  if (!isOpen || !memoId) return null;

  return (
    <div
      className="fixed inset-0 z-[105] flex items-stretch sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={requestClose}
    >
      <div
        className="bg-surface border border-line sm:rounded-2xl w-full max-w-5xl h-[100dvh] sm:h-auto sm:max-h-[85vh] flex shadow-float overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        <MemoDetailView
          memoId={memoId}
          onDelete={onDelete}
          onClose={requestClose}
          onDirtyChange={handleDirtyChange}
          isPage={false}
        />
      </div>
    </div>
  );
}
