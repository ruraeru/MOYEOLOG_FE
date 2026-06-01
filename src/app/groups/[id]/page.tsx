'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { 
  Plus, 
  ChevronLeft, 
  Loader2, 
  MessageSquare, 
  LayoutGrid,
  List as ListIcon,
  Calendar as LucideCalendar,
  Copy,
  Check,
  Link as LinkIcon,
  Settings
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { groupApi, type GroupResponse } from '@/lib/group-api';
import { type ScheduleResponse } from '@/lib/schedule-api';
import { type MemoResponse } from '@/lib/memo-api';
import MemoCreateModal from '@/components/MemoCreateModal';
import GroupInviteModal from '@/components/GroupInviteModal';
import AppointmentModal from '@/components/AppointmentModal';
import AppointmentListModal from '@/components/AppointmentListModal';
import AppointmentDetailModal from '@/components/AppointmentDetailModal';
import GroupEditModal from '@/components/GroupEditModal';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format, isSameDay, parseISO } from 'date-fns';
import Image from 'next/image';

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const groupId = params.id as string;

  const [group, setGroup] = useState<GroupResponse | null>(null);
  const [memos, setMemos] = useState<MemoResponse[]>([]);
  const [schedules, setSchedules] = useState<ScheduleResponse[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleResponse | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState<'memos' | 'calendar'>('memos');

  const fetchGroupData = useCallback(async () => {
    if (!session || !groupId) return;
    try {
      setLoading(true);
      const [groupData, memoData, scheduleData] = await Promise.all([
        groupApi.getById(groupId, session),
        groupApi.getGroupMemos(groupId, session),
        groupApi.getGroupSchedules(groupId, session)
      ]);
      setGroup(groupData);
      setMemos(memoData);
      setSchedules(scheduleData);
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

  const handleEdit = (schedule: ScheduleResponse) => {
    setIsDetailOpen(false);
    setSelectedSchedule(schedule);
    setIsScheduleModalOpen(true);
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

  if (loading) {
    return (
      <div className="h-screen flex flex-col bg-[#F8F9FB]">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
          <p className="font-bold text-gray-500">모임 정보를 불러오는 중...</p>
        </div>
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
    <div className="h-screen flex flex-col bg-[#F8F9FB] text-gray-900 overflow-hidden font-sans">
      <Navbar />

      <main className="flex-1 overflow-y-auto no-scrollbar">
        {/* Banner Section */}
        <div className={`w-full bg-gradient-to-br ${bannerGradient} pt-12 pb-20 px-8 lg:px-12 relative overflow-hidden`}>
          {groupBg && (
            <div className="absolute inset-0 z-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={groupBg} alt="Background" className="w-full h-full object-cover opacity-40 mix-blend-overlay" />
              <div className="absolute inset-0 bg-black/10" />
            </div>
          )}
          <div className="max-w-7xl mx-auto relative z-10">
            <div className="flex items-center justify-between mb-8">
              <button 
                onClick={() => router.push('/groups')}
                className="flex items-center gap-2 text-white/80 hover:text-white transition-colors font-bold text-sm"
              >
                <ChevronLeft className="w-5 h-5" />
                목록으로 돌아가기
              </button>
              
              <button 
                onClick={() => setIsEditModalOpen(true)}
                className="p-2.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-white hover:bg-white/20 transition-all shadow-lg"
                title="모임 정보 수정"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  {groupProfile ? (
                    <div className="w-16 h-16 rounded-[1.5rem] overflow-hidden border-2 border-white/30 shadow-xl relative shrink-0">
                      <Image src={groupProfile} alt={group.name} fill className="object-cover" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-[1.5rem] bg-white/20 backdrop-blur-md border-2 border-white/30 flex items-center justify-center text-white text-2xl font-black shadow-xl shrink-0">
                      {group.name.substring(0, 1)}
                    </div>
                  )}
                  <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">
                    {group.name}
                  </h1>
                </div>
                <p className="text-white/80 max-w-2xl font-medium leading-relaxed">
                  {group.description || '모임 설명이 없습니다. 팀원들과 함께 메모와 일정을 공유해보세요!'}
                </p>

                {/* Invite Info Card */}
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-3 pr-4 w-fit animate-in fade-in slide-in-from-left-4 duration-500">
                  <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center text-white">
                    <LinkIcon className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col min-w-[100px]">
                    <p className="text-[9px] font-black text-white/60 uppercase tracking-widest leading-none mb-1">Invite Code</p>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-black text-white tracking-wider leading-none">{group.inviteCode}</span>
                      <button 
                        onClick={handleCopyInviteLink}
                        className="p-1.5 hover:bg-white/20 rounded-lg transition-all text-white/70 hover:text-white"
                        title="초대 링크 복사"
                      >
                        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  {copied && (
                    <span className="ml-2 text-[10px] font-black text-emerald-300 animate-pulse">복사됨!</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 bg-black/10 backdrop-blur-lg p-4 rounded-2xl border border-white/10">
                <div className="flex -space-x-3">
                  {group.members.slice(0, 5).map((member) => (
                    <div 
                      key={member.id}
                      className="w-10 h-10 rounded-full bg-white border-2 border-indigo-400 flex items-center justify-center text-xs font-bold text-indigo-600 shadow-sm overflow-hidden"
                      title={member.nickname}
                    >
                      {member.profileImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={member.profileImage.startsWith('/uploads/') ? `${apiUrl}${member.profileImage}` : member.profileImage} alt={member.nickname} className="w-full h-full object-cover" />
                      ) : (
                        member.nickname.substring(0, 1)
                      )}
                    </div>
                  ))}
                  <button 
                    onClick={() => setIsInviteModalOpen(true)}
                    className="w-10 h-10 rounded-full bg-indigo-600 border-2 border-white flex items-center justify-center text-white hover:bg-indigo-700 transition-colors shadow-sm z-10"
                    title="멤버 초대"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                <div className="text-white pr-2">
                  <p className="text-[10px] font-bold opacity-60">Members</p>
                  <p className="text-lg font-black">{group.memberCount}명</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="max-w-7xl mx-auto px-8 lg:px-12 -mt-10 pb-20 relative z-20">
          <div className="bg-white rounded-3xl shadow-xl p-6 md:p-8 border border-gray-100 flex flex-col gap-8">
            
            {/* Tabs */}
            <div className="flex items-center gap-4 border-b border-gray-100 pb-1">
              <button 
                onClick={() => setActiveTab('memos')}
                className={`px-4 py-3 text-sm font-black transition-all relative ${activeTab === 'memos' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  모임 메모
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${activeTab === 'memos' ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-50 text-gray-400'}`}>
                    {memos.length}
                  </span>
                </div>
                {activeTab === 'memos' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-full" />}
              </button>
              <button 
                onClick={() => setActiveTab('calendar')}
                className={`px-4 py-3 text-sm font-black transition-all relative ${activeTab === 'calendar' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <div className="flex items-center gap-2">
                  <LucideCalendar className="w-4 h-4" />
                  모임 일정
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${activeTab === 'calendar' ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-50 text-gray-400'}`}>
                    {schedules.length}
                  </span>
                </div>
                {activeTab === 'calendar' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-full" />}
              </button>
            </div>

            {activeTab === 'memos' ? (
              <>
                {/* Memo Toolbar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center bg-gray-50 p-1 rounded-xl border border-gray-100">
                      <button 
                        onClick={() => setViewMode('grid')}
                        className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400 hover:bg-gray-50'}`}
                      >
                        <LayoutGrid className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setViewMode('list')}
                        className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400 hover:bg-gray-50'}`}
                      >
                        <ListIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setIsMemoModalOpen(true)}
                      className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      새 메모 작성
                    </button>
                  </div>
                </div>

                {/* Memos List/Grid */}
                {memos.length > 0 ? (
                  <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
                    {memos.map((memo) => (
                      <MemoCard key={memo.id} memo={memo} viewMode={viewMode} />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-24 text-center">
                    <MessageSquare className="w-12 h-12 text-gray-200 mb-4" />
                    <p className="text-gray-400 font-medium">아직 작성된 메모가 없습니다.</p>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col gap-6">
                <div className="flex justify-end">
                  <button 
                    onClick={() => setIsScheduleModalOpen(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    새 일정 등록
                  </button>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-8 group">
                  <Calendar
                    className="w-full h-full border-none font-sans"
                    tileContent={getTileContent}
                    formatDay={(locale, date) => format(date, 'd')}
                    calendarType="gregory"
                    onClickDay={handleOpenListModal}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modals */}
      <MemoCreateModal 
        isOpen={isMemoModalOpen}
        onClose={() => setIsMemoModalOpen(false)}
        userId={session?.user?.id || ''}
        groupId={groupId}
        onSuccess={fetchGroupData}
      />

      <GroupInviteModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        groupId={groupId}
        groupName={group.name}
        onSuccess={() => {
          // 초대가 성공적으로 보내졌을 때의 처리 (알림 등으로 표시될 예정)
        }}
      />

      <AppointmentModal 
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        initialDate={selectedDate}
        onSuccess={fetchGroupData}
        initialSchedule={selectedSchedule}
      />

      <AppointmentListModal 
        isOpen={isListModalOpen}
        onClose={() => setIsListModalOpen(false)}
        date={selectedDate}
        appointments={schedules.filter(s => isSameDay(parseISO(s.startTime), new Date(selectedDate)))}
        onCreateNew={() => {
          setSelectedSchedule(null);
          setIsScheduleModalOpen(true);
        }}
        onAppointmentClick={handleScheduleClick}
      />

      <AppointmentDetailModal 
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        schedule={selectedSchedule}
        onSuccess={fetchGroupData}
        onEdit={handleEdit}
      />

      <GroupEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        group={group}
        onSuccess={fetchGroupData}
      />
    </div>
  );
}

function MemoCard({ memo, viewMode }: { memo: MemoResponse, viewMode: 'grid' | 'list' }) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  const imageSrc = memo.imageUrl ? (memo.imageUrl.startsWith('/uploads/') ? `${apiUrl}${memo.imageUrl}` : memo.imageUrl) : null;

  if (viewMode === 'list') {
    return (
      <div className="flex items-center gap-4 p-4 bg-white border border-gray-100 rounded-2xl hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer group">
        {imageSrc ? (
          <div className="w-16 h-16 relative shrink-0">
            <Image src={imageSrc} alt="" fill className="rounded-xl object-cover" />
          </div>
        ) : (
          <div className="w-16 h-16 rounded-xl bg-gray-50 flex items-center justify-center text-gray-300">
            <LayoutGrid className="w-6 h-6" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-gray-800 truncate group-hover:text-indigo-600 transition-colors">
            {memo.title}
          </h4>
          <p className="text-xs text-gray-400 mt-1 truncate font-medium">{memo.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-white border border-gray-100 rounded-3xl overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group">
      {imageSrc && (
        <div className="h-40 overflow-hidden relative">
          <Image 
            src={imageSrc} 
            alt={memo.title} 
            fill
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        </div>
      )}
      <div className="p-6 flex flex-col flex-1">
        <h4 className="text-lg font-black text-gray-800 mb-2 group-hover:text-indigo-600 transition-colors line-clamp-1">
          {memo.title}
        </h4>
        <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed font-medium mb-4 flex-1">
          {memo.content}
        </p>
        <div className="flex items-center justify-between pt-4 border-t border-gray-50 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
          <span>{format(new Date(memo.createdAt), 'yyyy.MM.dd')}</span>
          {memo.tags && memo.tags.length > 0 && <span className="text-indigo-500">#{memo.tags[0]}</span>}
        </div>
      </div>
    </div>
  );
}
