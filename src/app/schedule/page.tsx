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
  ChevronDown,
  Calendar as CalendarIcon,
  User,
  Plus,
  Loader2,
  X
} from 'lucide-react';
import {
  format,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
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
import { GroupAvatar } from '@/components/groups/GroupIdentity';
import { getApiErrorMessage } from '@/lib/axios';
import { getThemeColors } from '@/lib/utils';
import { useScheduleWeather } from '@/hooks/useWeather';
import { WeatherIcon } from '@/components/Weather';
import type { WeatherAt } from '@/lib/weather';
import { Ribbon, Segmented, SideItem, SideLabel, EmptyState } from '@/components/ui';
import {
  type ScheduleView,
  formatScheduleRange,
  formatTimeOnDay,
  useTimeFormat,
  scheduleCoversDay,
  schedulesOnDay,
  sortSchedules,
  isMultiDaySchedule,
  useDefaultScheduleView,
  useWeekStartsOn,
  weekdayHeaders
} from '@/lib/schedule-utils';

/** 일정 띠 색: 모임 일정은 모임 색, 개인 일정은 중립색 */
const scheduleHex = (s: ScheduleResponse, groups: GroupResponse[]) => {
  if (!s.groupId) return 'var(--ink-3)';
  return getThemeColors(groups.find((g) => g.id === s.groupId)?.colorTheme).hex;
};

const VIEW_ITEMS: { key: ScheduleView; label: string }[] = [
  { key: 'month', label: '월' },
  { key: 'week', label: '주' },
  { key: 'list', label: '목록' },
];


/** 출발지를 아직 적지 않은 일정의 칸: 옅은 붉은 바탕 + 붉은 글자 */
const DEPARTURE_NEEDED_BOX = 'bg-negative-soft text-negative hover:bg-negative-soft/70';
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

  // 장소 좌표가 있는 일정의 시작 시각 날씨(10일 안)
  const weatherOf = useScheduleWeather(filteredSchedules);

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
        className="form-input h-9 w-full pl-9 pr-9"
      />
      <Search size={16} strokeWidth={1.5} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
      {searchQuery && (
        <button
          onClick={() => setSearchQuery('')}
          aria-label="검색어 지우기"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink transition-colors duration-150 ease-out"
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      )}
    </div>
  );

  const myCount = schedules.filter((s) => !s.groupId).length;

  return (
    <div className="h-[calc(100dvh-4rem)] lg:h-screen flex flex-col bg-canvas text-ink overflow-hidden">
      <Navbar />
      <div className="flex-1 flex overflow-hidden">

        {/* 왼쪽 메뉴: 보기 · 모임 */}
        <aside className="hidden lg:flex w-[264px] shrink-0 flex-col border-r border-line px-4 py-6 overflow-y-auto no-scrollbar">
          <SideLabel>보기</SideLabel>
          <div className="space-y-0.5">
            <SideItem label="전체 일정" icon={CalendarIcon} count={schedules.length} active={activeFilter.type === 'all'} onClick={() => setActiveFilter({ type: 'all' })} />
            <SideItem label="내 일정" icon={User} count={myCount} active={activeFilter.type === 'my'} onClick={() => setActiveFilter({ type: 'my' })} />
          </div>

          <SideLabel>모임</SideLabel>
          {userGroups.length > 0 ? (
            <div className="space-y-0.5">
              {userGroups.map((group) => (
                <SideItem
                  key={group.id}
                  label={
                    <span className="flex min-w-0 items-center gap-2.5">
                      <GroupAvatar name={group.name} src={group.profileImage} theme={group.colorTheme} size="xs" />
                      <span className="min-w-0 truncate">{group.name}</span>
                    </span>
                  }
                  count={schedules.filter(s => s.groupId === group.id).length}
                  active={activeFilter.type === 'group' && activeFilter.id === group.id}
                  onClick={() => setActiveFilter({ type: 'group', id: group.id })}
                />
              ))}
            </div>
          ) : (
            <p className="px-3 text-[13px] text-ink-3">참여 중인 모임이 없어요</p>
          )}
        </aside>

        {/* 달력 */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0 px-4 pt-4 pb-4 lg:px-8 lg:pt-6 lg:pb-6">
          {/* 머리: 제목 ‹ › 오늘 | 검색 · 보기 · 일정 추가 */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-3 shrink-0">
            <div className="flex items-center gap-1 min-w-0">
              <h1 className="font-display text-2xl leading-8 text-ink lg:text-[30px] lg:leading-9 whitespace-nowrap tabular-nums mr-2">
                {view === 'week' ? (
                  <>
                    {format(weekDays[0], 'M.d')} – {format(weekDays[6], isSameMonth(weekDays[0], weekDays[6]) ? 'd' : 'M.d')}
                  </>
                ) : (
                  <>
                    <span className="hidden sm:inline">{format(currentDate, 'yyyy년 ')}</span>
                    {format(currentDate, 'M월')}
                  </>
                )}
              </h1>
              <button onClick={goPrev} aria-label={view === 'week' ? '이전 주' : '이전 달'} className="btn-icon"><ChevronLeft size={18} strokeWidth={1.5} /></button>
              <button onClick={goNext} aria-label={view === 'week' ? '다음 주' : '다음 달'} className="btn-icon"><ChevronRight size={18} strokeWidth={1.5} /></button>
              <button onClick={goToToday} className="btn-secondary btn-sm ml-1 hidden sm:inline-flex lg:h-9 lg:px-3.5 lg:text-[13px]">오늘</button>
            </div>

            <div className="ml-auto flex items-center gap-2 lg:gap-3 shrink-0">
              {searchInput('hidden xl:block w-50')}
              <Segmented items={VIEW_ITEMS} active={view} onChange={setViewOverride} size="sm" ariaLabel="보기 전환" />
              <button
                onClick={() => handleOpenCreate(isSameMonth(new Date(), currentDate) ? new Date() : currentDate)}
                className="btn-primary h-8 px-3 lg:h-9 lg:px-3.5"
              >
                <Plus size={16} strokeWidth={1.5} />
                <span><span className="hidden sm:inline">일정 </span>추가</span>
              </button>
            </div>

            {/* 작은 화면: 오늘 · 검색 · 필터 */}
            <div className="w-full flex gap-2 xl:hidden">
              <button onClick={goToToday} className="btn-secondary shrink-0 sm:hidden">오늘</button>
              {searchInput('flex-1 min-w-0')}
              <div className="relative lg:hidden shrink-0 w-36">
                <select value={filterValue} onChange={(e) => onFilterSelect(e.target.value)} aria-label="일정 필터" className="form-input h-9 appearance-none pr-8 truncate">
                  <option value="all">전체 일정</option>
                  <option value="my">내 일정</option>
                  {userGroups.map((g) => <option key={g.id} value={`group:${g.id}`}>{g.name}</option>)}
                </select>
                <ChevronDown size={16} strokeWidth={1.5} className="text-ink-3 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* 보기 */}
          <div className="mt-4 lg:mt-5 flex-1 min-h-0 flex flex-col">
            {loading && schedules.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <Loader2 size={20} strokeWidth={1.5} className="animate-spin text-ink-3" />
                <p className="text-sm text-ink-3">일정을 불러오는 중이에요</p>
              </div>
            ) : loadError && schedules.length === 0 ? (
              <EmptyState
                className="flex-1"
                title="일정을 불러오지 못했어요"
                description={loadError}
                action={<button onClick={fetchSchedules} className="btn-secondary">다시 시도</button>}
              />
            ) : view === 'week' ? (
              <WeekView
                days={weekDays}
                schedules={filteredSchedules}
                userGroups={userGroups}
                weatherOf={weatherOf}
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
              <div className="card flex-1 min-h-0 flex flex-col overflow-hidden">
                <div className="grid grid-cols-7 border-b border-line shrink-0">
                  {headers.map(({ label }) => (
                    <div key={label} className="px-1.5 py-2 text-xs text-ink-3 md:px-3 md:py-2.5">{label}</div>
                  ))}
                </div>

                <div className="flex-1 min-h-0 overflow-hidden">
                  <div className="grid grid-cols-7 h-full" style={{ gridAutoRows: '1fr' }}>
                    {monthDays.map((day, i) => (
                      <CalendarDay
                        key={i}
                        day={day}
                        lastCol={i % 7 === 6}
                        currentDate={currentDate}
                        schedules={filteredSchedules}
                        userGroups={userGroups}
                        weatherOf={weatherOf}
                        onDayClick={handleOpenListModal}
                        onScheduleClick={(e, schedule) => { e.stopPropagation(); handleOpenDetail(schedule); }}
                      />
                    ))}
                  </div>
                </div>
              </div>
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

/** 오늘이면 주황 알약, 아니면 숫자만 */
function DayNumber({ day, muted, className = '' }: { day: Date; muted?: boolean; className?: string }) {
  if (isToday(day)) {
    return (
      <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-mark px-1.5 text-[13px] font-medium tabular-nums text-white ${className}`}>
        {format(day, 'd')}
      </span>
    );
  }
  return (
    <span className={`inline-flex h-6 items-center text-[13px] tabular-nums ${muted ? 'text-ink-3' : 'text-ink'} ${className}`}>
      {format(day, 'd')}
    </span>
  );
}

interface CalendarDayProps {
  day: Date;
  lastCol: boolean;
  currentDate: Date;
  schedules: ScheduleResponse[];
  userGroups: GroupResponse[];
  weatherOf: (s: ScheduleResponse) => WeatherAt | null;
  onDayClick: (date: Date) => void;
  onScheduleClick: (e: React.MouseEvent, schedule: ScheduleResponse) => void;
}

/** 그 날 시작하는 일정 가운데 날씨를 아는 첫 일정의 날씨(약속 장소·시각 기준). */
function dayWeather(items: ScheduleResponse[], day: Date, weatherOf: (s: ScheduleResponse) => WeatherAt | null) {
  for (const s of items) {
    const weather = isSameDay(parseISO(s.startTime), day) ? weatherOf(s) : null;
    if (weather) return weather;
  }
  return null;
}

function CalendarDay({ day, lastCol, currentDate, schedules, userGroups, weatherOf, onDayClick, onScheduleClick }: CalendarDayProps) {
  const tf = useTimeFormat();
  // 여러 날 일정은 걸친 모든 날짜 칸에 나온다.
  const daySchedules = schedulesOnDay(schedules, day);
  const weather = dayWeather(daySchedules, day, weatherOf);
  const isCurrMonth = isSameMonth(day, currentDate);

  return (
    <div
      onClick={() => onDayClick(day)}
      className={`${lastCol ? '' : 'border-r'} border-b border-line p-1 md:p-2 min-h-0 min-w-0 flex flex-col gap-1 relative group cursor-pointer transition-colors duration-150 ease-out ${
        isCurrMonth ? 'bg-surface hover:bg-canvas' : 'bg-canvas'
      }`}
    >
      <div className="flex items-center justify-between shrink-0">
        <DayNumber day={day} muted={!isCurrMonth} />
        <span className="flex items-center gap-0.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDayClick(day);
          }}
          aria-label="이 날 일정 보기"
          className="hidden md:inline-flex size-6 items-center justify-center rounded-md text-ink-3 opacity-0 group-hover:opacity-100 hover:bg-raised hover:text-ink transition-opacity duration-150 ease-out"
        >
          <Plus size={16} strokeWidth={1.5} />
        </button>
        {weather && <WeatherIcon weather={weather} className="md:mr-0.5" />}
        </span>
      </div>
      <div className={`flex-1 flex flex-col gap-1 overflow-hidden min-h-0 ${isCurrMonth ? '' : 'opacity-70'}`}>
        {daySchedules.slice(0, 3).map((s, idx) => (
          <div
            key={s.id}
            onClick={(e) => {
              e.stopPropagation();
              onScheduleClick(e, s);
            }}
            title={`${s.title} · ${formatScheduleRange(s, tf)}${s.departureNeeded ? ' · 출발지 미입력' : ''}`}
            className={`${idx === 2 ? 'hidden md:flex' : 'flex'} items-center gap-1 md:gap-1.5 h-5 md:h-6 px-1 md:px-1.5 rounded-md text-[11px] md:text-xs cursor-pointer transition-colors duration-150 ease-out shrink-0 min-w-0 ${s.departureNeeded ? DEPARTURE_NEEDED_BOX : 'bg-raised text-ink hover:bg-line'}`}
          >
            <Ribbon color={scheduleHex(s, userGroups)} className="h-3" />
            <span className="stamp shrink-0 hidden md:inline">{formatTimeOnDay(s, day, tf)}</span>
            <span className="truncate min-w-0">{s.title}</span>
          </div>
        ))}
        {daySchedules.length > 2 && (
          <div className="md:hidden text-[11px] text-ink-3 tabular-nums px-1 shrink-0">
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

interface WeekViewProps {
  days: Date[];
  schedules: ScheduleResponse[];
  userGroups: GroupResponse[];
  weatherOf: (s: ScheduleResponse) => WeatherAt | null;
  onDayClick: (date: Date) => void;
  onAddClick: (date: Date) => void;
  onScheduleClick: (schedule: ScheduleResponse) => void;
}

function WeekView({ days, schedules, userGroups, weatherOf, onDayClick, onAddClick, onScheduleClick }: WeekViewProps) {
  const tf = useTimeFormat();
  return (
    <div className="card flex-1 min-h-0 overflow-y-auto no-scrollbar">
      <div className="grid grid-cols-1 md:grid-cols-7 md:min-h-full md:divide-x divide-line">
        {days.map((day) => {
          const items = schedulesOnDay(schedules, day);
          const weather = dayWeather(items, day, weatherOf);
          return (
            <div key={day.toISOString()} className="flex flex-col border-b md:border-b-0 border-line last:border-b-0 min-w-0">
              <div className="flex items-center justify-between gap-2 px-3 py-2 md:sticky md:top-0 bg-surface border-b border-line">
                <button type="button" onClick={() => onDayClick(day)} className="flex items-center gap-1.5 text-left">
                  <span className="text-xs text-ink-3">{format(day, 'EEE', { locale: ko })}</span>
                  <DayNumber day={day} />
                  {weather && <WeatherIcon weather={weather} />}
                </button>
                <button type="button" onClick={() => onAddClick(day)} aria-label={`${format(day, 'M월 d일', { locale: ko })}에 일정 추가`} className="btn-icon text-ink-3">
                  <Plus size={16} strokeWidth={1.5} />
                </button>
              </div>
              <div className="flex flex-col gap-1.5 p-2 flex-1">
                {items.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onScheduleClick(s)}
                    title={`${s.title} · ${formatScheduleRange(s, tf)}${s.departureNeeded ? ' · 출발지 미입력' : ''}`}
                    className={`w-full text-left flex items-stretch gap-2 rounded-lg px-2 py-1.5 transition-colors duration-150 ease-out ${s.departureNeeded ? DEPARTURE_NEEDED_BOX : 'bg-raised hover:bg-line'}`}
                  >
                    <Ribbon color={scheduleHex(s, userGroups)} className="h-auto" />
                    <span className="flex-1 min-w-0">
                      <span className="stamp block">{formatTimeOnDay(s, day, tf)}</span>
                      <span className={`block text-[13px] line-clamp-2 break-words ${s.departureNeeded ? '' : 'text-ink'}`}>{s.title}</span>
                      {s.departureNeeded && <span className="block text-[11px]">출발지 미입력</span>}
                    </span>
                  </button>
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

/** 날짜 머리: 오늘 · 11.23 월 / 내일 · 11.24 화 / 11.26 목 */
function dayHeading(day: Date) {
  const base = format(day, 'M.d EEE', { locale: ko });
  if (isToday(day)) return `오늘 · ${base}`;
  if (isSameDay(day, addDays(new Date(), 1))) return `내일 · ${base}`;
  return base;
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
      <EmptyState
        className="flex-1"
        title="이 달에는 일정이 없어요"
        description="새 일정을 추가하면 날짜순으로 모여요"
        action={<button onClick={onAddClick} className="btn-secondary"><Plus size={16} strokeWidth={1.5} />일정 추가</button>}
      />
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
      <div className="max-w-3xl space-y-5 pb-4">
        {groups.map(({ day, items }) => (
          <section key={day.toISOString()}>
            <h3 className="font-display text-[15px] leading-6 text-ink-2 mb-2">{dayHeading(day)}</h3>
            <div className="space-y-2">
              {items.map((s) => {
                const group = s.groupId ? userGroups.find((g) => g.id === s.groupId) : undefined;
                const meta = [group ? group.name : '내 일정', s.location].filter(Boolean).join(' · ');
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onScheduleClick(s)}
                    className={`card w-full text-left flex items-center gap-4 px-4 py-3 min-h-16 transition-colors duration-150 ease-out ${s.departureNeeded ? 'bg-negative-soft' : 'hover:bg-raised'}`}
                  >
                    <span className="w-14 shrink-0 text-[13px] font-medium tabular-nums text-ink-2">{formatTimeOnDay(s, day, tf)}</span>
                    <Ribbon color={scheduleHex(s, userGroups)} className="h-9" />
                    <span className="flex-1 min-w-0">
                      <span className="block font-display text-base leading-6 text-ink truncate">{s.title}</span>
                      {s.departureNeeded && <span className="block text-[13px] text-negative">출발지 미입력</span>}
                      <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-ink-3">
                        {group && <GroupAvatar name={group.name} src={group.profileImage} theme={group.colorTheme} size="xs" />}
                        <span className="min-w-0 truncate">
                          {meta}
                          {isMultiDaySchedule(s) && <span className="tabular-nums"> · {formatScheduleRange(s, tf)}</span>}
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
