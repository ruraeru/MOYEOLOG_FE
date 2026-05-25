'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import { Bell, Users, Check, Loader2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { groupApi, type GroupInvitationResponse } from '@/lib/group-api';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

export default function NotificationsPage() {
  const { data: session } = useSession();
  const [filter, setFilter] = useState<'all' | 'invitations'>('all');
  const [invitations, setInvitations] = useState<GroupInvitationResponse[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchInvitations = useCallback(async () => {
    if (!session) return;
    try {
      setLoading(true);
      const data = await groupApi.getMyInvitations(session);
      setInvitations(data);
    } catch (error) {
      console.error('Failed to fetch invitations:', error);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  const handleAccept = async (id: string) => {
    try {
      await groupApi.acceptInvitation(id, session);
      setInvitations(prev => prev.filter(i => i.id !== id));
      alert('모임 초대를 수락했습니다!');
    } catch (error) {
      console.error('Accept error:', error);
      alert('수락에 실패했습니다.');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await groupApi.rejectInvitation(id, session);
      setInvitations(prev => prev.filter(i => i.id !== id));
      alert('모임 초대를 거절했습니다.');
    } catch (error) {
      console.error('Reject error:', error);
      alert('거절에 실패했습니다.');
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#F8F9FB] text-gray-900 overflow-hidden font-sans">
      <Navbar />
      
      <main className="flex-1 overflow-y-auto no-scrollbar p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-gray-100">
                <Bell className="w-5 h-5 text-indigo-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">알림</h2>
            </div>
            {filter === 'all' && (
              <button className="text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                모두 읽음으로 표시
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex border-b border-gray-200">
            <button 
              onClick={() => setFilter('all')}
              className={`px-6 py-3 text-sm font-bold transition-all relative ${filter === 'all' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              전체 알림
              {filter === 'all' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-full" />}
            </button>
            <button 
              onClick={() => setFilter('invitations')}
              className={`px-6 py-3 text-sm font-bold transition-all relative ${filter === 'invitations' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              모임 초대
              {invitations.length > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{invitations.length}</span>
              )}
              {filter === 'invitations' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-full" />}
            </button>
          </div>

          {/* List Section */}
          <div className="space-y-3">
            {filter === 'invitations' ? (
              loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                  <p className="text-sm text-gray-400 font-bold">초대 목록을 불러오는 중...</p>
                </div>
              ) : invitations.length > 0 ? (
                invitations.map((invite) => (
                  <div 
                    key={invite.id} 
                    className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm shadow-indigo-50 flex items-start gap-4"
                  >
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                      <Users className="w-6 h-6 text-indigo-500" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-base font-bold text-gray-900">모임 초대</h4>
                        <span className="text-xs text-gray-400 font-medium">
                          {format(new Date(invite.invitedAt), 'MM월 dd일 HH:mm', { locale: ko })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        <span className="font-bold text-indigo-600">{invite.inviterNickname}</span>님이 
                        <span className="font-bold text-gray-800"> &quot;{invite.groupName}&quot;</span> 모임에 초대했습니다.
                      </p>
                      
                      <div className="flex items-center gap-3 mt-4">
                        <button 
                          onClick={() => handleAccept(invite.id)}
                          className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors"
                        >
                          수락하기
                        </button>
                        <button 
                          onClick={() => handleReject(invite.id)}
                          className="flex-1 py-2 bg-gray-50 text-gray-500 rounded-xl text-sm font-bold hover:bg-gray-100 transition-colors"
                        >
                          거절
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Users className="w-12 h-12 text-gray-100 mb-4" />
                  <p className="text-gray-400 font-bold text-sm">받은 초대가 없습니다.</p>
                </div>
              )
            ) : (
              // General Notifications (Static Placeholder for now)
              <div className="space-y-3 opacity-60 grayscale">
                <p className="text-center py-10 text-gray-400 text-sm font-bold">일반 알림 서비스 준비 중입니다.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
