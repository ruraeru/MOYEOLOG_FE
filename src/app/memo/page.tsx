'use client';

import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import { 
  Search, 
  Plus, 
  Grid, 
  List, 
  ChevronDown,
  Archive,
  User,
  Share2,
  Star,
  Lock,
  Tag as TagIcon,
  Circle
} from 'lucide-react';
import Image from 'next/image';
import MemoDetailModal from '@/components/MemoDetailModal';
import MemoCreateModal from '@/components/MemoCreateModal';

const memos = [
  {
    id: 1,
    title: 'React 훅 정리 노트',
    description: 'useState, useEffect, useContext, useReducer 등 주요 훅들의 사용법과 예제를 정리했습니다. 실무에서 자주 사용하는 패턴들을 중...',
    image: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800&auto=format&fit=crop&q=60',
    tags: ['React', 'Hooks', 'Frontend'],
    category: '대학 동기들',
    categoryColor: 'bg-blue-500',
    date: '2026.04.05'
  },
  {
    id: 2,
    title: '독서 모임 - 클린 코드',
    description: '이번 달 독서 모임에서 읽은 "클린 코드"의 핵심 내용을 정리했습니다. 의미 있는 이름 짓기, 함수 작성법, 주석 사용법 등 실무에 바로 적용할 수 있는...',
    image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&auto=format&fit=crop&q=60',
    tags: ['클린코드', '리팩토링', '베스트프랙티스'],
    category: '독서 모임',
    categoryColor: 'bg-orange-500',
    date: '2026.04.03'
  },
  {
    id: 3,
    title: '운동 루틴 및 식단 기록',
    description: '헬스 크루에서 함께 진행하는 운동 프로그램과 식단 관리 내용입니다. 주 3회 웨이트, 주 2회 유산소 운동을 병행하고 있습니다.',
    image: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&auto=format&fit=crop&q=60',
    tags: ['운동', '건강', '루틴'],
    category: '헬스 크루',
    categoryColor: 'bg-emerald-500',
    date: '2026.04.01'
  },
  {
    id: 4,
    title: '팀 회의록 - 2026년 4월',
    description: '이번 달 팀 회의 내용입니다. 프로젝트 일정 조정, 역할 분담, 다음 마일스톤까지의 목표를 설정했습니다.',
    tags: ['회의', '일정', '계획'],
    category: '대학 동기들',
    categoryColor: 'bg-blue-500',
    date: '2026.03.29'
  },
  {
    id: 5,
    title: '중간고사 대비 정리',
    description: '데이터구조 과목 중간고사 범위입니다. 스택, 큐, 트리, 그래프 등의 자료구조와 알고리즘 복잡도 분석 방법을 정리했습니다.',
    tags: ['데이터구조', '알고리즘', '시험'],
    date: '2026.04.04'
  },
  {
    id: 6,
    title: '프로젝트 아이디어 브레인스토밍',
    description: '캡스톤 디자인 프로젝트 주제를 정하기 위한 아이디어 회의 내용입니다. AI 기반 학습 도우미, IoT 스마트홈, 헬스케어 앱 등 여러 아이디어가 나왔...',
    tags: ['아이디어', '브레인스토밍', '프로젝트'],
    category: '대학 동기들',
    categoryColor: 'bg-blue-500',
    date: '2026.04.02'
  },
  {
    id: 7,
    title: 'TypeScript 타입 시스템 정리',
    description: 'TypeScript의 고급 타입 시스템에 대한 정리입니다. 제네릭, 유니온 타입, 인터섹션 타입, 유틸리티 타입 등을 예제와 함께 정리했습니다.',
    tags: ['TypeScript', 'Type System', 'Generic'],
    date: '2026.03.30',
    locked: true
  },
  {
    id: 8,
    title: '여행 계획 - 제주도',
    description: '여름 방학 때 친구들과 가는 제주도 여행 계획입니다. 3박 4일 일정으로 성산일출봉, 우도, 한라산 등을 방문할 예정입니다.',
    image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&auto=format&fit=crop&q=60',
    tags: ['여행', '제주도', '휴가'],
    date: '2026.03.28'
  }
];

export default function MemoPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedMemo, setSelectedMemo] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleMemoClick = (memo: any) => {
    setSelectedMemo(memo);
    setIsDetailOpen(true);
  };

  return (
    <div className="h-screen flex flex-col bg-white text-gray-900 overflow-hidden font-sans">
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        
        {/* Sidebar */}
        <aside className="w-[260px] border-r border-gray-100 flex flex-col p-5 gap-10 overflow-y-auto no-scrollbar hidden lg:flex">
          
          {/* Categories Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 flex items-center gap-2">
              <ChevronDown className="w-3 h-3" /> 카테고리
            </h3>
            <div className="space-y-1">
              <SidebarItem icon={Archive} label="전체 메모" active />
              <SidebarItem icon={User} label="내 메모" />
              <SidebarItem icon={Share2} label="공유받은 메모" />
              <SidebarItem icon={Star} label="즐겨찾기" />
            </div>
          </div>

          {/* Meeting Folders Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 flex items-center gap-2">
              <ChevronDown className="w-3 h-3" /> 모임별 폴더
            </h3>
            <div className="space-y-1">
              <SidebarItem label="대학 동기들" count={3} color="text-blue-500" />
              <SidebarItem label="헬스 크루" count={1} color="text-emerald-500" />
              <SidebarItem label="독서 모임" count={1} color="text-orange-500" />
            </div>
          </div>

          {/* Tags Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 flex items-center gap-2">
              <ChevronDown className="w-3 h-3" /> 태그
            </h3>
            <div className="flex flex-wrap gap-2 px-1">
              {['React', '시험기간', '독서모임', '프로젝트', '스터디', '회의록', '아이디어'].map(tag => (
                <span key={tag} className="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded-md cursor-pointer hover:bg-gray-200 transition-colors">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#F8F9FB]">
          
          {/* Header & Search */}
          <div className="p-8 pb-4 space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">메모 보관함</h2>
            
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-2xl">
                <input 
                  type="text" 
                  placeholder="AI 통합 검색..." 
                  className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none shadow-sm"
                />
                <Search className="w-5 h-5 absolute left-3.5 top-3 text-gray-300" />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="relative">
                  <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                    최신순 <ChevronDown className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
                <div className="flex p-1 bg-white border border-gray-200 rounded-lg shadow-sm">
                  <button 
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-50'}`}
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-50'}`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Memo Grid Area */}
          <div className="flex-1 overflow-y-auto p-8 pt-4 no-scrollbar">
            <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>
              {memos.map(memo => (
                <div key={memo.id} onClick={() => handleMemoClick(memo)} className="contents">
                  <MemoCard {...memo} viewMode={viewMode} />
                </div>
              ))}
            </div>
          </div>

          {/* FAB */}
          <button 
            onClick={() => setIsCreateOpen(true)}
            className="fixed bottom-10 right-10 w-14 h-14 bg-[#6366F1] text-white rounded-full flex items-center justify-center shadow-xl hover:bg-[#5558E6] transition-all transform hover:scale-110 group"
          >
            <Plus className="w-8 h-8 group-hover:rotate-90 transition-transform duration-300" />
          </button>
        </main>
      </div>

      <MemoDetailModal 
        isOpen={isDetailOpen} 
        onClose={() => setIsDetailOpen(false)} 
        memo={selectedMemo} 
      />

      <MemoCreateModal 
        isOpen={isCreateOpen} 
        onClose={() => setIsCreateOpen(false)} 
      />
    </div>
  );
}

function SidebarItem({ icon: Icon, label, count, active, color }: any) {
  return (
    <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all ${active ? 'bg-[#F0F2FF] text-[#6366F1]' : 'hover:bg-gray-50 text-gray-600'}`}>
      <div className="flex items-center gap-3">
        {Icon && <Icon className={`w-4 h-4 ${active ? 'text-[#6366F1]' : 'text-gray-400'}`} />}
        {!Icon && <Circle className={`w-1.5 h-1.5 fill-current ${color || 'text-gray-300'}`} />}
        <span className={`text-sm font-bold`}>{label}</span>
      </div>
      {count !== undefined && (
        <span className="text-xs font-medium text-gray-400">
          {count}
        </span>
      )}
    </div>
  );
}

function MemoCard({ title, description, image, tags, category, categoryColor, date, locked, viewMode }: any) {
  if (viewMode === 'list') {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:border-indigo-100 transition-all group flex overflow-hidden p-6 gap-6 relative cursor-pointer">
        {image && (
          <div className="w-[120px] h-[120px] relative rounded-xl overflow-hidden shrink-0 bg-gray-50 border border-gray-50">
            <Image 
              src={image} 
              alt={title} 
              fill 
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover group-hover:scale-105 transition-transform duration-500" 
            />
          </div>
        )}
        
        <div className="flex flex-col flex-1 min-w-0 py-1">
          <div className="flex items-start justify-between gap-4 mb-2">
            <h4 className="font-bold text-gray-800 text-[17px] truncate">{title}</h4>
          </div>
          
          <p className="text-sm text-gray-500 leading-relaxed line-clamp-2 mb-4">
            {locked ? '이 메모는 잠겨 있습니다. 내용을 보려면 비밀번호를 입력하세요.' : description}
          </p>

          <div className="flex flex-wrap gap-2 mb-4">
            {tags.map((tag: string) => (
              <span key={tag} className="text-[11px] text-[#6366F1] font-bold bg-[#F0F2FF] px-2.5 py-0.5 rounded-md">
                {tag}
              </span>
            ))}
          </div>
          
          <div className="flex items-center justify-between mt-auto">
            <div className="flex items-center gap-3">
              {category && (
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${categoryColor || 'bg-gray-300'}`} />
                  <span className="text-xs text-[#6366F1] font-bold">{category}</span>
                </div>
              )}
              <span className="text-xs text-gray-400 font-medium">{date}</span>
            </div>
            {locked && <Lock className="w-4 h-4 text-gray-300" />}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-indigo-100 hover:shadow-md transition-all group flex flex-col overflow-hidden relative cursor-pointer">
      {image && (
        <div className="h-44 w-full relative bg-gray-50">
          <Image 
            src={image} 
            alt={title} 
            fill 
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover group-hover:scale-105 transition-transform duration-500" 
          />
        </div>
      )}
      
      <div className="p-5 flex flex-col gap-3 flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-bold text-gray-800 text-[15px] truncate">{title}</h4>
          {locked && <Lock className="w-3.5 h-3.5 text-gray-300 shrink-0" />}
        </div>
        
        <p className="text-xs text-gray-500 leading-relaxed line-clamp-3 flex-1">
          {locked ? '이 메모는 잠겨 있습니다. 내용을 보려면 비밀번호를 입력하세요.' : description}
        </p>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag: string) => (
              <span key={tag} className="text-[10px] text-indigo-500 font-bold bg-[#F0F2FF] px-2 py-0.5 rounded-md">
                {tag}
              </span>
            ))}
          </div>
          
          <div className="flex items-center justify-between pt-2 border-t border-gray-50">
            <div className="flex items-center gap-1.5">
              {category && (
                <>
                  <Circle className={`w-1.5 h-1.5 fill-current ${categoryColor}`} />
                  <span className="text-[10px] text-blue-500 font-bold">{category}</span>
                </>
              )}
            </div>
            <span className="text-[10px] text-gray-400 font-medium">{date}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
