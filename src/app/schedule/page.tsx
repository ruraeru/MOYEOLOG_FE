'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Navbar from '@/components/Navbar';
import AppointmentModal from '@/components/AppointmentModal';
import AppointmentDetailModal from '@/components/AppointmentDetailModal';
import AppointmentListModal from '@/components/AppointmentListModal';
import { 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  CheckCircle2,
  Plus,
  Loader2,
  X
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
import { getThemeColors } from '@/lib/utils';

export default function SchedulePage() {
  const { data: session } = useSession();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedules, setSchedules] = useState<ScheduleResponse[]>([]);
  const [userGroups, setUserGroups] = useState<GroupResponse[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [view, setView] = useState<'month' | 'week' | 'list'>('month');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleResponse | null>(null);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchQuery, setSearchQuery] = useState('');

  // Filtering state
  const [activeFilter, setActiveFilter] = useState<{ type: 'all' | 'my' | 'group', id?: string }>({ type: 'all' });

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

  const handleOpenListModal = (date: Date) => {
    setSelectedDate(format(date, 'yyyy-MM-dd'));
    setSelectedSchedule(null);
    setIsListModalOpen(true);
  };

  const handleEdit = (schedule: ScheduleResponse) => {
    setIsDetailOpen(false);
    setSelectedSchedule(schedule);
    setIsModalOpen(true);
  };

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToToday = () => {
    setCurrentDate(new Date());
    setSearchQuery('');
  };

  // Filtered schedules logic
  const filteredSchedules = useMemo(() => {
    let result = [...schedules];

    // Filter by Type
    if (activeFilter.type === 'my') {
      result = result.filter(s => !s.groupId);
    } else if (activeFilter.type === 'group') {
      result = result.filter(s => s.groupId === activeFilter.id);
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(s => 
        s.title.toLowerCase().includes(query) || 
        (s.description && s.description.toLowerCase().includes(query)) ||
        (s.location && s.location.toLowerCase().includes(query))
      );
    }

    return result;
  }, [schedules, activeFilter, searchQuery]);

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
        <aside className="w-[300px] bg-white border-r border-gray-100 flex flex-col p-8 gap-10 overflow-y-auto no-scrollbar hidden lg:flex relative z-10">
          
          {/* Mini Calendar (Quick Date Selection) */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-gray-900 font-black text-xs uppercase tracking-widest px-1">
              <CalendarIcon className="w-4 h-4 text-indigo-500" />
              <span>빠른 날짜 선택</span>
            </div>
            
            <div className="bg-gray-50/50 rounded-3xl border border-gray-100 p-5 shadow-inner">
              <div className="flex items-center justify-between mb-5 px-1">
                <span className="text-xs font-black text-gray-800">{format(currentDate, 'yyyy년 M월')}</span>
                <div className="flex gap-1">
                  <button onClick={prevMonth} className="p-1.5 hover:bg-white hover:shadow-sm rounded-xl text-gray-400 transition-all"><ChevronLeft className="w-4 h-4" /></button>
                  <button onClick={nextMonth} className="p-1.5 hover:bg-white hover:shadow-sm rounded-xl text-gray-400 transition-all"><ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-y-3 text-center">
                {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                  <span key={d} className={`text-[9px] font-black uppercase tracking-tighter ${i === 0 ? 'text-rose-500' : i === 6 ? 'text-indigo-500' : 'text-gray-300'}`}>{d}</span>
                ))}
                {monthDays.map((day, i) => {
                  const hasSchedule = filteredSchedules.some(s => isSameDay(parseISO(s.startTime), day));
                  const isTodayDay = isToday(day);
                  return (
                    <button 
                      key={i} 
                      onClick={() => {
                        setCurrentDate(day);
                        handleOpenListModal(day);
                      }}
                      className={`text-[10px] font-black w-7 h-7 flex flex-col items-center justify-center mx-auto rounded-xl transition-all duration-300 relative
                        ${!isSameMonth(day, currentDate) ? 'text-gray-200' : 'text-gray-700'} 
                        ${isTodayDay ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-110' : 'hover:bg-white hover:shadow-sm hover:scale-110'}
                        ${isSameDay(day, currentDate) && !isTodayDay ? 'ring-2 ring-indigo-100 bg-white' : ''}`}
                    >
                      {format(day, 'd')}
                      {hasSchedule && (
                        <span className={`w-1 h-1 rounded-full absolute bottom-1 ${isTodayDay ? 'bg-white' : 'bg-indigo-500'}`} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Schedule Filter */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">일정 필터</h3>
            <div className="space-y-1.5">
              <FilterItem label="전체 일정" isActive={activeFilter.type === 'all'} onClick={() => setActiveFilter({ type: 'all' })} />
              <FilterItem label="내 일정" isActive={activeFilter.type === 'my'} onClick={() => setActiveFilter({ type: 'my' })} />
            </div>
          </div>

          {/* Participating Groups */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">참여 그룹</h3>
            <div className="space-y-1.5">
              {userGroups.length > 0 ? userGroups.map((group) => (
                <GroupFilterItem 
                  key={group.id} 
                  isActive={activeFilter.type === 'group' && activeFilter.id === group.id}
                  onClick={() => setActiveFilter({ type: 'group', id: group.id })}
                  color={getThemeColors(group.colorTheme).bg} 
                  name={group.name} 
                  count={schedules.filter(s => s.groupId === group.id).length} 
                />
              )) : (
                <p className="text-[10px] text-gray-400 font-bold px-1">참여 중인 모임이 없습니다.</p>
              )}
            </div>
          </div>
        </aside>

        {/* Main Calendar Section */}
        <main className="flex-1 flex flex-col bg-white overflow-hidden relative">
          {/* Toolbar (Glassmorphism) */}
          <div className="h-24 border-b border-gray-100 flex items-center justify-between px-10 shrink-0 sticky top-0 bg-white/80 backdrop-blur-xl z-20">
            <div className="flex items-center gap-10">
              <button onClick={goToToday} className="px-8 py-3 bg-white border border-gray-100 rounded-2xl text-xs font-black hover:bg-gray-50 transition-all shadow-sm active:scale-95 uppercase tracking-widest">Today</button>
              <div className="flex items-center gap-6">
                <button onClick={prevMonth} className="p-2.5 hover:bg-gray-100 rounded-2xl text-gray-400 transition-all active:scale-90"><ChevronLeft className="w-6 h-6" /></button>
                <h2 className="text-3xl font-black tracking-tighter text-gray-900 w-56 text-center">{format(currentDate, 'yyyy년 M월')}</h2>
                <button onClick={nextMonth} className="p-2.5 hover:bg-gray-100 rounded-2xl text-gray-400 transition-all active:scale-90"><ChevronRight className="w-6 h-6" /></button>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="relative hidden xl:block">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="일정 검색..." 
                  className="w-80 bg-gray-50/50 border-0 rounded-[1.25rem] pl-12 pr-4 py-3.5 text-sm font-bold focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all outline-none shadow-inner" 
                />
                <Search className="w-5 h-5 absolute left-4 top-3.5 text-gray-300" />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <ViewSelector currentView={view} onViewChange={setView} />
              <button 
                onClick={() => { setSelectedSchedule(null); setIsModalOpen(true); }} 
                className="bg-indigo-600 text-white p-4 rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-90 hover:rotate-90"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Calendar View Container */}
          <div className="flex-1 overflow-hidden flex flex-col bg-[#F8F9FB]/30">
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 bg-white rounded-3xl shadow-xl flex items-center justify-center animate-bounce">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                </div>
                <p className="font-black text-gray-400 text-xs uppercase tracking-widest">일정을 동기화 중입니다...</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-7 border-b border-gray-100 shrink-0 bg-white/50 backdrop-blur-md">
                  {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
                    <div key={day} className={`py-6 text-center text-[10px] font-black uppercase tracking-widest ${i === 0 ? 'text-rose-500' : i === 6 ? 'text-indigo-500' : 'text-gray-300'}`}>{day}</div>
                  ))}
                </div>

                <div className="flex-1 overflow-hidden">
                  <div className="grid grid-cols-7 h-full">
                    {monthDays.map((day, i) => (
                      <CalendarDay 
                        key={i} 
                        day={day} 
                        currentDate={currentDate} 
                        schedules={filteredSchedules} 
                        userGroups={userGroups} 
                        onDayClick={handleOpenListModal} 
                        onScheduleClick={(e, schedule) => { e.stopPropagation(); setIsListModalOpen(false); setSelectedSchedule(schedule); setIsDetailOpen(true); }} 
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      <AppointmentModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setSelectedSchedule(null); }} initialDate={selectedDate} onSuccess={fetchSchedules} initialSchedule={selectedSchedule} />
      <AppointmentListModal 
        isOpen={isListModalOpen} 
        onClose={() => setIsListModalOpen(false)} 
        date={selectedDate} 
        appointments={filteredSchedules.filter(s => isSameDay(parseISO(s.startTime), new Date(selectedDate)))} 
        onCreateNew={() => { setSelectedSchedule(null); setIsModalOpen(true); }} 
        onAppointmentClick={(s) => { setIsListModalOpen(false); setSelectedSchedule(s); setIsDetailOpen(true); }} 
      />
      <AppointmentDetailModal isOpen={isDetailOpen} onClose={() => { setIsDetailOpen(false); setSelectedSchedule(null); }} schedule={selectedSchedule} onSuccess={fetchSchedules} onEdit={handleEdit} />
    </div>
  );
}

// ─── Sub Components ─────────────────────────────────────────────

interface FilterItemProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function FilterItem({ label, isActive, onClick }: FilterItemProps) {
  return (
    <div 
      onClick={onClick} 
      className={`flex items-center justify-between group cursor-pointer p-3 rounded-2xl transition-all duration-300 border-0 ${
        isActive 
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-[1.02]' 
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      <span className="text-sm font-black tracking-tight">{label}</span>
      {isActive && <CheckCircle2 className="w-4 h-4 text-white" />}
    </div>
  );
}

interface GroupFilterItemProps {
  color: string;
  name: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
}

function GroupFilterItem({ color, name, count, isActive, onClick }: GroupFilterItemProps) {
  return (
    <div 
      onClick={onClick} 
      className={`flex items-center justify-between group cursor-pointer p-3 rounded-2xl transition-all duration-300 border-0 ${
        isActive 
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-[1.02]' 
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-white' : color} shadow-sm transition-colors`} />
        <span className="text-sm font-black tracking-tight">{name}</span>
      </div>
      <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg transition-colors ${
        isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-400 group-hover:bg-indigo-50 group-hover:text-indigo-600'
      }`}>
        {count}
      </span>
    </div>
  );
}

interface ViewSelectorProps {
  currentView: 'month' | 'week' | 'list';
  onViewChange: (view: 'month' | 'week' | 'list') => void;
}

function ViewSelector({ currentView, onViewChange }: ViewSelectorProps) {
  return (
    <div className="flex p-1.5 bg-gray-100/50 backdrop-blur-md rounded-2xl shadow-inner border border-gray-100/50">
      {(['month', 'week', 'list'] as const).map(v => (
        <button 
          key={v} 
          onClick={() => onViewChange(v)} 
          className={`px-6 py-2.5 text-[10px] font-black rounded-xl transition-all duration-300 uppercase tracking-widest ${
            currentView === v 
              ? 'bg-white shadow-md text-indigo-600 scale-105' 
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          {v === 'month' ? 'Month' : v === 'week' ? 'Week' : 'List'}
        </button>
      ))}
    </div>
  );
}

interface CalendarDayProps {
  day: Date;
  currentDate: Date;
  schedules: ScheduleResponse[];
  userGroups: GroupResponse[];
  onDayClick: (date: Date) => void;
  onScheduleClick: (e: React.MouseEvent, schedule: ScheduleResponse) => void;
}

function CalendarDay({ day, currentDate, schedules, userGroups, onDayClick, onScheduleClick }: CalendarDayProps) {
  const daySchedules = schedules.filter((s) => isSameDay(parseISO(s.startTime), day));
  const isCurrMonth = isSameMonth(day, currentDate);
  const isTodayDay = isToday(day);

  return (
    <div 
      onClick={() => onDayClick(day)}
      className={`border-r border-b border-gray-100 p-3 h-full flex flex-col gap-1 transition-all duration-500 hover:bg-white hover:shadow-2xl hover:z-10 hover:scale-[1.01] hover:rounded-2xl relative group cursor-pointer ${!isCurrMonth ? 'bg-gray-50/30 opacity-40' : 'bg-white'}`}
    >
      <div className="flex items-center justify-between mb-1 shrink-0">
        <span className={`text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-lg transition-all duration-300 ${
          !isCurrMonth ? 'text-gray-300' : 'text-gray-700'
        } ${
          isTodayDay ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-110' : 'group-hover:bg-gray-50 group-hover:text-indigo-600'
        }`}>
          {format(day, 'd')}
        </span>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onDayClick(day);
          }} 
          className="opacity-0 group-hover:opacity-100 transition-all duration-300 bg-indigo-50 text-indigo-600 p-1.5 rounded-lg hover:bg-indigo-600 hover:text-white active:scale-90 shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 flex flex-col gap-1 overflow-hidden min-h-0">
        {daySchedules.slice(0, 2).map((s) => {
          const group = userGroups.find((g) => g.id === s.groupId);
          const theme = getThemeColors(group?.colorTheme);
          return (
            <div 
              key={s.id} 
              onClick={(e) => {
                e.stopPropagation();
                onScheduleClick(e, s);
              }} 
              className="transform transition-all duration-300 hover:scale-105 active:scale-95 shrink-0"
            >
              <div className={`${theme.light} ${theme.soft} ${theme.border} border border-opacity-50 px-2.5 py-1 rounded-lg text-[9px] font-black truncate shadow-sm hover:shadow-md transition-all cursor-pointer`}>
                {s.title}
              </div>
            </div>
          );
        })}
        {daySchedules.length > 2 && (
          <div className="text-[8px] text-gray-400 font-black text-center pt-0.5 animate-pulse shrink-0">
            + {daySchedules.length - 2} more
          </div>
        )}
      </div>
    </div>
  );
}
