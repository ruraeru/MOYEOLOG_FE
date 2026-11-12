'use client';

import React, { useState, useCallback } from 'react';
import { Plus, Users, Inbox, LayoutGrid, ArrowLeft, Loader2, MessageSquare, FileText, ChevronRight, RefreshCw, Calendar } from 'lucide-react';
import { useGroupModal } from './GroupModalContext';
import { groupApi, type GroupActivityResponse } from '@/lib/group-api';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { stripMarkdown } from '@/lib/utils';
import ImageWithFallback from '@/components/ImageWithFallback';

export default function GroupsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { openCreateModal } = useGroupModal();
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [activities, setActivities] = useState<GroupActivityResponse[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchActivities = useCallback(async () => {
    if (!session) return;
    try {
      setLoading(true);
      const data = await groupApi.getActivities(session);
      setActivities(data);
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    } finally {
      setLoading(false);
    }
  }, [session]);

  const handleStartBrowsing = () => {
    setIsBrowsing(true);
    fetchActivities();
  };

  if (isBrowsing) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-canvas">
        <header className="px-8 py-5 shrink-0 flex items-center justify-between border-b border-line bg-surface sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsBrowsing(false)}
              className="btn-ghost size-9 !px-0"
            >
              <ArrowLeft size={18} strokeWidth={1.5} />
            </button>
            <div>
              <h2 className="text-2xl font-semibold text-ink">둘러보기</h2>
              <p className="text-sm text-ink-2">모임별 최근 활동</p>
            </div>
          </div>
          <button 
            onClick={fetchActivities}
            disabled={loading}
            className="btn-ghost size-9 !px-0"
          >
            {loading ? <Loader2 size={18} strokeWidth={1.5} className="animate-spin" /> : <RefreshCw size={18} strokeWidth={1.5} />}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto no-scrollbar p-8">
          <div className="max-w-3xl mx-auto space-y-3">
            {loading ? (
              <div className="py-24 flex flex-col items-center justify-center gap-3">
                <Loader2 size={18} strokeWidth={1.5} className="animate-spin text-ink-3" />
                <p className="text-sm text-ink-3">활동 내역을 불러오는 중이에요</p>
              </div>
            ) : activities.length > 0 ? (
              activities.map((activity, idx) => (
                <ActivityCard 
                  key={`${activity.type}-${activity.id}-${idx}`} 
                  activity={activity} 
                  onClick={() => {
                    if (activity.type === 'MEMO') {
                      router.push(`/memo/${activity.id}`);
                    } else {
                      router.push(`/groups/${activity.groupId}`);
                    }
                  }}
                />
              ))
            ) : (
              <div className="py-24 flex flex-col items-center justify-center text-center">
                <div className="size-10 rounded-full bg-raised flex items-center justify-center mb-3">
                  <Inbox size={18} strokeWidth={1.5} className="text-ink-3" />
                </div>
                <p className="text-sm font-medium text-ink">최근 활동이 없어요</p>
                <p className="text-sm text-ink-3 mt-1">참여 중인 모임에서 소식이 생기면 여기에 모여요</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-8 bg-canvas">
      <div className="size-16 bg-raised rounded-2xl flex items-center justify-center text-ink-3">
        <Users size={18} strokeWidth={1.5} />
      </div>

      <div className="space-y-2 max-w-sm">
        <h2 className="text-2xl font-semibold text-ink">모임을 선택해 주세요</h2>
        <p className="text-sm text-ink-2 leading-relaxed">
          사이드바에서 모임을 고르거나,<br />
          새 모임을 만들어 친구들을 초대해 보세요.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 w-full max-w-lg">
        <LandingCard 
          icon={<Plus size={18} strokeWidth={1.5} />} 
          label="새 모임 만들기" 
          description="우리만의 공간 만들기"
          onClick={openCreateModal}
        />
        <LandingCard 
          icon={<LayoutGrid size={18} strokeWidth={1.5} />} 
          label="둘러보기" 
          description="최근 활동 보기"
          onClick={handleStartBrowsing}
        />
      </div>
    </div>
  );
}

function LandingCard({ icon, label, description, onClick }: { icon: React.ReactNode, label: string, description: string, onClick?: () => void }) {
  return (
    <div 
      onClick={onClick}
      className="card p-5 text-left hover:bg-raised transition-colors duration-150 ease-out cursor-pointer active:scale-[0.98]"
    >
      <div className="text-ink-3 mb-4">
        {icon}
      </div>
      <h4 className="font-medium text-ink text-sm mb-1">{label}</h4>
      <p className="text-xs text-ink-3">{description}</p>
    </div>
  );
}

function ActivityCard({ activity, onClick }: { activity: GroupActivityResponse, onClick: () => void }) {
  const { data: session } = useSession();
  
  const userName = session?.user?.name || activity.authorNickname;
  const userImage = session?.user?.image;

  const typeConfig = {
    MEMO: { label: '메모', icon: <FileText size={16} strokeWidth={1.5} /> },
    TOPIC: { label: '토픽', icon: <MessageSquare size={16} strokeWidth={1.5} /> },
    SCHEDULE: { label: '일정', icon: <Calendar size={16} strokeWidth={1.5} /> },
    COMMENT: { label: '댓글', icon: <MessageSquare size={16} strokeWidth={1.5} /> },
  };

  const config = typeConfig[activity.type] || typeConfig.MEMO;

  return (
    <div 
      onClick={onClick}
      className="card p-5 transition-colors duration-150 ease-out cursor-pointer group flex flex-col gap-2 hover:bg-raised"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-ink-3">{config.icon}</span>
          <span className="text-xs text-ink-2">{config.label}</span>
          <span className="rounded-md bg-raised px-2 py-0.5 text-xs text-ink-2 flex items-center gap-1">
            <Users size={12} strokeWidth={1.5} />
            {activity.groupName}
          </span>
        </div>
        <span className="stamp">{format(parseISO(activity.createdAt), 'M.d EEE HH:mm', { locale: ko })}</span>
      </div>

      <h3 className="font-medium text-ink text-base truncate">
        {activity.title}
      </h3>
      
      <p className="text-sm text-ink-2 line-clamp-1">
        {stripMarkdown(activity.contentSnippet)}
      </p>
      <div className="pt-3 flex items-center gap-2 border-t border-line mt-1">
        <div className="size-6 rounded-full relative shrink-0 overflow-hidden">
          {userImage ? (
            <ImageWithFallback 
              src={userImage} 
              alt={userName} 
              fill 
              containerClassName="w-full h-full"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="w-full h-full bg-raised flex items-center justify-center text-xs text-ink-2">{userName[0]}</div>
          )}
        </div>
        <span className="text-xs text-ink-2">{userName}</span>
        <ChevronRight size={16} strokeWidth={1.5} className="text-ink-3 ml-auto" />
      </div>
    </div>
  );
}
