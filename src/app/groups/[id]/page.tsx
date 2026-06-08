'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { 
  Plus, 
  Loader2, 
  MessageSquare, 
  LayoutGrid,
  List as ListIcon,
  Calendar as LucideCalendar,
  Link as LinkIcon,
  Settings,
  Sparkles,
  Users,
  Trash2,
  Search,
  Archive,
  User as UserIcon,
  Star,
  ChevronDown,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { type Session } from 'next-auth';
import { groupApi, type GroupResponse } from '@/lib/group-api';
import { groupTopicApi } from '@/lib/group-topic-api';
import { type ScheduleResponse } from '@/lib/schedule-api';
import { type MemoResponse } from '@/lib/memo-api';
import { type TopicResponse } from '@/types/topic';
import MemoCreateModal from '@/components/MemoCreateModal';
import MemoDetailModal from '@/components/MemoDetailModal';
import AppointmentModal from '@/components/AppointmentModal';
import AppointmentListModal from '@/components/AppointmentListModal';
import AppointmentDetailModal from '@/components/AppointmentDetailModal';
import GroupEditModal from '@/components/GroupEditModal';
import GroupTopicCreateModal from '@/components/GroupTopicCreateModal';
import GroupTopicDetailModal from '@/components/GroupTopicDetailModal';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format, isSameDay, parseISO } from 'date-fns';
import { stripMarkdown } from '@/lib/utils';
import Image from 'next/image';

type FilterType = 'all' | 'my' | 'favorites' | 'tag';

export default function GroupDetailPage() {
  const params = useParams();
  const { data: session } = useSession();
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
  const [isMemoDetailOpen, setIsMemoDetailOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleResponse | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<TopicResponse | null>(null);
  const [selectedMemoId, setSelectedMemoId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState<'memos' | 'calendar' | 'topics' | 'members'>('memos');
  const [memoFilter, setMemoFilter] = useState<{ type: FilterType; id?: string }>({ type: 'all' });

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
    setSelectedMemoId(id);
    setIsMemoDetailOpen(true);
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
    } else if (memoFilter.type === 'tag' && memoFilter.id) {
      result = result.filter(m => m.tags?.includes(memoFilter.id!));
    }
    return result;
  }, [memos, memoFilter, session]);

  const dynamicTags = useMemo(() => {
    const tagSet = new Set<string>();
    memos.forEach(m => m.tags?.forEach(t => tagSet.add(t)));
    return Array.from(tagSet).slice(0, 10);
  }, [memos]);

  const handleKickMember = async (memberId: string) => {
    if (!session || !group) return;
    if (!confirm('정말로 이 멤버를 내보내시겠습니까?')) return;
    try {
      await groupApi.kickMember(group.id, memberId, session);
      fetchGroupData();
    } catch (error) {
      console.error('Failed to kick member:', error);
      alert('멤버 내보내기에 실패했습니다.');
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
                <Image src={groupBg} alt="Background" fill className="object-cover opacity-10 grayscale" unoptimized />
              </div>
            )}
            
            <div className="relative z-10 max-w-7xl mx-auto flex flex-col gap-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  {groupProfile ? (
                    <div className="w-24 h-24 rounded-[2rem] overflow-hidden shadow-sm relative shrink-0 border-4 border-white">
                      <Image src={groupProfile} alt={group.name} fill className="object-cover" />
                    </div>
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
                        <TagBadge key={tag} label={tag} active={memoFilter.type === 'tag' && memoFilter.id === tag} onClick={() => setMemoFilter({ type: 'tag', id: tag })} />
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
              <div className="bg-white p-12 rounded-[3rem] border border-gray-100 shadow-sm animate-in zoom-in-95 duration-500 border-0 no-outline">
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

      <Modals 
        isMemoModalOpen={isMemoModalOpen} setIsMemoModalOpen={setIsMemoModalOpen}
        isScheduleModalOpen={isScheduleModalOpen} setIsScheduleModalOpen={setIsScheduleModalOpen}
        isListModalOpen={isListModalOpen} setIsListModalOpen={setIsListModalOpen}
        isDetailOpen={isDetailOpen} setIsDetailOpen={setIsDetailOpen}
        isEditModalOpen={isEditModalOpen} setIsEditModalOpen={setIsEditModalOpen}
        isTopicModalOpen={isTopicModalOpen} setIsTopicModalOpen={setIsTopicModalOpen}
        isTopicDetailOpen={isTopicDetailOpen} setIsTopicDetailOpen={setIsTopicDetailOpen}
        isMemoDetailOpen={isMemoDetailOpen} setIsMemoDetailOpen={setIsMemoDetailOpen}
        groupId={groupId} group={group} session={session}
        selectedDate={selectedDate} selectedSchedule={selectedSchedule}
        selectedTopic={selectedTopic} selectedMemoId={selectedMemoId}
        onSuccess={fetchGroupData} handleTopicEdit={handleTopicEdit}
        handleMemoClick={handleMemoClick} handleEdit={handleEdit}
        handleScheduleClick={handleScheduleClick}
        schedules={schedules}
        setSelectedSchedule={setSelectedSchedule}
      />
    </div>
  );
}

// ─── Sub Components ─────────────────────────────────────────────

function TabButton({ active, icon: IconComponent, label, onClick }: { active: boolean, icon: React.ReactElement, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick} 
      className={`flex items-center gap-2.5 px-6 py-3.5 text-sm font-black rounded-2xl select-none border-0 no-outline transition-all duration-300 ${
        active 
          ? 'bg-white text-indigo-600 shadow-md ring-1 ring-black/5' 
          : 'text-gray-400 hover:text-indigo-600 hover:bg-white/50'
      }`}
    >
      {React.cloneElement(IconComponent, { size: 16, className: active ? 'stroke-[2.5]' : 'stroke-2' } as React.SVGAttributes<SVGElement>)}
      {label}
    </button>
  );
}

function FilterButton({ active, icon: IconComponent, label, onClick, isFavorite }: { active: boolean, icon: React.ReactElement, label: string, onClick: () => void, isFavorite?: boolean }) {
  return (
    <button 
      onClick={onClick} 
      className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-2xl text-sm font-black border-0 transition-all duration-300 no-outline ${
        active 
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
          : 'text-gray-400 hover:bg-white hover:text-indigo-600'
      }`}
    >
      {React.cloneElement(IconComponent, { 
        size: 16, 
        className: `transition-colors ${active && isFavorite ? 'fill-white stroke-white' : ''}` 
      } as React.SVGAttributes<SVGElement>)}
      {label}
    </button>
  );
}

function SectionTitle({ label }: { label: string }) {
  return <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2 mb-4 flex items-center gap-2"><ChevronDown className="w-3 h-3" /> {label}</h3>;
}

function TagBadge({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick} 
      className={`text-[10px] font-black px-3.5 py-2 rounded-xl transition-all duration-300 no-outline border-0 ${
        active 
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-50' 
          : 'bg-white text-gray-400 hover:text-indigo-600 hover:shadow-sm'
      }`}
    >
      #{label}
    </button>
  );
}

function ViewSelector({ current, onChange }: { current: 'grid' | 'list', onChange: (mode: 'grid' | 'list') => void }) {
  return (
    <div className="flex p-1.5 bg-gray-200/50 rounded-2xl no-outline border-0">
      <button 
        onClick={() => onChange('grid')} 
        className={`p-2.5 rounded-xl transition-all border-0 no-outline ${current === 'grid' ? 'bg-white shadow-md text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
      >
        <LayoutGrid className="w-4 h-4" />
      </button>
      <button 
        onClick={() => onChange('list')} 
        className={`p-2.5 rounded-xl transition-all border-0 no-outline ${current === 'list' ? 'bg-white shadow-md text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
      >
        <ListIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: React.ReactElement, text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center bg-white/30 backdrop-blur-sm border-2 border-dashed border-gray-200 rounded-[3rem]">
      {React.cloneElement(Icon, { size: 64, className: 'text-gray-200 mb-6 stroke-[1.5]' } as React.SVGAttributes<SVGElement>)}
      <p className="text-gray-500 font-black text-lg">{text}</p>
      <p className="text-sm text-gray-400 mt-2 font-bold tracking-tight">새로운 활동을 시작해보세요!</p>
    </div>
  );
}

function MemberCard({ member, isOwner, currentUserIsOwner, onKick, apiUrl }: { member: GroupResponse['members'][0], isOwner: boolean, currentUserIsOwner: boolean, onKick: () => void, apiUrl: string }) {
  return (
    <div className="flex items-center justify-between p-6 bg-white rounded-[2.5rem] transition-all duration-300 hover:shadow-xl hover:-translate-y-1 group/member border border-transparent hover:border-indigo-50">
      <div className="flex items-center gap-5">
        <div className="w-16 h-16 rounded-[1.5rem] overflow-hidden relative shadow-lg shrink-0 group-hover/member:scale-105 transition-transform duration-500">
          {member.profileImage ? (
            <Image src={member.profileImage.startsWith('/uploads/') ? `${apiUrl}${member.profileImage}` : member.profileImage} alt={member.nickname} fill className="object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center text-indigo-500 font-black text-2xl">
              {member.nickname[0]}
            </div>
          )}
        </div>
        <div className="flex flex-col">
          <span className="text-lg font-black text-gray-900 flex items-center gap-2">
            {member.nickname}
            {isOwner && (
              <span className="bg-indigo-600 text-white text-[9px] px-2.5 py-1 rounded-full font-black uppercase tracking-wider shadow-md shadow-indigo-100">
                Leader
              </span>
            )}
          </span>
          <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-1">Community Member</p>
        </div>
      </div>
      {currentUserIsOwner && !isOwner && (
        <button onClick={onKick} className="p-3.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all opacity-0 group-hover/member:opacity-100 active:scale-90">
          <Trash2 className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

function MemoCard({ memo, viewMode, onClick }: { memo: MemoResponse, viewMode: 'grid' | 'list', onClick: () => void }) {
  const isList = viewMode === 'list';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  const imageSrc = memo.imageUrl ? (memo.imageUrl.startsWith('/uploads/') ? `${apiUrl}${memo.imageUrl}` : memo.imageUrl) : null;
  
  return (
    <div 
      onClick={onClick} 
      className={`bg-white shadow-sm transition-all duration-500 group flex overflow-hidden cursor-pointer border border-transparent hover:border-indigo-100 ${
        isList 
          ? 'rounded-[2rem] p-6 gap-8 hover:shadow-xl hover:-translate-x-1' 
          : 'rounded-[3rem] flex-col hover:shadow-2xl hover:-translate-y-2'
      }`}
    >
      {imageSrc && (
        <div className={isList ? "w-40 h-40 relative rounded-2xl overflow-hidden shrink-0 shadow-xl" : "h-56 w-full relative bg-gray-50 overflow-hidden"}>
          <Image src={imageSrc} alt={memo.title} fill className="object-cover group-hover:scale-110 transition-transform duration-700" unoptimized />
          {!isList && <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-60" />}
          <div className="absolute top-6 right-6 z-10">
            <div className={`p-2 rounded-2xl backdrop-blur-md shadow-xl transition-all ${memo.isFavorite ? 'bg-amber-400/90 text-white' : 'bg-white/90 text-gray-300 group-hover:text-indigo-400'}`}>
              <Star className={`w-4 h-4 ${memo.isFavorite ? 'fill-current' : ''}`} />
            </div>
          </div>
        </div>
      )}
      <div className={isList ? "flex flex-col flex-1 min-w-0 py-2" : "p-8 flex flex-col gap-5 flex-1 min-w-0"}>
        <div className="flex items-center justify-between">
          <h4 className="font-black text-gray-900 text-xl truncate group-hover:text-indigo-600 transition-colors tracking-tight">
            {memo.title}
          </h4>
          {(!imageSrc || isList) && (
            <Star className={`w-5 h-5 ${memo.isFavorite ? 'text-amber-400 fill-amber-400' : 'text-gray-100'}`} />
          )}
        </div>
        <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed font-bold flex-1">
          {stripMarkdown(memo.content)}
        </p>
        <div className="flex flex-wrap gap-2">
          {memo.tags?.slice(0, 3).map(tag => (
            <span key={tag} className="text-[10px] text-indigo-500 font-black bg-indigo-50/50 px-3 py-1 rounded-xl">
              #{tag}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between pt-5 border-t border-gray-50 mt-2">
          <div className="flex items-center gap-3">
             <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-100 to-indigo-50 flex items-center justify-center text-indigo-500 text-[9px] font-black shadow-inner">
               {memo.authorNickname[0]}
             </div>
             <span className="text-[11px] text-gray-500 font-black tracking-tight">{memo.authorNickname}</span>
          </div>
          <span className="text-[11px] text-gray-300 font-black">{format(new Date(memo.createdAt), 'yyyy.MM.dd')}</span>
        </div>
      </div>
    </div>
  );
}

function TopicCard({ topic, viewMode, onClick }: { topic: TopicResponse, viewMode: 'grid' | 'list', onClick: () => void }) {
  const isList = viewMode === 'list';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  
  return (
    <div 
      onClick={onClick} 
      className={`bg-white shadow-sm transition-all duration-500 group flex overflow-hidden cursor-pointer border border-transparent hover:border-indigo-100 ${
        isList 
          ? 'rounded-[2rem] p-6 gap-8 hover:shadow-xl hover:-translate-x-1' 
          : 'rounded-[3rem] flex-col hover:shadow-2xl hover:-translate-y-2'
      }`}
    >
      {topic.imageUrl && (
        <div className={isList ? "w-40 h-40 relative rounded-2xl overflow-hidden shrink-0 shadow-xl" : "h-56 w-full relative bg-gray-50 overflow-hidden"}>
          <Image src={topic.imageUrl.startsWith('/uploads/') ? `${apiUrl}${topic.imageUrl}` : topic.imageUrl} alt={topic.title} fill className="object-cover group-hover:scale-110 transition-transform duration-700" unoptimized />
          {!isList && <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-60" />}
        </div>
      )}
      <div className={isList ? "flex flex-col flex-1 min-w-0 py-2" : "p-8 flex flex-col gap-5 flex-1 min-w-0"}>
        <div className="flex items-center justify-between">
          <h4 className="font-black text-gray-900 text-xl truncate group-hover:text-indigo-600 transition-colors tracking-tight">
            {topic.title}
          </h4>
          <div className="flex items-center gap-1.5 text-indigo-500 font-black text-[11px] bg-indigo-50 px-3 py-1 rounded-xl shadow-sm">
            <MessageSquare className="w-3.5 h-3.5" /> 
            {topic.commentCount}
          </div>
        </div>
        <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed font-bold flex-1">
          {stripMarkdown(topic.content)}
        </p>
        <div className="flex items-center justify-between pt-5 border-t border-gray-50 mt-auto">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full overflow-hidden relative bg-indigo-50 shadow-inner">
              {topic.authorProfileImage ? (
                <Image src={topic.authorProfileImage.startsWith('/uploads/') ? `${apiUrl}${topic.authorProfileImage}` : topic.authorProfileImage} alt="" fill className="object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[9px] text-indigo-500 font-black">
                  {topic.authorNickname[0]}
                </div>
              )}
            </div>
            <span className="text-[11px] text-gray-500 font-black tracking-tight">{topic.authorNickname}</span>
          </div>
          <span className="text-[11px] text-gray-300 font-black">{format(new Date(topic.createdAt), 'yyyy.MM.dd')}</span>
        </div>
      </div>
    </div>
  );
}

interface ModalsProps {
  isMemoModalOpen: boolean; setIsMemoModalOpen: (o: boolean) => void;
  isScheduleModalOpen: boolean; setIsScheduleModalOpen: (o: boolean) => void;
  isListModalOpen: boolean; setIsListModalOpen: (o: boolean) => void;
  isDetailOpen: boolean; setIsDetailOpen: (o: boolean) => void;
  isEditModalOpen: boolean; setIsEditModalOpen: (o: boolean) => void;
  isTopicModalOpen: boolean; setIsTopicModalOpen: (o: boolean) => void;
  isTopicDetailOpen: boolean; setIsTopicDetailOpen: (o: boolean) => void;
  isMemoDetailOpen: boolean; setIsMemoDetailOpen: (o: boolean) => void;
  groupId: string; group: GroupResponse; session: Session | null;
  selectedDate: string; selectedSchedule: ScheduleResponse | null;
  selectedTopic: TopicResponse | null; selectedMemoId: string | null;
  onSuccess: () => void; handleTopicEdit: (t: TopicResponse) => void;
  handleMemoClick: (id: string) => void; handleEdit: (s: ScheduleResponse) => void;
  handleScheduleClick: (s: ScheduleResponse) => void;
  schedules: ScheduleResponse[];
}

function Modals({ isMemoModalOpen, setIsMemoModalOpen, isScheduleModalOpen, setIsScheduleModalOpen, isListModalOpen, setIsListModalOpen, isDetailOpen, setIsDetailOpen, isEditModalOpen, setIsEditModalOpen, isTopicModalOpen, setIsTopicModalOpen, isTopicDetailOpen, setIsTopicDetailOpen, isMemoDetailOpen, setIsMemoDetailOpen, groupId, group, session, selectedDate, selectedSchedule, selectedTopic, selectedMemoId, onSuccess, handleTopicEdit, handleMemoClick, handleEdit, handleScheduleClick, schedules, setSelectedSchedule }: ModalsProps & { setSelectedSchedule: (s: ScheduleResponse | null) => void }) {
  return (
    <>
      <MemoCreateModal isOpen={isMemoModalOpen} onClose={() => setIsMemoModalOpen(false)} userId={session?.user?.id || ''} groupId={groupId} onSuccess={onSuccess} />
      <AppointmentModal 
        isOpen={isScheduleModalOpen} 
        onClose={() => { setIsScheduleModalOpen(false); setSelectedSchedule(null); }} 
        initialDate={selectedDate} 
        onSuccess={onSuccess} 
        initialSchedule={selectedSchedule} 
      />
      <AppointmentListModal 
        isOpen={isListModalOpen} 
        onClose={() => setIsListModalOpen(false)} 
        date={selectedDate} 
        appointments={schedules.filter(s => isSameDay(parseISO(s.startTime), new Date(selectedDate)))} 
        onCreateNew={() => { setSelectedSchedule(null); setIsScheduleModalOpen(true); }} 
        onAppointmentClick={handleScheduleClick} 
      />
      <AppointmentDetailModal 
        isOpen={isDetailOpen} 
        onClose={() => { setIsDetailOpen(false); setSelectedSchedule(null); }} 
        schedule={selectedSchedule} 
        onSuccess={onSuccess} 
        onEdit={handleEdit} 
      />
      <GroupEditModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} group={group} onSuccess={onSuccess} />
      <GroupTopicCreateModal isOpen={isTopicModalOpen} onClose={() => setIsTopicModalOpen(false)} groupId={groupId} onSuccess={onSuccess} initialTopic={selectedTopic} />
      <GroupTopicDetailModal isOpen={isTopicDetailOpen} onClose={() => setIsTopicDetailOpen(false)} topicId={selectedTopic?.id || null} onDelete={onSuccess} onEdit={handleTopicEdit} onMemoClick={handleMemoClick} />
      <MemoDetailModal isOpen={isMemoDetailOpen} onClose={() => setIsMemoDetailOpen(false)} memoId={selectedMemoId} userId={session?.user?.id || ''} onDelete={onSuccess} />
    </>
  );
}
