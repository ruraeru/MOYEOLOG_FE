'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import { UserPlus, MessageCircle, UserCheck, Clock, Loader2, UserX, Users } from 'lucide-react';
import ImageWithFallback from '@/components/ImageWithFallback';
import { useSession } from 'next-auth/react';
import { friendApi, type FriendResponse } from '@/lib/friend-api';
import FriendSearchModal from '@/components/FriendSearchModal';

export default function FriendsPage() {
  const { data: session } = useSession();
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
    } catch (error) {
      console.error('Failed to accept request:', error);
      alert('요청 수락에 실패했습니다.');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`${name}님을 친구 목록에서 삭제하시겠습니까?`)) return;
    try {
      await friendApi.deleteFriendship(id, session);
      fetchFriendsData();
    } catch (error) {
      console.error('Failed to delete friendship:', error);
      alert('친구 삭제에 실패했습니다.');
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

  return (
    <div className="h-screen flex flex-col bg-[#F8F9FB] text-gray-900 overflow-hidden font-sans">
      <Navbar />
      
      <main className="flex-1 overflow-y-auto no-scrollbar p-8">
        <div className="max-w-5xl mx-auto space-y-10">
          
          {/* Header & Search */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">친구 관리</h2>
              <p className="text-sm text-gray-400 mt-1">친구들과 연결되어 일정을 공유해보세요.</p>
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsSearchModalOpen(true)}
                className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-sm font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center gap-2 shrink-0 active:scale-95"
              >
                <UserPlus className="w-4 h-4" />
                친구 추가하기
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
              <p className="font-bold text-gray-500">친구 목록을 불러오는 중...</p>
            </div>
          ) : (
            <>
              {/* Friend Requests */}
              {friendRequests.length > 0 && (
                <section className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="flex items-center gap-2 text-sm font-black text-gray-500 uppercase tracking-widest">
                    <Clock className="w-4 h-4" />
                    <span>받은 친구 요청</span>
                    <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full shadow-sm">{friendRequests.length}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {friendRequests.map(req => (
                      <div key={req.id} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between group hover:border-indigo-100 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="relative w-12 h-12 rounded-2xl border border-gray-50 shadow-inner bg-gray-50 flex items-center justify-center overflow-hidden">
                            {req.profileImage ? (
                              <ImageWithFallback 
                                src={req.profileImage} 
                                alt={req.nickname} 
                                fill 
                                sizes="48px"
                                className="object-cover" 
                              />
                            ) : (
                              <span className="text-lg font-black text-indigo-300">{req.nickname[0]}</span>
                            )}
                          </div>
                          <div>
                            <h4 className="font-black text-gray-800 text-sm">{req.nickname}</h4>
                            <p className="text-[11px] text-gray-400 font-medium">{req.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleAccept(req.id)}
                            className="px-5 py-2 bg-indigo-600 text-white text-xs font-black rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-50 active:scale-95"
                          >
                            수락
                          </button>
                          <button 
                            onClick={() => handleReject(req.id)}
                            className="px-5 py-2 bg-gray-50 text-gray-500 text-xs font-black rounded-xl hover:bg-gray-100 transition-all active:scale-95"
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
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-black text-gray-500 uppercase tracking-widest">
                    <UserCheck className="w-4 h-4" />
                    <span>내 친구</span>
                    <span className="text-gray-300 font-black">({friends.length})</span>
                  </div>
                </div>
                
                {friends.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {friends.map(friend => (
                      <div key={friend.id} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm hover:border-indigo-100 hover:shadow-xl hover:-translate-y-1 transition-all group flex flex-col items-center text-center relative overflow-hidden">
                        <button 
                          onClick={() => handleDelete(friend.id, friend.nickname)}
                          className="absolute top-5 right-5 p-2 text-gray-200 hover:text-red-400 hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100"
                        >
                          <UserX className="w-4 h-4" />
                        </button>

                        <div className="relative mb-5">
                          <div className="w-24 h-24 rounded-[2rem] border-4 border-white shadow-xl bg-gray-50 flex items-center justify-center group-hover:scale-105 transition-transform duration-500 overflow-hidden">
                            {friend.profileImage ? (
                              <ImageWithFallback 
                                src={friend.profileImage} 
                                alt={friend.nickname} 
                                fill 
                                sizes="96px"
                                containerClassName="w-full h-full"
                                className="object-cover" 
                              />
                            ) : (
                              <span className="text-3xl font-black text-indigo-200">{friend.nickname[0]}</span>
                            )}
                          </div>
                        </div>

                        <h4 className="font-black text-gray-800 text-lg mb-1">{friend.nickname}</h4>
                        <p className="text-[11px] text-gray-400 font-bold mb-6 tracking-tight">{friend.email}</p>

                        <div className="w-full pt-4 border-t border-gray-50">
                          <button className="w-full py-3 bg-indigo-50 text-indigo-600 rounded-2xl text-xs font-black flex items-center justify-center gap-2 hover:bg-indigo-600 hover:text-white transition-all active:scale-95 shadow-sm">
                            <MessageCircle className="w-4 h-4" />
                            메시지 보내기
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[3rem] border border-dashed border-gray-200">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                      <Users className="w-10 h-10 text-gray-200" />
                    </div>
                    <h3 className="text-xl font-black text-gray-800 mb-2">아직 친구가 없습니다</h3>
                    <p className="text-gray-400 text-sm mb-8 font-medium">새로운 친구를 찾아 일정을 함께 나눠보세요!</p>
                    <button 
                      onClick={() => setIsSearchModalOpen(true)}
                      className="px-8 py-3 bg-white border-2 border-indigo-600 text-indigo-600 rounded-2xl font-black text-sm hover:bg-indigo-50 transition-all active:scale-95"
                    >
                      친구 검색하러 가기
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