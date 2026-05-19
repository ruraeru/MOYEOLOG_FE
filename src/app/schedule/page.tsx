'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Navbar from '@/components/Navbar';
import AppointmentModal from '@/components/AppointmentModal';
import AppointmentDetailModal from '@/components/AppointmentDetailModal';
import { 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  CheckCircle2,
  Plus,
  Loader2
} from 'lucide-react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  isToday,
  parseISO
} from 'date-fns';
import { useSession } from 'next-auth/react';
import { scheduleApi, type ScheduleResponse } from '@/lib/schedule-api';
import { groupApi, type GroupResponse } from '@/lib/group-api';

export default function SchedulePage() {
  const { data: session } = useSession();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedules, setSchedules] = useState<ScheduleResponse[]>([]);
  const [userGroups, setUserGroups] = useState<GroupResponse[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [view, setView] = useState<'month' | 'week' | 'list'>('month');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleResponse | null>(null);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const fetchSchedules = useCallback(async () => {
    if (!session) return;
    try {
      setLoading(true);
      const [scheduleData, groupData] = await Promise.all([
        scheduleApi.getAll(session),
        groupApi.getAll(session)
      ]);
      setSchedules(scheduleData);
      setUserGroups(groupData);
    } catch (error) {
      console.error('Failed to fetch schedule data:', error);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const handleOpenModal = (date: Date) => {
    setSelectedDate(format(date, 'yyyy-MM-dd'));
    setIsModalOpen(true);
  };

  const handleOpenDetail = (e: React.MouseEvent, schedule: ScheduleResponse) => {
    e.stopPropagation();
    setSelectedSchedule(schedule);
    setIsDetailOpen(true);
  };

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  // Month Grid Days
  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentDate]);

  return (
    <div className="h-screen flex flex-col bg-[#F8F9FB] text-gray-900 overflow-hidden font-sans">
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        
        {/* Sidebar */}
        <aside className="w-[280px] bg-white border-r border-gray-100 flex flex-col p-6 gap-8 overflow-y-auto no-scrollbar hidden lg:flex">
          
          {/* Mini Calendar (Quick Date Selection) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-gray-800 font-bold text-sm">
              <CalendarIcon className="w-4 h-4" />
              <span>빠른 날짜 선택</span>
            </div>
            
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold">{format(currentDate, 'yyyy년 M월')}</span>
                <div className="flex gap-2">
                  <button onClick={prevMonth} className="p-0.5 hover:bg-gray-100 rounded text-gray-400"><ChevronLeft className="w-4 h-4" /></button>
                  <button onClick={nextMonth} className="p-0.5 hover:bg-gray-100 rounded text-gray-400"><ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-y-2 text-center">
                {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                  <span key={d} className={`text-[10px] font-bold ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-400'}`}>{d}</span>
                ))}
                {monthDays.map((day, i) => (
                  <button 
                    key={i} 
                    onClick={() => setCurrentDate(day)}
                    className={`text-[10px] font-medium w-6 h-6 flex items-center justify-center mx-auto rounded-full transition-colors 
                      ${!isSameMonth(day, currentDate) ? 'text-gray-200' : 'text-gray-700'} 
                      ${isToday(day) ? 'bg-indigo-600 text-white' : 'hover:bg-gray-100'}
                      ${isSameDay(day, currentDate) && !isToday(day) ? 'ring-1 ring-indigo-400' : ''}`}
                  >
                    {format(day, 'd')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Schedule Filter */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">일정 필터</h3>
            <div className="flex items-center justify-between group cursor-pointer hover:bg-gray-50 p-2 -mx-2 rounded-xl transition-all">
              <span className="text-sm font-bold text-gray-700">내 일정</span>
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
            </div>
          </div>

          {/* Participating Groups */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">참여 그룹</h3>
            <div className="space-y-2">
              {userGroups.length > 0 ? userGroups.map((group) => (
                <GroupFilterItem 
                  key={group.id} 
                  color={group.colorTheme === 'indigo' ? 'bg-indigo-500' : 
                         group.colorTheme === 'blue' ? 'bg-blue-500' : 
                         group.colorTheme === 'emerald' ? 'bg-emerald-500' : 
                         group.colorTheme === 'orange' ? 'bg-orange-500' : 
                         group.colorTheme === 'rose' ? 'bg-rose-500' : 'bg-amber-500'} 
                  name={group.name} 
                  count={schedules.filter(s => s.groupId === group.id).length} 
                />
              )) : (
                <p className="text-xs text-gray-400 font-medium">참여 중인 모임이 없습니다.</p>
              )}
            </div>
          </div>
        </aside>

        {/* Main Calendar Section */}
        <main className="flex-1 flex flex-col bg-white overflow-hidden">
          
          {/* Toolbar */}
          <div className="h-20 border-b border-gray-100 flex items-center justify-between px-8 shrink-0">
            <div className="flex items-center gap-8">
              <button 
                onClick={goToToday}
                className="px-6 py-2 bg-white border border-gray-200 rounded-xl text-sm font-black hover:bg-gray-50 transition-all shadow-sm active:scale-95"
              >
                오늘
              </button>
              <div className="flex items-center gap-4">
                <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"><ChevronLeft className="w-6 h-6" /></button>
                <h2 className="text-2xl font-black tracking-tight text-gray-800 w-48 text-center">
                  {format(currentDate, 'yyyy년 M월')}
                </h2>
                <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"><ChevronRight className="w-6 h-6" /></button>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative hidden md:block">
                <input 
                  type="text" 
                  placeholder="일정 검색..." 
                  className="w-72 bg-gray-50 border border-transparent rounded-xl pl-11 pr-4 py-2.5 text-sm focus:bg-white focus:border-indigo-500 transition-all outline-none shadow-sm"
                />
                <Search className="w-4 h-4 absolute left-4 top-3 text-gray-400" />
              </div>
              <div className="flex p-1.5 bg-gray-100 rounded-2xl shadow-inner">
                <button 
                  onClick={() => setView('month')}
                  className={`px-5 py-2 text-xs font-black rounded-xl transition-all ${view === 'month' ? 'bg-white shadow-md text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  월
                </button>
                <button 
                  onClick={() => setView('week')}
                  className={`px-5 py-2 text-xs font-black rounded-xl transition-all ${view === 'week' ? 'bg-white shadow-md text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  주
                </button>
                <button 
                  onClick={() => setView('list')}
                  className={`px-5 py-2 text-xs font-black rounded-xl transition-all ${view === 'list' ? 'bg-white shadow-md text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  목록
                </button>
              </div>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Calendar View Container */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                <p className="font-bold text-gray-500">일정을 불러오는 중...</p>
              </div>
            ) : (
              <>
                {/* Day Headers */}
                <div className="grid grid-cols-7 border-b border-gray-100 shrink-0 bg-gray-50/50">
                  {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
                    <div key={day} className={`py-4 text-center text-xs font-black uppercase tracking-widest ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-400'}`}>
                      {day}
                    </div>
                  ))}
                </div>

                {/* Grid Body */}
                <div className="flex-1 overflow-y-auto no-scrollbar">
                  <div className="grid grid-cols-7 h-full min-h-[840px] border-l border-gray-100">
                    {monthDays.map((day, i) => {
                      const daySchedules = schedules.filter(s => isSameDay(parseISO(s.startTime), day));
                      const isCurrMonth = isSameMonth(day, currentDate);
                      const isTodayDay = isToday(day);

                      return (
                        <div 
                          key={i} 
                          className={`border-r border-b border-gray-100 p-2 min-h-[140px] flex flex-col gap-1 transition-all hover:bg-gray-50/50 relative group
                            ${!isCurrMonth ? 'bg-gray-50/30' : 'bg-white'} 
                            ${isTodayDay ? 'bg-indigo-50/20' : ''}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-xs font-black w-7 h-7 flex items-center justify-center rounded-lg transition-all
                              ${!isCurrMonth ? 'text-gray-300' : 'text-gray-700'} 
                              ${isTodayDay ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'group-hover:bg-gray-100'}`}>
                              {format(day, 'd')}
                            </span>
                            <button 
                              onClick={() => handleOpenModal(day)}
                              className="opacity-0 group-hover:opacity-100 transition-all bg-indigo-50 text-indigo-600 p-1.5 rounded-lg hover:bg-indigo-100 active:scale-90 shadow-sm"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          
                          {/* Events */}
                          <div className="flex flex-col gap-1.5 overflow-hidden">
                            {daySchedules.map((s) => {
                              // 그룹 색상 매핑
                              const group = userGroups.find(g => g.id === s.groupId);
                              const theme = group?.colorTheme || 'indigo';
                              const colorMap = {
                                indigo: 'bg-indigo-100 text-indigo-700 border-indigo-200',
                                blue: 'bg-blue-100 text-blue-700 border-blue-200',
                                emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
                                orange: 'bg-orange-100 text-orange-700 border-orange-200',
                                rose: 'bg-rose-100 text-rose-700 border-rose-200',
                                amber: 'bg-amber-100 text-amber-700 border-amber-200'
                              };

                              return (
                                <div key={s.id} onClick={(e) => handleOpenDetail(e, s)}>
                                  <ScheduleBadge 
                                    color={colorMap[theme as keyof typeof colorMap]} 
                                    title={s.title} 
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      <AppointmentModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        initialDate={selectedDate}
        onSuccess={fetchSchedules}
      />

      <AppointmentDetailModal 
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedSchedule(null);
        }}
        schedule={selectedSchedule}
        onSuccess={fetchSchedules}
      />
    </div>
  );
}

function GroupFilterItem({ color, name, count }: { color: string, name: string, count: number }) {
  return (
    <div className="flex items-center justify-between group cursor-pointer hover:bg-gray-50 p-2 -mx-2 rounded-xl transition-all">
      <div className="flex items-center gap-3">
        <div className={`w-2.5 h-2.5 rounded-full ${color} shadow-sm`} />
        <span className="text-sm font-bold text-gray-700 group-hover:text-gray-900">{name}</span>
      </div>
      <span className="text-xs font-black text-gray-300 group-hover:text-indigo-600 transition-colors bg-gray-50 group-hover:bg-indigo-50 px-2 py-0.5 rounded-lg">{count}</span>
    </div>
  );
}

function ScheduleBadge({ color, title }: { color: string, title: string }) {
  return (
    <div className={`${color} border border-opacity-50 px-2.5 py-1 rounded-lg text-[10px] font-black truncate shadow-sm hover:brightness-95 transition-all cursor-pointer`}>
      {title}
    </div>
  );
}
