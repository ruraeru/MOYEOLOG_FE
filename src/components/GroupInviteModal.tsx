'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Search, Check } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { friendApi, type FriendResponse } from '@/lib/friend-api';
import { groupApi } from '@/lib/group-api';
import ImageWithFallback from './ImageWithFallback';
import { getApiErrorMessage } from '@/lib/axios';
import { useAlert } from '@/hooks/useAlert';
import { initialOf } from '@/lib/utils';
import { Modal, EmptyState } from './ui';

interface GroupInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
  /** 이미 모임에 있는 사람 (목록에서 뺀다) */
  memberIds?: string[];
  onSuccess?: () => void;
}

export default function GroupInviteModal({
  isOpen,
  onClose,
  groupId,
  groupName,
  memberIds,
  onSuccess,
}: GroupInviteModalProps) {
  const { data: session } = useSession();
  const { toast } = useAlert();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [friends, setFriends] = useState<FriendResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  const fetchFriends = useCallback(async () => {
    try {
      const data = await friendApi.getFriends(session);
      setLoadError(null);
      // 수락된 친구만 필터링
      setFriends(data.filter(f => f.status === 'ACCEPTED'));
    } catch (e) {
      console.error('Failed to fetch friends:', e);
      setLoadError(getApiErrorMessage(e, '친구 목록을 불러오지 못했어요'));
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (isOpen && session) {
      fetchFriends();
    }
  }, [isOpen, session, fetchFriends]);

  const handleToggleSelect = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId) 
        : [...prev, userId]
    );
  };

  const handleInvite = async () => {
    if (selectedUserIds.length === 0) return;

    try {
      setInviting(true);
      setError(null);
      await groupApi.inviteMembers(groupId, selectedUserIds, session);
      toast.success(`${selectedUserIds.length}명에게 초대를 보냈어요`);
      onSuccess?.();
      onClose();
      setSelectedUserIds([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : '초대장을 보내지 못했어요');
    } finally {
      setInviting(false);
    }
  };

  const query = searchQuery.trim().toLowerCase();
  const filteredFriends = friends
    .filter(friend => !memberIds?.includes(friend.userId))
    .filter(friend =>
      !query ||
      friend.nickname.toLowerCase().includes(query) ||
      (friend.customId || '').toLowerCase().includes(query)
    );

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="친구 초대"
      subtitle={groupName}
      size="sm"
      bodyClassName="!px-0 !py-0 flex flex-col"
      footer={
        <>
          <span className="mr-auto text-[13px] text-ink-3">
            선택 <span className="tabular-nums text-ink-2">{selectedUserIds.length}명</span>
          </span>
          <button type="button" onClick={onClose} className="btn-secondary">취소</button>
          <button
            type="button"
            onClick={handleInvite}
            disabled={inviting || selectedUserIds.length === 0}
            className="btn-primary"
          >
            {inviting && <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />}
            {inviting ? '보내는 중' : '초대 보내기'}
          </button>
        </>
      }
    >
      <div className="shrink-0 px-5 pt-4 pb-2 md:px-6">
        <div className="relative">
          <Search size={16} strokeWidth={1.5} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            type="text"
            placeholder="이름이나 아이디로 찾기"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-input h-9 py-0 pl-9"
          />
        </div>
      </div>

      <div className="min-h-[280px] flex-1 px-3 pb-3 md:px-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16">
            <Loader2 size={16} strokeWidth={1.5} className="animate-spin text-ink-3" />
            <p className="text-sm text-ink-3">친구 목록을 불러오는 중이에요</p>
          </div>
        ) : loadError ? (
          <EmptyState
            title="불러오지 못했어요"
            description={loadError}
            action={
              <button type="button" onClick={() => { setLoading(true); setLoadError(null); fetchFriends(); }} className="btn-secondary">
                다시 시도
              </button>
            }
          />
        ) : filteredFriends.length > 0 ? (
          <ul>
            {filteredFriends.map((friend) => {
              const isSelected = selectedUserIds.includes(friend.userId);
              return (
                <li key={friend.id}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => handleToggleSelect(friend.userId)}
                    className={`flex h-14 w-full items-center gap-3 rounded-[10px] px-2 transition-colors ${
                      isSelected ? 'bg-accent-soft' : 'hover:bg-raised'
                    }`}
                  >
                    <div className="relative size-9 shrink-0 overflow-hidden rounded-full">
                      {friend.profileImage ? (
                        <ImageWithFallback
                          src={friend.profileImage.startsWith('/uploads/') ? `${apiUrl}${friend.profileImage}` : friend.profileImage}
                          alt={friend.nickname}
                          fill
                          containerClassName="w-full h-full"
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-raised text-[13px] text-ink-2">
                          {initialOf(friend.nickname)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <p className={`truncate font-display text-[15px] ${isSelected ? 'text-accent' : 'text-ink'}`}>
                        {friend.nickname}
                      </p>
                      {friend.customId && <p className="truncate text-xs text-ink-3">@{friend.customId}</p>}
                    </div>
                    <span
                      aria-hidden
                      className={`flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                        isSelected ? 'border-accent bg-accent text-white' : 'border-line-strong bg-surface'
                      }`}
                    >
                      {isSelected && <Check size={12} strokeWidth={2} />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            title={query ? '찾는 친구가 없어요' : '초대할 친구가 없어요'}
            description={query ? '다른 이름으로 찾아보세요' : '친구만 초대할 수 있고, 이미 모임에 있는 친구는 빠져 있어요'}
          />
        )}
      </div>

      {error && <p role="alert" className="mx-5 mb-3 rounded-[10px] bg-negative-soft px-3 py-2 text-sm text-negative md:mx-6">{error}</p>}
    </Modal>
  );
}
