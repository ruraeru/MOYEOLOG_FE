'use client';

import React, { useEffect, useState } from 'react';
import { Check, Loader2, Search, RefreshCw } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { friendApi, type FriendResponse } from '@/lib/friend-api';
import { memoApi, type MemoSharedUser } from '@/lib/memo-api';
import { getApiErrorMessage } from '@/lib/axios';
import ImageWithFallback from './ImageWithFallback';
import { useAlert } from '@/hooks/useAlert';
import { initialOf } from '@/lib/utils';
import { Modal } from './ui';

interface MemoShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  memoId: string;
  memoTitle: string;
  /** 이미 공유한 사람 (MemoResponse.sharedWith) */
  sharedWith?: MemoSharedUser[];
  /** 공유·공유 해제 뒤 메모를 다시 불러오게 알린다 */
  onChanged?: () => void;
}

export default function MemoShareModal({ isOpen, onClose, memoId, memoTitle, sharedWith = [], onChanged }: MemoShareModalProps) {
  const { data: session } = useSession();
  const { toast } = useAlert();
  const [friends, setFriends] = useState<FriendResponse[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [unsharingId, setUnsharingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  useEffect(() => {
    if (isOpen && session) {
      setLoading(true);
      setLoadError(null);
      setSelectedFriendIds([]);
      friendApi.getFriends(session)
        .then(setFriends)
        .catch((e) => {
          console.error(e);
          setLoadError(getApiErrorMessage(e));
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, session, reloadKey]);

  const sharedIds = new Set(sharedWith.map(u => u.id));

  const handleUnshare = async (user: MemoSharedUser) => {
    setUnsharingId(user.id);
    try {
      await memoApi.unshare(memoId, user.id, session);
      toast.success(`${user.nickname}님과 공유를 그만뒀어요`);
      onChanged?.();
    } catch (error) {
      console.error('Failed to unshare memo:', error);
      toast.error(getApiErrorMessage(error, '공유를 해제하지 못했어요'));
      onChanged?.();
    } finally {
      setUnsharingId(null);
    }
  };

  const toggleFriend = (id: string) => {
    setSelectedFriendIds(prev => 
      prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id]
    );
  };

  const handleShare = async () => {
    if (selectedFriendIds.length === 0) return;
    
    setIsSharing(true);
    try {
      await memoApi.share(memoId, selectedFriendIds, session);
      toast.success('메모를 공유했어요');
      setSelectedFriendIds([]);
      onChanged?.();
      onClose();
    } catch (error) {
      console.error('Failed to share memo:', error);
      toast.error(getApiErrorMessage(error, '공유하지 못했어요'));
    } finally {
      setIsSharing(false);
    }
  };

  const q = searchQuery.trim().toLowerCase();
  // 이미 공유한 친구는 위 '공유 중' 목록에서 관리하고, 아래에는 아직 공유하지 않은 친구만 보여 준다.
  const filteredFriends = friends.filter(f =>
    !sharedIds.has(f.userId) && (
      !q ||
      f.nickname.toLowerCase().includes(q) ||
      (f.customId || '').toLowerCase().includes(q) ||
      (f.email || '').toLowerCase().includes(q)
    )
  );

  const avatar = (name: string, image: string | null | undefined, size: string, text: string) => (
    <div className={`relative ${size} rounded-full overflow-hidden bg-raised shrink-0`}>
      {image ? (
        <ImageWithFallback
          src={String(image).startsWith('/uploads/') ? `${apiUrl}${image}` : image}
          alt={name}
          fill
          containerClassName="w-full h-full"
          className="object-cover"
          unoptimized
        />
      ) : (
        <div className={`w-full h-full bg-raised flex items-center justify-center text-ink-2 font-medium ${text}`}>
          {initialOf(name)}
        </div>
      )}
    </div>
  );

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="sm"
      title="메모 공유"
      subtitle={<span className="line-clamp-1">{memoTitle}</span>}
      bodyClassName="px-3! py-3! md:px-3!"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">
            취소
          </button>
          <button
            onClick={handleShare}
            disabled={isSharing || selectedFriendIds.length === 0}
            className="btn-primary"
          >
            {isSharing && <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />}
            {isSharing ? '공유 중…' : `${selectedFriendIds.length}명과 공유`}
          </button>
        </>
      }
    >
      <div className="relative px-2 pb-3">
        <Search size={16} strokeWidth={1.5} className="pointer-events-none absolute left-5 top-[18px] -translate-y-1/2 text-ink-3" />
        <input
          type="text"
          placeholder="친구 검색"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="form-input h-9 pl-9"
        />
      </div>

      {sharedWith.length > 0 && (
        <div className="mb-2">
          <p className="px-2 pb-1 pt-2 text-xs font-medium text-ink-3">
            공유 중 <span className="stamp">{sharedWith.length}</span>
          </p>
          <ul>
            {sharedWith.map(user => (
              <li key={user.id} className="flex h-14 items-center justify-between gap-3 px-2">
                <div className="flex items-center gap-3 min-w-0">
                  {avatar(user.nickname, user.profileImage, 'size-8', 'text-xs')}
                  <p className="font-display text-[15px] text-ink truncate">{user.nickname}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleUnshare(user)}
                  disabled={unsharingId === user.id}
                  className="btn-secondary btn-sm shrink-0"
                >
                  {unsharingId === user.id && <Loader2 size={12} strokeWidth={1.5} className="animate-spin" />}
                  공유 해제
                </button>
              </li>
            ))}
          </ul>
          <p className="px-2 pb-1 pt-4 text-xs font-medium text-ink-3">다른 친구에게 공유</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10">
          <Loader2 size={16} strokeWidth={1.5} className="animate-spin text-ink-3" />
          <p className="text-sm text-ink-3">친구 목록을 불러오고 있어요</p>
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <p className="font-display text-lg text-ink">친구 목록을 불러오지 못했어요</p>
          <p className="text-sm text-ink-3">{loadError}</p>
          <button type="button" onClick={() => setReloadKey(k => k + 1)} className="btn-secondary mt-3">
            <RefreshCw size={16} strokeWidth={1.5} />
            다시 시도
          </button>
        </div>
      ) : filteredFriends.length > 0 ? (
        <ul>
          {filteredFriends.map(friend => {
            const selected = selectedFriendIds.includes(friend.userId);
            return (
              <li
                key={friend.userId}
                onClick={() => toggleFriend(friend.userId)}
                className={`flex h-14 items-center justify-between gap-3 px-2 rounded-[10px] cursor-pointer transition-colors duration-150 ease-out ${selected ? 'bg-accent-soft' : 'hover:bg-raised'}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {avatar(friend.nickname, friend.profileImage, 'size-10', 'text-sm')}
                  <div className="min-w-0">
                    <p className={`font-display text-[15px] truncate ${selected ? 'text-accent' : 'text-ink'}`}>{friend.nickname}</p>
                    <p className="text-xs text-ink-3 truncate">{friend.email || (friend.customId ? `@${friend.customId}` : '')}</p>
                  </div>
                </div>
                <div className={`size-5 shrink-0 rounded-full border flex items-center justify-center transition-colors duration-150 ease-out ${selected ? 'bg-accent border-accent text-white' : 'border-line-strong bg-surface'}`}>
                  {selected && <Check size={12} strokeWidth={2} />}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="py-10 text-center text-sm text-ink-3">
          {q ? '검색 결과가 없어요' : friends.length === 0 ? '아직 친구가 없어요' : '모든 친구와 공유하고 있어요'}
        </p>
      )}
    </Modal>
  );
}
