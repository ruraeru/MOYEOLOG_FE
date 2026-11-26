'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
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
  isThisYear,
  parseISO,
  startOfDay,
  max as maxDate
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { useSession } from 'next-auth/react';
import { scheduleApi, scheduleAlert, type ScheduleResponse } from '@/lib/schedule-api';
import { groupApi, type GroupResponse } from '@/lib/group-api';
import { GroupAvatar } from '@/components/groups/GroupIdentity';
import { getApiErrorMessage } from '@/lib/axios';
import { getThemeColors } from '@/lib/utils';
import { useVisiblePolling, LIST_POLL_MS } from '@/hooks/useVisiblePolling';
import { useLiveTopics } from '@/lib/live';
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


/** 내가 할 일이 남은 일정(출발지 미입력, 내가 만들었는데 장소 미정)의 칸: 옅은 붉은 바탕 + 붉은 글자 */
const DEPARTURE_NEEDED_BOX = 'bg-negative-soft text-negative hover:bg-negative-soft/70';

/** md(768px) 이상인지. 월 칸의 일정 줄 높이·탭 동작이 이 기준으로 바뀐다. 서버 렌더링은 모바일. */
const MD_QUERY = '(min-width: 768px)';
const subscribeMd = (cb: () => void) => {
  const mq = window.matchMedia(MD_QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};
function useIsMd() {
  return useSyncExternalStore(subscribeMd, () => window.matchMedia(MD_QUERY).matches, () => false);
}

/** 개인 일정의 출처: 내가 만든 것은 '내 일정', 남이 만들고 나를 넣은 것은 '○○님 일정' */
const personalLabel = (s: ScheduleResponse, myId?: string) =>
  !myId || s.authorId === myId ? '내 일정' : `${s.authorNickname}님 일정`;

const VIEW_PARAM = (v: string | null): ScheduleView | null => (v === 'month' || v === 'week' || v === 'list' ? v : null);

export default function SchedulePage() {
  const { data: session } = useSession();
  const accessToken = session?.user?.accessToken;
  const myId = session?.user?.id;
  // 주소의 ?view=&date= 로 보던 보기·날짜를 새로고침·뒤로 가기 뒤에도 잇는다
  const [currentDate, setCurrentDate] = useState(new Date());
  const [urlRead, setUrlRead] = useState(false);
  const [schedules, setSchedules] = useState<ScheduleResponse[]>([]);
  const [userGroups, setUserGroups] = useState<GroupResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 설정 화면의 '일정 기본 보기'·'주 시작 요일'
  const defaultView = useDefaultScheduleView();
  const weekStartsOn = useWeekStartsOn();
  const [viewOverride, setViewOverride] = useState<ScheduleView | null>(null);
  const view = viewOverride ?? defaultView;

  // 처음 한 번 주소에서 읽는다(서버 렌더링과 어긋나지 않게 마운트 뒤에)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const v = VIEW_PARAM(params.get('view'));
    const d = params.get('date');
    const parsed = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? parseISO(d) : null;
    // 주소(외부 상태)를 마운트 때 한 번 옮긴다
    if (v) setViewOverride(v);
    if (parsed && !Number.isNaN(parsed.getTime())) setCurrentDate(parsed);
    setUrlRead(true);
  }, []);

  // 보기·날짜가 바뀌면 주소에 적는다(기록을 늘리지 않게 replaceState). 오늘이면 date 를 뺀다.
  useEffect(() => {
    if (!urlRead) return;
    const params = new URLSearchParams(window.location.search);
    if (viewOverride) params.set('view', viewOverride); else params.delete('view');
    if (isToday(currentDate)) params.delete('date'); else params.set('date', format(currentDate, 'yyyy-MM-dd'));
    const qs = params.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
  }, [urlRead, viewOverride, currentDate]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleResponse | null>(null);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchQuery, setSearchQuery] = useState('');
  // 상세에서 수정을 열었는지. 수정을 저장하지 않고 닫으면 상세로 돌아간다.
  const editFromDetail = useRef(false);
  const editSaved = useRef(false);

  // Filtering state
  const [activeFilter, setActiveFilter] = useState<{ type: 'all' | 'my' | 'group', id?: string }>({ type: 'all' });

  /** silent: 자동 갱신. 로딩 표시를 띄우지 않고, 실패해도 보던 목록을 그대로 둔다(다음 주기에 다시 시도). */
  const fetchSchedules = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!session) return;
    try {
      if (!opts.silent) {
        setLoading(true);
        setLoadError(null);
      }
      const [scheduleData, groupData] = await Promise.all([
        scheduleApi.getAll(session),
        groupApi.getAll(session)
      ]);
      setSchedules(scheduleData);
      setUserGroups(groupData);
      setLoadError(null);
    } catch (error) {
      console.error('Failed to fetch schedule data:', error);
      if (!opts.silent) setLoadError(getApiErrorMessage(error));
    } finally {
      if (!opts.silent) setLoading(false);
    }
  // 세션 객체는 포커스 때마다 새로 만들어지므로 토큰이 바뀔 때만 다시 불러온다.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  // 다른 사람이 추가·수정한 일정을 새로고침 없이 반영한다
  useVisiblePolling(() => fetchSchedules({ silent: true }), !!session, LIST_POLL_MS);
  // 실시간 갱신: 일정이나 모임(필터에 쓰는 이름·색)이 바뀌면 바로 다시 불러온다
  useLiveTopics(['schedules', 'groups'], () => fetchSchedules({ silent: true }), !!session);

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
    editFromDetail.current = true;
    editSaved.current = false;
    setIsModalOpen(true);
  };

  const handleCloseEdit = () => {
    setIsModalOpen(false);
    if (editFromDetail.current && !editSaved.current && selectedSchedule) {
      setIsDetailOpen(true);
    } else {
      setSelectedSchedule(null);
    }
    editFromDetail.current = false;
    editSaved.current = false;
  };

  const goNext = () => setCurrentDate(view === 'week' ? addWeeks(currentDate, 1) : addMonths(currentDate, 1));
  const goPrev = () => setCurrentDate(view === 'week' ? subWeeks(currentDate, 1) : subMonths(currentDate, 1));
  const goToToday = () => {
    setCurrentDate(new Date());
    setSearchQuery('');
  };

  // 모바일: 달력을 좌우로 밀면 이전·다음
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = t ? { x: t.clientX, y: t.clientY } : null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    const t = e.changedTouches[0];
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 2) return;
    if (dx < 0) goNext(); else goPrev();
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

  /** 보기를 바꿀 때 기준 날짜: 주 → 월은 그 주(오늘이 있으면 오늘, 아니면 첫날), 다른 달의 월 → 주는 그 달 1일 */
  const changeView = (next: ScheduleView) => {
    const today = new Date();
    if (view === 'week' && next !== 'week') {
      setCurrentDate(weekDays.some((d) => isSameDay(d, today)) ? today : weekDays[0]);
    } else if (view !== 'week' && next === 'week' && !isSameMonth(today, currentDate)) {
      setCurrentDate(startOfMonth(currentDate));
    }
    setViewOverride(next);
  };

  /** '일정 추가' 기본 날짜: 보고 있는 범위에 오늘이 있으면 오늘, 아니면 그 주 첫날·그 달 1일 */
  const addDefaultDate = () => {
    const today = new Date();
    if (view === 'week') return weekDays.some((d) => isSameDay(d, today)) ? today : weekDays[0];
    return isSameMonth(today, currentDate) ? today : startOfMonth(currentDate);
  };

  const filterValue = activeFilter.type === 'group' ? `group:${activeFilter.id}` : activeFilter.type;
  const onFilterSelect = (value: string) => {
    if (value.startsWith('group:')) setActiveFilter({ type: 'group', id: value.slice(6) });
    else setActiveFilter({ type: value as 'all' | 'my' });
  };

  // 좁은 화면에서는 자리표시 글자가 잘리지 않게 짧게, 지우기 버튼이 없을 때는 오른쪽 여백을 줄인다
  const searchInput = (className: string, placeholder = '일정 검색') => (
    <div className={`relative ${className}`}>
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={placeholder}
        aria-label="일정 검색"
        className={`form-input h-9 w-full pl-9 ${searchQuery ? 'pr-9' : 'pr-3'}`}
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
            <SideItem label="개인 일정" icon={User} count={myCount} active={activeFilter.type === 'my'} onClick={() => setActiveFilter({ type: 'my' })} />
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
            {/* 모바일: ‹ › 는 32px 그대로 두고 손가락 닿는 곳만 44px 로(after), 서로 겹치지 않게 12px 띄운다 */}
            <div className="flex items-center gap-3 sm:gap-1 min-w-0">
              <h1 className="font-display text-2xl leading-8 text-ink lg:text-[30px] lg:leading-9 whitespace-nowrap tabular-nums mr-1 sm:mr-2">
                {view === 'week' ? (
                  <span className="text-xl sm:text-2xl lg:text-[30px]">
                    {format(weekDays[0], 'M.d')}<span className="sm:mx-1">–</span>{format(weekDays[6], isSameMonth(weekDays[0], weekDays[6]) ? 'd' : 'M.d')}
                  </span>
                ) : (
                  <>
                    <span className="hidden sm:inline">{format(currentDate, 'yyyy년 ')}</span>
                    {!isThisYear(currentDate) && <span className="sm:hidden text-base text-ink-3">{format(currentDate, 'yy년 ')}</span>}
                    {format(currentDate, 'M월')}
                  </>
                )}
              </h1>
              <button onClick={goPrev} aria-label={view === 'week' ? '이전 주' : '이전 달'} className="btn-icon relative after:absolute after:-inset-1.5 lg:after:hidden"><ChevronLeft size={18} strokeWidth={1.5} /></button>
              <button onClick={goNext} aria-label={view === 'week' ? '다음 주' : '다음 달'} className="btn-icon relative after:absolute after:-inset-1.5 lg:after:hidden"><ChevronRight size={18} strokeWidth={1.5} /></button>
              <button onClick={goToToday} className="btn-secondary btn-sm ml-1 hidden sm:inline-flex lg:h-9 lg:px-3.5 lg:text-[13px]">오늘</button>
            </div>

            <div className="ml-auto flex items-center gap-2 lg:gap-3 shrink-0">
              {searchInput('hidden xl:block w-50')}
              <Segmented items={VIEW_ITEMS} active={view} onChange={changeView} size="sm" ariaLabel="보기 전환" />
              <button
                onClick={() => handleOpenCreate(addDefaultDate())}
                className="btn-primary px-3 lg:px-3.5"
              >
                <Plus size={16} strokeWidth={1.5} />
                <span><span className="hidden sm:inline">일정 </span>추가</span>
              </button>
            </div>

            {/* 작은 화면: 오늘 · 검색 · 필터 */}
            <div className="w-full flex flex-wrap gap-2 xl:hidden">
              <button onClick={goToToday} className="btn-secondary shrink-0 sm:hidden">오늘</button>
              {searchInput('order-last basis-full min-[380px]:order-none min-[380px]:basis-0 flex-1 min-w-0', '검색')}
              <div className="relative lg:hidden flex-1 min-[380px]:flex-none min-[380px]:w-36">
                <select value={filterValue} onChange={(e) => onFilterSelect(e.target.value)} aria-label="일정 필터" className="form-input h-9 appearance-none pr-8 truncate">
                  <option value="all">전체 일정</option>
                  <option value="my">개인 일정</option>
                  {userGroups.map((g) => <option key={g.id} value={`group:${g.id}`}>{g.name}</option>)}
                </select>
                <ChevronDown size={16} strokeWidth={1.5} className="text-ink-3 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* 검색 결과가 하나도 없을 때 */}
          {searchQuery.trim() && filteredSchedules.length === 0 && schedules.length > 0 && (
            <p role="status" className="mt-3 flex shrink-0 items-center gap-2 text-[13px] text-ink-3">
              <span className="min-w-0 truncate">&lsquo;{searchQuery.trim()}&rsquo;에 맞는 일정이 없어요</span>
              <button onClick={() => setSearchQuery('')} className="btn-ghost btn-sm shrink-0">검색 지우기</button>
            </p>
          )}

          {/* 보기: 모바일은 좌우로 밀어 이전·다음 */}
          <div className="mt-4 lg:mt-5 flex-1 min-h-0 flex flex-col" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
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
                action={<button onClick={() => fetchSchedules()} className="btn-secondary">다시 시도</button>}
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
                myId={myId}
                onAddClick={() => handleOpenCreate(addDefaultDate())}
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
                        onAddClick={handleOpenCreate}
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

      <AppointmentModal isOpen={isModalOpen} onClose={handleCloseEdit} initialDate={selectedDate} onSuccess={() => { editSaved.current = true; fetchSchedules({ silent: true }); }} initialSchedule={selectedSchedule} />
      <AppointmentListModal
        isOpen={isListModalOpen}
        onClose={() => setIsListModalOpen(false)}
        date={selectedDate}
        appointments={schedulesOnDay(filteredSchedules, parseISO(selectedDate))}
        groups={userGroups}
        onCreateNew={() => { setSelectedSchedule(null); setIsModalOpen(true); }}
        onAppointmentClick={handleOpenDetail}
      />
      <AppointmentDetailModal isOpen={isDetailOpen} onClose={() => { setIsDetailOpen(false); setSelectedSchedule(null); }} schedule={selectedSchedule} onSuccess={() => fetchSchedules({ silent: true })} onEdit={handleEdit} />
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
  onAddClick: (date: Date) => void;
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

/** 월 칸 일정 줄 높이(h-5 / md:h-6), 줄 사이(gap-1), '+n' 줄 높이(leading-4) */
const ITEM_H = { mobile: 20, md: 24 } as const;
const ITEM_GAP = 4;
const MORE_H = 16;

/** 칸 높이 안에 들어가는 일정 수. 다 안 들어가면 '+n' 줄 자리를 남긴다. */
function visibleCount(total: number, height: number, itemH: number) {
  const fits = Math.max(0, Math.floor((height + ITEM_GAP) / (itemH + ITEM_GAP)));
  if (total <= fits) return total;
  return Math.max(0, Math.floor((height - MORE_H) / (itemH + ITEM_GAP)));
}

/** 여러 날 일정이 그 날 칸에서 이어지는 쪽의 모서리를 각지게 해 띠처럼 보이게 한다 */
function spanRounding(s: ScheduleResponse, day: Date) {
  if (!isMultiDaySchedule(s)) return 'rounded-md';
  const first = isSameDay(parseISO(s.startTime), day);
  const last = !schedulesOnDay([s], addDays(day, 1)).length;
  if (first) return 'rounded-l-md';
  if (last) return 'rounded-r-md';
  return '';
}

function CalendarDay({ day, lastCol, currentDate, schedules, userGroups, weatherOf, onDayClick, onAddClick, onScheduleClick }: CalendarDayProps) {
  const tf = useTimeFormat();
  const isMd = useIsMd();
  // 여러 날 일정은 걸친 모든 날짜 칸에 나온다.
  const daySchedules = schedulesOnDay(schedules, day);
  const weather = dayWeather(daySchedules, day, weatherOf);
  const isCurrMonth = isSameMonth(day, currentDate);

  // 칸 높이(창 크기·6줄 달)에 맞춰 보이는 개수를 정한다. 재기 전에는 2개.
  const listRef = useRef<HTMLDivElement>(null);
  const [listH, setListH] = useState<number | null>(null);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setListH(entry.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const shown = listH == null
    ? Math.min(daySchedules.length, 2)
    : visibleCount(daySchedules.length, listH, isMd ? ITEM_H.md : ITEM_H.mobile);
  const hidden = daySchedules.length - shown;
  const dateLabel = format(day, 'M월 d일 EEEE', { locale: ko });

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${dateLabel}, 일정 ${daySchedules.length}개`}
      onClick={() => onDayClick(day)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onDayClick(day);
        }
      }}
      className={`${lastCol ? '' : 'border-r'} border-b border-line p-1 md:p-2 min-h-0 min-w-0 flex flex-col gap-1 relative group cursor-pointer transition-colors duration-150 ease-out focus-visible:-outline-offset-2 ${
        isCurrMonth ? 'bg-surface hover:bg-canvas' : 'bg-canvas'
      }`}
    >
      <div className="flex items-center justify-between gap-0.5 shrink-0">
        <DayNumber day={day} muted={!isCurrMonth} />
        <span className="flex items-center gap-0.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddClick(day);
          }}
          aria-label={`${format(day, 'M월 d일', { locale: ko })}에 일정 추가`}
          className="hidden md:inline-flex size-6 items-center justify-center rounded-md text-ink-3 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-raised hover:text-ink transition-opacity duration-150 ease-out"
        >
          <Plus size={16} strokeWidth={1.5} />
        </button>
        {weather && <WeatherIcon weather={weather} size={isMd ? 16 : 14} className="md:mr-0.5" />}
        </span>
      </div>
      <div ref={listRef} className={`flex-1 flex flex-col gap-1 overflow-hidden min-h-0 ${isCurrMonth ? '' : 'opacity-70'}`}>
        {daySchedules.slice(0, shown).map((s) => {
          const alert = scheduleAlert(s);
          return (
            <button
              key={s.id}
              type="button"
              // 모바일은 일정 줄이 작아 칸 전체를 한 동작(그 날 목록)으로 둔다. 데스크톱은 바로 상세.
              tabIndex={isMd ? 0 : -1}
              onClick={(e) => {
                if (!isMd) return;
                e.stopPropagation();
                onScheduleClick(e, s);
              }}
              title={`${s.title} · ${formatScheduleRange(s, tf)}${alert ? ` · ${alert}` : ''}`}
              className={`flex items-center gap-0.5 md:gap-1.5 h-5 md:h-6 px-0.5 md:px-1.5 text-left text-[11px] md:text-xs cursor-pointer transition-colors duration-150 ease-out shrink-0 min-w-0 ${spanRounding(s, day)} ${alert ? DEPARTURE_NEEDED_BOX : 'bg-raised text-ink hover:bg-line'}`}
            >
              <Ribbon color={scheduleHex(s, userGroups)} className="h-3" />
              {/* 붉은 칸은 시각 자리에 까닭을 적는다 */}
              <span className={`shrink-0 hidden md:inline ${alert ? 'text-[11px]' : 'stamp'}`}>{alert ?? formatTimeOnDay(s, day, tf)}</span>
              {/* 모바일은 칸이 좁아 말줄임표 대신 들어가는 만큼 글자를 보여 준다 */}
              <span className="min-w-0 overflow-hidden whitespace-nowrap text-clip md:text-ellipsis">{s.title}</span>
            </button>
          );
        })}
        {hidden > 0 && (
          <div className="text-[11px] md:text-xs leading-4 text-ink-3 tabular-nums px-1 md:px-1.5 shrink-0">
            +{hidden}<span className="hidden md:inline">개 더</span>
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLDivElement>(null);
  const weekKey = format(days[0], 'yyyy-MM-dd');
  // 모바일은 날짜가 세로로 쌓이므로 이번 주를 열면 오늘로 스크롤한다
  useEffect(() => {
    const box = scrollRef.current;
    const today = todayRef.current;
    if (!box || !today) return;
    box.scrollTop = today.offsetTop; // 카드가 relative 라 카드 기준 위치
  }, [weekKey]);
  return (
    <div ref={scrollRef} className="card relative flex-1 min-h-0 overflow-y-auto no-scrollbar">
      <div className="grid grid-cols-1 md:grid-cols-7 md:min-h-full md:divide-x divide-line">
        {days.map((day) => {
          const items = schedulesOnDay(schedules, day);
          const weather = dayWeather(items, day, weatherOf);
          return (
            <div key={day.toISOString()} ref={isToday(day) ? todayRef : undefined} className="flex flex-col border-b md:border-b-0 border-line last:border-b-0 min-w-0">
              <div className="flex items-center justify-between gap-2 px-3 py-1 md:py-2 md:sticky md:top-0 bg-surface border-b border-line">
                <button type="button" onClick={() => onDayClick(day)} aria-label={`${format(day, 'M월 d일 EEEE', { locale: ko })} 일정 보기`} className="flex min-h-11 md:min-h-0 items-center gap-1.5 text-left">
                  <span className="text-xs text-ink-3">{format(day, 'EEE', { locale: ko })}</span>
                  <DayNumber day={day} />
                  {weather && <WeatherIcon weather={weather} />}
                </button>
                <button type="button" onClick={() => onAddClick(day)} aria-label={`${format(day, 'M월 d일', { locale: ko })}에 일정 추가`} className="btn-icon size-11 md:size-8 text-ink-3">
                  <Plus size={16} strokeWidth={1.5} />
                </button>
              </div>
              <div className="flex flex-col gap-1.5 p-2 flex-1">
                {items.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onScheduleClick(s)}
                    title={`${s.title} · ${formatScheduleRange(s, tf)}${scheduleAlert(s) ? ` · ${scheduleAlert(s)}` : ''}`}
                    className={`w-full text-left flex items-stretch gap-2 rounded-lg px-2 py-1.5 transition-colors duration-150 ease-out ${scheduleAlert(s) ? DEPARTURE_NEEDED_BOX : 'bg-raised hover:bg-line'}`}
                  >
                    <Ribbon color={scheduleHex(s, userGroups)} className="h-auto" />
                    <span className="flex-1 min-w-0">
                      <span className="stamp block">{formatTimeOnDay(s, day, tf)}</span>
                      {/* line-clamp 는 display 를 직접 정하므로 block 을 같이 쓰지 않는다. 한글은 단어 단위로 줄바꿈 */}
                      <span className={`text-[13px] line-clamp-2 break-keep [overflow-wrap:anywhere] ${scheduleAlert(s) ? '' : 'text-ink'}`}>{s.title}</span>
                      {scheduleAlert(s) && <span className="block text-[11px]">{scheduleAlert(s)}</span>}
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
  myId?: string;
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

function ListView({ currentDate, schedules, userGroups, myId, onAddClick, onScheduleClick }: ListViewProps) {
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

  // 이번 달을 열면 오늘(없으면 오늘 뒤 첫 날) 묶음으로 한 번 스크롤한다. 자동 갱신 때는 다시 움직이지 않는다.
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrolledFor = useRef<string | null>(null);
  const monthKey = format(currentDate, 'yyyy-MM');
  const todayKey = useMemo(() => {
    const today = startOfDay(new Date());
    if (!isSameMonth(today, currentDate)) return null;
    const target = groups.find((g) => g.day >= today);
    return target ? format(target.day, 'yyyy-MM-dd') : null;
  }, [groups, currentDate]);
  useEffect(() => {
    const box = scrollRef.current;
    if (!box || !todayKey || scrolledFor.current === monthKey) return;
    const el = box.querySelector<HTMLElement>(`[data-day="${todayKey}"]`);
    if (!el) return;
    box.scrollTop = el.offsetTop; // 스크롤 상자가 relative 라 상자 기준 위치
    scrolledFor.current = monthKey;
  }, [todayKey, monthKey]);

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
    <div ref={scrollRef} className="relative flex-1 min-h-0 overflow-y-auto no-scrollbar">
      <div className="space-y-5 pb-4">
        {groups.map(({ day, items }) => (
          <section key={day.toISOString()} data-day={format(day, 'yyyy-MM-dd')}>
            <h3 className="font-display text-[15px] leading-6 text-ink-2 mb-2">{dayHeading(day)}</h3>
            <div className="space-y-2">
              {items.map((s) => {
                const group = s.groupId ? userGroups.find((g) => g.id === s.groupId) : undefined;
                const meta = [group ? group.name : s.groupId ? '모임' : personalLabel(s, myId), s.location].filter(Boolean).join(' · ');
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onScheduleClick(s)}
                    className={`card w-full text-left flex items-center gap-4 px-4 py-3 min-h-16 transition-colors duration-150 ease-out ${scheduleAlert(s) ? 'bg-negative-soft' : 'hover:bg-raised'}`}
                  >
                    <span className="w-14 shrink-0 text-[13px] font-medium tabular-nums text-ink-2">{formatTimeOnDay(s, day, tf)}</span>
                    <Ribbon color={scheduleHex(s, userGroups)} className="h-9" />
                    <span className="flex-1 min-w-0">
                      <span className="block font-display text-base leading-6 text-ink truncate">{s.title}</span>
                      {scheduleAlert(s) && <span className="block text-[13px] text-negative">{scheduleAlert(s)}</span>}
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
