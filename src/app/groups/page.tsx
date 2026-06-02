'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Plus, Users, Sparkles, LayoutGrid, ArrowLeft, Loader2, MessageSquare, FileText, ChevronRight } from 'lucide-react';
import { useGroupModal } from './GroupModalContext';
import { groupApi, type GroupActivityResponse } from '@/lib/group-api';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import Image from 'next/image';

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
      <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500">
        <header className="px-8 py-8 shrink-0 flex items-center justify-between border-b border-gray-100 bg-white/50 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsBrowsing(false)}
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-600 no-outline"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">둘러보기</h2>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-0.5">Recent Activities Across Groups</p>
            </div>
          </div>
          <button 
            onClick={fetchActivities}
            disabled={loading}
            className="p-2 hover:bg-indigo-50 rounded-xl transition-colors text-indigo-500 disabled:opacity-50 no-outline"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto no-scrollbar p-8">
          <div className="max-w-3xl mx-auto space-y-6">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                <p className="font-bold text-gray-400">활동 내역을 불러오는 중...</p>
              </div>
            ) : activities.length > 0 ? (
              activities.map((activity, idx) => (
                <ActivityCard 
                  key={`${activity.type}-${activity.id}-${idx}`} 
                  activity={activity} 
                  onClick={() => router.push(`/groups/${activity.groupId}`)}
                />
              ))
            ) : (
              <div className="py-32 flex flex-col items-center justify-center text-center bg-white border-2 border-dashed border-gray-100 rounded-[3rem]">
                <Sparkles className="w-16 h-16 text-gray-100 mb-4" />
                <p className="text-gray-500 font-black text-lg">최근 활동이 없습니다</p>
                <p className="text-sm text-gray-400 font-medium mt-1">참여 중인 모임에서 첫 소식을 만들어보세요!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-8 animate-in fade-in zoom-in duration-500">
      <div className="relative">
        <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full scale-150 animate-pulse" />
        <div className="relative w-32 h-32 bg-white rounded-[2.5rem] shadow-2xl flex items-center justify-center text-indigo-600">
          <Users className="w-16 h-16 stroke-[1.5]" />
        </div>
      </div>

      <div className="space-y-3 max-w-sm">
        <h2 className="text-3xl font-black text-gray-900 tracking-tight">모임을 선택해 보세요</h2>
        <p className="text-gray-500 font-medium leading-relaxed">
          왼쪽 사이드바에서 참여 중인 모임을 선택하거나,<br />
          새로운 모임을 만들어 친구들을 초대해 보세요.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 w-full max-w-md">
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
      
      <div className="pt-8 flex items-center gap-2 text-indigo-500 font-bold text-xs uppercase tracking-widest opacity-50">
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
      className="bg-white/50 backdrop-blur-sm border border-gray-100 p-6 rounded-3xl text-left hover:bg-white hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group no-outline"
    >
      <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
        {icon}
      </div>
      <h4 className="font-black text-gray-800 text-sm mb-1">{label}</h4>
      <p className="text-[10px] text-gray-400 font-bold">{description}</p>
    </div>
  );
}

function ActivityCard({ activity, onClick }: { activity: GroupActivityResponse, onClick: () => void }) {
  const isMemo = activity.type === 'MEMO';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  
  return (
    <div 
      onClick={onClick}
      className="bg-white p-6 rounded-[2rem] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group flex gap-5 border border-gray-50/50"
    >
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${isMemo ? 'bg-indigo-50 text-indigo-500' : 'bg-emerald-50 text-emerald-500'}`}>
        {isMemo ? <FileText className="w-7 h-7" /> : <MessageSquare className="w-7 h-7" />}
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${isMemo ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
              {isMemo ? 'Memo' : 'Topic'}
            </span>
            <span className="text-[10px] font-black text-gray-400 flex items-center gap-1">
              <Users className="w-2.5 h-2.5" />
              {activity.groupName}
            </span>
          </div>
          <span className="text-[10px] text-gray-300 font-bold">{format(parseISO(activity.createdAt), 'MM.dd HH:mm')}</span>
        </div>

        <h3 className="font-black text-gray-800 text-base truncate group-hover:text-indigo-600 transition-colors">
          {activity.title}
        </h3>
        
        <p className="text-sm text-gray-400 font-bold line-clamp-1 leading-relaxed">
          {activity.contentSnippet}
        </p>

        <div className="pt-2 flex items-center gap-2 border-t border-gray-50 mt-1">
          <div className="w-5 h-5 rounded-full overflow-hidden relative border border-gray-100 shrink-0">
            {activity.authorProfileImage ? (
              <Image src={activity.authorProfileImage.startsWith('/uploads/') ? `${apiUrl}${activity.authorProfileImage}` : activity.authorProfileImage} alt="" fill className="object-cover" />
            ) : (
              <div className="w-full h-full bg-gray-50 flex items-center justify-center text-[8px] text-gray-400 font-black">{activity.authorNickname[0]}</div>
            )}
          </div>
          <span className="text-[10px] text-gray-400 font-black">{activity.authorNickname}</span>
          <ChevronRight className="w-3 h-3 text-gray-200 ml-auto group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </div>
  );
}
