'use client';

import React, { useState, useSyncExternalStore } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { PageHeader, Ribbon, Dot, EmptyState } from '@/components/ui';
import { memoApi, type MemoResponse } from '@/lib/memo-api';
import { scheduleApi, type ScheduleResponse } from '@/lib/schedule-api';
import { groupApi, type GroupResponse } from '@/lib/group-api';
import { GroupAvatar } from '@/components/groups/GroupIdentity';
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

export default function HomePage() {
  const tf = useTimeFormat();
  const router = useRouter();
  const { data: session } = useSession();

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

  const recentMemos = memoData ? memoData.slice(0, 5) : [];
  const schedules = scheduleData || [];
  const weatherOf = useScheduleWeather(schedules);
  const userGroups = groupData || [];
  const loading = memosLoading || schedulesLoading || groupsLoading;
  const weekStartsOn = useWeekStartsOn();

  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: ['memos'] });
    queryClient.invalidateQueries({ queryKey: ['schedules'] });
    queryClient.invalidateQueries({ queryKey: ['groups'] });
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleResponse | null>(null);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // 날짜는 브라우저 시간대로 그린다(서버 렌더링과 어긋나지 않게 마운트 뒤에만)
  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const handleOpenCreateModal = (date: Date) => {
    setSelectedDate(format(date, 'yyyy-MM-dd'));
    setSelectedSchedule(null);
    setIsModalOpen(true);
  };

  const handleEdit = (schedule: ScheduleResponse) => {
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

  // 이번 주 7칸과 오늘부터 이번 주 끝까지의 일정 기록
  const today = isMounted ? startOfDay(new Date()) : null;
  const weekDays = today
    ? Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(today, { weekStartsOn }), i))
    : [];
  const weekSchedules = weekDays.map((day) => ({ day, items: schedulesOnDay(schedules, day) }));
  const weekCount = new Set(weekSchedules.flatMap((d) => d.items.map((s) => s.id))).size;
  const todayCount = today ? schedulesOnDay(schedules, today).length : 0;
  const upcoming = today ? weekSchedules.filter((d) => d.day >= today && d.items.length > 0) : [];

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-ink font-sans">
      <Navbar />
      <main className="mx-auto w-full max-w-[1400px] flex-1 grid grid-cols-1 gap-8 px-4 pt-5 pb-24 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8 lg:px-8 lg:pt-8 lg:pb-8 xl:grid-cols-[minmax(0,1fr)_464px]">

        {/* 왼쪽: 날짜 머리 + 이번 주 + 일정 기록 */}
        <section className="flex flex-col gap-5 lg:rounded-xl lg:border lg:border-line lg:bg-surface lg:p-8 lg:self-start">
          <PageHeader
            title={today ? format(today, 'M월 d일 EEEE', { locale: ko }) : '오늘'}
            description={today && !schedulesLoading ? `이번 주 일정 ${weekCount}개 · 오늘 ${todayCount}개` : undefined}
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
              <div className="grid grid-cols-7 gap-1.5 lg:gap-2">
                {weekSchedules.map(({ day, items }) => {
                  const isToday = isSameDay(day, today);
                  const first = items[0];
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
                      {first ? <Dot color={groupHex(first.groupId, userGroups)} /> : <span aria-hidden className="size-1.5" />}
                    </button>
                  );
                })}
              </div>

              {/* 일정 기록 */}
              {schedulesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={18} strokeWidth={1.5} className="animate-spin text-ink-3" />
                </div>
              ) : upcoming.length === 0 ? (
                <div className="rounded-xl border border-line bg-surface lg:border-0">
                  <EmptyState
                    icon={CalendarDays}
                    title="이번 주 남은 일정이 없어요"
                    description="일정을 추가하면 여기에 날짜순으로 모여요"
                  />
                </div>
              ) : (
                <ul className="divide-y divide-line rounded-xl border border-line bg-surface px-4 lg:rounded-none lg:border-0 lg:border-y lg:px-0">
                  {upcoming.flatMap(({ day, items }) =>
                    items.map((s, i) => (
                      <li key={`${day.toISOString()}-${s.id}`}>
                        <ScheduleRow
                          schedule={s}
                          day={day}
                          label={i === 0 ? dayLabel(day, today) : ''}
                          time={formatTimeOnDay(s, day, tf)}
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
            <SectionHead title="최근 메모" href="/memo" />
            {loading ? (
              <LoadingCard />
            ) : memosError && !memoData ? (
              <LoadError message={getApiErrorMessage(memosError)} onRetry={() => refetchMemos()} />
            ) : recentMemos.length === 0 ? (
              <div className="card">
                <EmptyState icon={FileText} title="아직 메모가 없어요" description="새 메모를 쓰면 여기에 모여요" />
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
                    className={i >= 2 ? 'max-lg:hidden' : ''}
                    onClick={() => handleMemoClick(memo.id)}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <SectionHead title="내 모임" href="/groups" />
            {loading ? (
              <LoadingCard />
            ) : groupsError && !groupData ? (
              <LoadError message={getApiErrorMessage(groupsError)} onRetry={() => refetchGroups()} />
            ) : userGroups.length === 0 ? (
              <div className="card">
                <EmptyState icon={Users} title="참여 중인 모임이 없어요" description="친구를 초대해 모임을 만들어 보세요" />
              </div>
            ) : (
              <ul className="card divide-y divide-line overflow-hidden">
                {userGroups.map((group) => (
                  <li key={group.id}>
                    <GroupRow
                      group={group}
                      next={today ? nextScheduleOf(group.id, schedules, today) : undefined}
                      tf={tf}
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
        onClose={() => { setIsModalOpen(false); setSelectedSchedule(null); }}
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
        onCreateNew={() => { setSelectedSchedule(null); setIsModalOpen(true); }}
        onAppointmentClick={handleScheduleClick}
      />

      <AppointmentDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => { setIsDetailModalOpen(false); setSelectedSchedule(null); }}
        schedule={selectedSchedule}
        onSuccess={refreshData}
        onEdit={handleEdit}
      />
    </div>
  );
}

/** 모임의 다음 일정(오늘 이후 시작) */
function nextScheduleOf(groupId: string, schedules: ScheduleResponse[], today: Date) {
  return sortSchedules(schedules.filter((s) => s.groupId === groupId && parseISO(s.startTime) >= today))[0];
}

function SectionHead({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="font-display text-lg leading-7 text-ink">{title}</h2>
      <Link href={href} className="text-[13px] text-ink-3 transition-colors hover:text-ink">전체 보기</Link>
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
  onClick,
}: {
  schedule: ScheduleResponse;
  day: Date;
  label: string;
  time: string;
  weather: WeatherAt | null;
  groups: GroupResponse[];
  onClick: () => void;
}) {
  const group = schedule.groupId ? groups.find((g) => g.id === schedule.groupId) : undefined;
  const groupName = schedule.groupId ? group?.name : '내 일정';
  const meta = [groupName, schedule.location].filter(Boolean).join(' · ');
  const people = schedule.participants ?? [];

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 py-3 text-left lg:gap-4 lg:py-3.5"
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
      {/* 시각 (좁은 화면은 아래에 날짜 말) */}
      <div className="w-14 shrink-0 lg:w-16">
        <p className="text-sm tabular-nums text-ink-2">{time}</p>
        {label && <p className="mt-0.5 text-xs text-ink-3 lg:hidden">{label}</p>}
      </div>
      <Ribbon color={groupHex(schedule.groupId, groups)} className="h-10" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-[15px] leading-5 text-ink group-hover:text-accent">{schedule.title}</p>
        {meta && (
          <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[13px] text-ink-3">
            {group && <GroupAvatar name={group.name} src={group.profileImage} theme={group.colorTheme} size="xs" />}
            <span className="min-w-0 truncate">{meta}</span>
          </p>
        )}
        {weather && <p className="mt-1 text-[13px] text-ink-3"><WeatherLine weather={weather} /></p>}
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
  className = '',
  onClick,
}: {
  memo: MemoResponse;
  group?: GroupResponse;
  ribbon: string;
  author: string;
  className?: string;
  onClick: () => void;
}) {
  const created = parseISO(memo.createdAt);
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
          {!Number.isNaN(created.getTime()) && <span className="stamp shrink-0">{format(created, 'M.d')}</span>}
        </div>
      </div>
    </button>
  );
}

function GroupRow({
  group,
  next,
  tf,
  onClick,
}: {
  group: GroupResponse;
  next?: ScheduleResponse;
  tf: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-14 w-full items-center gap-3 px-4 text-left transition-colors hover:bg-raised lg:px-5"
    >
      <GroupAvatar name={group.name} src={group.profileImage} theme={group.colorTheme} size="sm" />
      <span className="min-w-0 truncate font-display text-[15px] text-ink">{group.name}</span>
      <span className="shrink-0 text-[13px] tabular-nums text-ink-3">{group.memberCount}명</span>
      {next && (
        <span className="ml-auto min-w-0 truncate pl-2 text-xs tabular-nums text-ink-3">
          {format(parseISO(next.startTime), `EEEEE ${tf}`, { locale: ko })} {next.title}
        </span>
      )}
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
