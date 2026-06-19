'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Plus, 
  Loader2, 
  MessageSquare, 
  Calendar as LucideCalendar,
  Link as LinkIcon,
  Settings,
  Sparkles,
  Users,
  Search,
  Archive,
  User as UserIcon,
  Star,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { groupApi, type GroupResponse } from '@/lib/group-api';
import { groupTopicApi } from '@/lib/group-topic-api';
import { type ScheduleResponse } from '@/lib/schedule-api';
import { type MemoResponse } from '@/lib/memo-api';
import { type TopicResponse } from '@/types/topic';
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
  EmptyState 
} from '@/components/groups/GroupUI';
import { MemberCard } from '@/components/groups/MemberCard';
import { MemoCard } from '@/components/groups/MemoCard';
import { TopicCard } from '@/components/groups/TopicCard';
import { GroupModals } from '@/components/groups/GroupModals';

type FilterType = 'all' | 'my' | 'favorites' | 'tag';

import { useAlert } from '@/hooks/useAlert';

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const { confirm, toast } = useAlert();
  const groupId = params?.id as string;

  const [group, setGroup] = useState<GroupResponse | null>(null);
  const [memos, setMemos] = useState<MemoResponse[]>([]);
  const [schedules, setSchedules] = useState<ScheduleResponse[]>([]);
  const [topics, setTopics] = useState<TopicResponse[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [isTopicDetailOpen, setIsTopicDetailOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleResponse | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<TopicResponse | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState<'memos' | 'calendar' | 'topics' | 'members'>('memos');
  const [memoFilter, setMemoFilter] = useState<{ type: FilterType; id?: string }>({ type: 'all' });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const fetchGroupData = useCallback(async () => {
    if (!session || !groupId) return;
    try {
      setLoading(true);
      const [groupData, memoData, scheduleData, topicData] = await Promise.all([
        groupApi.getById(groupId, session),
        groupApi.getGroupMemos(groupId, session),
        groupApi.getGroupSchedules(groupId, session),
        groupTopicApi.getByGroup(groupId, session)
      ]);
      setGroup(groupData);
      setMemos(memoData);
      setSchedules(scheduleData);
      setTopics(topicData);
    } catch (error) {
      console.error('Failed to fetch group data:', error);
    } finally {
      setLoading(false);
    }
  }, [session, groupId]);

  useEffect(() => {
    fetchGroupData();
  }, [fetchGroupData]);

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
    setIsTopicDetailOpen(true);
  };

  const handleTopicEdit = (topic: TopicResponse) => {
    setIsTopicDetailOpen(false);
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
    return result;
  }, [memos, memoFilter, session, selectedTags]);

  const dynamicTags = useMemo(() => {
    const tagSet = new Set<string>();
    memos.forEach(m => m.tags?.forEach(t => tagSet.add(t)));
    return Array.from(tagSet).slice(0, 10);
  }, [memos]);

  const handleKickMember = async (memberId: string) => {
    if (!session || !group) return;
    if (!(await confirm('정말로 이 멤버를 내보내시겠습니까?'))) return;
    try {
      await groupApi.kickMember(group.id, memberId, session);
      fetchGroupData();
      toast.success('멤버를 내보냈습니다.');
    } catch (error) {
      console.error('Failed to kick member:', error);
      toast.error('멤버 내보내기에 실패했습니다.');
    }
  };

  const getTileContent = ({ date, view }: { date: Date, view: string }) => {
    if (view !== 'month') return null;
    const daySchedules = schedules.filter(s => isSameDay(parseISO(s.startTime), date));
    if (daySchedules.length === 0) return null;
    return (
      <div className="mt-1 flex flex-col gap-0.5 w-full overflow-hidden px-0.5">
        {daySchedules.slice(0, 2).map(s => (
          <div key={s.id} className="bg-indigo-500 text-white text-[7px] px-1 py-0.5 rounded font-bold truncate">
            {s.title}
          </div>
        ))}
        {daySchedules.length > 2 && (
          <div className="text-[6px] text-gray-400 font-bold text-center">+{daySchedules.length - 2}</div>
        )}
      </div>
    );
  };

  if (loading && !group) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        <p className="font-bold text-gray-500">모임 정보를 불러오는 중...</p>
      </div>
    );
  }

  if (!group) return null;

  const inviteLink = typeof window !== 'undefined' ? `${window.location.origin}/invite/group?code=${group.inviteCode}` : '';
  const handleCopyInviteLink = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const themeClasses = {
    indigo: 'bg-indigo-50',
    blue: 'bg-sky-50',
    emerald: 'bg-emerald-50',
    orange: 'bg-orange-50',
    rose: 'bg-rose-50',
    amber: 'bg-amber-50'
  };
  const themeTextClasses = {
    indigo: 'text-indigo-500',
    blue: 'text-sky-500',
    emerald: 'text-emerald-500',
    orange: 'text-orange-500',
    rose: 'text-rose-500',
    amber: 'text-amber-500'
  };
  const bannerBg = themeClasses[group.colorTheme as keyof typeof themeClasses] || themeClasses.indigo;
  const themeText = themeTextClasses[group.colorTheme as keyof typeof themeTextClasses] || themeTextClasses.indigo;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  const groupBg = group.backgroundImage ? (group.backgroundImage.startsWith('/uploads/') ? `${apiUrl}${group.backgroundImage}` : group.backgroundImage) : null;
  const groupProfile = group.profileImage ? (group.profileImage.startsWith('/uploads/') ? `${apiUrl}${group.profileImage}` : group.profileImage) : null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-700 bg-white">
      <main className="flex-1 overflow-y-auto no-scrollbar pb-24">
        {/* Clean Banner Section */}
        <div className="px-10 pt-10">
          <div className={`w-full rounded-[2.5rem] ${bannerBg} p-12 lg:p-16 relative overflow-hidden`}>
            {groupBg && (
              <div className="absolute inset-0 z-0">
                <ImageWithFallback 
                  src={groupBg} 
                  alt="Background" 
                  fill 
                  containerClassName="w-full h-full" 
                  className="object-cover opacity-30" 
                  unoptimized 
                />
              </div>
            )}
            
            <div className="relative z-10 max-w-7xl mx-auto flex flex-col gap-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  {groupProfile ? (
                    <ImageWithFallback 
                      src={groupProfile} 
                      alt={group.name} 
                      fill 
                      containerClassName="w-24 h-24 rounded-[2rem] shadow-sm relative shrink-0 border-4 border-white overflow-hidden" 
                      className="object-cover" 
                      unoptimized
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-[2rem] bg-white flex items-center justify-center text-4xl font-black shadow-sm shrink-0 border-4 border-white">
                      <span className={themeText}>{group.name.substring(0, 1)}</span>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <h1 className="text-4xl md:text-5xl font-black text-gray-800 tracking-tight">
                      {group.name}
                    </h1>
                    <div className="flex items-center gap-3">
                      <div className="px-3.5 py-1.5 bg-white/60 rounded-xl flex items-center gap-2 border border-white/40">
                        <Users className={`w-3.5 h-3.5 ${themeText}`} />
                        <span className={`text-[11px] font-bold uppercase tracking-wider ${themeText}`}>{group.memberCount} members</span>
                      </div>
                      <button 
                        onClick={handleCopyInviteLink}
                        className={`px-3.5 py-1.5 bg-white/60 rounded-xl flex items-center gap-2 border border-white/40 hover:bg-white transition-all ${copied ? 'text-emerald-500' : 'text-gray-500'}`}
                      >
                        <LinkIcon className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-bold uppercase tracking-wider">{copied ? 'Copied!' : 'Invite Link'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {session?.user?.id === group.createdById && (
                  <button 
                    onClick={() => setIsEditModalOpen(true)}
                    className="p-4 bg-white/80 rounded-[1.5rem] text-gray-400 hover:text-indigo-500 hover:shadow-md transition-all active:scale-95 border border-white"
                  >
                    <Settings className="w-6 h-6" />
                  </button>
                )}
              </div>
              
              <p className="text-gray-600 max-w-3xl font-medium text-lg leading-relaxed">
                {group.description || '모임 설명이 없습니다. 팀원들과 함께 메모와 일정을 공유해보세요!'}
              </p>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="max-w-7xl mx-auto px-10 mt-12 space-y-12">
          {/* Navigation Tabs (Modern Clean Style) */}
          <div className="flex items-center gap-3 p-1.5 bg-gray-50 rounded-[1.75rem] w-fit">
            <TabButton active={activeTab === 'memos'} icon={<Archive />} label="모임 메모" onClick={() => setActiveTab('memos')} />
            <TabButton active={activeTab === 'calendar'} icon={<LucideCalendar />} label="모임 일정" onClick={() => setActiveTab('calendar')} />
            <TabButton active={activeTab === 'topics'} icon={<Sparkles />} label="모임 토픽" onClick={() => setActiveTab('topics')} />
            <TabButton active={activeTab === 'members'} icon={<Users />} label="모임 멤버" onClick={() => setActiveTab('members')} />
          </div>

          <div className="min-h-[500px] outline-none">
            {activeTab === 'memos' ? (
              <div className="flex gap-12 items-start outline-none">
                {/* Sidebar Filter */}
                <aside className="w-60 shrink-0 space-y-10 animate-in slide-in-from-left-4 duration-500">
                  <div>
                    <SectionTitle label="카테고리" />
                    <div className="space-y-1.5">
                      <FilterButton active={memoFilter.type === 'all'} icon={<Archive />} label="전체 메모" onClick={() => setMemoFilter({ type: 'all' })} />
                      <FilterButton active={memoFilter.type === 'my'} icon={<UserIcon />} label="내가 쓴 메모" onClick={() => setMemoFilter({ type: 'my' })} />
                      <FilterButton active={memoFilter.type === 'favorites'} icon={<Star />} label="즐겨찾기" onClick={() => setMemoFilter({ type: 'favorites' })} isFavorite />
                    </div>
                  </div>
                  <div>
                    <SectionTitle label="태그" />
                    <div className="flex flex-wrap gap-2 px-1">
                      {dynamicTags.length > 0 ? dynamicTags.map(tag => (
                        <TagBadge key={tag} label={tag} active={selectedTags.includes(tag)} onClick={() => toggleTag(tag)} />
                      )) : <p className="text-[10px] text-gray-400 font-semibold">사용된 태그 없음</p>}
                    </div>
                  </div>
                </aside>

                <div className="flex-1 space-y-10 animate-in fade-in duration-700">
                  <div className="flex justify-between items-center">
                    <div className="relative flex-1 max-w-xl group">
                      <input type="text" placeholder="메모 검색..." className="w-full bg-gray-50 border border-gray-100 rounded-2xl pl-12 pr-4 py-4 text-sm font-semibold focus:bg-white focus:border-indigo-200 focus:ring-4 focus:ring-indigo-50/50 transition-all outline-none" />
                      <Search className="w-5 h-5 absolute left-4 top-4 text-gray-300 group-hover:text-indigo-400 transition-colors" />
                    </div>
                    <div className="flex items-center gap-4">
                      <ViewSelector current={viewMode} onChange={setViewMode} />
                      <button onClick={() => setIsMemoModalOpen(true)} className="flex items-center gap-2 px-8 py-4 bg-indigo-400 text-white rounded-2xl font-bold text-sm hover:bg-indigo-500 shadow-sm transition-all active:scale-95"><Plus className="w-4 h-4" /> 메모 작성</button>
                    </div>
                  </div>

                  {filteredMemos.length > 0 ? (
                    <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8" : "space-y-4"}>
                      {filteredMemos.map(memo => <MemoCard key={memo.id} memo={memo} viewMode={viewMode} onClick={() => handleMemoClick(memo.id)} />)}
                    </div>
                  ) : <EmptyState icon={<Archive />} text={memoFilter.type === 'favorites' ? '즐겨찾기한 메모가 없습니다.' : '메모가 없습니다.'} />}
                </div>
              </div>
            ) : activeTab === 'calendar' ? (
              <div className="bg-white p-12 rounded-[3rem] border border-gray-100 animate-in zoom-in-95 duration-500 no-outline">
                <Calendar locale="ko-KR" formatDay={(_, date) => format(date, 'd')} calendarType="gregory" onClickDay={handleOpenListModal} tileContent={getTileContent} className="w-full border-none font-sans" />
              </div>
            ) : activeTab === 'topics' ? (
              <div className="space-y-10 animate-in fade-in duration-500 outline-none">
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-black text-gray-800 tracking-tight">공유 토픽</h3>
                  <button onClick={() => { setSelectedTopic(null); setIsTopicModalOpen(true); }} className="px-8 py-4 bg-indigo-400 text-white rounded-2xl font-bold text-sm hover:bg-indigo-500 shadow-sm transition-all active:scale-95 flex items-center gap-2"><Plus className="w-4 h-4" /> 새 토픽 게시</button>
                </div>
                {topics.length > 0 ? (
                  <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8" : "space-y-4"}>
                    {topics.map(topic => <TopicCard key={topic.id} topic={topic} viewMode={viewMode} onClick={() => handleTopicClick(topic)} />)}
                  </div>
                ) : <EmptyState icon={<Sparkles />} text="아직 게시된 토픽이 없습니다." />}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in slide-in-from-bottom-4 duration-500">
                {group.members.map(member => (
                  <MemberCard key={member.id} member={member} isOwner={member.id === group.createdById} currentUserIsOwner={session?.user?.id === group.createdById} onKick={() => handleKickMember(member.id)} apiUrl={apiUrl} />
                ))}
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
        isTopicDetailOpen={isTopicDetailOpen} setIsTopicDetailOpen={setIsTopicDetailOpen}
        groupId={groupId} group={group} session={session}
        selectedDate={selectedDate} selectedSchedule={selectedSchedule}
        selectedTopic={selectedTopic}
        onSuccess={fetchGroupData} handleTopicEdit={handleTopicEdit}
        handleMemoClick={handleMemoClick} handleEdit={handleEdit}
        handleScheduleClick={handleScheduleClick}
        schedules={schedules}
        setSelectedSchedule={setSelectedSchedule}
      />
    </div>
  );
}
