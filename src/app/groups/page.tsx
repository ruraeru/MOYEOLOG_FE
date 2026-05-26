'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import { Plus, ChevronRight, Loader2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { groupApi, type GroupResponse } from '@/lib/group-api';
import GroupCreateModal from '@/components/GroupCreateModal';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function GroupsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [groups, setGroups] = useState<GroupResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchGroups = useCallback(async () => {
    if (!session) return;
    try {
      setLoading(true);
      const data = await groupApi.getAll(session);
      setGroups(data);
    } catch (error) {
      console.error('Failed to fetch groups:', error);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  return (
    <div className="h-screen flex flex-col bg-[#F8F9FB] text-gray-900 overflow-hidden font-sans">
      <Navbar />
      
      <main className="flex-1 overflow-y-auto no-scrollbar p-8 lg:p-12">
        <div className="max-w-7xl mx-auto space-y-12">
          
          {/* Header */}
          <div className="flex flex-col items-center gap-8">
            <div className="w-full flex justify-start">
              <h2 className="text-2xl font-bold text-gray-800">내 모임</h2>
            </div>

            {/* Centered Create Group Button */}
            <div 
              onClick={() => setIsModalOpen(true)}
              className="flex flex-col items-center justify-center py-10 px-6 bg-white rounded-3xl border border-dashed border-gray-200 w-full max-w-2xl shadow-sm hover:shadow-md transition-all group cursor-pointer"
            >
              <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Plus className="w-8 h-8 text-indigo-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">새로운 모임 만들기</h3>
              <p className="text-sm text-gray-400 mb-6 text-center">친구들을 초대하고 함께 일정을 관리해보세요.</p>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsModalOpen(true);
                }}
                className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
              >
                모임 생성하기
              </button>
            </div>
          </div>

          {/* Groups Grid */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <p className="text-sm font-bold text-gray-500">모임 목록을 불러오는 중...</p>
            </div>
          ) : groups.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {groups.map((group) => (
                <div key={group.id} onClick={() => router.push(`/groups/${group.id}`)}>
                  <GroupCard group={group} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 text-gray-400 font-medium">
              아직 참여 중인 모임이 없습니다. 새로운 모임을 만들어보세요!
            </div>
          )}
        </div>
      </main>

      <GroupCreateModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={fetchGroups}
      />
    </div>
  );
}

function GroupCard({ group }: { group: GroupResponse }) {
  const themeClasses = {
    indigo: {
      iconBg: 'bg-indigo-500',
      borderColor: 'border-indigo-100',
      memberBg: 'bg-indigo-50',
      memberText: 'text-indigo-500'
    },
    blue: {
      iconBg: 'bg-blue-500',
      borderColor: 'border-blue-100',
      memberBg: 'bg-blue-50',
      memberText: 'text-blue-500'
    },
    emerald: {
      iconBg: 'bg-emerald-500',
      borderColor: 'border-emerald-100',
      memberBg: 'bg-emerald-50',
      memberText: 'text-emerald-500'
    },
    orange: {
      iconBg: 'bg-orange-500',
      borderColor: 'border-orange-100',
      memberBg: 'bg-orange-50',
      memberText: 'text-orange-500'
    },
    rose: {
      iconBg: 'bg-rose-500',
      borderColor: 'border-rose-100',
      memberBg: 'bg-rose-50',
      memberText: 'text-rose-500'
    },
    amber: {
      iconBg: 'bg-amber-500',
      borderColor: 'border-amber-100',
      memberBg: 'bg-amber-50',
      memberText: 'text-amber-500'
    }
  };

  const theme = themeClasses[group.colorTheme as keyof typeof themeClasses] || themeClasses.indigo;
  const initial = group.name.substring(0, 1);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  const profileSrc = group.profileImage ? (group.profileImage.startsWith('/uploads/') ? `${apiUrl}${group.profileImage}` : group.profileImage) : null;

  return (
    <div className={`bg-white rounded-2xl border ${theme.borderColor} p-6 shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden`}>
      <div className="flex flex-col gap-4">
        {/* Group Icon/Initial or Profile Image */}
        <div className={`w-12 h-12 ${theme.iconBg} rounded-xl flex items-center justify-center text-white text-xl font-black shadow-sm group-hover:scale-110 transition-transform overflow-hidden relative shrink-0`}>
          {profileSrc ? (
            <Image src={profileSrc} alt={group.name} fill className="object-cover" />
          ) : (
            initial
          )}
        </div>

        {/* Group Info */}
        <div className="space-y-1">
          <h3 className="font-bold text-gray-800 text-lg flex items-center justify-between">
            {group.name}
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:translate-x-1 transition-transform" />
          </h3>
          <p className="text-xs text-gray-400 leading-relaxed font-medium">
            {group.description || '설명이 없습니다.'}
          </p>
        </div>

        {/* Members List */}
        <div className="flex items-center gap-3 pt-2">
          <div className="flex -space-x-2">
            {group.members.slice(0, 3).map((member) => (
              <div 
                key={member.id} 
                className={`w-7 h-7 rounded-full ${theme.memberBg} ${theme.memberText} border-2 border-white flex items-center justify-center text-[10px] font-bold overflow-hidden shadow-sm`}
                title={member.nickname}
              >
                {member.profileImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={member.profileImage} alt={member.nickname} className="w-full h-full object-cover" />
                ) : (
                  member.nickname.substring(0, 1)
                )}
              </div>
            ))}
          </div>
          <span className="text-xs text-gray-400 font-bold">{group.memberCount}명</span>
        </div>
      </div>
      
      {/* Subtle background decoration */}
      <div className={`absolute -right-4 -bottom-4 w-24 h-24 ${theme.iconBg} opacity-[0.03] rounded-full`} />
    </div>
  );
}
