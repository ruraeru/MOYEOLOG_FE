'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Search, Check, Link as LinkIcon } from 'lucide-react';
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
  /** 초대할 친구가 없을 때 '초대 링크 복사' 를 보여 준다 */
  inviteCode?: string;
  onSuccess?: () => void;
}

export default function GroupInviteModal({
  isOpen,
  onClose,
  groupId,
  groupName,
  memberIds,
  inviteCode,
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
  const [linkCopied, setLinkCopied] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // 마우스 기기에서는 열리자마자 검색칸에 쓸 수 있게 한다(터치 기기는 키보드가 화면을 가리므로 그대로)
  useEffect(() => {
    if (!isOpen) return;
    if (typeof window === 'undefined' || !window.matchMedia('(pointer: fine)').matches) return;
    const t = setTimeout(() => searchRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [isOpen]);

  const handleCopyLink = async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/invite/group?code=${inviteCode}`);
      setLinkCopied(true);
      toast.success('초대 링크를 복사했어요');
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      toast.error(`복사하지 못했어요. 초대 코드는 ${inviteCode} 이에요`);
    }
  };

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
      const result = await groupApi.inviteMembers(groupId, selectedUserIds, session);
      // 이미 대기 중인 초대는 서버가 건너뛴다. 실제로 보낸 수만 말한다
      const sent = result ? result.invitedCount : selectedUserIds.length;
      const skipped = result ? result.alreadyInvitedCount + result.alreadyMemberCount : 0;
      if (sent > 0 && skipped > 0) {
        toast.success(`${sent}명에게 초대를 보냈어요. ${skipped}명은 이미 초대했거나 멤버예요`);
      } else if (sent > 0) {
        toast.success(`${sent}명에게 초대를 보냈어요`);
      } else {
        toast.info('이미 초대한 친구예요. 응답을 기다리고 있어요');
      }
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
    .sort((a, b) => a.nickname.localeCompare(b.nickname, 'ko'))
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
          <button type="button" onClick={onClose} className="btn-secondary max-md:h-11">취소</button>
          <button
            type="button"
            onClick={handleInvite}
            disabled={inviting || selectedUserIds.length === 0}
            className="btn-primary max-md:h-11"
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
            ref={searchRef}
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
            description={query ? '다른 이름으로 찾아보세요' : '친구만 초대할 수 있고, 이미 모임에 있는 친구는 빠져 있어요. 친구가 아닌 사람에게는 초대 링크를 보내 주세요'}
            action={!query && inviteCode ? (
              <button type="button" onClick={handleCopyLink} className="btn-secondary">
                {linkCopied ? <Check size={16} strokeWidth={1.5} /> : <LinkIcon size={16} strokeWidth={1.5} />}
                {linkCopied ? '복사했어요' : '초대 링크 복사'}
              </button>
            ) : undefined}
          />
        )}
      </div>

      {error && <p role="alert" className="mx-5 mb-3 rounded-[10px] bg-negative-soft px-3 py-2 text-sm text-negative md:mx-6">{error}</p>}
    </Modal>
  );
}
