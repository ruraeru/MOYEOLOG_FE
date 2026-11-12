'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import { UserPlus, MessageCircle, Loader2, UserX, Users } from 'lucide-react';
import ImageWithFallback from '@/components/ImageWithFallback';
import { useSession } from 'next-auth/react';
import { friendApi, type FriendResponse } from '@/lib/friend-api';
import FriendSearchModal from '@/components/FriendSearchModal';

import { useAlert } from '@/hooks/useAlert';

export default function FriendsPage() {
  const { data: session } = useSession();
  const { confirm, toast } = useAlert();
  const [friends, setFriends] = useState<FriendResponse[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  const fetchFriendsData = useCallback(async () => {
    if (!session) return;
    try {
      setLoading(true);
      const [friendsData, requestsData] = await Promise.all([
        friendApi.getFriends(session),
        friendApi.getRequests(session)
      ]);
      setFriends(friendsData);
      setFriendRequests(requestsData);
    } catch (error) {
      console.error('Failed to fetch friends data:', error);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchFriendsData();
  }, [fetchFriendsData]);

  const handleAccept = async (requestId: string) => {
    try {
      await friendApi.acceptRequest(requestId, session);
      fetchFriendsData();
      toast.success('친구 요청을 수락했어요');
    } catch (error) {
      console.error('Failed to accept request:', error);
      toast.error('요청을 수락하지 못했어요');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!(await confirm(`${name}님을 친구 목록에서 삭제하시겠습니까?`))) return;
    try {
      await friendApi.deleteFriendship(id, session);
      fetchFriendsData();
      toast.success('친구 목록에서 삭제했어요');
    } catch (error) {
      console.error('Failed to delete friendship:', error);
      toast.error('친구를 삭제하지 못했어요');
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await friendApi.deleteFriendship(requestId, session);
      fetchFriendsData();
    } catch (error) {
      console.error('Failed to reject request:', error);
    }
  };

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  return (
    <div className="h-screen flex flex-col bg-canvas text-ink overflow-hidden">
      <Navbar />
      
      <main className="flex-1 overflow-y-auto no-scrollbar p-8">
        <div className="max-w-5xl mx-auto space-y-8">
          
          {/* Header & Search */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl font-semibold text-ink">친구</h2>
              <p className="text-sm text-ink-2 mt-1">친구와 연결하면 메모와 일정을 함께 쓸 수 있어요</p>
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsSearchModalOpen(true)}
                className="btn-primary shrink-0"
              >
                <UserPlus size={16} strokeWidth={1.5} />
                친구 추가
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 size={18} strokeWidth={1.5} className="animate-spin text-ink-3" />
              <p className="text-sm text-ink-3">친구 목록을 불러오는 중…</p>
            </div>
          ) : (
            <>
              {/* Friend Requests */}
              {friendRequests.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-base font-semibold text-ink">받은 친구 요청</h3>
                    <span className="text-xs text-ink-3 tabular-nums">{friendRequests.length}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {friendRequests.map(req => (
                      <div key={req.id} className="card px-4 py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative size-10 shrink-0 rounded-full bg-raised flex items-center justify-center overflow-hidden">
                            {req.profileImage ? (
                              <ImageWithFallback 
                                src={String(req.profileImage).startsWith('/uploads/') ? `${apiUrl}${req.profileImage}` : req.profileImage} 
                                alt={req.nickname} 
                                fill 
                                sizes="40px"
                                containerClassName="w-full h-full"
                                className="object-cover" 
                                unoptimized
                              />
                            ) : (
                              <span className="text-base font-medium text-ink-2">{req.nickname[0]}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-medium text-ink truncate">{req.nickname}</h4>
                            <p className="text-xs text-ink-3 truncate">{req.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleAccept(req.id)}
                            className="btn-primary h-9 px-3"
                          >
                            수락
                          </button>
                          <button 
                            onClick={() => handleReject(req.id)}
                            className="btn-ghost"
                          >
                            거절
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Friends List */}
              <section className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-base font-semibold text-ink">내 친구</h3>
                  <span className="text-xs text-ink-3 tabular-nums">{friends.length}</span>
                </div>
                
                {friends.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {friends.map(friend => (
                      <div key={friend.id} className="card p-5 flex flex-col items-center text-center relative">
                        <button 
                          onClick={() => handleDelete(friend.id, friend.nickname)}
                          className="btn-ghost absolute top-3 right-3 size-9 px-0 hover:text-negative"
                        >
                          <UserX size={16} strokeWidth={1.5} />
                        </button>

                        <div className="relative mb-4">
                          <div className="size-16 rounded-full bg-raised flex items-center justify-center overflow-hidden relative">
                            {friend.profileImage ? (
                              <ImageWithFallback 
                                src={String(friend.profileImage).startsWith('/uploads/') ? `${apiUrl}${friend.profileImage}` : friend.profileImage} 
                                alt={friend.nickname} 
                                fill 
                                sizes="64px"
                                containerClassName="w-full h-full"
                                className="object-cover" 
                                unoptimized
                              />
                            ) : (
                              <span className="text-xl font-medium text-ink-2">{friend.nickname[0]}</span>
                            )}
                          </div>
                        </div>

                        <h4 className="text-base font-medium text-ink mb-0.5 max-w-full truncate">{friend.nickname}</h4>
                        <p className="text-xs text-ink-3 mb-4 max-w-full truncate">{friend.email}</p>

                        <div className="w-full pt-4 border-t border-line">
                          <button className="btn-secondary w-full">
                            <MessageCircle size={16} strokeWidth={1.5} className="text-ink-3" />
                            메시지 보내기
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="card flex flex-col items-center justify-center py-16 text-center">
                    <div className="size-10 rounded-full bg-raised flex items-center justify-center mb-3">
                      <Users size={18} strokeWidth={1.5} className="text-ink-3" />
                    </div>
                    <h3 className="text-sm font-medium text-ink">아직 친구가 없어요</h3>
                    <p className="text-sm text-ink-3 mt-1 mb-5">친구를 찾아 추가하면 일정을 함께 볼 수 있어요</p>
                    <button 
                      onClick={() => setIsSearchModalOpen(true)}
                      className="btn-secondary"
                    >
                      친구 찾기
                    </button>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>

      <FriendSearchModal 
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onSuccess={fetchFriendsData}
      />
    </div>
  );
}