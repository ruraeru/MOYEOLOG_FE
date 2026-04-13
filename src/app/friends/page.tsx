'use client';

import React from 'react';
import Navbar from '@/components/Navbar';
import { Search, UserPlus, MessageCircle, MoreHorizontal, UserCheck, Clock } from 'lucide-react';
import Image from 'next/image';

const friendRequests = [
  { id: 1, name: '김하늘', school: '명지대학교', image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop' },
  { id: 2, name: '이준호', school: '명지대학교', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop' },
];

const friends = [
  { id: 1, name: '박지민', status: '온라인', school: '명지대학교', image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop' },
  { id: 2, name: '최수진', status: '오프라인', school: '명지대학교', image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop' },
  { id: 3, name: '정태현', status: '온라인', school: '명지대학교', image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop' },
  { id: 4, name: '이지원', status: '온라인', school: '명지대학교', image: 'https://images.unsplash.com/photo-1554151228-14d9def656e4?w=100&h=100&fit=crop' },
];

export default function FriendsPage() {
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
              <div className="relative w-64">
                <input 
                  type="text" 
                  placeholder="이름으로 친구 검색..." 
                  className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-indigo-400 transition-all shadow-sm"
                />
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-300" />
              </div>
              <button className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center gap-2 shrink-0">
                <UserPlus className="w-4 h-4" />
                친구 추가
              </button>
            </div>
          </div>

          {/* Friend Requests */}
          {friendRequests.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-500">
                <Clock className="w-4 h-4" />
                <span>받은 친구 요청</span>
                <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{friendRequests.length}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {friendRequests.map(req => (
                  <div key={req.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between group hover:border-indigo-100 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-gray-50">
                        <Image 
                          src={req.image} 
                          alt={req.name} 
                          fill 
                          sizes="48px"
                          className="object-cover" 
                        />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-800 text-sm">{req.name}</h4>
                        <p className="text-[11px] text-gray-400">{req.school}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-all">수락</button>
                      <button className="px-4 py-1.5 bg-gray-50 text-gray-500 text-xs font-bold rounded-lg hover:bg-gray-100 transition-all">거절</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Friends List */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-500">
                <UserCheck className="w-4 h-4" />
                <span>내 친구</span>
                <span className="text-gray-300 font-medium">({friends.length})</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {friends.map(friend => (
                <div key={friend.id} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm hover:border-indigo-100 hover:shadow-md transition-all group flex flex-col items-center text-center relative">
                  <button className="absolute top-4 right-4 p-1 text-gray-300 hover:text-gray-600 transition-colors opacity-0 group-hover:opacity-100">
                    <MoreHorizontal className="w-5 h-5" />
                  </button>

                  <div className="relative mb-4">
                    <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-gray-50 shadow-sm">
                      <Image 
                        src={friend.image} 
                        alt={friend.name} 
                        fill 
                        sizes="80px"
                        className="object-cover" 
                      />
                    </div>
                    <div className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-white ${friend.status === '온라인' ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                  </div>

                  <h4 className="font-bold text-gray-800 mb-1">{friend.name}</h4>
                  <p className="text-[11px] text-gray-400 mb-5">{friend.school}</p>

                  <div className="w-full flex gap-2">
                    <button className="flex-1 py-2 bg-[#F0F2FF] text-[#6366F1] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[#E2E6FF] transition-all">
                      <MessageCircle className="w-3.5 h-3.5" />
                      메시지
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
