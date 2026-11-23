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
  X,
  MapPin
} from 'lucide-react';
import {
  format,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
  startOfDay,
  max as maxDate
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { useSession } from 'next-auth/react';
import { scheduleApi, type ScheduleResponse } from '@/lib/schedule-api';
import { groupApi, type GroupResponse } from '@/lib/group-api';
import { getApiErrorMessage } from '@/lib/axios';
import { getThemeColors } from '@/lib/utils';
import {
  type ScheduleView,
  formatScheduleRange,
  formatTimeOnDay,
  useTimeFormat,
  scheduleCoversDay,
  scheduleDotClass,
  schedulesOnDay,
  sortSchedules,
  useDefaultScheduleView,
  useWeekStartsOn,
  weekdayHeaders
} from '@/lib/schedule-utils';

export default function SchedulePage() {
  const { data: session } = useSession();
  const accessToken = session?.user?.accessToken;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedules, setSchedules] = useState<ScheduleResponse[]>([]);
  const [userGroups, setUserGroups] = useState<GroupResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 설정 화면의 '일정 기본 보기'·'주 시작 요일'
  const defaultView = useDefaultScheduleView();
  const weekStartsOn = useWeekStartsOn();
  const [viewOverride, setViewOverride] = useState<ScheduleView | null>(null);
  const view = viewOverride ?? defaultView;

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
      setLoadError(null);
      const [scheduleData, groupData] = await Promise.all([
        scheduleApi.getAll(session),
        groupApi.getAll(session)
      ]);
      setSchedules(scheduleData);
      setUserGroups(groupData);
    } catch (error) {
      console.error('Failed to fetch schedule data:', error);
      setLoadError(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  // 세션 객체는 포커스 때마다 새로 만들어지므로 토큰이 바뀔 때만 다시 불러온다.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const handleOpenListModal = (date: Date) => {
    setSelectedDate(format(date, 'yyyy-MM-dd'));
    setSelectedSchedule(null);
    setIsListModalOpen(true);
  };

  const handleOpenCreate = (date: Date) => {
    setSelectedDate(format(date, 'yyyy-MM-dd'));
    setSelectedSchedule(null);
    setIsModalOpen(true);
  };

  const handleOpenDetail = (schedule: ScheduleResponse) => {
    setIsListModalOpen(false);
    setSelectedSchedule(schedule);
    setIsDetailOpen(true);
  };

  const handleEdit = (schedule: ScheduleResponse) => {
    setIsDetailOpen(false);
    setSelectedSchedule(schedule);
    setIsModalOpen(true);
  };

  const goNext = () => setCurrentDate(view === 'week' ? addWeeks(currentDate, 1) : addMonths(currentDate, 1));
  const goPrev = () => setCurrentDate(view === 'week' ? subWeeks(currentDate, 1) : subMonths(currentDate, 1));
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
      const query = searchQuery.trim().toLowerCase();
      result = result.filter(s =>
        s.title.toLowerCase().includes(query) ||
        (s.description && s.description.toLowerCase().includes(query)) ||
        (s.location && s.location.toLowerCase().includes(query))
      );
    }

    return sortSchedules(result);
  }, [schedules, activeFilter, searchQuery]);

  // Month Grid Days
  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn });
    const endDate = endOfWeek(monthEnd, { weekStartsOn });

    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentDate, weekStartsOn]);

  const weekDays = useMemo(() => eachDayOfInterval({
    start: startOfWeek(currentDate, { weekStartsOn }),
    end: endOfWeek(currentDate, { weekStartsOn })
  }), [currentDate, weekStartsOn]);

  const headers = weekdayHeaders(weekStartsOn);

  const toolbarTitle = view === 'week'
    ? `${format(weekDays[0], 'yyyy.M.d')} – ${format(weekDays[6], isSameMonth(weekDays[0], weekDays[6]) ? 'd' : 'M.d')}`
    : format(currentDate, 'yyyy년 M월');

  const filterValue = activeFilter.type === 'group' ? `group:${activeFilter.id}` : activeFilter.type;
  const onFilterSelect = (value: string) => {
    if (value.startsWith('group:')) setActiveFilter({ type: 'group', id: value.slice(6) });
    else setActiveFilter({ type: value as 'all' | 'my' });
  };

  const searchInput = (className: string) => (
    <div className={`relative ${className}`}>
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="일정 검색"
        className="form-input w-full pl-10 pr-9"
      />
      <Search size={16} strokeWidth={1.5} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
      {searchQuery && (
        <button
          onClick={() => setSearchQuery('')}
          aria-label="검색어 지우기"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink-2 transition-colors duration-150 ease-out"
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      )}
    </div>
  );

  return (
    <div className="h-[calc(100dvh-4rem)] lg:h-screen flex flex-col bg-canvas text-ink overflow-hidden">
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
                  <button onClick={prevMonth} aria-label="이전 달" className="btn-ghost size-8 p-0 text-ink-3"><ChevronLeft size={16} strokeWidth={1.5} /></button>
                  <button onClick={nextMonth} aria-label="다음 달" className="btn-ghost size-8 p-0 text-ink-3"><ChevronRight size={16} strokeWidth={1.5} /></button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-y-1 text-center">
                {headers.map(({ label, dayIndex }) => (
                  <span key={label} className={`text-xs pb-1 ${dayIndex === 0 ? 'text-negative' : 'text-ink-3'}`}>{label}</span>
                ))}
                {monthDays.map((day, i) => {
                  const hasSchedule = filteredSchedules.some(s => scheduleCoversDay(s, day));
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
        <main className="flex-1 flex flex-col bg-surface overflow-hidden relative min-w-0">
          {/* Toolbar */}
          <div className="border-b border-line flex flex-wrap items-center gap-x-3 gap-y-2 px-4 md:px-6 py-3 shrink-0 bg-surface z-20">
            <div className="flex items-center gap-2 md:gap-4 min-w-0">
              <button onClick={goToToday} className="btn-secondary h-9 shrink-0 whitespace-nowrap">오늘</button>
              <div className="flex items-center gap-1 md:gap-2 min-w-0">
                <button onClick={goPrev} aria-label={view === 'week' ? '이전 주' : '이전 달'} className="btn-ghost size-9 p-0 text-ink-2 shrink-0"><ChevronLeft size={18} strokeWidth={1.5} /></button>
                <h2 className="text-lg md:text-2xl font-semibold text-ink tabular-nums whitespace-nowrap text-center md:min-w-40">{toolbarTitle}</h2>
                <button onClick={goNext} aria-label={view === 'week' ? '다음 주' : '다음 달'} className="btn-ghost size-9 p-0 text-ink-2 shrink-0"><ChevronRight size={18} strokeWidth={1.5} /></button>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2 md:gap-3 shrink-0">
              {searchInput('hidden xl:block w-72')}
              <ViewSelector currentView={view} onViewChange={setViewOverride} />
              <button
                onClick={() => handleOpenCreate(isSameMonth(new Date(), currentDate) ? new Date() : currentDate)}
                aria-label="새 일정"
                className="btn-primary size-9 md:size-10 p-0 shrink-0"
              >
                <Plus size={18} strokeWidth={1.5} />
              </button>
            </div>

            {/* 작은 화면: 검색과 필터 */}
            <div className="w-full flex gap-2 xl:hidden">
              {searchInput('flex-1 min-w-0')}
              <div className="relative lg:hidden shrink-0 w-36">
                <select value={filterValue} onChange={(e) => onFilterSelect(e.target.value)} aria-label="일정 필터" className="form-input appearance-none pr-8 truncate">
                  <option value="all">전체 일정</option>
                  <option value="my">내 일정</option>
                  {userGroups.map((g) => <option key={g.id} value={`group:${g.id}`}>{g.name}</option>)}
                </select>
                <ChevronRight size={16} strokeWidth={1.5} className="text-ink-3 absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Calendar View Container */}
          <div className="flex-1 overflow-hidden flex flex-col bg-surface">
            {loading && schedules.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <Loader2 size={20} strokeWidth={1.5} className="animate-spin text-ink-3" />
                <p className="text-sm text-ink-3">일정을 불러오는 중이에요</p>
              </div>
            ) : loadError && schedules.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
                <p className="text-sm font-medium text-ink">일정을 불러오지 못했어요</p>
                <p className="text-sm text-ink-3">{loadError}</p>
                <button onClick={fetchSchedules} className="btn-secondary">다시 시도</button>
              </div>
            ) : view === 'week' ? (
              <WeekView
                days={weekDays}
                schedules={filteredSchedules}
                userGroups={userGroups}
                onDayClick={handleOpenListModal}
                onAddClick={handleOpenCreate}
                onScheduleClick={handleOpenDetail}
              />
            ) : view === 'list' ? (
              <ListView
                currentDate={currentDate}
                schedules={filteredSchedules}
                userGroups={userGroups}
                onAddClick={() => handleOpenCreate(isSameMonth(new Date(), currentDate) ? new Date() : startOfMonth(currentDate))}
                onScheduleClick={handleOpenDetail}
              />
            ) : (
              <>
                <div className="grid grid-cols-7 border-b border-line shrink-0">
                  {headers.map(({ label, dayIndex }) => (
                    <div key={label} className={`py-2 md:py-3 text-center text-xs ${dayIndex === 0 ? 'text-negative' : 'text-ink-3'}`}>{label}</div>
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
                        onScheduleClick={(e, schedule) => { e.stopPropagation(); handleOpenDetail(schedule); }}
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
        appointments={schedulesOnDay(filteredSchedules, parseISO(selectedDate))}
        groups={userGroups}
        onCreateNew={() => { setSelectedSchedule(null); setIsModalOpen(true); }}
        onAppointmentClick={handleOpenDetail}
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
  currentView: ScheduleView;
  onViewChange: (view: ScheduleView) => void;
}

function ViewSelector({ currentView, onViewChange }: ViewSelectorProps) {
  return (
    <div className="flex bg-raised rounded-[10px] p-1" role="group" aria-label="보기 전환">
      {(['month', 'week', 'list'] as const).map(v => (
        <button
          key={v}
          onClick={() => onViewChange(v)}
          aria-pressed={currentView === v}
          className={`px-2 md:px-3 h-7 text-sm whitespace-nowrap rounded-lg transition-colors duration-150 ease-out ${
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

function CalendarDay({ day, currentDate, schedules, userGroups, onDayClick, onScheduleClick }: CalendarDayProps) {
  const tf = useTimeFormat();
  // 여러 날 일정은 걸친 모든 날짜 칸에 나온다.
  const daySchedules = schedulesOnDay(schedules, day);
  const isCurrMonth = isSameMonth(day, currentDate);
  const isTodayDay = isToday(day);

  return (
    <div
      onClick={() => onDayClick(day)}
      className={`border-r border-b border-line p-1 md:p-2 min-h-0 min-w-0 flex flex-col gap-1 transition-colors duration-150 ease-out hover:bg-raised relative group cursor-pointer ${
        isTodayDay ? 'bg-accent-soft hover:bg-accent-soft' : isCurrMonth ? 'bg-surface' : 'bg-canvas'
      }`}
    >
      <div className="flex items-center justify-between shrink-0">
        <span className={`text-xs md:text-sm tabular-nums size-5 md:size-6 flex items-center justify-center rounded-full ${
          isTodayDay ? 'bg-accent text-white font-medium' : isCurrMonth ? 'text-ink' : 'text-ink-3 opacity-60'
        }`}>
          {format(day, 'd')}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDayClick(day);
          }}
          aria-label="이 날 일정 보기"
          className="hidden md:block opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-out text-ink-3 hover:text-ink hover:bg-surface p-1 rounded-md"
        >
          <Plus size={16} strokeWidth={1.5} />
        </button>
      </div>
      <div className={`flex-1 flex flex-col gap-0.5 overflow-hidden min-h-0 ${isCurrMonth ? '' : 'opacity-60'}`}>
        {daySchedules.slice(0, 3).map((s, idx) => (
          <div
            key={s.id}
            onClick={(e) => {
              e.stopPropagation();
              onScheduleClick(e, s);
            }}
            title={`${s.title} · ${formatScheduleRange(s, tf)}`}
            className={`${idx === 2 ? 'hidden md:flex' : 'flex'} items-center gap-1 md:gap-1.5 px-0.5 md:px-1.5 h-5 md:h-6 rounded-md text-[11px] md:text-xs text-ink hover:bg-surface cursor-pointer transition-colors duration-150 ease-out shrink-0 min-w-0`}
          >
            <span className={`size-1.5 rounded-full shrink-0 ${scheduleDotClass(s, userGroups)}`} />
            <span className="stamp shrink-0 hidden md:inline">{formatTimeOnDay(s, day, tf)}</span>
            <span className="truncate min-w-0">{s.title}</span>
          </div>
        ))}
        {daySchedules.length > 2 && (
          <div className="md:hidden text-[11px] text-ink-3 tabular-nums px-0.5 shrink-0">
            +{daySchedules.length - 2}
          </div>
        )}
        {daySchedules.length > 3 && (
          <div className="hidden md:block text-xs text-ink-3 tabular-nums px-1.5 shrink-0">
            +{daySchedules.length - 3}개 더
          </div>
        )}
      </div>
    </div>
  );
}

interface ScheduleRowProps {
  schedule: ScheduleResponse;
  userGroups: GroupResponse[];
  timeText: string;
  onClick: (schedule: ScheduleResponse) => void;
  compact?: boolean;
}

function ScheduleRow({ schedule, userGroups, timeText, onClick, compact }: ScheduleRowProps) {
  const group = schedule.groupId ? userGroups.find((g) => g.id === schedule.groupId) : undefined;
  return (
    <button
      type="button"
      onClick={() => onClick(schedule)}
      className="w-full text-left flex items-start gap-2.5 rounded-[10px] border border-line bg-surface px-3 py-2.5 hover:bg-raised transition-colors duration-150 ease-out"
    >
      <span className={`mt-1.5 size-1.5 rounded-full shrink-0 ${scheduleDotClass(schedule, userGroups)}`} />
      <span className="flex-1 min-w-0">
        <span className="stamp block">{timeText}</span>
        <span className={`block text-sm text-ink ${compact ? 'line-clamp-2 break-words' : 'truncate'}`}>{schedule.title}</span>
        {(schedule.location || group) && (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-xs text-ink-3 min-w-0">
            {group && <span className="truncate max-w-full">{group.name}</span>}
            {schedule.location && (
              <span className="flex items-center gap-1 min-w-0 max-w-full">
                <MapPin size={12} strokeWidth={1.5} className="shrink-0" />
                <span className="truncate">{schedule.location}</span>
              </span>
            )}
          </span>
        )}
      </span>
    </button>
  );
}

interface WeekViewProps {
  days: Date[];
  schedules: ScheduleResponse[];
  userGroups: GroupResponse[];
  onDayClick: (date: Date) => void;
  onAddClick: (date: Date) => void;
  onScheduleClick: (schedule: ScheduleResponse) => void;
}

function WeekView({ days, schedules, userGroups, onDayClick, onAddClick, onScheduleClick }: WeekViewProps) {
  const tf = useTimeFormat();
  return (
    <div className="flex-1 overflow-y-auto no-scrollbar">
      <div className="grid grid-cols-1 md:grid-cols-7 md:min-h-full md:divide-x divide-line">
        {days.map((day) => {
          const items = schedulesOnDay(schedules, day);
          const todayDay = isToday(day);
          return (
            <div key={day.toISOString()} className="flex flex-col border-b md:border-b-0 border-line min-w-0">
              <div className="flex items-center justify-between gap-2 px-3 py-2 md:sticky md:top-0 bg-surface border-b border-line">
                <button type="button" onClick={() => onDayClick(day)} className="flex items-baseline gap-1.5 md:flex-col md:items-start md:gap-0 text-left">
                  <span className={`text-xs ${day.getDay() === 0 ? 'text-negative' : 'text-ink-3'}`}>{format(day, 'EEE', { locale: ko })}</span>
                  <span className={`text-base md:text-lg tabular-nums ${todayDay ? 'text-accent font-semibold' : 'text-ink'}`}>{format(day, 'd')}</span>
                </button>
                <button type="button" onClick={() => onAddClick(day)} aria-label={`${format(day, 'M월 d일', { locale: ko })}에 일정 추가`} className="btn-ghost size-8 p-0 text-ink-3">
                  <Plus size={16} strokeWidth={1.5} />
                </button>
              </div>
              <div className={`flex flex-col gap-1.5 p-2 flex-1 ${todayDay ? 'bg-accent-soft' : ''}`}>
                {items.map((s) => (
                  <ScheduleRow key={s.id} schedule={s} userGroups={userGroups} timeText={formatTimeOnDay(s, day, tf)} onClick={onScheduleClick} compact />
                ))}
                {items.length === 0 && <p className="text-xs text-ink-3 px-1 py-1 md:hidden">일정 없음</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface ListViewProps {
  currentDate: Date;
  schedules: ScheduleResponse[];
  userGroups: GroupResponse[];
  onAddClick: () => void;
  onScheduleClick: (schedule: ScheduleResponse) => void;
}

function ListView({ currentDate, schedules, userGroups, onAddClick, onScheduleClick }: ListViewProps) {
  const tf = useTimeFormat();
  // 이 달에 걸친 일정을 날짜별로 묶는다. 지난달에 시작한 일정은 1일에 둔다.
  const groups = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const map = new Map<string, { day: Date; items: ScheduleResponse[] }>();
    schedules.forEach((s) => {
      const start = parseISO(s.startTime);
      const overlaps = eachDayOfInterval({ start: monthStart, end: monthEnd }).some((d) => scheduleCoversDay(s, d));
      if (!overlaps) return;
      const day = startOfDay(maxDate([start, monthStart]));
      const key = format(day, 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, { day, items: [] });
      map.get(key)!.items.push(s);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => ({ ...v, items: sortSchedules(v.items) }));
  }, [currentDate, schedules]);

  if (groups.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 px-6 text-center">
        <div className="size-10 rounded-full bg-raised flex items-center justify-center mb-1"><CalendarIcon size={18} strokeWidth={1.5} className="text-ink-3" /></div>
        <p className="text-sm font-medium text-ink">이 달에는 일정이 없어요</p>
        <p className="text-sm text-ink-3">새 일정을 추가하면 날짜순으로 모여요</p>
        <button onClick={onAddClick} className="btn-secondary mt-2"><Plus size={16} strokeWidth={1.5} />새 일정</button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-4 md:py-6 space-y-6">
        {groups.map(({ day, items }) => (
          <section key={day.toISOString()} className="space-y-2">
            <h3 className={`stamp ${isToday(day) ? '!text-accent' : ''}`}>
              {format(day, 'M.d EEE', { locale: ko })}{isToday(day) ? ' · 오늘' : ''}
            </h3>
            <div className="space-y-2">
              {items.map((s) => (
                <ScheduleRow key={s.id} schedule={s} userGroups={userGroups} timeText={formatScheduleRange(s, tf)} onClick={onScheduleClick} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
