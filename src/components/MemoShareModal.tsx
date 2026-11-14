'use client';

import React, { useEffect, useState } from 'react';
import { X, Users, Check, Loader2, Search } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { friendApi, type FriendResponse } from '@/lib/friend-api';
import { memoApi } from '@/lib/memo-api';
import ImageWithFallback from './ImageWithFallback';
import { useAlert } from '@/hooks/useAlert';

interface MemoShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  memoId: string;
  memoTitle: string;
}

export default function MemoShareModal({ isOpen, onClose, memoId, memoTitle }: MemoShareModalProps) {
  const { data: session } = useSession();
  const { toast } = useAlert();
  const [friends, setFriends] = useState<FriendResponse[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  useEffect(() => {
    if (isOpen && session) {
      setLoading(true);
      friendApi.getFriends(session)
        .then(setFriends)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [isOpen, session]);

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
      onClose();
    } catch (error) {
      console.error('Failed to share memo:', error);
      toast.error('공유하지 못했어요');
    } finally {
      setIsSharing(false);
    }
  };

  const filteredFriends = friends.filter(f => 
    f.nickname.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (f.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
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
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Loader2 size={18} strokeWidth={1.5} className="animate-spin text-ink-3" />
              <p className="text-sm text-ink-3">친구 목록을 불러오고 있어요</p>
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
                          {friend.nickname.substring(0, 1)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{friend.nickname}</p>
                      <p className="text-xs text-ink-3 truncate">{friend.email}</p>
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
              <p className="text-sm text-ink-3">검색 결과가 없어요</p>
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