'use client';

import MemoDetailView from './MemoDetailView';

interface MemoDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  memoId: string | null;
  userId: string;
  onDelete?: () => void;
}

export default function MemoDetailModal({
  isOpen,
  onClose,
  memoId,
  onDelete,
}: MemoDetailModalProps) {
  if (!isOpen || !memoId) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-5xl max-h-[85vh] flex shadow-2xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        <MemoDetailView 
          memoId={memoId} 
          onDelete={onDelete} 
          onClose={onClose} 
          isPage={false} 
        />
      </div>
    </div>
  );
}
