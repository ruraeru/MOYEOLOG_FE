'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Search, UserPlus, Check } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { friendApi, type FriendResponse } from '@/lib/friend-api';
import { groupApi } from '@/lib/group-api';
import ImageWithFallback from './ImageWithFallback';

interface GroupInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
  onSuccess?: () => void;
}

export default function GroupInviteModal({
  isOpen,
  onClose,
  groupId,
  groupName,
  onSuccess,
}: GroupInviteModalProps) {
  const { data: session } = useSession();
  const [friends, setFriends] = useState<FriendResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  const fetchFriends = useCallback(async () => {
    try {
      setLoading(true);
      const data = await friendApi.getFriends(session);
      // 수락된 친구만 필터링
      setFriends(data.filter(f => f.status === 'ACCEPTED'));
    } catch (e) {
      console.error('Failed to fetch friends:', e);
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
      onSuccess?.();
      onClose();
      setSelectedUserIds([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : '초대장을 보내지 못했어요');
    } finally {
      setInviting(false);
    }
  };

  const filteredFriends = friends.filter(friend => 
    friend.nickname.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (friend.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-line rounded-2xl w-full max-w-md flex flex-col shadow-float overflow-hidden max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-line flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink">멤버 초대</h2>
            <p className="text-xs text-ink-3">{groupName}</p>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="p-4 border-b border-line">
          <div className="relative">
            <Search size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              type="text"
              placeholder="친구 이름 또는 이메일 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input pl-10"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 min-h-[300px] no-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <Loader2 size={18} strokeWidth={1.5} className="animate-spin text-ink-3" />
              <p className="text-sm text-ink-3">친구 목록을 불러오는 중이에요</p>
            </div>
          ) : filteredFriends.length > 0 ? (
            <div className="space-y-1">
              {filteredFriends.map((friend) => {
                const isSelected = selectedUserIds.includes(friend.userId);
                return (
                  <button
                    key={friend.id}
                    onClick={() => handleToggleSelect(friend.userId)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors duration-150 ease-out ${
                      isSelected ? 'bg-accent-soft' : 'hover:bg-raised'
                    }`}
                  >
                    <div className="size-10 rounded-full relative overflow-hidden shrink-0">
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
                        <div className="w-full h-full flex items-center justify-center bg-raised text-ink-2 text-sm">
                          {friend.nickname.substring(0, 1)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className={`text-sm font-medium truncate ${isSelected ? 'text-accent' : 'text-ink'}`}>
                        {friend.nickname}
                      </p>
                      <p className="text-xs text-ink-3 truncate">{friend.email}</p>
                    </div>
                    <div className={`size-5 rounded-full flex items-center justify-center border transition-colors duration-150 ease-out ${
                      isSelected ? 'bg-accent border-accent text-white' : 'border-line-strong'
                    }`}>
                      {isSelected && <Check size={12} strokeWidth={1.5} />}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <div className="size-10 rounded-full bg-raised flex items-center justify-center mb-3">
                <UserPlus size={18} strokeWidth={1.5} className="text-ink-3" />
              </div>
              <p className="text-sm font-medium text-ink">초대할 수 있는 친구가 없어요</p>
              <p className="text-sm text-ink-3 mt-1">먼저 친구를 추가해 보세요</p>
            </div>
          )}
        </div>

        {error && <p className="px-6 py-2 text-sm text-negative">{error}</p>}

        <div className="px-6 py-4 border-t border-line flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-3">선택한 친구</span>
            <span className="text-xs text-ink-2 tabular-nums">{selectedUserIds.length}명</span>
          </div>
          <button
            type="button"
            onClick={handleInvite}
            disabled={inviting || selectedUserIds.length === 0}
            className="btn-primary w-full"
          >
            {inviting && <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />}
            {inviting ? '초대장 발송 중…' : '초대장 보내기'}
          </button>
        </div>
      </div>
    </div>
  );
}