'use client';

import React, { useEffect, useState } from 'react';
import { X, Users, Check, Loader2, Search } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { friendApi, type FriendResponse } from '@/lib/friend-api';
import { memoApi } from '@/lib/memo-api';
import ImageWithFallback from './ImageWithFallback';

interface MemoShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  memoId: string;
  memoTitle: string;
}

export default function MemoShareModal({ isOpen, onClose, memoId, memoTitle }: MemoShareModalProps) {
  const { data: session } = useSession();
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
      alert('메모를 공유했습니다!');
      onClose();
    } catch (error) {
      console.error('Failed to share memo:', error);
      alert('공유에 실패했습니다.');
    } finally {
      setIsSharing(false);
    }
  };

  const filteredFriends = friends.filter(f => 
    f.nickname.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-800">메모 공유하기</h2>
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">대상: {memoTitle}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-50 shrink-0">
          <div className="relative">
            <input 
              type="text" 
              placeholder="친구 검색..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 border border-gray-100 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-indigo-400 transition-all shadow-sm"
            />
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-300" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 no-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              <p className="text-xs text-gray-400 font-bold">친구 목록 불러오는 중...</p>
            </div>
          ) : filteredFriends.length > 0 ? (
            <div className="grid grid-cols-1 gap-1">
              {filteredFriends.map(friend => (
                <div 
                  key={friend.userId} 
                  onClick={() => toggleFriend(friend.userId)}
                  className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all ${selectedFriendIds.includes(friend.userId) ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-full overflow-hidden border border-gray-100 bg-gray-50 flex items-center justify-center shrink-0">
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
                        <span className="text-sm font-black text-indigo-200">{friend.nickname[0]}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">{friend.nickname}</p>
                      <p className="text-[10px] text-gray-400 truncate">{friend.email}</p>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedFriendIds.includes(friend.userId) ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-200'}`}>
                    {selectedFriendIds.includes(friend.userId) && <Check className="w-3 h-3" />}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center">
              <p className="text-sm text-gray-400 font-medium">검색 결과가 없습니다.</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50/50 shrink-0">
          <button
            onClick={handleShare}
            disabled={isSharing || selectedFriendIds.length === 0}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl text-sm font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
          >
            {isSharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
            {isSharing ? '공유 중…' : `${selectedFriendIds.length}명의 친구와 공유하기`}
          </button>
        </div>
      </div>
    </div>
  );
}