'use client';

import React from 'react';
import { Plus, Users, Sparkles, LayoutGrid } from 'lucide-react';

export default function GroupsPage() {
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
        />
        <LandingCard 
          icon={<LayoutGrid className="w-5 h-5" />} 
          label="둘러보기" 
          description="최근 활동 확인"
        />
      </div>
      
      <div className="pt-8 flex items-center gap-2 text-indigo-500 font-bold text-xs uppercase tracking-widest opacity-50">
        <Sparkles className="w-3 h-3" />
        <span>moyeolog spaces</span>
      </div>
    </div>
  );
}

function LandingCard({ icon, label, description }: { icon: React.ReactNode, label: string, description: string }) {
  return (
    <div className="bg-white/50 backdrop-blur-sm border border-gray-100 p-6 rounded-3xl text-left hover:bg-white hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group">
      <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
        {icon}
      </div>
      <h4 className="font-black text-gray-800 text-sm mb-1">{label}</h4>
      <p className="text-[10px] text-gray-400 font-bold">{description}</p>
    </div>
  );
}
