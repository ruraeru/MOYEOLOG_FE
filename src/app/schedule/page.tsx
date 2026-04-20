'use client';

import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import AppointmentModal from '@/components/AppointmentModal';
import { 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  CheckCircle2,
  Plus
} from 'lucide-react';

export default function SchedulePage() {
  const [view, setView] = useState<'month' | 'week' | 'list'>('month');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState('2026-04-11');

  const handleOpenModal = (day: number) => {
    const formattedDate = `2026-04-${day.toString().padStart(2, '0')}`;
    setSelectedDate(formattedDate);
    setIsModalOpen(true);
  };

  return (
    <div className="h-screen flex flex-col bg-[#F8F9FB] text-gray-900 overflow-hidden">
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        
        {/* Sidebar */}
        <aside className="w-[280px] bg-white border-r border-gray-100 flex flex-col p-6 gap-8 overflow-y-auto no-scrollbar hidden lg:flex">
          
          {/* Quick Date Selection */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-gray-800 font-bold text-sm">
              <CalendarIcon className="w-4 h-4" />
              <span>빠른 날짜 선택</span>
            </div>
            
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold">2026년 4월</span>
                <div className="flex gap-2">
                  <button className="p-0.5 hover:bg-gray-100 rounded text-gray-400"><ChevronLeft className="w-4 h-4" /></button>
                  <button className="p-0.5 hover:bg-gray-100 rounded text-gray-400"><ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-y-2 text-center">
                {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                  <span key={d} className={`text-[10px] font-bold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-400'}`}>{d}</span>
                ))}
                {/* Placeholder days before April starts (assume starts on Wednesday for visual match) */}
                {[29, 30, 31].map((day, i) => <span key={`prev-${i}`} className="text-[10px] text-gray-200">{day}</span>)}
                {[...Array(30)].map((_, i) => (
                  <button key={i} className={`text-[10px] font-medium w-6 h-6 flex items-center justify-center mx-auto rounded-full transition-colors ${i + 1 === 6 ? 'bg-indigo-600 text-white' : 'hover:bg-gray-100'}`}>
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Schedule Filter */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400">일정 필터</h3>
            <div className="flex items-center justify-between group cursor-pointer">
              <span className="text-sm font-bold text-gray-700">내 일정</span>
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
            </div>
          </div>

          {/* Participating Groups */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400">참여 그룹</h3>
            <div className="space-y-3">
              <GroupFilterItem color="bg-blue-500" name="대학 동기들" count={5} />
              <GroupFilterItem color="bg-emerald-500" name="헬스 크루" count={4} />
              <GroupFilterItem color="bg-orange-500" name="독서 모임" count={3} />
            </div>
          </div>
        </aside>

        {/* Main Calendar Section */}
        <main className="flex-1 flex flex-col bg-white overflow-hidden">
          
          {/* Toolbar */}
          <div className="h-16 border-b border-gray-100 flex items-center justify-between px-6 shrink-0">
            <div className="flex items-center gap-6">
              <button className="px-4 py-1.5 border border-gray-200 rounded-lg text-sm font-bold hover:bg-gray-50 transition-colors">오늘</button>
              <div className="flex items-center gap-4">
                <button className="p-1 hover:bg-gray-100 rounded text-gray-400"><ChevronLeft className="w-5 h-5" /></button>
                <h2 className="text-lg font-bold">2026년 4월</h2>
                <button className="p-1 hover:bg-gray-100 rounded text-gray-400"><ChevronRight className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="일정 검색..." 
                  className="w-64 bg-gray-50 border border-transparent rounded-lg pl-9 pr-4 py-1.5 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none"
                />
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              </div>
              <div className="flex p-1 bg-gray-100 rounded-lg">
                <button 
                  onClick={() => setView('month')}
                  className={`px-4 py-1 text-xs font-bold rounded-md transition-all ${view === 'month' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  월
                </button>
                <button 
                  onClick={() => setView('week')}
                  className={`px-4 py-1 text-xs font-bold rounded-md transition-all ${view === 'week' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  주
                </button>
                <button 
                  onClick={() => setView('list')}
                  className={`px-4 py-1 text-xs font-bold rounded-md transition-all ${view === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  목록
                </button>
              </div>
            </div>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b border-gray-100 shrink-0">
            {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
              <div key={day} className={`py-4 text-center text-sm font-bold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'}`}>
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="flex-1 overflow-y-auto no-scrollbar">
            <div className="grid grid-cols-7 h-full min-h-[800px] border-l border-gray-100">
              {/* Previous month placeholders */}
              {[...Array(3)].map((_, i) => (
                <div key={`empty-${i}`} className="border-r border-b border-gray-100 bg-gray-50/30 p-2"></div>
              ))}

              {/* April days */}
              {[...Array(30)].map((_, i) => {
                const day = i + 1;
                const isToday = day === 6;
                return (
                  <div 
                    key={i} 
                    className={`border-r border-b border-gray-100 p-2 min-h-[140px] flex flex-col gap-1 transition-colors hover:bg-gray-50/50 relative group ${isToday ? 'bg-indigo-50/20' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-indigo-600 text-white' : 'text-gray-700'}`}>
                        {day}
                      </span>
                      <button 
                        onClick={() => handleOpenModal(day)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-50 text-indigo-600 p-1 rounded-md hover:bg-indigo-100"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    
                    {/* Events */}
                    <div className="flex flex-col gap-1 overflow-hidden">
                      {day === 6 && <ScheduleBadge color="bg-blue-100 text-blue-700 border-blue-200" title="팀 회의" />}
                      {day === 7 && <ScheduleBadge color="bg-emerald-100 text-emerald-700 border-emerald-200" title="헬스" />}
                      {day === 8 && <ScheduleBadge color="bg-blue-100 text-blue-700 border-blue-200" title="친구들과 저녁" />}
                      {day === 9 && <ScheduleBadge color="bg-blue-100 text-blue-700 border-blue-200" title="스터디" />}
                      {day === 10 && <ScheduleBadge color="bg-blue-100 text-blue-700 border-blue-200" title="프로젝트 발표" />}
                      {day === 11 && <ScheduleBadge color="bg-emerald-100 text-emerald-700 border-emerald-200" title="요가 수업" />}
                      {day === 12 && <ScheduleBadge color="bg-orange-100 text-orange-700 border-orange-200" title="독서 모임" />}
                      {day === 13 && <ScheduleBadge color="bg-orange-100 text-orange-700 border-orange-200" title="영화 보기" />}
                      {day === 14 && (
                        <>
                          <ScheduleBadge color="bg-blue-100 text-blue-700 border-blue-200" title="동아리 모임" />
                          <ScheduleBadge color="bg-emerald-100 text-emerald-700 border-emerald-200" title="헬스 PT" />
                        </>
                      )}
                      {day === 15 && <ScheduleBadge color="bg-blue-100 text-blue-700 border-blue-200" title="중간고사" />}
                      {day === 16 && <ScheduleBadge color="bg-blue-100 text-blue-700 border-blue-200" title="저녁 약속" />}
                      {day === 18 && <ScheduleBadge color="bg-emerald-100 text-emerald-700 border-emerald-200" title="수영" />}
                      {day === 19 && <ScheduleBadge color="bg-orange-100 text-orange-700 border-orange-200" title="책 토론회" />}
                      {day === 20 && <ScheduleBadge color="bg-blue-100 text-blue-700 border-blue-200" title="세미나" />}
                    </div>
                  </div>
                );
              })}

              {/* Next month placeholders */}
              {[...Array(9)].map((_, i) => (
                <div key={`next-${i}`} className="border-r border-b border-gray-100 bg-gray-50/30 p-2"></div>
              ))}
            </div>
          </div>
        </main>
      </div>

      <AppointmentModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        initialDate={selectedDate}
      />
    </div>
  );
}

function GroupFilterItem({ color, name, count }: { color: string, name: string, count: number }) {
  return (
    <div className="flex items-center justify-between group cursor-pointer hover:bg-gray-50 p-1 -mx-1 rounded-md transition-colors">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${color}`} />
        <span className="text-sm font-bold text-gray-700">{name}</span>
      </div>
      <span className="text-xs font-bold text-gray-400 group-hover:text-indigo-600 transition-colors">{count}</span>
    </div>
  );
}

function ScheduleBadge({ color, title }: { color: string, title: string }) {
  return (
    <div className={`${color} border px-2 py-0.5 rounded text-[10px] font-bold truncate`}>
      {title}
    </div>
  );
}
