'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import { Users, Check, Loader2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { groupApi, type GroupInvitationResponse } from '@/lib/group-api';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

import { useAlert } from '@/hooks/useAlert';

export default function NotificationsPage() {
  const { data: session } = useSession();
  const { toast } = useAlert();
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
      toast.success('모임 초대를 수락했어요');
    } catch (error) {
      console.error('Accept error:', error);
      toast.error('초대를 수락하지 못했어요');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await groupApi.rejectInvitation(id, session);
      setInvitations(prev => prev.filter(i => i.id !== id));
      toast.success('모임 초대를 거절했어요');
    } catch (error) {
      console.error('Reject error:', error);
      toast.error('초대를 거절하지 못했어요');
    }
  };

  return (
    <div className="h-screen flex flex-col bg-canvas text-ink overflow-hidden">
      <Navbar />
      
      <main className="flex-1 overflow-y-auto no-scrollbar p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-semibold text-ink">알림</h2>
            {filter === 'all' && (
              <button className="btn-ghost">
                <Check size={16} strokeWidth={1.5} />
                모두 읽음 처리
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex border-b border-line">
            <button 
              onClick={() => setFilter('all')}
              className={`px-4 py-3 text-sm transition-colors relative ${filter === 'all' ? 'text-ink font-medium' : 'text-ink-2 hover:text-ink'}`}
            >
              전체 알림
              {filter === 'all' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-accent" />}
            </button>
            <button 
              onClick={() => setFilter('invitations')}
              className={`px-4 py-3 text-sm transition-colors relative ${filter === 'invitations' ? 'text-ink font-medium' : 'text-ink-2 hover:text-ink'}`}
            >
              모임 초대
              {invitations.length > 0 && (
                <span className="ml-1.5 text-xs text-ink-3 tabular-nums">{invitations.length}</span>
              )}
              {filter === 'invitations' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-accent" />}
            </button>
          </div>

          {/* List Section */}
          <div className="space-y-3">
            {filter === 'invitations' ? (
              loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 size={18} strokeWidth={1.5} className="animate-spin text-ink-3" />
                  <p className="text-sm text-ink-3">초대 목록을 불러오는 중…</p>
                </div>
              ) : invitations.length > 0 ? (
                invitations.map((invite) => (
                  <div 
                    key={invite.id} 
                    className="card px-4 py-4 flex items-start gap-3"
                  >
                    <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-medium text-ink">모임 초대</h4>
                        <span className="stamp">
                          {format(new Date(invite.invitedAt), 'M.d EEE HH:mm', { locale: ko })}
                        </span>
                      </div>
                      <p className="text-sm text-ink-2 leading-relaxed">
                        <span className="font-medium text-ink">{invite.inviterNickname}</span>님이
                        <span className="font-medium text-ink"> &quot;{invite.groupName}&quot;</span> 모임에 초대했어요
                      </p>
                      
                      <div className="flex items-center gap-2 mt-3">
                        <button 
                          onClick={() => handleAccept(invite.id)}
                          className="btn-primary h-9 flex-1"
                        >
                          수락
                        </button>
                        <button 
                          onClick={() => handleReject(invite.id)}
                          className="btn-secondary h-9 flex-1"
                        >
                          거절
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="size-10 rounded-full bg-raised flex items-center justify-center mb-3">
                    <Users size={18} strokeWidth={1.5} className="text-ink-3" />
                  </div>
                  <p className="text-sm font-medium text-ink">받은 초대가 없어요</p>
                  <p className="text-sm text-ink-3 mt-1">모임 초대가 오면 여기에 모여요</p>
                </div>
              )
            ) : (
              // General Notifications (Static Placeholder for now)
              <div className="space-y-3">
                <p className="text-center py-10 text-ink-3 text-sm">일반 알림은 준비 중이에요</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
