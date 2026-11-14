'use client';

import React, { useState } from 'react';
import { X, Search, UserPlus, Loader2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { friendApi } from '@/lib/friend-api';

interface FriendSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function FriendSearchModal({ isOpen, onClose, onSuccess }: FriendSearchModalProps) {
  const { data: session } = useSession();
  const [customId, setCustomId] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customId.trim()) return;

    setIsSending(true);
    setError(null);
    setSuccess(false);

    try {
      await friendApi.sendRequest(customId, session);
      setSuccess(true);
      setCustomId('');
      onSuccess?.();
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '친구 요청을 보내지 못했어요');
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface shadow-float overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-line flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">친구 추가</h2>
          <button onClick={onClose} className="btn-ghost">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <form onSubmit={handleSendRequest} className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-ink">사용자 ID로 찾기</label>
            <div className="relative">
              <input
                type="text"
                value={customId}
                onChange={(e) => setCustomId(e.target.value)}
                placeholder="친구의 8자리 ID를 입력해요"
                className="form-input pl-10"
                required
                maxLength={8}
              />
              <Search size={16} strokeWidth={1.5} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
            </div>
          </div>

          {error && <p className="text-xs text-negative">{error}</p>}
          {success && <p className="text-xs text-positive">친구 요청을 보냈어요</p>}

          <button
            type="submit"
            disabled={isSending || success}
            className="btn-primary w-full"
          >
            {isSending ? <Loader2 size={16} strokeWidth={1.5} className="animate-spin" /> : <UserPlus size={16} strokeWidth={1.5} />}
            {isSending ? '보내는 중…' : '친구 요청 보내기'}
          </button>
        </form>
      </div>
    </div>
  );
}
