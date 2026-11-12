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
    <div className="h-screen flex flex-col bg-canvas text-ink overflow-hidden">
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        
        {/* Sidebar */}
        <aside className="w-[300px] bg-surface border-r border-line flex-col p-6 gap-8 overflow-y-auto no-scrollbar hidden lg:flex relative z-10">
          
          {/* Mini Calendar (Quick Date Selection) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-base font-semibold text-ink">
              <CalendarIcon size={16} strokeWidth={1.5} className="text-ink-3" />
              <span>빠른 날짜 선택</span>
            </div>
            
            <div className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-ink tabular-nums">{format(currentDate, 'yyyy년 M월')}</span>
                <div className="flex gap-1">
                  <button onClick={prevMonth} className="btn-ghost size-8 p-0 text-ink-3"><ChevronLeft size={16} strokeWidth={1.5} /></button>
                  <button onClick={nextMonth} className="btn-ghost size-8 p-0 text-ink-3"><ChevronRight size={16} strokeWidth={1.5} /></button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-y-1 text-center">
                {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                  <span key={d} className={`text-xs pb-1 ${i === 0 ? 'text-negative' : 'text-ink-3'}`}>{d}</span>
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
                      className={`text-xs tabular-nums size-8 flex flex-col items-center justify-center mx-auto rounded-lg transition-colors duration-150 ease-out relative
                        ${!isSameMonth(day, currentDate) ? 'text-ink-3 opacity-50' : 'text-ink'} 
                        ${isTodayDay ? 'bg-accent text-white' : 'hover:bg-raised'}
                        ${isSameDay(day, currentDate) && !isTodayDay ? 'bg-raised' : ''}`}
                    >
                      {format(day, 'd')}
                      {hasSchedule && (
                        <span className={`size-1 rounded-full absolute bottom-1 ${isTodayDay ? 'bg-white' : 'bg-accent'}`} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Schedule Filter */}
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-ink">일정 필터</h3>
            <div className="space-y-1">
              <FilterItem label="전체 일정" isActive={activeFilter.type === 'all'} onClick={() => setActiveFilter({ type: 'all' })} />
              <FilterItem label="내 일정" isActive={activeFilter.type === 'my'} onClick={() => setActiveFilter({ type: 'my' })} />
            </div>
          </div>

          {/* Participating Groups */}
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-ink">참여 그룹</h3>
            <div className="space-y-1">
              {userGroups.length > 0 ? userGroups.map((group) => (
                <GroupFilterItem 
                  key={group.id} 
                  isActive={activeFilter.type === 'group' && activeFilter.id === group.id}
                  onClick={() => setActiveFilter({ type: 'group', id: group.id })}
                  color={getThemeColors(group.colorTheme).dot} 
                  name={group.name} 
                  count={schedules.filter(s => s.groupId === group.id).length} 
                />
              )) : (
                <p className="text-sm text-ink-3">참여 중인 모임이 없어요</p>
              )}
            </div>
          </div>
        </aside>

        {/* Main Calendar Section */}
        <main className="flex-1 flex flex-col bg-surface overflow-hidden relative">
          {/* Toolbar */}
          <div className="h-16 border-b border-line flex items-center justify-between px-6 shrink-0 sticky top-0 bg-surface z-20">
            <div className="flex items-center gap-4">
              <button onClick={goToToday} className="btn-secondary h-9">오늘</button>
              <div className="flex items-center gap-2">
                <button onClick={prevMonth} className="btn-ghost size-9 p-0 text-ink-2"><ChevronLeft size={18} strokeWidth={1.5} /></button>
                <h2 className="text-2xl font-semibold text-ink tabular-nums w-40 text-center">{format(currentDate, 'yyyy년 M월')}</h2>
                <button onClick={nextMonth} className="btn-ghost size-9 p-0 text-ink-2"><ChevronRight size={18} strokeWidth={1.5} /></button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative hidden xl:block">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="일정 검색" 
                  className="form-input w-72 pl-10 pr-9" 
                />
                <Search size={16} strokeWidth={1.5} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink-2 transition-colors duration-150 ease-out"
                  >
                    <X size={16} strokeWidth={1.5} />
                  </button>
                )}
              </div>
              <ViewSelector currentView={view} onViewChange={setView} />
              <button 
                onClick={() => { setSelectedSchedule(null); setIsModalOpen(true); }} 
                className="btn-primary size-10 p-0"
              >
                <Plus size={18} strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* Calendar View Container */}
          <div className="flex-1 overflow-hidden flex flex-col bg-surface">
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <Loader2 size={20} strokeWidth={1.5} className="animate-spin text-ink-3" />
                <p className="text-sm text-ink-3">일정을 불러오는 중이에요</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-7 border-b border-line shrink-0">
                  {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
                    <div key={day} className={`py-3 text-center text-xs ${i === 0 ? 'text-negative' : 'text-ink-3'}`}>{day}</div>
                  ))}
                </div>

                <div className="flex-1 overflow-hidden">
                  <div className="grid grid-cols-7 h-full" style={{ gridAutoRows: '1fr' }}>
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
        appointments={filteredSchedules.filter(s => isSameDay(parseISO(s.startTime), parseISO(selectedDate)))} 
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
      className={`flex items-center justify-between cursor-pointer px-3 h-10 rounded-[10px] transition-colors duration-150 ease-out ${
        isActive 
          ? 'bg-accent-soft text-accent' 
          : 'text-ink-2 hover:bg-raised'
      }`}
    >
      <span className="text-sm font-medium">{label}</span>
      {isActive && <CheckCircle2 size={16} strokeWidth={1.5} />}
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
      className={`flex items-center justify-between cursor-pointer px-3 h-10 rounded-[10px] transition-colors duration-150 ease-out ${
        isActive 
          ? 'bg-accent-soft text-accent' 
          : 'text-ink-2 hover:bg-raised'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`size-2 rounded-full shrink-0 ${color}`} />
        <span className="text-sm font-medium truncate">{name}</span>
      </div>
      <span className="text-xs tabular-nums text-ink-3">
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
    <div className="flex bg-raised rounded-[10px] p-1">
      {(['month', 'week', 'list'] as const).map(v => (
        <button 
          key={v} 
          onClick={() => onViewChange(v)} 
          className={`px-3 h-7 text-sm rounded-lg transition-colors duration-150 ease-out ${
            currentView === v 
              ? 'bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.06)]' 
              : 'text-ink-2 hover:text-ink'
          }`}
        >
          {v === 'month' ? '월' : v === 'week' ? '주' : '목록'}
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

function CalendarDay({ day, currentDate, schedules, onDayClick, onScheduleClick }: CalendarDayProps) {
  const daySchedules = schedules
    .filter((s) => isSameDay(parseISO(s.startTime), day))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const isCurrMonth = isSameMonth(day, currentDate);
  const isTodayDay = isToday(day);

  return (
    <div 
      onClick={() => onDayClick(day)}
      className={`border-r border-b border-line p-2 min-h-0 flex flex-col gap-1 transition-colors duration-150 ease-out hover:bg-raised relative group cursor-pointer ${
        isTodayDay ? 'bg-accent-soft hover:bg-accent-soft' : isCurrMonth ? 'bg-surface' : 'bg-canvas'
      }`}
    >
      <div className="flex items-center justify-between shrink-0">
        <span className={`text-sm tabular-nums size-6 flex items-center justify-center rounded-full ${
          isTodayDay ? 'bg-accent text-white font-medium' : isCurrMonth ? 'text-ink' : 'text-ink-3 opacity-60'
        }`}>
          {format(day, 'd')}
        </span>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onDayClick(day);
          }} 
          className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-out text-ink-3 hover:text-ink hover:bg-surface p-1 rounded-md"
        >
          <Plus size={16} strokeWidth={1.5} />
        </button>
      </div>
      <div className={`flex-1 flex flex-col gap-0.5 overflow-hidden min-h-0 ${isCurrMonth ? '' : 'opacity-60'}`}>
        {daySchedules.slice(0, 3).map((s) => (
          <div 
            key={s.id} 
            onClick={(e) => {
              e.stopPropagation();
              onScheduleClick(e, s);
            }} 
            className="flex items-center gap-1.5 px-1.5 h-6 rounded-md text-xs text-ink hover:bg-surface cursor-pointer transition-colors duration-150 ease-out shrink-0"
          >
            <span className="size-1.5 rounded-full bg-accent shrink-0" />
            <span className="stamp shrink-0">{format(parseISO(s.startTime), 'HH:mm')}</span>
            <span className="truncate">{s.title}</span>
          </div>
        ))}
        {daySchedules.length > 3 && (
          <div className="text-xs text-ink-3 tabular-nums px-1.5 shrink-0">
            +{daySchedules.length - 3}개 더
          </div>
        )}
      </div>
    </div>
  );
}
