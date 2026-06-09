'use client';

import React, { useState, useCallback } from 'react';
import { Plus, Users, Sparkles, LayoutGrid, ArrowLeft, Loader2, MessageSquare, FileText, ChevronRight } from 'lucide-react';
import { useGroupModal } from './GroupModalContext';
import { groupApi, type GroupActivityResponse } from '@/lib/group-api';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
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
      <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-700 bg-white">
        <header className="px-10 py-8 shrink-0 flex items-center justify-between border-b border-gray-100 sticky top-0 z-10 bg-white/90 backdrop-blur-md">
          <div className="flex items-center gap-5">
            <button 
              onClick={() => setIsBrowsing(false)}
              className="p-3 hover:bg-gray-50 rounded-2xl transition-all text-gray-400 hover:text-gray-600 active:scale-95"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight px-1">둘러보기</h2>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1 px-1">Recent Activities Across Groups</p>
            </div>
          </div>
          <button 
            onClick={fetchActivities}
            disabled={loading}
            className="p-3 hover:bg-indigo-50 rounded-2xl transition-all text-indigo-400 disabled:opacity-50 active:scale-95"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto no-scrollbar p-10">
          <div className="max-w-3xl mx-auto space-y-6">
            {loading ? (
              <div className="py-24 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-300" />
                <p className="text-sm font-semibold text-gray-400 tracking-tight">활동 내역을 불러오는 중...</p>
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
              <div className="py-32 flex flex-col items-center justify-center text-center border-2 border-dashed border-gray-50 rounded-[3rem]">
                <Sparkles className="w-12 h-12 text-gray-100 mb-6 stroke-[1.5]" />
                <p className="text-gray-500 font-bold text-lg">최근 활동이 없습니다</p>
                <p className="text-sm text-gray-400 font-medium mt-2">참여 중인 모임에서 첫 소식을 만들어보세요!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-10 text-center space-y-10 animate-in fade-in duration-1000 bg-white">
      <div className="relative">
        <div className="absolute inset-0 bg-indigo-50 blur-3xl rounded-full scale-150 animate-pulse" />
        <div className="relative w-32 h-32 bg-white rounded-[2.5rem] border border-indigo-50 flex items-center justify-center text-indigo-400 shadow-sm">
          <Users className="w-14 h-14 stroke-[1.5]" />
        </div>
      </div>

      <div className="space-y-4 max-w-sm">
        <h2 className="text-3xl font-black text-gray-800 tracking-tight">모임을 선택해 보세요</h2>
        <p className="text-gray-400 font-medium leading-relaxed px-4">
          사이드바에서 모임을 선택하거나,<br />
          새로운 모임을 만들어 친구들을 초대해 보세요.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-5 w-full max-w-lg">
        <LandingCard 
          icon={<Plus className="w-5 h-5" />} 
          label="새 모임 만들기" 
          description="우리만의 공간 생성"
          onClick={openCreateModal}
        />
        <LandingCard 
          icon={<LayoutGrid className="w-5 h-5" />} 
          label="둘러보기" 
          description="최근 활동 확인"
          onClick={handleStartBrowsing}
        />
      </div>
      
      <div className="pt-10 flex items-center gap-2 text-indigo-300 font-bold text-[10px] uppercase tracking-[0.2em] opacity-60">
        <Sparkles className="w-3 h-3" />
        <span>moyeolog spaces</span>
      </div>
    </div>
  );
}

function LandingCard({ icon, label, description, onClick }: { icon: React.ReactNode, label: string, description: string, onClick?: () => void }) {
  return (
    <div 
      onClick={onClick}
      className="bg-gray-50 border border-gray-100 p-8 rounded-[2rem] text-left hover:bg-white hover:border-indigo-100 transition-all cursor-pointer group active:scale-95 shadow-sm hover:shadow-md"
    >
      <div className="w-11 h-11 bg-white text-indigo-400 rounded-xl flex items-center justify-center mb-6 group-hover:bg-indigo-400 group-hover:text-white transition-all shadow-sm">
        {icon}
      </div>
      <h4 className="font-black text-gray-800 text-sm mb-1.5">{label}</h4>
      <p className="text-[10px] text-gray-400 font-bold tracking-tight">{description}</p>
    </div>
  );
}

function ActivityCard({ activity, onClick }: { activity: GroupActivityResponse, onClick: () => void }) {
  const { data: session } = useSession();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  
  const userName = session?.user?.name || activity.authorNickname;
  const userImage = session?.user?.image;

  const typeConfig = {
    MEMO: { label: 'Memo', icon: <FileText className="w-6 h-6" />, color: 'bg-indigo-50 text-indigo-400', badge: 'bg-indigo-100 text-indigo-600' },
    TOPIC: { label: 'Topic', icon: <Sparkles className="w-6 h-6" />, color: 'bg-emerald-50 text-emerald-400', badge: 'bg-emerald-100 text-emerald-600' },
    SCHEDULE: { label: 'Schedule', icon: <LayoutGrid className="w-6 h-6" />, color: 'bg-rose-50 text-rose-400', badge: 'bg-rose-100 text-rose-600' },
    COMMENT: { label: 'Comment', icon: <MessageSquare className="w-6 h-6" />, color: 'bg-amber-50 text-amber-400', badge: 'bg-amber-100 text-amber-600' },
  };

  const config = typeConfig[activity.type] || typeConfig.MEMO;

  return (
    <div 
      onClick={onClick}
      className="bg-white p-7 rounded-[2.5rem] border border-gray-100 transition-all duration-300 cursor-pointer group flex gap-6 hover:border-indigo-100 hover:shadow-sm"
    >
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${config.color} shadow-sm group-hover:scale-105 transition-transform duration-500`}>
        {config.icon}
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-md uppercase tracking-[0.1em] ${config.badge}`}>
              {config.label}
            </span>
            <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1.5 bg-gray-50 px-2 py-0.5 rounded-md">
              <Users className="w-3 h-3" />
              {activity.groupName}
            </span>
          </div>
          <span className="text-[10px] text-gray-300 font-bold uppercase tracking-tight">{format(parseISO(activity.createdAt), 'MM.dd HH:mm')}</span>
        </div>

        <h3 className="font-bold text-gray-800 text-base truncate group-hover:text-indigo-500 transition-colors tracking-tight">
          {activity.title}
        </h3>
        
        <p className="text-[13px] text-gray-500 font-medium line-clamp-1 leading-relaxed">
          {stripMarkdown(activity.contentSnippet)}
        </p>
        <div className="pt-3.5 flex items-center gap-2.5 border-t border-gray-50 mt-1">
          <div className="w-6 h-6 rounded-full relative border border-white shadow-sm shrink-0 overflow-hidden">
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
              <div className="w-full h-full bg-gray-100 flex items-center justify-center text-[9px] text-gray-400 font-black">{userName[0]}</div>
            )}
          </div>
          <span className="text-[10px] text-gray-400 font-bold tracking-tight">{userName}</span>
          <ChevronRight className="w-3.5 h-3.5 text-gray-200 ml-auto group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
        </div>
      </div>
    </div>
  );
}