'use client';

import React from 'react';
import Navbar from '@/components/Navbar';
import { Plus, ChevronRight } from 'lucide-react';

const groups = [
  {
    id: 1,
    name: '대학 동기들',
    description: '같은 과 친구들과 정기적으로 모임',
    initial: '대',
    color: 'blue',
    members: ['지', '수', '태'],
    memberCount: 5,
    borderColor: 'border-blue-100',
    iconBg: 'bg-blue-500',
    memberBg: 'bg-blue-50',
    memberText: 'text-blue-500'
  },
  {
    id: 2,
    name: '헬스 크루',
    description: '매주 운동하는 모임',
    initial: '헬',
    color: 'emerald',
    members: ['현', '서'],
    memberCount: 3,
    borderColor: 'border-emerald-100',
    iconBg: 'bg-emerald-500',
    memberBg: 'bg-emerald-50',
    memberText: 'text-emerald-500'
  },
  {
    id: 3,
    name: '독서 모임',
    description: '한 달에 한 권씩 책 읽고 토론',
    initial: '독',
    color: 'orange',
    members: ['예', '도', '하'],
    memberCount: 4,
    borderColor: 'border-orange-100',
    iconBg: 'bg-orange-500',
    memberBg: 'bg-orange-50',
    memberText: 'text-orange-500'
  }
];

export default function GroupsPage() {
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
            <div className="flex flex-col items-center justify-center py-10 px-6 bg-white rounded-3xl border border-dashed border-gray-200 w-full max-w-2xl shadow-sm hover:shadow-md transition-all group cursor-pointer">
              <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Plus className="w-8 h-8 text-indigo-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">새로운 모임 만들기</h3>
              <p className="text-sm text-gray-400 mb-6 text-center">친구들을 초대하고 함께 일정을 관리해보세요.</p>
              <button className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all">
                모임 생성하기
              </button>
            </div>
          </div>

          {/* Groups Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map((group) => (
              <GroupCard key={group.id} {...group} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

interface GroupCardProps {
  name: string;
  description: string;
  initial: string;
  iconBg: string;
  borderColor: string;
  members: string[];
  memberCount: number;
  memberBg: string;
  memberText: string;
}

function GroupCard({ name, description, initial, iconBg, borderColor, members, memberCount, memberBg, memberText }: GroupCardProps) {
  return (
    <div className={`bg-white rounded-2xl border ${borderColor} p-6 shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden`}>
      <div className="flex flex-col gap-4">
        {/* Group Icon/Initial */}
        <div className={`w-12 h-12 ${iconBg} rounded-xl flex items-center justify-center text-white text-xl font-black shadow-sm group-hover:scale-110 transition-transform`}>
          {initial}
        </div>

        {/* Group Info */}
        <div className="space-y-1">
          <h3 className="font-bold text-gray-800 text-lg flex items-center justify-between">
            {name}
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:translate-x-1 transition-transform" />
          </h3>
          <p className="text-xs text-gray-400 leading-relaxed font-medium">
            {description}
          </p>
        </div>

        {/* Members List */}
        <div className="flex items-center gap-3 pt-2">
          <div className="flex -space-x-2">
            {members.map((m: string, i: number) => (
              <div 
                key={i} 
                className={`w-7 h-7 rounded-full ${memberBg} ${memberText} border-2 border-white flex items-center justify-center text-[10px] font-bold`}
              >
                {m}
              </div>
            ))}
          </div>
          <span className="text-xs text-gray-400 font-bold">{memberCount}명</span>
        </div>
      </div>
      
      {/* Subtle background decoration */}
      <div className={`absolute -right-4 -bottom-4 w-24 h-24 ${iconBg} opacity-[0.03] rounded-full`} />
    </div>
  );
}
