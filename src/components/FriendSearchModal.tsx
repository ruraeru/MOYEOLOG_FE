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
      setError(err instanceof Error ? err.message : '친구 요청을 보내지 못했습니다.');
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">친구 추가</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSendRequest} className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">사용자 ID로 찾기</label>
            <div className="relative">
              <input
                type="text"
                value={customId}
                onChange={(e) => setCustomId(e.target.value)}
                placeholder="친구의 8자리 ID를 입력하세요"
                className="w-full bg-gray-50 border border-gray-100 rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:border-indigo-400 focus:bg-white transition-all shadow-sm"
                required
                maxLength={8}
              />
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-300" />
            </div>
          </div>

          {error && <p className="text-xs font-medium text-red-500">{error}</p>}
          {success && <p className="text-xs font-medium text-green-500">친구 요청을 성공적으로 보냈습니다!</p>}

          <button
            type="submit"
            disabled={isSending || success}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            {isSending ? '보내는 중…' : '친구 요청 보내기'}
          </button>
        </form>
      </div>
    </div>
  );
}
