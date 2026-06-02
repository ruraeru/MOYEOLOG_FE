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
    setIsListModalOpen(true);
  };

  const handleScheduleClick = (schedule: ScheduleResponse) => {
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
    indigo: 'from-indigo-500 to-indigo-600',
    blue: 'from-blue-500 to-blue-600',
    emerald: 'from-emerald-500 to-emerald-600',
    orange: 'from-orange-500 to-orange-600',
    rose: 'from-rose-500 to-rose-600',
    amber: 'from-amber-500 to-amber-600'
  };
  const bannerGradient = themeClasses[group.colorTheme as keyof typeof themeClasses] || themeClasses.indigo;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  const groupBg = group.backgroundImage ? (group.backgroundImage.startsWith('/uploads/') ? `${apiUrl}${group.backgroundImage}` : group.backgroundImage) : null;
  const groupProfile = group.profileImage ? (group.profileImage.startsWith('/uploads/') ? `${apiUrl}${group.profileImage}` : group.profileImage) : null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-500">
      <main className="flex-1 overflow-y-auto no-scrollbar pb-20">
        {/* Glassmorphism Banner Section */}
        <div className="px-8 pt-8 relative">
          <div className={`w-full rounded-[2.5rem] bg-gradient-to-br ${bannerGradient} p-10 lg:p-12 relative overflow-hidden shadow-2xl`}>
            {groupBg && (
              <div className="absolute inset-0 z-0">
                <Image src={groupBg} alt="Background" fill className="object-cover opacity-40 mix-blend-overlay scale-105" unoptimized />
                <div className="absolute inset-0 bg-black/10 backdrop-blur-[2px]" />
              </div>
            )}
            
            <div className="relative z-10 max-w-7xl mx-auto flex flex-col gap-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <div className="relative">
                    <div className="absolute inset-0 bg-white/20 blur-xl rounded-full scale-150" />
                    {groupProfile ? (
                      <div className="w-20 h-20 rounded-3xl overflow-hidden shadow-2xl relative shrink-0">
                        <Image src={groupProfile} alt={group.name} fill className="object-cover" />
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-3xl bg-white/20 backdrop-blur-xl flex items-center justify-center text-white text-3xl font-black shadow-2xl shrink-0">
                        {group.name.substring(0, 1)}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter drop-shadow-sm">
                      {group.name}
                    </h1>
                    <div className="flex items-center gap-3">
                      <div className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full flex items-center gap-1.5">
                        <Users className="w-3 h-3 text-white/80" />
                        <span className="text-[10px] font-black text-white uppercase tracking-wider">{group.memberCount} members</span>
                      </div>
                      <button 
                        onClick={handleCopyInviteLink}
                        className={`px-3 py-1 bg-white/10 backdrop-blur-md rounded-full flex items-center gap-1.5 hover:bg-white/20 transition-all ${copied ? 'text-emerald-300' : 'text-white/80'}`}
                      >
                        <LinkIcon className="w-3 h-3" />
                        <span className="text-[10px] font-black uppercase tracking-wider">{copied ? 'Copied!' : 'Invite Link'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setIsEditModalOpen(true)}
                  className="p-3 bg-white/10 backdrop-blur-xl rounded-2xl text-white hover:bg-white/20 hover:scale-105 transition-all shadow-xl active:scale-95 border-0"
                >
                  <Settings className="w-6 h-6" />
                </button>
              </div>
              
              <p className="text-white/90 max-w-3xl font-bold text-lg leading-relaxed drop-shadow-sm">
                {group.description || '모임 설명이 없습니다. 팀원들과 함께 메모와 일정을 공유해보세요!'}
              </p>
            </div>
            
            {/* Background pattern */}
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Sparkles className="w-64 h-64 text-white rotate-12" />
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="max-w-7xl mx-auto px-8 mt-12 space-y-10">
          {/* Navigation Tabs (Modern Glass Style) */}
          <div className="flex items-center gap-2 p-1.5 bg-gray-100/50 backdrop-blur-sm rounded-[1.5rem] w-fit">
            <TabButton active={activeTab === 'memos'} icon={<Archive />} label="모임 메모" onClick={() => setActiveTab('memos')} />
            <TabButton active={activeTab === 'calendar'} icon={<LucideCalendar />} label="모임 일정" onClick={() => setActiveTab('calendar')} />
            <TabButton active={activeTab === 'topics'} icon={<Sparkles />} label="모임 토픽" onClick={() => setActiveTab('topics')} />
            <TabButton active={activeTab === 'members'} icon={<Users />} label="모임 멤버" onClick={() => setActiveTab('members')} />
          </div>

          <div className="min-h-[500px] outline-none">
            {activeTab === 'memos' ? (
              <div className="flex gap-10 items-start outline-none">
                {/* Sidebar Filter */}
                <aside className="w-56 shrink-0 space-y-8 animate-in slide-in-from-left-4 duration-500">
                  <SectionTitle label="카테고리" />
                  <div className="space-y-1.5">
                    <FilterButton active={memoFilter.type === 'all'} icon={<Archive />} label="전체 메모" onClick={() => setMemoFilter({ type: 'all' })} />
                    <FilterButton active={memoFilter.type === 'my'} icon={<UserIcon />} label="내가 쓴 메모" onClick={() => setMemoFilter({ type: 'my' })} />
                    <FilterButton active={memoFilter.type === 'favorites'} icon={<Star />} label="즐겨찾기" onClick={() => setMemoFilter({ type: 'favorites' })} isFavorite />
                  </div>
                  <SectionTitle label="태그" />
                  <div className="flex flex-wrap gap-2 px-1">
                    {dynamicTags.length > 0 ? dynamicTags.map(tag => (
                      <TagBadge key={tag} label={tag} active={memoFilter.type === 'tag' && memoFilter.id === tag} onClick={() => setMemoFilter({ type: 'tag', id: tag })} />
                    )) : <p className="text-[10px] text-gray-400 font-bold">사용된 태그 없음</p>}
                  </div>
                </aside>

                <div className="flex-1 space-y-8 animate-in fade-in duration-700">
                  <div className="flex justify-between items-center">
                    <div className="relative flex-1 max-w-lg group">
                      <input type="text" placeholder="메모 검색..." className="w-full bg-white border-0 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold focus:ring-4 focus:ring-indigo-50 transition-all outline-none shadow-sm group-hover:shadow-md" />
                      <Search className="w-5 h-5 absolute left-4 top-4 text-gray-300 group-hover:text-indigo-400 transition-colors" />
                    </div>
                    <div className="flex items-center gap-3">
                      <ViewSelector current={viewMode} onChange={setViewMode} />
                      <button onClick={() => setIsMemoModalOpen(true)} className="flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95"><Plus className="w-4 h-4" /> 메모 작성</button>
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
              <div className="bg-white p-10 rounded-[2.5rem] shadow-xl animate-in zoom-in-95 duration-500 border-0 no-outline">
                <Calendar locale="ko-KR" formatDay={(_, date) => format(date, 'd')} calendarType="gregory" onClickDay={handleOpenListModal} tileContent={getTileContent} className="w-full border-none font-sans" />
              </div>
            ) : activeTab === 'topics' ? (
              <div className="space-y-8 animate-in fade-in duration-500 outline-none">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-black text-gray-800 tracking-tight">공유 토픽</h3>
                  <button onClick={() => { setSelectedTopic(null); setIsTopicModalOpen(true); }} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center gap-2"><Plus className="w-4 h-4" /> 새 토픽 게시</button>
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
      />
    </div>
  );
}

// ─── Sub Components ─────────────────────────────────────────────

function TabButton({ active, icon: IconComponent, label, onClick }: { active: boolean, icon: React.ReactElement, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick} 
      className={`flex items-center gap-2 px-6 py-3 text-sm font-black rounded-2xl select-none border-0 no-outline transition-all duration-200 ${active ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200/30'}`}
    >
      {React.cloneElement(IconComponent, { size: 16 } as React.SVGAttributes<SVGElement>)}
      {label}
    </button>
  );
}

function FilterButton({ active, icon: IconComponent, label, onClick, isFavorite }: { active: boolean, icon: React.ReactElement, label: string, onClick: () => void, isFavorite?: boolean }) {
  return (
    <button 
      onClick={onClick} 
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-black border-0 transition-all no-outline ${active ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:bg-white/50 hover:text-gray-600'}`}
    >
      {React.cloneElement(IconComponent, { size: 16, className: active && isFavorite ? 'fill-indigo-600' : '' } as React.SVGAttributes<SVGElement>)}
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
      className={`text-[10px] font-black px-3 py-1.5 rounded-xl transition-all no-outline border-0 ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white text-gray-400 hover:text-indigo-500'}`}
    >
      #{label}
    </button>
  );
}

function ViewSelector({ current, onChange }: { current: 'grid' | 'list', onChange: (mode: 'grid' | 'list') => void }) {
  return (
    <div className="flex p-1.5 bg-gray-100/50 rounded-2xl no-outline border-0">
      <button 
        onClick={() => onChange('grid')} 
        className={`p-2.5 rounded-xl transition-all border-0 no-outline ${current === 'grid' ? 'bg-white shadow-md text-indigo-600' : 'text-gray-400'}`}
      >
        <LayoutGrid className="w-4 h-4" />
      </button>
      <button 
        onClick={() => onChange('list')} 
        className={`p-2.5 rounded-xl transition-all border-0 no-outline ${current === 'list' ? 'bg-white shadow-md text-indigo-600' : 'text-gray-400'}`}
      >
        <ListIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: React.ReactElement, text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center bg-white/50 border-2 border-dashed border-gray-200 rounded-[3rem]">
      {React.cloneElement(Icon, { size: 64, className: 'text-gray-200 mb-4 stroke-[1.5]' } as React.SVGAttributes<SVGElement>)}
      <p className="text-gray-500 font-bold">{text}</p>
      <p className="text-xs text-gray-400 mt-1 font-medium">새로운 활동을 시작해보세요!</p>
    </div>
  );
}

function MemberCard({ member, isOwner, currentUserIsOwner, onKick, apiUrl }: { member: GroupResponse['members'][0], isOwner: boolean, currentUserIsOwner: boolean, onKick: () => void, apiUrl: string }) {
  return (
    <div className="flex items-center justify-between p-6 bg-white rounded-[2rem] transition-all hover:shadow-xl group/member border-0">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-[1.25rem] overflow-hidden relative shadow-md shrink-0">
          {member.profileImage ? <Image src={member.profileImage.startsWith('/uploads/') ? `${apiUrl}${member.profileImage}` : member.profileImage} alt={member.nickname} fill className="object-cover" /> : <div className="w-full h-full bg-indigo-50 flex items-center justify-center text-indigo-500 font-black text-lg">{member.nickname[0]}</div>}
        </div>
        <div className="flex flex-col">
          <span className="font-black text-gray-800 flex items-center gap-2">
            {member.nickname}
            {isOwner && <span className="bg-indigo-600 text-white text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter shadow-md shadow-indigo-100">Leader</span>}
          </span>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Community Member</p>
        </div>
      </div>
      {currentUserIsOwner && !isOwner && (
        <button onClick={onKick} className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all opacity-0 group-hover/member:opacity-100"><Trash2 className="w-5 h-5" /></button>
      )}
    </div>
  );
}

function MemoCard({ memo, viewMode, onClick }: { memo: MemoResponse, viewMode: 'grid' | 'list', onClick: () => void }) {
  const isList = viewMode === 'list';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  const imageSrc = memo.imageUrl ? (memo.imageUrl.startsWith('/uploads/') ? `${apiUrl}${memo.imageUrl}` : memo.imageUrl) : null;
  return (
    <div onClick={onClick} className={`bg-white shadow-sm transition-all group flex overflow-hidden cursor-pointer border-0 ${isList ? 'rounded-2xl p-6 gap-6 hover:shadow-md' : 'rounded-[2.5rem] flex-col hover:shadow-2xl hover:-translate-y-2'}`}>
      {imageSrc && (
        <div className={isList ? "w-32 h-32 relative rounded-2xl overflow-hidden shrink-0 shadow-md border border-gray-50" : "h-48 w-full relative bg-gray-50 overflow-hidden"}>
          <Image src={imageSrc} alt={memo.title} fill className="object-cover group-hover:scale-110 transition-transform duration-700" unoptimized />
          {!isList && <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />}
        </div>
      )}
      <div className={isList ? "flex flex-col flex-1 min-w-0 py-1" : "p-8 flex flex-col gap-4 flex-1 min-w-0"}>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-black text-gray-800 text-lg truncate group-hover:text-indigo-600 transition-colors tracking-tight">{memo.title}</h4>
          <Star className={`w-4 h-4 ${memo.isFavorite ? 'text-amber-400 fill-amber-400' : 'text-gray-100'}`} />
        </div>
        <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed font-bold mb-4 flex-1">{memo.content}</p>
        <div className="flex flex-wrap gap-1.5 mb-6">
          {memo.tags?.slice(0, 3).map(tag => <span key={tag} className="text-[9px] text-indigo-500 font-black bg-indigo-50 px-2 py-0.5 rounded-md">#{tag}</span>)}
        </div>
        <div className="flex items-center justify-between pt-4 border-t border-gray-50">
          <div className="flex items-center gap-2">
             <div className="w-5 h-5 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 text-[8px] font-black">{memo.authorNickname[0]}</div>
             <span className="text-[10px] text-gray-400 font-black tracking-tight">{memo.authorNickname}</span>
          </div>
          <span className="text-[10px] text-gray-300 font-bold">{format(new Date(memo.createdAt), 'yyyy.MM.dd')}</span>
        </div>
      </div>
    </div>
  );
}

function TopicCard({ topic, viewMode, onClick }: { topic: TopicResponse, viewMode: 'grid' | 'list', onClick: () => void }) {
  const isList = viewMode === 'list';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  return (
    <div onClick={onClick} className={`bg-white shadow-sm transition-all group flex overflow-hidden cursor-pointer border-0 ${isList ? 'rounded-2xl p-6 gap-6 hover:shadow-md' : 'rounded-[2.5rem] flex-col hover:border-indigo-200 hover:shadow-2xl hover:-translate-y-2'}`}>
      {topic.imageUrl && (
        <div className={isList ? "w-32 h-32 relative rounded-2xl overflow-hidden shrink-0 shadow-md border border-gray-50" : "h-48 w-full relative bg-gray-50 overflow-hidden"}>
          <Image src={topic.imageUrl.startsWith('/uploads/') ? `${apiUrl}${topic.imageUrl}` : topic.imageUrl} alt={topic.title} fill className="object-cover group-hover:scale-110 transition-transform duration-700" unoptimized />
          {!isList && <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />}
        </div>
      )}
      <div className={isList ? "flex flex-col flex-1 min-w-0 py-1" : "p-8 flex flex-col gap-4 flex-1 min-w-0"}>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-black text-gray-800 text-lg truncate group-hover:text-indigo-600 transition-colors tracking-tight">{topic.title}</h4>
          <div className="flex items-center gap-1 text-gray-400 font-black text-[10px] bg-gray-50 px-2 py-0.5 rounded-lg"><MessageSquare className="w-3 h-3" /> {topic.commentCount}</div>
        </div>
        <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed font-bold mb-4 flex-1">{topic.content.replace(/[#*`]/g, '')}</p>
        <div className="flex items-center justify-between pt-4 border-t border-gray-50 mt-auto">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full overflow-hidden relative bg-gray-100">
              {topic.authorProfileImage ? <Image src={topic.authorProfileImage.startsWith('/uploads/') ? `${apiUrl}${topic.authorProfileImage}` : topic.authorProfileImage} alt="" fill className="object-cover" /> : <div className="w-full h-full bg-indigo-50 flex items-center justify-center text-[8px] text-indigo-500 font-bold">{topic.authorNickname[0]}</div>}
            </div>
            <span className="text-[10px] text-gray-400 font-black">{topic.authorNickname}</span>
          </div>
          <span className="text-[10px] text-gray-300 font-bold">{format(new Date(topic.createdAt), 'yyyy.MM.dd')}</span>
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
}

function Modals({ isMemoModalOpen, setIsMemoModalOpen, isScheduleModalOpen, setIsScheduleModalOpen, isListModalOpen, setIsListModalOpen, isDetailOpen, setIsDetailOpen, isEditModalOpen, setIsEditModalOpen, isTopicModalOpen, setIsTopicModalOpen, isTopicDetailOpen, setIsTopicDetailOpen, isMemoDetailOpen, setIsMemoDetailOpen, groupId, group, session, selectedDate, selectedSchedule, selectedTopic, selectedMemoId, onSuccess, handleTopicEdit, handleMemoClick, handleEdit, handleScheduleClick }: ModalsProps) {
  return (
    <>
      <MemoCreateModal isOpen={isMemoModalOpen} onClose={() => setIsMemoModalOpen(false)} userId={session?.user?.id || ''} groupId={groupId} onSuccess={onSuccess} />
      <AppointmentModal isOpen={isScheduleModalOpen} onClose={() => setIsScheduleModalOpen(false)} initialDate={selectedDate} onSuccess={onSuccess} initialSchedule={null} />
      <AppointmentListModal isOpen={isListModalOpen} onClose={() => setIsListModalOpen(false)} date={selectedDate} appointments={[]} onCreateNew={() => setIsScheduleModalOpen(true)} onAppointmentClick={handleScheduleClick} />
      <AppointmentDetailModal isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} schedule={selectedSchedule} onSuccess={onSuccess} onEdit={handleEdit} />
      <GroupEditModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} group={group} onSuccess={onSuccess} />
      <GroupTopicCreateModal isOpen={isTopicModalOpen} onClose={() => setIsTopicModalOpen(false)} groupId={groupId} onSuccess={onSuccess} initialTopic={selectedTopic} />
      <GroupTopicDetailModal isOpen={isTopicDetailOpen} onClose={() => setIsTopicDetailOpen(false)} topicId={selectedTopic?.id || null} onDelete={onSuccess} onEdit={handleTopicEdit} onMemoClick={handleMemoClick} />
      <MemoDetailModal isOpen={isMemoDetailOpen} onClose={() => setIsMemoDetailOpen(false)} memoId={selectedMemoId} userId={session?.user?.id || ''} onDelete={onSuccess} />
    </>
  );
}
