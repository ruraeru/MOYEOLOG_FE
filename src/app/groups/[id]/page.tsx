'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  Plus,
  Loader2,
  Link as LinkIcon,
  Check,
  Settings,
  MessageSquare as TopicIcon,
  Search,
  FileText,
  UserPlus,
  LogOut,
  X,
  Image as ImageIcon,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { groupApi, type GroupResponse } from '@/lib/group-api';
import { groupTopicApi } from '@/lib/group-topic-api';
import { type ScheduleResponse } from '@/lib/schedule-api';
import { type MemoResponse } from '@/lib/memo-api';
import { type TopicResponse } from '@/types/topic';
import { getApiErrorMessage } from '@/lib/axios';
import { stripMarkdown, getThemeColors } from '@/lib/utils';
import { useTimeFormat } from '@/lib/schedule-utils';
import { useScheduleWeather } from '@/hooks/useWeather';
import { WeatherIcon } from '@/components/Weather';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format, isSameDay, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';

// ─── Imported Sub Components ─────────────────────────────────────
import { UnderlineTabs, Segmented, EmptyState } from '@/components/ui';
import { GroupAvatar, GroupCover, groupStyle } from '@/components/groups/GroupIdentity';
import {
  TagBadge,
  ErrorState,
  AvatarStack,
  Avatar,
} from '@/components/groups/GroupUI';
import { MemberCard } from '@/components/groups/MemberCard';
import { MemoCard } from '@/components/groups/MemoCard';
import { TopicCard } from '@/components/groups/TopicCard';
import { GroupModals } from '@/components/groups/GroupModals';
import { useGroupModal } from '../GroupModalContext';
import { useAlert } from '@/hooks/useAlert';

type FilterType = 'all' | 'my' | 'favorites' | 'tag';
type TabType = 'memos' | 'calendar' | 'topics' | 'members';
const TABS: TabType[] = ['memos', 'calendar', 'topics', 'members'];

/** 열린 모임 화면을 주기적으로 다시 불러오는 간격 (새 토픽, 내보내짐·삭제 감지) */
const POLL_INTERVAL_MS = 15000;
const TOPIC_POLL_INTERVAL_MS = 10000;

interface GroupLoadError {
  status?: number;
  message: string;
  /** 이 화면에서 모임을 보고 있다가 접근이 끊긴 경우 (내보내짐·삭제) */
  wasMember: boolean;
}

function statusOf(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}

export default function GroupDetailPage() {
  const params = useParams();
  const groupId = params?.id as string;
  // 다른 모임으로 이동하면 상태를 새로 시작한다
  return (
    <Suspense fallback={<GroupLoading />}>
      <GroupDetailContent key={groupId} />
    </Suspense>
  );
}

function GroupLoading() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3">
      <Loader2 size={18} strokeWidth={1.5} className="animate-spin text-ink-3" />
      <p className="text-sm text-ink-3">모임 정보를 불러오는 중이에요</p>
    </div>
  );
}

function GroupDetailContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { confirm, toast } = useAlert();
  const { refreshGroups } = useGroupModal();
  const tf = useTimeFormat();
  // '다가오는 일정' 기준 시각 (화면을 연 시각)
  const [now] = useState(() => Date.now());
  const groupId = params?.id as string;
  const topicParam = searchParams.get('topic');
  const tabParam = searchParams.get('tab');

  const [group, setGroup] = useState<GroupResponse | null>(null);
  const [groupError, setGroupError] = useState<GroupLoadError | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [memos, setMemos] = useState<MemoResponse[]>([]);
  const [schedules, setSchedules] = useState<ScheduleResponse[]>([]);
  const [topics, setTopics] = useState<TopicResponse[]>([]);
  const hadGroupRef = useRef(false);

  const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [isTopicDetailOpen, setIsTopicDetailOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleResponse | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<TopicResponse | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState<TabType>(
    TABS.includes(tabParam as TabType) ? (tabParam as TabType) : topicParam ? 'topics' : 'memos'
  );
  const [memoFilter, setMemoFilter] = useState<{ type: FilterType; id?: string }>({ type: 'all' });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  /** silent: 주기 갱신. 로딩 표시 없이 바뀐 내용만 반영한다. */
  const fetchGroupData = useCallback(async (silent = false) => {
    if (!session || !groupId) return;

    let groupData: GroupResponse;
    try {
      groupData = await groupApi.getById(groupId, session);
    } catch (error) {
      const status = statusOf(error);
      if (silent && (status === undefined || status >= 500)) {
        // 주기 갱신 중 일시적인 네트워크·서버 오류는 무시하고 다음 주기에 다시 시도한다
        return;
      }
      console.error('Failed to fetch group:', error);
      setGroupError({
        status,
        message: getApiErrorMessage(error),
        wasMember: hadGroupRef.current,
      });
      setGroup(null);
      if (status === 403 || status === 404) {
        // 내보내졌거나 삭제된 모임은 사이드바에서도 바로 빠지게
        refreshGroups();
      }
      return;
    }

    hadGroupRef.current = true;
    setGroup(groupData);
    setGroupError(null);

    const [memoResult, scheduleResult, topicResult] = await Promise.allSettled([
      groupApi.getGroupMemos(groupId, session),
      groupApi.getGroupSchedules(groupId, session),
      groupTopicApi.getByGroup(groupId, session),
    ]);
    if (memoResult.status === 'fulfilled') setMemos(memoResult.value);
    if (scheduleResult.status === 'fulfilled') setSchedules(scheduleResult.value);
    if (topicResult.status === 'fulfilled') setTopics(topicResult.value);

    const failed = [memoResult, scheduleResult, topicResult].find(
      (r): r is PromiseRejectedResult => r.status === 'rejected'
    );
    if (failed) {
      console.error('Failed to fetch group lists:', failed.reason);
      if (!silent) setListError(getApiErrorMessage(failed.reason, '목록을 불러오지 못했어요.'));
    } else {
      setListError(null);
    }
  }, [session, groupId, refreshGroups, setGroup, setGroupError, setMemos, setSchedules, setTopics, setListError]);

  useEffect(() => {
    fetchGroupData();
  }, [fetchGroupData]);

  // 새 토픽·메모와 내보내짐·삭제를 반영하기 위해 화면이 보일 때만 주기적으로 다시 불러온다
  useEffect(() => {
    if (!group || groupError) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') fetchGroupData(true);
    }, POLL_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchGroupData(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [!!group, groupError, fetchGroupData]); // eslint-disable-line react-hooks/exhaustive-deps

  // 토픽 탭이 열려 있는 동안은 토픽 목록을 더 자주(10초) 다시 불러온다. 문서가 hidden 이면 건너뛴다.
  useEffect(() => {
    if (activeTab !== 'topics' || !group || groupError || !session) return;
    const timer = window.setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        setTopics(await groupTopicApi.getByGroup(groupId, session));
      } catch {
        // 일시적인 오류는 다음 주기에 다시 시도한다 (모임 접근 오류는 15초 주기 갱신이 처리)
      }
    }, TOPIC_POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [activeTab, !!group, groupError, session, groupId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ?topic={id} 로 들어오면 그 토픽 상세를 연다 (활동·알림에서 이동). 닫으면 쿼리를 지운다.
  const openTopicId = topicParam || (isTopicDetailOpen ? selectedTopicId : null);

  const handleOpenListModal = (date: Date) => {
    setSelectedDate(format(date, 'yyyy-MM-dd'));
    setSelectedSchedule(null);
    setIsListModalOpen(true);
  };

  const handleScheduleClick = (schedule: ScheduleResponse) => {
    setIsListModalOpen(false);
    setSelectedSchedule(schedule);
    setIsDetailOpen(true);
  };

  const handleMemoClick = (id: string) => {
    router.push(`/memo/${id}`);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleTopicClick = (topic: TopicResponse) => {
    setSelectedTopic(topic);
    setSelectedTopicId(topic.id);
    setIsTopicDetailOpen(true);
  };

  const handleTopicDetailClose = () => {
    setIsTopicDetailOpen(false);
    setSelectedTopicId(null);
    if (topicParam) {
      router.replace(`/groups/${groupId}`, { scroll: false });
    }
  };

  const handleTopicEdit = (topic: TopicResponse) => {
    handleTopicDetailClose();
    setSelectedTopic(topic);
    setIsTopicModalOpen(true);
  };

  const handleEdit = (schedule: ScheduleResponse) => {
    setIsDetailOpen(false);
    setSelectedSchedule(schedule);
    setIsScheduleModalOpen(true);
  };

  const filteredMemos = useMemo(() => {
    let result = [...memos];
    if (memoFilter.type === 'my') {
      result = result.filter(m => m.authorId === session?.user?.id);
    } else if (memoFilter.type === 'favorites') {
      result = result.filter(m => m.isFavorite);
    }

    if (selectedTags.length > 0) {
      result = result.filter(m =>
        selectedTags.every(tag => m.tags?.includes(tag))
      );
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(m =>
        m.title.toLowerCase().includes(q) ||
        stripMarkdown(m.content || '').toLowerCase().includes(q) ||
        m.tags?.some(t => t.toLowerCase().includes(q))
      );
    }
    return result;
  }, [memos, memoFilter, session, selectedTags, searchQuery]);

  const dynamicTags = useMemo(() => {
    const tagSet = new Set<string>();
    memos.forEach(m => m.tags?.forEach(t => tagSet.add(t)));
    return Array.from(tagSet).slice(0, 10);
  }, [memos]);

  const isOwner = group
    ? (group.myRole ? group.myRole === 'OWNER' : session?.user?.id === group.createdById)
    : false;

  const handleKickMember = async (memberId: string, nickname: string) => {
    if (!session || !group) return;
    if (!(await confirm(`${nickname} 님은 초대 코드로 다시 들어올 수 없게 돼요. 방장이 직접 초대하면 다시 들어올 수 있어요.`, '이 멤버를 내보낼까요?', '내보내기', '취소'))) return;
    try {
      await groupApi.kickMember(group.id, memberId, session);
      fetchGroupData(true);
      toast.success('멤버를 내보냈어요');
    } catch (error) {
      console.error('Failed to kick member:', error);
      toast.error(error instanceof Error ? error.message : '멤버를 내보내지 못했어요');
    }
  };

  const handleLeave = async () => {
    if (!session || !group || leaving) return;
    const ok = await confirm(
      '모임 메모와 일정은 남지만, 다시 들어오려면 초대를 받아야 해요.',
      `'${group.name}' 모임에서 나갈까요?`,
      '나가기',
      '취소',
    );
    if (!ok) return;
    setLeaving(true);
    try {
      await groupApi.leave(group.id, session);
      toast.success('모임에서 나왔어요');
      await refreshGroups();
      router.push('/groups');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '모임에서 나가지 못했어요');
      setLeaving(false);
    }
  };

  const handleGroupUpdated = () => {
    fetchGroupData(true);
    refreshGroups();
  };

  const handleGroupDeleted = async () => {
    await refreshGroups();
    router.push('/groups');
  };

  const groupColor = getThemeColors(group?.colorTheme).hex;

  const weatherOf = useScheduleWeather(schedules);
  const getTileContent = ({ date, view }: { date: Date, view: string }) => {
    if (view !== 'month') return null;
    const daySchedules = schedules.filter(s => isSameDay(parseISO(s.startTime), date));
    if (daySchedules.length === 0) return null;
    const weather = daySchedules.map(weatherOf).find(Boolean);
    return (
      <div className="mt-1 flex w-full flex-col gap-0.5 overflow-hidden">
        {weather && <WeatherIcon weather={weather} className="absolute right-1.5 top-1.5 md:right-2.5 md:top-2.5" />}
        {daySchedules.slice(0, 2).map(s => (
          <div key={s.id} className="flex w-full min-w-0 items-center gap-1 text-left text-[11px] leading-4 text-ink-2">
            <span aria-hidden className="h-3 w-[3px] shrink-0 rounded-full bg-group" />
            <span className="hidden shrink-0 tabular-nums text-ink-3 sm:inline">{format(parseISO(s.startTime), tf)}</span>
            <span className="truncate">{s.title}</span>
          </div>
        ))}
        {daySchedules.length > 2 && (
          <div className="pl-2 text-[11px] leading-4 text-ink-3 tabular-nums">+{daySchedules.length - 2}</div>
        )}
      </div>
    );
  };

  if (groupError) {
    return (
      <GroupErrorView
        error={groupError}
        onRetry={() => { setGroupError(null); fetchGroupData(); }}
        onGoList={() => router.push('/groups')}
      />
    );
  }

  if (!group) {
    return <GroupLoading />;
  }

  const inviteLink = typeof window !== 'undefined' ? `${window.location.origin}/invite/group?code=${group.inviteCode}` : '';
  const handleCopyInviteLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(`복사하지 못했어요. 초대 코드는 ${group.inviteCode} 이에요`);
    }
  };

  const memoEmptyText = searchQuery.trim()
    ? '검색 결과가 없어요'
    : memoFilter.type === 'favorites' ? '즐겨찾기한 메모가 없어요' : '메모가 없어요';

  const upcomingSchedules = schedules
    .filter(s => parseISO(s.startTime).getTime() >= now)
    .sort((a, b) => parseISO(a.startTime).getTime() - parseISO(b.startTime).getTime())
    .slice(0, 3);

  const tabItems: { key: TabType; label: string; count: number }[] = [
    { key: 'memos', label: '메모', count: memos.length },
    { key: 'calendar', label: '일정', count: schedules.length },
    { key: 'topics', label: '토픽', count: topics.length },
    { key: 'members', label: '멤버', count: group.members.length },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-canvas" style={groupStyle(group.colorTheme)}>
      <main className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar pb-24">
        <div className="mx-auto max-w-7xl px-4 pt-4 md:px-8 lg:pt-6">
          {/* 머리: 표지 + 표지에 걸친 모임 얼굴 / 이름·설명·방장 / 얼굴 묶음 + 친구 초대 + 링크 복사 + 설정 */}
          <header>
            <GroupCover
              src={group.backgroundImage}
              theme={group.colorTheme}
              className="h-28 rounded-xl border border-line sm:h-32 lg:h-44"
            >
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(true)}
                  className="btn-secondary btn-sm absolute right-3 top-3 border-line bg-surface/90"
                >
                  <ImageIcon size={14} strokeWidth={1.5} /> 표지 바꾸기
                </button>
              )}
            </GroupCover>

            <div className="flex flex-wrap items-start gap-x-4 gap-y-3 px-3 sm:px-4 lg:flex-nowrap lg:px-6">
              <GroupAvatar
                name={group.name}
                src={group.profileImage}
                theme={group.colorTheme}
                size="xl"
                className="order-1 -mt-7 ring-4 ring-surface max-lg:size-14 max-lg:rounded-xl max-lg:text-2xl lg:-mt-10"
              />

              <div className="order-3 w-full min-w-0 lg:order-2 lg:w-auto lg:flex-1 lg:pt-4">
                <h1 className="break-words font-display text-2xl leading-8 text-ink lg:text-[30px] lg:leading-9">
                  {group.name}
                </h1>
                {group.description && (
                  <p className="mt-1 line-clamp-2 break-words text-sm text-ink-2">{group.description}</p>
                )}
                <p className="mt-1 text-[13px] text-ink-3">
                  <span className="tabular-nums">멤버 {group.memberCount}명</span> · 방장 {group.createdByNickname}
                </p>
              </div>

              <div className="order-2 ml-auto flex shrink-0 items-center gap-2 pt-3 lg:order-3 lg:pt-4">
                <span className="mr-1 hidden lg:flex" title={`멤버 ${group.memberCount}명`}>
                  <AvatarStack people={group.members} max={4} size="size-8" />
                </span>
                <button onClick={() => setIsInviteModalOpen(true)} className="btn-secondary">
                  <UserPlus size={16} strokeWidth={1.5} /> 친구 초대
                </button>
                <button
                  onClick={handleCopyInviteLink}
                  className="btn-secondary !px-2.5 sm:!px-3.5"
                  aria-label="초대 링크 복사"
                  title="초대 링크 복사"
                >
                  {copied ? <Check size={16} strokeWidth={1.5} /> : <LinkIcon size={16} strokeWidth={1.5} />}
                  <span className="hidden sm:inline">{copied ? '복사했어요' : '링크 복사'}</span>
                </button>
                {isOwner && (
                  <button
                    onClick={() => setIsEditModalOpen(true)}
                    className="btn-secondary size-9 !px-0"
                    aria-label="모임 설정"
                    title="모임 설정"
                  >
                    <Settings size={16} strokeWidth={1.5} />
                  </button>
                )}
              </div>
            </div>
          </header>

          <UnderlineTabs className="mt-5 lg:mt-6" items={tabItems} active={activeTab} onChange={setActiveTab} />

          <div className="mt-5 min-h-[400px] outline-none lg:mt-6">
            {activeTab === 'memos' ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 md:gap-3">
                  <Segmented
                    ariaLabel="메모 범위"
                    items={[
                      { key: 'all', label: '전체' },
                      { key: 'my', label: '내 메모' },
                      { key: 'favorites', label: '즐겨찾기' },
                    ]}
                    active={memoFilter.type === 'tag' ? 'all' : memoFilter.type}
                    onChange={(k) => setMemoFilter({ type: k })}
                  />
                  <div className="relative order-last w-full md:order-none md:w-auto md:min-w-[12rem] md:max-w-sm md:flex-1">
                    <input
                      type="search"
                      placeholder="제목·내용 검색"
                      aria-label="모임 메모 검색"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="form-input h-9 pl-9 pr-9"
                    />
                    <Search size={16} strokeWidth={1.5} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        aria-label="검색어 지우기"
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-ink-3 hover:text-ink"
                      >
                        <X size={14} strokeWidth={1.5} />
                      </button>
                    )}
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="hidden sm:inline-flex">
                      <Segmented
                        ariaLabel="보기"
                        items={[
                          { key: 'grid', label: '카드', title: '카드로 보기' },
                          { key: 'list', label: '목록', title: '목록으로 보기' },
                        ]}
                        active={viewMode}
                        onChange={setViewMode}
                      />
                    </span>
                    <button onClick={() => setIsMemoModalOpen(true)} className="btn-primary whitespace-nowrap">
                      <Plus size={16} strokeWidth={1.5} /> 메모 쓰기
                    </button>
                  </div>
                </div>

                {dynamicTags.length > 0 && (
                  <div className="-mx-4 flex items-center gap-1.5 overflow-x-auto no-scrollbar px-4 md:mx-0 md:flex-wrap md:px-0">
                    {dynamicTags.map(tag => (
                      <TagBadge key={tag} label={tag} active={selectedTags.includes(tag)} onClick={() => toggleTag(tag)} />
                    ))}
                  </div>
                )}

                {listError && memos.length === 0 ? (
                  <ErrorState message={listError} onRetry={() => fetchGroupData()} />
                ) : filteredMemos.length > 0 ? (
                  <div className={viewMode === 'grid' ? 'grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3' : 'space-y-2'}>
                    {filteredMemos.map(memo => (
                      <MemoCard key={memo.id} memo={memo} viewMode={viewMode} color={groupColor} onClick={() => handleMemoClick(memo.id)} />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={FileText}
                    title={memoEmptyText}
                    description={searchQuery.trim() ? '다른 검색어로 찾아보세요' : '첫 메모를 남겨 보세요'}
                  />
                )}
              </div>
            ) : activeTab === 'calendar' ? (
              listError && schedules.length === 0 ? (
                <ErrorState message={listError} onRetry={() => fetchGroupData()} />
              ) : (
                <div className="group-cal card overflow-hidden p-2 md:p-4">
                  <Calendar locale="ko-KR" formatDay={(_, date) => format(date, 'd')} calendarType="gregory" onClickDay={handleOpenListModal} tileContent={getTileContent} className="w-full border-none font-sans" />
                </div>
              )
            ) : activeTab === 'topics' ? (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                <section className="min-w-0 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-medium text-ink-2">최근 토픽</h2>
                    <button onClick={() => { setSelectedTopic(null); setIsTopicModalOpen(true); }} className="btn-primary whitespace-nowrap">
                      <Plus size={16} strokeWidth={1.5} /> 토픽 올리기
                    </button>
                  </div>
                  {listError && topics.length === 0 ? (
                    <ErrorState message={listError} onRetry={() => fetchGroupData()} />
                  ) : topics.length > 0 ? (
                    <div className="space-y-3">
                      {topics.map(topic => <TopicCard key={topic.id} topic={topic} onClick={() => handleTopicClick(topic)} />)}
                    </div>
                  ) : (
                    <EmptyState icon={TopicIcon} title="아직 토픽이 없어요" description="모임에서 같이 정할 이야기를 올려 보세요" />
                  )}
                </section>

                {/* 오른쪽: 다가오는 일정 · 멤버 */}
                <aside className="hidden space-y-4 xl:block">
                  <div className="card px-5 py-4">
                    <h3 className="font-display text-base text-ink">다가오는 일정</h3>
                    {upcomingSchedules.length > 0 ? (
                      <ul className="mt-2 divide-y divide-line">
                        {upcomingSchedules.map(s => {
                          const d = parseISO(s.startTime);
                          return (
                            <li key={s.id}>
                              <button
                                type="button"
                                onClick={() => handleScheduleClick(s)}
                                className="group/up flex w-full gap-3 py-3 text-left"
                              >
                                <span aria-hidden className="w-[3px] shrink-0 self-stretch rounded-full bg-group" />
                                <span className="stamp w-16 shrink-0 text-group-ink">
                                  {format(d, 'M.d EEE', { locale: ko })}
                                  <br />
                                  <span className="text-ink-2">{format(d, tf, { locale: ko })}</span>
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate font-display text-[15px] leading-5 text-ink group-hover/up:text-group-ink">{s.title}</span>
                                  {s.location && <span className="block truncate text-xs text-ink-3">{s.location}</span>}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-ink-3">잡힌 일정이 없어요</p>
                    )}
                  </div>

                  <div className="card px-5 py-4">
                    <h3 className="font-display text-base text-ink">
                      멤버 <span className="stamp">{group.members.length}</span>
                    </h3>
                    <ul className="mt-2 space-y-1">
                      {group.members.map(m => (
                        <li key={m.id} className="flex h-10 items-center gap-3">
                          <Avatar name={m.nickname} src={m.profileImage} size="size-7" />
                          <span className="truncate text-sm text-ink">{m.nickname}</span>
                          {m.id === group.createdById && <span className="shrink-0 text-xs text-ink-3">방장</span>}
                          {m.id === session?.user?.id && <span className="shrink-0 text-xs text-ink-3">나</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                </aside>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-medium text-ink-2">
                    멤버 <span className="tabular-nums">{group.members.length}</span>
                  </h2>
                  {!isOwner && (
                    <button onClick={handleLeave} disabled={leaving} className="btn-danger whitespace-nowrap">
                      {leaving ? <Loader2 size={16} strokeWidth={1.5} className="animate-spin" /> : <LogOut size={16} strokeWidth={1.5} />}
                      모임 나가기
                    </button>
                  )}
                </div>
                <div className="card divide-y divide-line overflow-hidden">
                  {group.members.map(member => (
                    <MemberCard
                      key={member.id}
                      member={member}
                      isOwner={member.id === group.createdById}
                      isMe={member.id === session?.user?.id}
                      currentUserIsOwner={isOwner}
                      onKick={() => handleKickMember(member.id, member.nickname)}
                    />
                  ))}
                </div>
                {isOwner && (
                  <p className="text-xs text-ink-3">방장은 모임을 나갈 수 없어요. 모임을 없애려면 모임 설정에서 삭제해 주세요.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      <GroupModals
        isMemoModalOpen={isMemoModalOpen} setIsMemoModalOpen={setIsMemoModalOpen}
        isScheduleModalOpen={isScheduleModalOpen} setIsScheduleModalOpen={setIsScheduleModalOpen}
        isListModalOpen={isListModalOpen} setIsListModalOpen={setIsListModalOpen}
        isDetailOpen={isDetailOpen} setIsDetailOpen={setIsDetailOpen}
        isEditModalOpen={isEditModalOpen} setIsEditModalOpen={setIsEditModalOpen}
        isTopicModalOpen={isTopicModalOpen} setIsTopicModalOpen={setIsTopicModalOpen}
        isTopicDetailOpen={!!openTopicId}
        isInviteModalOpen={isInviteModalOpen} setIsInviteModalOpen={setIsInviteModalOpen}
        groupId={groupId} group={group} session={session}
        selectedDate={selectedDate} selectedSchedule={selectedSchedule}
        selectedTopic={selectedTopic}
        selectedTopicId={openTopicId}
        onTopicDetailClose={handleTopicDetailClose}
        onSuccess={() => fetchGroupData(true)} handleTopicEdit={handleTopicEdit}
        onGroupUpdated={handleGroupUpdated}
        onGroupDeleted={handleGroupDeleted}
        handleMemoClick={handleMemoClick} handleEdit={handleEdit}
        handleScheduleClick={handleScheduleClick}
        schedules={schedules}
        setSelectedSchedule={setSelectedSchedule}
      />
    </div>
  );
}

function GroupErrorView({ error, onRetry, onGoList }: { error: GroupLoadError; onRetry: () => void; onGoList: () => void }) {
  let title = '모임을 불러오지 못했어요';
  let description = error.message;
  let canRetry = true;

  if (error.status === 403) {
    title = error.wasMember ? '이 모임에 더 이상 들어갈 수 없어요' : '이 모임의 멤버가 아니에요';
    description = error.wasMember
      ? '모임에서 내보내졌거나 모임을 나갔어요.'
      : '모임에 참여하려면 초대 링크나 초대 코드가 필요해요.';
    canRetry = false;
  } else if (error.status === 404 || error.status === 400) {
    title = error.wasMember ? '삭제된 모임이에요' : '모임을 찾을 수 없어요';
    description = error.wasMember
      ? '방장이 모임을 삭제했어요.'
      : '주소가 잘못됐거나 삭제된 모임이에요.';
    canRetry = false;
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6 pb-24">
      <div className="card w-full max-w-sm p-6 text-center">
        <h1 className="font-display text-xl leading-7 text-ink">{title}</h1>
        <p className="mt-2 text-sm text-ink-2">{description}</p>
        <div className="mt-6 flex justify-center gap-2">
          {canRetry && (
            <button onClick={onRetry} className="btn-secondary">다시 시도</button>
          )}
          <button onClick={onGoList} className="btn-primary">모임 목록으로</button>
        </div>
      </div>
    </div>
  );
}
