'use client';

import React, { useEffect, useState } from 'react';
import { Search, UserPlus, Loader2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { friendApi } from '@/lib/friend-api';
import { Modal } from '@/components/ui';

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

  // 창을 닫으면 입력값·오류를 비워 다음에 열 때 깨끗하게 시작해요.
  useEffect(() => {
    if (isOpen) return;
    setCustomId('');
    setError(null);
    setSuccess(false);
  }, [isOpen]);

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customId.trim()) return;

    setIsSending(true);
    setError(null);
    setSuccess(false);

    try {
      await friendApi.sendRequest(customId.trim(), session);
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

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="친구 추가"
      subtitle="친구의 8자리 아이디로 친구 신청을 보내요. 아이디는 친구 화면의 초대 링크 카드에 있어요"
      size="sm"
    >
      <form onSubmit={handleSendRequest} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="friend-custom-id" className="text-[13px] font-medium text-ink-2">
            사용자 아이디
          </label>
          <div className="relative">
            <input
              id="friend-custom-id"
              type="text"
              value={customId}
              // 복사할 때 딸려 온 공백을 먼저 지운 뒤 8자로 맞춰요(maxLength 는 공백까지 세어 ID 를 잘라 버림).
              onChange={(e) => {
                setCustomId(e.target.value.replace(/\s+/g, '').slice(0, 8));
                setError(null);
              }}
              autoFocus
              placeholder="8자리 아이디"
              className="form-input pl-9"
              required
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <Search size={16} strokeWidth={1.5} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          </div>
          {error && <p className="text-xs text-negative">{error}</p>}
          {success && <p className="text-xs text-positive">친구 요청을 보냈어요</p>}
        </div>

        <button
          type="submit"
          disabled={isSending || success}
          className="btn-primary w-full"
        >
          {isSending ? <Loader2 size={16} strokeWidth={1.5} className="animate-spin" /> : <UserPlus size={16} strokeWidth={1.5} />}
          {isSending ? '보내는 중…' : '친구 요청 보내기'}
        </button>
      </form>
    </Modal>
  );
}
