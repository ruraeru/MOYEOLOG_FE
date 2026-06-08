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
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

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

  const handleToggleSelect = (email: string) => {
    setSelectedEmails(prev => 
      prev.includes(email) 
        ? prev.filter(e => e !== email) 
        : [...prev, email]
    );
  };

  const handleInvite = async () => {
    if (selectedEmails.length === 0) return;

    try {
      setInviting(true);
      setError(null);
      await groupApi.inviteMembers(groupId, selectedEmails, session);
      onSuccess?.();
      onClose();
      setSelectedEmails([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : '초대 발송에 실패했습니다.');
    } finally {
      setInviting(false);
    }
  };

  const filteredFriends = friends.filter(friend => 
    friend.nickname.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-md flex flex-col shadow-2xl overflow-hidden max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-800">멤버 초대하기</h2>
            <p className="text-xs text-gray-400 font-medium">{groupName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="친구 이름 또는 이메일 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 border border-gray-100 rounded-xl pl-10 pr-4 py-2 text-sm outline-none focus:border-indigo-400 focus:bg-white transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 min-h-[300px] no-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <p className="text-sm text-gray-400 font-bold">친구 목록을 불러오는 중...</p>
            </div>
          ) : filteredFriends.length > 0 ? (
            <div className="space-y-1">
              {filteredFriends.map((friend) => {
                const isSelected = selectedEmails.includes(friend.email);
                return (
                  <button
                    key={friend.id}
                    onClick={() => handleToggleSelect(friend.email)}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${
                      isSelected ? 'bg-indigo-50 border-indigo-100' : 'hover:bg-gray-50 border-transparent'
                    } border`}
                  >
                    <div className="w-10 h-10 rounded-full relative overflow-hidden shrink-0 border border-gray-100">
                      {friend.profileImage ? (
                        <ImageWithFallback src={friend.profileImage} alt={friend.nickname} fill className="object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-indigo-100 text-indigo-600 font-bold text-sm">
                          {friend.nickname.substring(0, 1)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className={`text-sm font-bold truncate ${isSelected ? 'text-indigo-600' : 'text-gray-800'}`}>
                        {friend.nickname}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{friend.email}</p>
                    </div>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all ${
                      isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-200'
                    }`}>
                      {isSelected && <Check className="w-4 h-4" />}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <UserPlus className="w-12 h-12 text-gray-100 mb-4" />
              <p className="text-gray-400 font-bold text-sm">초대할 수 있는 친구가 없습니다.</p>
              <p className="text-xs text-gray-400 mt-1 font-medium">먼저 친구를 추가해보세요!</p>
            </div>
          )}
        </div>

        {error && <p className="px-6 py-2 text-xs font-medium text-red-500">{error}</p>}

        <div className="p-6 bg-gray-50/50 flex flex-col gap-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-gray-400">선택된 친구</span>
            <span className="text-xs font-bold text-indigo-600">{selectedEmails.length}명</span>
          </div>
          <button
            type="button"
            onClick={handleInvite}
            disabled={inviting || selectedEmails.length === 0}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
          >
            {inviting && <Loader2 className="w-4 h-4 animate-spin" />}
            {inviting ? '초대장 발송 중…' : '초대장 보내기'}
          </button>
        </div>
      </div>
    </div>
  );
}