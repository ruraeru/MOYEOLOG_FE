'use client';

import React, { useEffect, useState } from 'react';
import { X, Users, Check, Loader2, Search, RefreshCw } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { friendApi, type FriendResponse } from '@/lib/friend-api';
import { memoApi, type MemoSharedUser } from '@/lib/memo-api';
import { getApiErrorMessage } from '@/lib/axios';
import ImageWithFallback from './ImageWithFallback';
import { useAlert } from '@/hooks/useAlert';
import { initialOf } from '@/lib/utils';

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-surface border border-line rounded-2xl w-full max-w-md shadow-float overflow-hidden flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-line flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-ink">메모 공유</h2>
            <p className="text-sm text-ink-3 mt-0.5 line-clamp-1">{memoTitle}</p>
          </div>
          <button onClick={onClose} className="btn-ghost">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="p-4 border-b border-line shrink-0">
          <div className="relative">
            <input 
              type="text" 
              placeholder="친구 검색" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input w-full pl-10"
            />
            <Search size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 no-scrollbar">
          {sharedWith.length > 0 && (
            <div className="mb-2">
              <p className="text-xs text-ink-3 px-4 pt-2 pb-1">공유 중 {sharedWith.length}명</p>
              <div className="grid grid-cols-1 gap-1">
                {sharedWith.map(user => (
                  <div key={user.id} className="flex items-center justify-between px-4 py-2.5 rounded-[10px]">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative size-8 rounded-full overflow-hidden bg-raised shrink-0">
                        {user.profileImage ? (
                          <ImageWithFallback
                            src={String(user.profileImage).startsWith('/uploads/') ? `${apiUrl}${user.profileImage}` : user.profileImage}
                            alt={user.nickname}
                            fill
                            containerClassName="w-full h-full"
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="w-full h-full bg-accent-soft flex items-center justify-center text-accent font-medium text-xs">
                            {initialOf(user.nickname)}
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-ink truncate">{user.nickname}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnshare(user)}
                      disabled={unsharingId === user.id}
                      className="btn-secondary text-xs shrink-0 flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {unsharingId === user.id && <Loader2 size={12} strokeWidth={1.5} className="animate-spin" />}
                      공유 해제
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-ink-3 px-4 pt-3 pb-1">다른 친구에게 공유</p>
            </div>
          )}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Loader2 size={18} strokeWidth={1.5} className="animate-spin text-ink-3" />
              <p className="text-sm text-ink-3">친구 목록을 불러오고 있어요</p>
            </div>
          ) : loadError ? (
            <div className="py-10 flex flex-col items-center gap-2 text-center">
              <p className="text-sm text-ink">친구 목록을 불러오지 못했어요</p>
              <p className="text-xs text-ink-3">{loadError}</p>
              <button type="button" onClick={() => setReloadKey(k => k + 1)} className="btn-secondary mt-2 flex items-center gap-1.5">
                <RefreshCw size={16} strokeWidth={1.5} />
                다시 시도
              </button>
            </div>
          ) : filteredFriends.length > 0 ? (
            <div className="grid grid-cols-1 gap-1">
              {filteredFriends.map(friend => (
                <div 
                  key={friend.userId} 
                  onClick={() => toggleFriend(friend.userId)}
                  className={`flex items-center justify-between px-4 py-3 rounded-[10px] cursor-pointer transition-colors duration-150 ease-out ${selectedFriendIds.includes(friend.userId) ? 'bg-raised' : 'hover:bg-raised'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative size-10 rounded-full overflow-hidden bg-raised shrink-0">
                      {friend.profileImage ? (
                        <ImageWithFallback 
                          src={String(friend.profileImage).startsWith('/uploads/') ? `${apiUrl}${friend.profileImage}` : friend.profileImage} 
                          alt={friend.nickname} 
                          fill 
                          containerClassName="w-full h-full"
                          className="object-cover" 
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full bg-accent-soft flex items-center justify-center text-accent font-medium text-sm">
                          {initialOf(friend.nickname)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{friend.nickname}</p>
                      <p className="text-xs text-ink-3 truncate">{friend.email || (friend.customId ? `@${friend.customId}` : '')}</p>
                    </div>
                  </div>
                  <div className={`size-5 rounded-full border flex items-center justify-center transition-colors duration-150 ease-out ${selectedFriendIds.includes(friend.userId) ? 'bg-accent border-accent text-white' : 'border-line-strong'}`}>
                    {selectedFriendIds.includes(friend.userId) && <Check size={12} strokeWidth={1.5} />}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center">
              <p className="text-sm text-ink-3">
                {q ? '검색 결과가 없어요' : friends.length === 0 ? '아직 친구가 없어요' : '모든 친구와 공유하고 있어요'}
              </p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-line shrink-0">
          <button
            onClick={handleShare}
            disabled={isSharing || selectedFriendIds.length === 0}
            className="btn-primary w-full disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSharing ? <Loader2 size={16} strokeWidth={1.5} className="animate-spin" /> : <Users size={16} strokeWidth={1.5} />}
            {isSharing ? '공유 중…' : `친구 ${selectedFriendIds.length}명과 공유`}
          </button>
        </div>
      </div>
    </div>
  );
}