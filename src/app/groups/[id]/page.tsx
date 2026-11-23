'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  Plus,
  Loader2,
  Calendar as LucideCalendar,
  Link as LinkIcon,
  Settings,
  MessageSquare as TopicIcon,
  Users,
  Search,
  Archive,
  User as UserIcon,
  Star,
  UserPlus,
  LogOut,
  Lock,
  SearchX,
  AlertCircle,
  X,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { groupApi, type GroupResponse } from '@/lib/group-api';
import { groupTopicApi } from '@/lib/group-topic-api';
import { type ScheduleResponse } from '@/lib/schedule-api';
import { type MemoResponse } from '@/lib/memo-api';
import { type TopicResponse } from '@/types/topic';
import { getApiErrorMessage } from '@/lib/axios';
import { stripMarkdown } from '@/lib/utils';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format, isSameDay, parseISO } from 'date-fns';

// ─── Imported Sub Components ─────────────────────────────────────
import ImageWithFallback from '@/components/ImageWithFallback';
import {
  TabButton,
  FilterButton,
  SectionTitle,
  TagBadge,
  ViewSelector,
  EmptyState,
  ErrorState,
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

  const getTileContent = ({ date, view }: { date: Date, view: string }) => {
    if (view !== 'month') return null;
    const daySchedules = schedules.filter(s => isSameDay(parseISO(s.startTime), date));
    if (daySchedules.length === 0) return null;
    return (
      <div className="mt-1 flex flex-col gap-0.5 w-full overflow-hidden px-0.5">
        {daySchedules.slice(0, 2).map(s => (
          <div key={s.id} className="bg-accent text-white text-xs px-1 py-0.5 rounded w-full text-left truncate">
            {s.title}
          </div>
        ))}
        {daySchedules.length > 2 && (
          <div className="text-xs text-ink-3 tabular-nums">+{daySchedules.length - 2}</div>
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

  const themeClasses = {
    indigo: 'bg-accent-soft',
    blue: 'bg-sky-50',
    emerald: 'bg-emerald-50',
    orange: 'bg-orange-50',
    rose: 'bg-rose-50',
    amber: 'bg-amber-50',
    purple: 'bg-purple-50',
  };
  const themeTextClasses = {
    indigo: 'text-accent',
    blue: 'text-sky-600',
    emerald: 'text-emerald-600',
    orange: 'text-orange-600',
    rose: 'text-rose-600',
    amber: 'text-amber-600',
    purple: 'text-purple-600',
  };
  const bannerBg = themeClasses[group.colorTheme as keyof typeof themeClasses] || themeClasses.indigo;
  const themeText = themeTextClasses[group.colorTheme as keyof typeof themeTextClasses] || themeTextClasses.indigo;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  const groupBg = group.backgroundImage ? (group.backgroundImage.startsWith('/uploads/') ? `${apiUrl}${group.backgroundImage}` : group.backgroundImage) : null;
  const groupProfile = group.profileImage ? (group.profileImage.startsWith('/uploads/') ? `${apiUrl}${group.profileImage}` : group.profileImage) : null;

  const memoEmptyText = searchQuery.trim()
    ? '검색 결과가 없어요'
    : memoFilter.type === 'favorites' ? '즐겨찾기한 메모가 없어요' : '메모가 없어요';

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-canvas">
      <main className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar pb-24">
        {/* Banner Section */}
        <div className="px-4 pt-4 md:px-8 md:pt-8">
          <div className={`w-full rounded-2xl ${bannerBg} p-5 md:p-8 lg:p-12 relative overflow-hidden`}>
            {groupBg && (
              <div className="absolute inset-0 z-0">
                <ImageWithFallback
                  src={groupBg}
                  alt=""
                  fill
                  containerClassName="w-full h-full"
                  className="object-cover opacity-30"
                  unoptimized
                />
              </div>
            )}

            <div className="relative z-10 max-w-7xl mx-auto flex flex-col gap-4 md:gap-6">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 md:gap-5 min-w-0">
                  {groupProfile ? (
                    <ImageWithFallback
                      src={groupProfile}
                      alt={group.name}
                      fill
                      containerClassName="size-14 md:size-20 rounded-2xl relative shrink-0 border-4 border-surface overflow-hidden"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="size-14 md:size-20 rounded-2xl bg-surface flex items-center justify-center text-xl md:text-2xl font-semibold shrink-0 border-4 border-surface">
                      <span className={themeText}>{[...group.name][0]}</span>
                    </div>
                  )}
                  <div className="space-y-2 min-w-0">
                    <h1 className="text-xl md:text-2xl font-semibold text-ink break-words">
                      {group.name}
                    </h1>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="px-3 py-1 bg-surface rounded-lg flex items-center gap-2 whitespace-nowrap">
                        <Users size={16} strokeWidth={1.5} className="text-ink-3" />
                        <span className="text-xs text-ink-2 tabular-nums">멤버 {group.memberCount}명</span>
                      </div>
                      <button
                        onClick={handleCopyInviteLink}
                        className={`px-3 py-1 bg-surface rounded-lg flex items-center gap-2 whitespace-nowrap hover:bg-raised transition-colors duration-150 ease-out ${copied ? 'text-positive' : 'text-ink-2'}`}
                      >
                        <LinkIcon size={16} strokeWidth={1.5} />
                        <span className="text-xs">{copied ? '복사했어요' : '초대 링크 복사'}</span>
                      </button>
                      <button
                        onClick={() => setIsInviteModalOpen(true)}
                        className="px-3 py-1 bg-surface rounded-lg flex items-center gap-2 whitespace-nowrap text-ink-2 hover:bg-raised transition-colors duration-150 ease-out"
                      >
                        <UserPlus size={16} strokeWidth={1.5} />
                        <span className="text-xs">친구 초대</span>
                      </button>
                    </div>
                  </div>
                </div>

                {isOwner && (
                  <button
                    onClick={() => setIsEditModalOpen(true)}
                    className="btn-secondary size-10 !px-0 shrink-0"
                    aria-label="모임 설정"
                    title="모임 설정"
                  >
                    <Settings size={18} strokeWidth={1.5} className="text-ink-2" />
                  </button>
                )}
              </div>

              <p className="text-ink-2 max-w-3xl text-sm md:text-base leading-relaxed break-words">
                {group.description || '아직 모임 설명이 없어요. 팀원들과 메모와 일정을 함께 나눠 보세요'}
              </p>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="max-w-7xl mx-auto px-4 md:px-8 mt-6 md:mt-8 space-y-6 md:space-y-8">
          {/* Navigation Tabs */}
          <div className="grid grid-cols-4 sm:flex items-center gap-1 p-1 bg-raised rounded-[10px] w-full sm:w-fit">
            <TabButton active={activeTab === 'memos'} icon={<Archive />} label="모임 메모" onClick={() => setActiveTab('memos')} />
            <TabButton active={activeTab === 'calendar'} icon={<LucideCalendar />} label="모임 일정" onClick={() => setActiveTab('calendar')} />
            <TabButton active={activeTab === 'topics'} icon={<TopicIcon />} label="모임 토픽" onClick={() => setActiveTab('topics')} />
            <TabButton active={activeTab === 'members'} icon={<Users />} label="모임 멤버" onClick={() => setActiveTab('members')} />
          </div>

          <div className="min-h-[500px] outline-none">
            {activeTab === 'memos' ? (
              <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-stretch md:items-start outline-none">
                {/* 모바일: 카테고리·태그를 가로 칩으로 */}
                <div className="md:hidden flex items-center gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
                  {([
                    { type: 'all', label: '전체' },
                    { type: 'my', label: '내가 쓴 메모' },
                    { type: 'favorites', label: '즐겨찾기' },
                  ] as const).map(f => (
                    <button
                      key={f.type}
                      type="button"
                      onClick={() => setMemoFilter({ type: f.type })}
                      className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors duration-150 ease-out ${
                        memoFilter.type === f.type ? 'bg-surface text-ink font-medium shadow-[0_1px_2px_rgb(0_0_0/0.06)]' : 'text-ink-2 bg-raised'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                  {dynamicTags.length > 0 && <span className="w-px h-5 bg-line shrink-0" />}
                  {dynamicTags.map(tag => (
                    <TagBadge key={tag} label={tag} active={selectedTags.includes(tag)} onClick={() => toggleTag(tag)} />
                  ))}
                </div>

                {/* 데스크톱: 필터 사이드바 */}
                <aside className="hidden md:block w-56 shrink-0 space-y-6">
                  <div>
                    <SectionTitle label="카테고리" />
                    <div className="space-y-1">
                      <FilterButton active={memoFilter.type === 'all'} icon={<Archive />} label="전체 메모" onClick={() => setMemoFilter({ type: 'all' })} />
                      <FilterButton active={memoFilter.type === 'my'} icon={<UserIcon />} label="내가 쓴 메모" onClick={() => setMemoFilter({ type: 'my' })} />
                      <FilterButton active={memoFilter.type === 'favorites'} icon={<Star />} label="즐겨찾기" onClick={() => setMemoFilter({ type: 'favorites' })} isFavorite />
                    </div>
                  </div>
                  <div>
                    <SectionTitle label="태그" />
                    <div className="flex flex-wrap gap-2 px-3">
                      {dynamicTags.length > 0 ? dynamicTags.map(tag => (
                        <TagBadge key={tag} label={tag} active={selectedTags.includes(tag)} onClick={() => toggleTag(tag)} />
                      )) : <p className="text-xs text-ink-3">사용된 태그가 없어요</p>}
                    </div>
                  </div>
                </aside>

                <div className="flex-1 min-w-0 space-y-6">
                  <div className="flex flex-wrap justify-between items-center gap-3">
                    <div className="relative flex-1 min-w-[12rem] max-w-xl">
                      <input
                        type="search"
                        placeholder="메모 검색"
                        aria-label="모임 메모 검색"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="form-input pl-10 pr-9"
                      />
                      <Search size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
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
                    <div className="flex items-center gap-3 shrink-0">
                      <ViewSelector current={viewMode} onChange={setViewMode} />
                      <button onClick={() => setIsMemoModalOpen(true)} className="btn-primary whitespace-nowrap"><Plus size={16} strokeWidth={1.5} /> 메모 작성</button>
                    </div>
                  </div>

                  {listError && memos.length === 0 ? (
                    <ErrorState message={listError} onRetry={() => fetchGroupData()} />
                  ) : filteredMemos.length > 0 ? (
                    <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" : "space-y-3"}>
                      {filteredMemos.map(memo => <MemoCard key={memo.id} memo={memo} viewMode={viewMode} onClick={() => handleMemoClick(memo.id)} />)}
                    </div>
                  ) : (
                    <EmptyState
                      icon={<Archive />}
                      text={memoEmptyText}
                      subText={searchQuery.trim() ? '다른 검색어로 찾아보세요' : undefined}
                    />
                  )}
                </div>
              </div>
            ) : activeTab === 'calendar' ? (
              listError && schedules.length === 0 ? (
                <ErrorState message={listError} onRetry={() => fetchGroupData()} />
              ) : (
                <div className="card p-3 md:p-6 no-outline">
                  <Calendar locale="ko-KR" formatDay={(_, date) => format(date, 'd')} calendarType="gregory" onClickDay={handleOpenListModal} tileContent={getTileContent} className="w-full border-none font-sans" />
                </div>
              )
            ) : activeTab === 'topics' ? (
              <div className="space-y-6 outline-none">
                <div className="flex justify-between items-center gap-3">
                  <h3 className="text-base font-semibold text-ink">공유 토픽 <span className="text-xs font-normal text-ink-3 tabular-nums">{topics.length}</span></h3>
                  <button onClick={() => { setSelectedTopic(null); setIsTopicModalOpen(true); }} className="btn-primary whitespace-nowrap"><Plus size={16} strokeWidth={1.5} /> 새 토픽 게시</button>
                </div>
                {listError && topics.length === 0 ? (
                  <ErrorState message={listError} onRetry={() => fetchGroupData()} />
                ) : topics.length > 0 ? (
                  <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" : "space-y-3"}>
                    {topics.map(topic => <TopicCard key={topic.id} topic={topic} viewMode={viewMode} onClick={() => handleTopicClick(topic)} />)}
                  </div>
                ) : <EmptyState icon={<TopicIcon />} text="아직 게시된 토픽이 없어요" />}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-base font-semibold text-ink">멤버 <span className="text-xs font-normal text-ink-3 tabular-nums">{group.members.length}</span></h3>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setIsInviteModalOpen(true)} className="btn-secondary whitespace-nowrap">
                      <UserPlus size={16} strokeWidth={1.5} /> 친구 초대
                    </button>
                    {!isOwner && (
                      <button
                        onClick={handleLeave}
                        disabled={leaving}
                        className="btn-ghost whitespace-nowrap text-negative hover:!bg-negative-soft"
                      >
                        {leaving ? <Loader2 size={16} strokeWidth={1.5} className="animate-spin" /> : <LogOut size={16} strokeWidth={1.5} />}
                        모임 나가기
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.members.map(member => (
                    <MemberCard
                      key={member.id}
                      member={member}
                      isOwner={member.id === group.createdById}
                      isMe={member.id === session?.user?.id}
                      currentUserIsOwner={isOwner}
                      onKick={() => handleKickMember(member.id, member.nickname)}
                      apiUrl={apiUrl}
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
  let icon = <AlertCircle size={18} strokeWidth={1.5} className="text-negative" />;
  let title = '모임을 불러오지 못했어요';
  let description = error.message;
  let canRetry = true;

  if (error.status === 403) {
    icon = <Lock size={18} strokeWidth={1.5} className="text-ink-3" />;
    title = error.wasMember ? '이 모임에 더 이상 들어갈 수 없어요' : '이 모임의 멤버가 아니에요';
    description = error.wasMember
      ? '모임에서 내보내졌거나 모임을 나갔어요.'
      : '모임에 참여하려면 초대 링크나 초대 코드가 필요해요.';
    canRetry = false;
  } else if (error.status === 404 || error.status === 400) {
    icon = <SearchX size={18} strokeWidth={1.5} className="text-ink-3" />;
    title = error.wasMember ? '삭제된 모임이에요' : '모임을 찾을 수 없어요';
    description = error.wasMember
      ? '방장이 모임을 삭제했어요.'
      : '주소가 잘못됐거나 삭제된 모임이에요.';
    canRetry = false;
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6 pb-24">
      <div className="card w-full max-w-sm p-6 text-center space-y-5">
        <div className="size-10 rounded-full bg-raised flex items-center justify-center mx-auto">{icon}</div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-ink">{title}</h1>
          <p className="text-sm text-ink-2">{description}</p>
        </div>
        <div className="flex flex-col gap-2">
          <button onClick={onGoList} className="btn-primary w-full">모임 목록으로</button>
          {canRetry && (
            <button onClick={onRetry} className="btn-secondary w-full">다시 시도</button>
          )}
        </div>
      </div>
    </div>
  );
}
