'use client';

import React, { useState, useSyncExternalStore } from 'react';
import { useSession } from 'next-auth/react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, format, isSameDay, parseISO, startOfDay, startOfWeek } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ImageWithFallback from '@/components/ImageWithFallback';
import { Plus, Loader2, CalendarDays, FileText, Users } from 'lucide-react';
import Navbar from '@/components/Navbar';
import AppointmentModal from '@/components/AppointmentModal';
import AppointmentListModal from '@/components/AppointmentListModal';
import AppointmentDetailModal from '@/components/AppointmentDetailModal';
import MemoCreateModal from '@/components/MemoCreateModal';
import GroupCreateModal from '@/components/GroupCreateModal';
import { PageHeader, Ribbon, Dot, EmptyState } from '@/components/ui';
import { memoApi, type MemoResponse } from '@/lib/memo-api';
import { scheduleApi, type ScheduleResponse } from '@/lib/schedule-api';
import { groupApi, type GroupResponse } from '@/lib/group-api';
import { GroupAvatar } from '@/components/groups/GroupIdentity';
import { useVisiblePolling } from '@/hooks/useVisiblePolling';
import { stripMarkdown, initialOf, getThemeColors, getFileUrl } from '@/lib/utils';
import { getApiErrorMessage } from '@/lib/axios';
import { useScheduleWeather } from '@/hooks/useWeather';
import { WeatherLine } from '@/components/Weather';
import type { WeatherAt } from '@/lib/weather';
import { formatTimeOnDay, schedulesOnDay, sortSchedules, useTimeFormat, useWeekStartsOn } from '@/lib/schedule-utils';

const emptySubscribe = () => () => { };

/** 개인 일정·메모는 중립색 띠 */
const NEUTRAL_RIBBON = 'var(--line-strong)';

const groupHex = (groupId: string | undefined, groups: GroupResponse[]) => {
  if (!groupId) return NEUTRAL_RIBBON;
  return getThemeColors(groups.find((g) => g.id === groupId)?.colorTheme).hex;
};

/** 오늘·내일은 말로, 나머지는 요일 이름 */
const dayLabel = (day: Date, today: Date) => {
  if (isSameDay(day, today)) return '오늘';
  if (isSameDay(day, addDays(today, 1))) return '내일';
  return format(day, 'EEEE', { locale: ko });
};

// 다른 사람이 바꾼 일정·메모·모임을 새로고침 없이 반영한다: 화면이 보이는 동안 15초마다, 탭으로 돌아오면(SSE 가 3초 안에 못 붙으면) 바로.
// 실시간 갱신(SSE)이 붙어 있으면 바뀔 때 바로 다시 불러오고(components/LiveEvents.tsx 의 쿼리 무효화) 폴링은 60초 안전망으로 남는다
const POLL_MS = 15000;

/** 홈 일정 기록에 보여 줄 날 수(오늘 포함) */
const UPCOMING_DAYS = 7;

/** 최근 메모 정렬 기준: 고친 시각, 없으면 쓴 시각 */
const memoTime = (m: MemoResponse) => {
  const t = parseISO(m.updatedAt || m.createdAt).getTime();
  return Number.isNaN(t) ? 0 : t;
};

export default function HomePage() {
  const tf = useTimeFormat();
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  // 세션을 받기 전에는 쿼리가 꺼져 있어 isLoading 이 false 다. 그동안 빈 상태 대신 로딩을 보인다
  const sessionPending = sessionStatus === 'loading';

  const queryClient = useQueryClient();

  const { data: memoData, isLoading: memosLoading, error: memosError, refetch: refetchMemos } = useQuery({
    queryKey: ['memos'],
    queryFn: () => memoApi.getAll(session!),
    enabled: !!session
  });

  const { data: scheduleData, isLoading: schedulesLoading, error: schedulesError, refetch: refetchSchedules } = useQuery({
    queryKey: ['schedules'],
    queryFn: () => scheduleApi.getAll(session!),
    enabled: !!session
  });

  const { data: groupData, isLoading: groupsLoading, error: groupsError, refetch: refetchGroups } = useQuery({
    queryKey: ['groups'],
    queryFn: () => groupApi.getAll(session!),
    enabled: !!session
  });

  // 최근 메모 = 내 메모 + 공유받은 메모 + 내 모임의 메모, 고친 시각 최신순(고정과 관계없이)
  const { data: sharedMemoData } = useQuery({
    queryKey: ['memos', 'shared'],
    queryFn: () => memoApi.getSharedMemos(session!),
    enabled: !!session
  });
  const groupMemoQueries = useQueries({
    queries: (groupData ?? []).map((g) => ({
      queryKey: ['memos', 'group', g.id],
      queryFn: () => memoApi.getGroupMemos(g.id, session!),
      enabled: !!session
    }))
  });
  const memoById = new Map<string, MemoResponse>();
  for (const list of [memoData, sharedMemoData, ...groupMemoQueries.map((q) => q.data)]) {
    for (const m of list ?? []) if (!memoById.has(m.id)) memoById.set(m.id, m);
  }
  const allMemos = [...memoById.values()].sort((a, b) => memoTime(b) - memoTime(a));
  const recentMemos = allMemos.slice(0, 5);
  const schedules = scheduleData || [];
  const weatherOf = useScheduleWeather(schedules);
  const userGroups = groupData || [];
  const loading = sessionPending || memosLoading || schedulesLoading || groupsLoading;
  const scheduleListLoading = sessionPending || schedulesLoading;
  const weekStartsOn = useWeekStartsOn();

  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: ['memos'] });
    queryClient.invalidateQueries({ queryKey: ['schedules'] });
    queryClient.invalidateQueries({ queryKey: ['groups'] });
  };
  useVisiblePolling(refreshData, !!session, POLL_MS);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  // 그날 목록 창에서 '일정 추가'로 연 새 일정 창을 닫으면 목록 창으로 돌아간다
  const [returnToList, setReturnToList] = useState(false);
  const [isMemoCreateOpen, setIsMemoCreateOpen] = useState(false);
  const [isGroupCreateOpen, setIsGroupCreateOpen] = useState(false);

  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleResponse | null>(null);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // 날짜는 브라우저 시간대로 그린다(서버 렌더링과 어긋나지 않게 마운트 뒤에만)
  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const handleOpenCreateModal = (date: Date) => {
    setReturnToList(false);
    setSelectedDate(format(date, 'yyyy-MM-dd'));
    setSelectedSchedule(null);
    setIsModalOpen(true);
  };

  const handleEdit = (schedule: ScheduleResponse) => {
    setReturnToList(false);
    setIsDetailModalOpen(false);
    setSelectedSchedule(schedule);
    setIsModalOpen(true);
  };

  const handleOpenListModal = (date: Date) => {
    setSelectedDate(format(date, 'yyyy-MM-dd'));
    setIsListModalOpen(true);
  };

  const handleScheduleClick = (schedule: ScheduleResponse) => {
    setIsListModalOpen(false);
    setSelectedSchedule(schedule);
    setIsDetailModalOpen(true);
  };

  const handleMemoClick = (memoId: string) => {
    router.push(`/memo/${memoId}`);
  };

  // 이번 주 7칸, 그리고 오늘부터 7일(주 끝에서 끊지 않는다)의 일정 기록
  const now = isMounted ? new Date() : null;
  const today = now ? startOfDay(now) : null;
  const weekDays = today
    ? Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(today, { weekStartsOn }), i))
    : [];
  const weekSchedules = weekDays.map((day) => ({ day, items: schedulesOnDay(schedules, day) }));
  const weekCount = new Set(weekSchedules.flatMap((d) => d.items.map((s) => s.id))).size;
  const todayCount = today ? schedulesOnDay(schedules, today).length : 0;
  const upcoming = today
    ? Array.from({ length: UPCOMING_DAYS }, (_, i) => addDays(today, i))
      .map((day) => ({ day, items: schedulesOnDay(schedules, day) }))
      .filter((d) => d.items.length > 0)
    : [];

  // 세션이 없으면(만료·기기 시계 어긋남 등) 빈 상태 대신 다시 로그인하게 한다
  if (sessionStatus === 'unauthenticated') {
    return (
      <div className="min-h-screen flex flex-col bg-canvas text-ink font-sans">
        <Navbar />
        <main className="mx-auto w-full max-w-[560px] flex-1 px-4 pt-16">
          <div className="card">
            <EmptyState
              title="로그인이 풀렸어요"
              description="다시 로그인하면 일정과 메모를 볼 수 있어요"
              action={<Link href={`/?callbackUrl=${encodeURIComponent('/home')}`} className="btn-primary">다시 로그인</Link>}
            />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-ink font-sans">
      <Navbar />
      <main className="mx-auto w-full max-w-[1400px] flex-1 grid content-start grid-cols-1 gap-8 px-4 pt-5 pb-24 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8 lg:px-8 lg:pt-8 lg:pb-8 xl:grid-cols-[minmax(0,1fr)_464px]">

        {/* 왼쪽: 날짜 머리 + 이번 주 + 일정 기록 */}
        <section className="flex flex-col gap-5 lg:rounded-xl lg:border lg:border-line lg:bg-surface lg:p-8 lg:self-start">
          <PageHeader
            title={today ? format(today, 'M월 d일 EEEE', { locale: ko }) : '오늘'}
            description={today && !scheduleListLoading ? `이번 주 일정 ${weekCount}개 · 오늘 ${todayCount}개` : '일정을 불러오는 중'}
            actions={
              <button onClick={() => handleOpenCreateModal(today ?? new Date())} className="btn-primary">
                <Plus size={16} strokeWidth={1.5} aria-hidden />
                일정 추가
              </button>
            }
          />

          {schedulesError && !scheduleData && (
            <div className="flex items-center justify-between gap-3 rounded-[10px] bg-negative-soft px-3 py-2">
              <p className="text-sm text-negative min-w-0">일정을 불러오지 못했어요. {getApiErrorMessage(schedulesError)}</p>
              <button onClick={() => refetchSchedules()} className="btn-secondary btn-sm shrink-0">다시 시도</button>
            </div>
          )}

          {!today ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={18} strokeWidth={1.5} className="animate-spin text-ink-3" />
            </div>
          ) : (
            <>
              {/* 이번 주 7칸. 누르면 그 날 일정 목록 */}
              <div className="grid grid-cols-7 gap-0.5 sm:gap-2">
                {weekSchedules.map(({ day, items }) => {
                  const isToday = isSameDay(day, today);
                  // 그날 일정의 색(모임 색·개인 중립색)을 겹치지 않게 3개까지
                  const dotColors = [...new Set(items.map((s) => groupHex(s.groupId, userGroups)))].slice(0, 3);
                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      onClick={() => handleOpenListModal(day)}
                      aria-label={`${format(day, 'M월 d일 EEEE', { locale: ko })}, 일정 ${items.length}개`}
                      aria-current={isToday ? 'date' : undefined}
                      className={`flex h-16 flex-col items-center justify-center gap-0.5 rounded-[10px] transition-colors lg:h-[72px] ${
                        isToday
                          ? 'bg-accent-soft text-accent'
                          : 'border border-line bg-surface text-ink hover:bg-raised lg:border-0 lg:bg-raised lg:hover:bg-line'
                      }`}
                    >
                      <span className={`text-xs ${isToday ? 'text-accent' : 'text-ink-3'}`}>{format(day, 'EEEEE', { locale: ko })}</span>
                      <span className="text-lg leading-6 tabular-nums">{format(day, 'd')}</span>
                      {dotColors.length > 0 ? (
                        <span aria-hidden className="flex h-1.5 items-center gap-0.5">
                          {dotColors.map((c) => <Dot key={c} color={c} />)}
                        </span>
                      ) : <span aria-hidden className="size-1.5" />}
                    </button>
                  );
                })}
              </div>

              {/* 일정 기록 */}
              {scheduleListLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={18} strokeWidth={1.5} className="animate-spin text-ink-3" />
                </div>
              ) : upcoming.length === 0 ? (
                <div className="rounded-xl border border-line bg-surface lg:border-0">
                  <EmptyState
                    icon={CalendarDays}
                    title="앞으로 7일 동안 일정이 없어요"
                    description="일정을 추가하면 여기에 날짜순으로 모여요"
                  />
                </div>
              ) : (
                <ul className="divide-y divide-line rounded-xl border border-line bg-surface px-4 lg:rounded-none lg:border-0 lg:border-y lg:px-0">
                  {upcoming.flatMap(({ day, items }) =>
                    items.map((s, i) => (
                      <li key={`${day.toISOString()}-${s.id}`}>
                        {/* 좁은 화면: 날이 바뀔 때 날짜 머리 */}
                        {i === 0 && (
                          <p className="pt-3 font-display text-[13px] leading-5 text-ink-2 lg:hidden">
                            {dayLabel(day, today)} <span className="stamp ml-1 text-ink-3">{format(day, 'M.d EEE', { locale: ko })}</span>
                          </p>
                        )}
                        <ScheduleRow
                          schedule={s}
                          day={day}
                          label={i === 0 ? dayLabel(day, today) : ''}
                          time={formatTimeOnDay(s, day, tf)}
                          ended={!!now && isScheduleEnded(s, now)}
                          wideTime={tf !== 'HH:mm'}
                          weather={isSameDay(parseISO(s.startTime), day) ? weatherOf(s) : null}
                          groups={userGroups}
                          onClick={() => handleScheduleClick(s)}
                        />
                      </li>
                    ))
                  )}
                </ul>
              )}
            </>
          )}
        </section>

        {/* 오른쪽: 최근 메모 · 내 모임 */}
        <div className="flex flex-col gap-8">
          <section className="flex flex-col gap-3">
            <SectionHead title="최근 메모" href="/memo" count={loading ? undefined : allMemos.length} />
            {loading ? (
              <LoadingCard />
            ) : memosError && !memoData ? (
              <LoadError message={getApiErrorMessage(memosError)} onRetry={() => refetchMemos()} />
            ) : recentMemos.length === 0 ? (
              <div className="card">
                <EmptyState
                  icon={FileText}
                  title="아직 메모가 없어요"
                  description="새 메모를 쓰면 여기에 모여요"
                  action={<button type="button" onClick={() => setIsMemoCreateOpen(true)} className="btn-secondary">메모 쓰기</button>}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {recentMemos.map((memo, i) => (
                  <MemoCard
                    key={memo.id}
                    memo={memo}
                    group={userGroups.find((g) => g.id === memo.groupId)}
                    ribbon={groupHex(memo.groupId, userGroups)}
                    author={memo.authorNickname || session?.user?.name || '나'}
                    tf={tf}
                    today={today}
                    className={i >= 3 ? 'max-lg:hidden' : ''}
                    onClick={() => handleMemoClick(memo.id)}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <SectionHead title="내 모임" href="/groups" count={loading ? undefined : userGroups.length} />
            {loading ? (
              <LoadingCard />
            ) : groupsError && !groupData ? (
              <LoadError message={getApiErrorMessage(groupsError)} onRetry={() => refetchGroups()} />
            ) : userGroups.length === 0 ? (
              <div className="card">
                <EmptyState
                  icon={Users}
                  title="참여 중인 모임이 없어요"
                  description="친구를 초대해 모임을 만들어 보세요"
                  action={<button type="button" onClick={() => setIsGroupCreateOpen(true)} className="btn-secondary">모임 만들기</button>}
                />
              </div>
            ) : (
              <ul className="card divide-y divide-line overflow-hidden">
                {userGroups.map((group) => (
                  <li key={group.id}>
                    <GroupRow
                      group={group}
                      next={now ? nextScheduleOf(group.id, schedules, now) : undefined}
                      tf={tf}
                      today={today}
                      onClick={() => router.push(`/groups/${group.id}`)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

      </main>

      <AppointmentModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedSchedule(null);
          if (returnToList) { setReturnToList(false); setIsListModalOpen(true); }
        }}
        initialDate={selectedDate}
        onSuccess={refreshData}
        initialSchedule={selectedSchedule}
      />

      <AppointmentListModal
        isOpen={isListModalOpen}
        onClose={() => setIsListModalOpen(false)}
        date={selectedDate}
        appointments={schedulesOnDay(schedules, parseISO(selectedDate))}
        groups={userGroups}
        onCreateNew={() => { setSelectedSchedule(null); setReturnToList(true); setIsModalOpen(true); }}
        onAppointmentClick={handleScheduleClick}
      />

      <AppointmentDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => { setIsDetailModalOpen(false); setSelectedSchedule(null); }}
        schedule={selectedSchedule}
        onSuccess={refreshData}
        onEdit={handleEdit}
      />

      <MemoCreateModal
        isOpen={isMemoCreateOpen}
        onClose={() => setIsMemoCreateOpen(false)}
        userId={session?.user?.id ?? ''}
        onSuccess={refreshData}
      />

      <GroupCreateModal
        isOpen={isGroupCreateOpen}
        onClose={() => setIsGroupCreateOpen(false)}
        onSuccess={refreshData}
        onOpenGroup={(groupId) => router.push(`/groups/${groupId}`)}
      />
    </div>
  );
}

/** 끝난 일정인지(끝 시각이 없으면 시작 시각 기준) */
function isScheduleEnded(s: ScheduleResponse, now: Date) {
  const end = parseISO(s.endTime || s.startTime);
  return !Number.isNaN(end.getTime()) && end < now;
}

/** 모임의 다음 일정(아직 끝나지 않은 것 중 가장 이른 것) */
function nextScheduleOf(groupId: string, schedules: ScheduleResponse[], now: Date) {
  return sortSchedules(schedules.filter((s) => s.groupId === groupId && !isScheduleEnded(s, now)))[0];
}

/** '오늘 19:00' · '내일 19:00' · '12.10 목 19:00' */
function formatWhen(iso: string, today: Date | null, tf: string) {
  const d = parseISO(iso);
  if (Number.isNaN(d.getTime())) return '';
  const time = format(d, tf, { locale: ko });
  if (today && isSameDay(d, today)) return `오늘 ${time}`;
  if (today && isSameDay(d, addDays(today, 1))) return `내일 ${time}`;
  return format(d, `M.d EEE ${tf}`, { locale: ko });
}

function SectionHead({ title, href, count }: { title: string; href: string; count?: number }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="flex items-baseline gap-2 font-display text-lg leading-7 text-ink">
        {title}
        {count != null && count > 0 && <span className="stamp text-sm text-ink-3">{count}</span>}
      </h2>
      {/* 글자는 작게 두고 누르는 영역만 44px 로 넓힌다 */}
      <Link href={href} className="-my-3 -mr-2 inline-flex min-h-11 items-center px-2 text-[13px] text-ink-3 transition-colors hover:text-ink">전체 보기</Link>
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="card flex items-center justify-center gap-2 py-12">
      <Loader2 size={16} strokeWidth={1.5} className="animate-spin text-ink-3" />
      <span className="text-sm text-ink-3">불러오는 중</span>
    </div>
  );
}

function ScheduleRow({
  schedule,
  day,
  label,
  time,
  weather,
  groups,
  ended = false,
  wideTime = false,
  onClick,
}: {
  schedule: ScheduleResponse;
  day: Date;
  label: string;
  time: string;
  weather: WeatherAt | null;
  groups: GroupResponse[];
  /** 이미 끝난 일정: 흐리게 + '지남' */
  ended?: boolean;
  /** 12시간 표시('오후 10:30')면 시각 칸을 넓힌다 */
  wideTime?: boolean;
  onClick: () => void;
}) {
  const group = schedule.groupId ? groups.find((g) => g.id === schedule.groupId) : undefined;
  const groupName = schedule.groupId ? group?.name : '내 일정';
  const people = schedule.participants ?? [];
  // 참여자는 이름으로(첫 글자 아바타만으로는 누군지 모른다). 좁은 화면은 아바타가 없어 이 글이 유일한 표시다
  const peopleText = people.length === 0 ? '' : people.length === 1 ? people[0].nickname : `${people[0].nickname} 외 ${people.length - 1}명`;
  const meta = [groupName, schedule.location, peopleText].filter(Boolean).join(' · ');

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-start gap-3 py-3 text-left lg:gap-4 lg:py-3.5 ${ended ? 'opacity-60' : ''}`}
    >
      {/* 넓은 화면: 날짜 칸 */}
      <div className="hidden w-24 shrink-0 lg:block">
        {label && (
          <>
            <p className="font-display text-[15px] leading-5 text-ink">{label}</p>
            <p className="stamp mt-0.5">{format(day, 'M.d EEE', { locale: ko })}</p>
          </>
        )}
      </div>
      {/* 시각 (좁은 화면의 날짜는 줄 위 날짜 머리에) */}
      <div className={`shrink-0 ${wideTime ? 'w-[4.5rem] lg:w-20' : 'w-14 lg:w-16'}`}>
        <p className="whitespace-nowrap text-sm leading-5 tabular-nums text-ink-2">{time}</p>
        {ended && <p className="mt-0.5 text-xs text-ink-3">지남</p>}
      </div>
      <Ribbon color={groupHex(schedule.groupId, groups)} className="self-stretch" />
      <div className="min-w-0 flex-1">
        <p className={`truncate font-display text-[15px] leading-5 group-hover:text-accent ${ended ? 'text-ink-2' : 'text-ink'}`}>{schedule.title}</p>
        {/* 날씨는 메타 줄 끝에 붙인다(따로 줄을 두면 날씨 있는 줄만 높아진다). 좁으면 메타가 먼저 줄어든다 */}
        {(meta || weather) && (
          <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[13px] text-ink-3">
            {meta && group && <GroupAvatar name={group.name} src={group.profileImage} theme={group.colorTheme} size="xs" />}
            {meta && <span className="min-w-0 truncate">{meta}</span>}
            {meta && weather && <span aria-hidden className="shrink-0">·</span>}
            {weather && <WeatherLine weather={weather} className="shrink-0 whitespace-nowrap" />}
          </p>
        )}
      </div>
      {people.length > 0 && (
        <div className="hidden shrink-0 -space-x-1.5 sm:flex" aria-label={`참여자 ${people.length}명`}>
          {people.slice(0, 4).map((p) => (
            <Avatar key={p.id} name={p.nickname} image={p.profileImage} />
          ))}
          {people.length > 4 && (
            <span className="relative flex size-6 items-center justify-center rounded-full border-2 border-surface bg-raised text-[11px] tabular-nums text-ink-2">
              +{people.length - 4}
            </span>
          )}
        </div>
      )}
    </button>
  );
}

function Avatar({ name, image }: { name: string; image?: string }) {
  const src = getFileUrl(image);
  return (
    <span title={name} className="relative flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-surface bg-raised text-[11px] text-ink-2">
      {src ? (
        <ImageWithFallback src={src} alt={name} fill containerClassName="w-full h-full" className="object-cover" fallbackIcon={initialOf(name)} />
      ) : (
        initialOf(name)
      )}
    </span>
  );
}

function MemoCard({
  memo,
  group,
  ribbon,
  author,
  tf,
  today,
  className = '',
  onClick,
}: {
  memo: MemoResponse;
  group?: GroupResponse;
  ribbon: string;
  author: string;
  tf: string;
  today: Date | null;
  className?: string;
  onClick: () => void;
}) {
  // 정렬 기준과 같은 시각(고친 시각). 오늘 것은 시각까지
  const edited = parseISO(memo.updatedAt || memo.createdAt);
  const description = stripMarkdown(memo.content);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`card flex w-full gap-3 px-4 py-4 text-left transition-colors hover:bg-raised lg:px-5 ${className}`}
    >
      <Ribbon color={ribbon} className="self-stretch" />
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-1 font-display text-base leading-6 text-ink">{memo.title}</h3>
        {description && <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-2">{description}</p>}
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-ink-3">
            {group && <GroupAvatar name={group.name} src={group.profileImage} theme={group.colorTheme} size="xs" />}
            <span className="min-w-0 truncate">{[group?.name, author].filter(Boolean).join(' · ')}</span>
          </span>
          {!Number.isNaN(edited.getTime()) && (
            <span className="stamp shrink-0">{today && isSameDay(edited, today) ? format(edited, tf, { locale: ko }) : format(edited, 'M.d')}</span>
          )}
        </div>
      </div>
    </button>
  );
}

function GroupRow({
  group,
  next,
  tf,
  today,
  onClick,
}: {
  group: GroupResponse;
  next?: ScheduleResponse;
  tf: string;
  today: Date | null;
  onClick: () => void;
}) {
  // 이름과 다음 일정을 한 줄에 나란히 두면 둘 다 잘린다 → 다음 일정은 둘째 줄
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-raised lg:px-5"
    >
      <GroupAvatar name={group.name} src={group.profileImage} theme={group.colorTheme} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="min-w-0 truncate font-display text-[15px] text-ink">{group.name}</span>
          <span className="shrink-0 text-[13px] tabular-nums text-ink-3">{group.memberCount}명</span>
        </span>
        {next && (
          <span className="mt-0.5 block truncate text-xs tabular-nums text-ink-3">
            {formatWhen(next.startTime, today, tf)} · {next.title}
          </span>
        )}
      </span>
    </button>
  );
}

function LoadError({ message, onRetry }: { message: string, onRetry: () => void }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <p className="font-display text-base text-ink">불러오지 못했어요</p>
      <p className="text-sm text-ink-3">{message}</p>
      <button onClick={onRetry} className="btn-secondary mt-2">다시 시도</button>
    </div>
  );
}
