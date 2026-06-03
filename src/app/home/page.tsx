'use client';

import React, { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useSession } from 'next-auth/react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format, isSameDay, parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Plus,
  Lock,
  Share2,
  ChevronRight,
  Loader2,
  Users
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import AppointmentModal from '@/components/AppointmentModal';
import AppointmentListModal from '@/components/AppointmentListModal';
import AppointmentDetailModal from '@/components/AppointmentDetailModal';
import MemoDetailModal from '@/components/MemoDetailModal';
import { memoApi, type MemoResponse } from '@/lib/memo-api';
import { scheduleApi, type ScheduleResponse } from '@/lib/schedule-api';
import { groupApi, type GroupResponse } from '@/lib/group-api';

const emptySubscribe = () => () => { };

export default function HomePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const [recentMemos, setRecentMemos] = useState<MemoResponse[]>([]);
  const [schedules, setSchedules] = useState<ScheduleResponse[]>([]);
  const [userGroups, setUserGroups] = useState<GroupResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);
  
  const [selectedMemoId, setSelectedMemoId] = useState<string | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleResponse | null>(null);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [currentDate, setCurrentDate] = useState(new Date());

  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const fetchData = useCallback(async () => {
    if (!session) return;
    try {
      setLoading(true);
      const [memoData, scheduleData, groupData] = await Promise.all([
        memoApi.getAll(session),
        scheduleApi.getAll(session),
        groupApi.getAll(session)
      ]);
      setRecentMemos(memoData.slice(0, 5));
      setSchedules(scheduleData);
      setUserGroups(groupData);
    } catch (error) {
      console.error('Failed to fetch home data:', error);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenCreateModal = (date: Date) => {
    setSelectedDate(format(date, 'yyyy-MM-dd'));
    setSelectedSchedule(null); // 작성 모드
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
    setSelectedMemoId(memoId);
    setIsMemoModalOpen(true);
  };

  const getTileContent = ({ date, view }: { date: Date, view: string }) => {
    if (view !== 'month') return null;

    const daySchedules = schedules.filter(s => isSameDay(parseISO(s.startTime), date));

    return (
      <div className="mt-1 flex flex-col gap-0.5 w-full">
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <div
            role="button"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenCreateModal(date);
            }}
            className="bg-indigo-50 text-indigo-600 p-1 rounded-md hover:bg-indigo-100 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
          </div>
        </div>
        {daySchedules.slice(0, 2).map(s => {
          const group = userGroups.find(g => g.id === s.groupId);
          const theme = group?.colorTheme || 'indigo';
          const colorMap = {
            indigo: 'bg-indigo-500',
            blue: 'bg-blue-500',
            emerald: 'bg-emerald-500',
            orange: 'bg-orange-500',
            rose: 'bg-rose-500',
            amber: 'bg-amber-500'
          };
          return <EventBadge key={s.id} color={colorMap[theme as keyof typeof colorMap] || 'bg-gray-400'} text={s.title} />;
        })}
        {daySchedules.length > 2 && (
          <div className="text-[8px] text-gray-400 font-bold text-center">+{daySchedules.length - 2}</div>
        )}
      </div>
    );
  };

  return (
    <div className="h-screen flex flex-col bg-[#F8F9FB] text-gray-900 overflow-hidden font-sans">
      <Navbar />
      <main className="flex-1 w-full flex flex-col lg:grid lg:grid-cols-[320px_1fr] xl:grid-cols-[320px_1fr_320px] gap-4 lg:gap-6 p-4 sm:p-6 overflow-y-auto lg:overflow-hidden no-scrollbar">

        {/* Left Section: Memo (Shown under calendar on mobile) */}
        <section className="order-2 lg:order-1 flex flex-col gap-3 lg:gap-4 overflow-hidden h-full mt-2 lg:mt-0">
          <div className="flex items-center justify-between shrink-0">
            <h2 className="text-lg lg:text-xl font-black tracking-tight">최근 메모</h2>
            <Link href="/memo" className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 lg:hidden">전체보기</Link>
          </div>

          <div className="flex-1 flex flex-col gap-2 lg:gap-3 overflow-y-auto pr-1 no-scrollbar min-h-0">
            {loading ? (
              <div className="py-10 flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                <span className="text-xs text-gray-400 font-bold">로딩 중...</span>
              </div>
            ) : recentMemos.length === 0 ? (
              <div className="bg-white rounded-3xl border border-dashed border-gray-200 py-10 flex flex-col items-center justify-center gap-2 text-center px-4">
                <Plus className="w-8 h-8 text-gray-200" />
                <p className="text-xs text-gray-400 font-medium leading-relaxed">아직 메모가 없습니다.<br/>새로운 생각을 기록해보세요!</p>
              </div>
            ) : (
              recentMemos.map((memo) => (
                <MemoCard
                  key={memo.id}
                  title={memo.title}
                  description={memo.content}
                  author={session?.user?.name || '나'}
                  date={format(new Date(memo.createdAt), 'yyyy.MM.dd')}
                  tags={memo.tags.map((t) => `#${t}`)}
                  onClick={() => handleMemoClick(memo.id)}
                />
              ))
            )}
          </div>
        </section>

        {/* Center Section: Calendar (Top on mobile) */}
        <section className="order-1 lg:order-2 bg-white rounded-3xl lg:rounded-[2.5rem] border border-gray-100 p-4 lg:p-8 shadow-sm flex flex-col h-fit lg:h-full lg:overflow-hidden relative group">
          <div className="flex items-center justify-between mb-2 lg:hidden">
            <h2 className="text-lg lg:text-xl font-black tracking-tight text-gray-800">일정 캘린더</h2>
          </div>
          {isMounted ? (
            <div className="flex-1 min-h-[420px] lg:min-h-[400px]">
              <Calendar
                onChange={(val) => val instanceof Date && setCurrentDate(val)}
                value={currentDate}
                className="w-full h-full border-none font-sans"
                tileContent={getTileContent}
                formatDay={(locale, date) => format(date, 'd')}
                calendarType="gregory"
                onClickDay={handleOpenListModal}
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center min-h-[420px] lg:min-h-[400px]">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
          )}
        </section>

        {/* Right Section: Groups (Bottom on mobile) */}
        <section className="order-3 lg:order-3 flex flex-col gap-3 lg:gap-4 h-full overflow-hidden mt-2 lg:mt-0">
          <div className="flex items-center justify-between shrink-0">
            <h2 className="text-lg lg:text-xl font-black tracking-tight">내 모임</h2>
            <Link href="/groups" className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 lg:hidden">전체보기</Link>
          </div>
          <div className="flex-1 flex flex-col gap-2 lg:gap-3 overflow-y-auto pr-1 no-scrollbar min-h-0">
            {loading ? (
              <div className="py-10 flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                <span className="text-xs text-gray-400 font-bold">로딩 중...</span>
              </div>
            ) : userGroups.length === 0 ? (
              <div className="bg-white rounded-3xl border border-dashed border-gray-200 py-10 flex flex-col items-center justify-center gap-2 text-center px-4">
                <Users className="w-8 h-8 text-gray-200" />
                <p className="text-xs text-gray-400 font-medium leading-relaxed">참여 중인 모임이 없습니다.<br/>친구들을 초대해 모임을 만들어보세요!</p>
              </div>
            ) : (
              userGroups.map((group) => (
                <GroupCard 
                  key={group.id}
                  group={group}
                  onClick={() => router.push(`/groups/${group.id}`)}
                />
              ))
            )}
          </div>
        </section>

      </main>

      <AppointmentModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setSelectedSchedule(null); }}
        initialDate={selectedDate}
        onSuccess={fetchData}
        initialSchedule={selectedSchedule}
      />

      <AppointmentListModal
        isOpen={isListModalOpen}
        onClose={() => setIsListModalOpen(false)}
        date={selectedDate}
        appointments={schedules.filter(s => isSameDay(parseISO(s.startTime), new Date(selectedDate)))}
        onCreateNew={() => { setSelectedSchedule(null); setIsModalOpen(true); }}
        onAppointmentClick={handleScheduleClick}
      />

      <AppointmentDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => { setIsDetailModalOpen(false); setSelectedSchedule(null); }}
        schedule={selectedSchedule}
        onSuccess={fetchData}
        onEdit={handleEdit}
      />

      {userId && (
        <MemoDetailModal
          isOpen={isMemoModalOpen}
          onClose={() => setIsMemoModalOpen(false)}
          memoId={selectedMemoId}
          userId={userId}
        />
      )}
    </div>
  );
}

interface MemoCardProps {
  title: string;
  description: string;
  author: string;
  date: string;
  tags: string[];
  isLocked?: boolean;
  onClick: () => void;
}

function MemoCard({ title, description, author, date, tags, isLocked = false, onClick }: MemoCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-2 relative group hover:border-indigo-200 transition-all cursor-pointer"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-black text-sm text-gray-800 line-clamp-1 group-hover:text-indigo-600 transition-colors">{title}</h3>
        {isLocked ? (
          <Lock className="w-3.5 h-3.5 text-gray-400" />
        ) : (
          <Share2 className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" />
        )}
      </div>
      <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed font-medium">{description}</p>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{author}</span>
        <span className="text-[10px] text-gray-400 font-medium">{date}</span>
      </div>
      {tags.length > 0 && (
        <div className="flex gap-1.5 mt-1 flex-wrap">
          {tags.map((tag: string) => (
            <span key={tag} className="text-[9px] text-indigo-500 font-black">{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function EventBadge({ color, text }: { color: string, text: string }) {
  return (
    <div className={`${color} text-white text-[8px] px-1 py-0.5 rounded font-black truncate shadow-sm`}>
      {text}
    </div>
  );
}

interface GroupCardProps {
  group: GroupResponse;
  onClick: () => void;
}

function GroupCard({ group, onClick }: GroupCardProps) {
  const themeClasses = {
    indigo: {
      iconBg: 'bg-indigo-500',
      borderColor: 'border-indigo-100',
      memberBg: 'bg-indigo-50',
      memberText: 'text-indigo-500'
    },
    blue: {
      iconBg: 'bg-blue-500',
      borderColor: 'border-blue-100',
      memberBg: 'bg-blue-50',
      memberText: 'text-blue-500'
    },
    emerald: {
      iconBg: 'bg-emerald-500',
      borderColor: 'border-emerald-100',
      memberBg: 'bg-emerald-50',
      memberText: 'text-emerald-500'
    },
    orange: {
      iconBg: 'bg-orange-500',
      borderColor: 'border-orange-100',
      memberBg: 'bg-orange-50',
      memberText: 'text-orange-500'
    },
    rose: {
      iconBg: 'bg-rose-500',
      borderColor: 'border-rose-100',
      memberBg: 'bg-rose-50',
      memberText: 'text-rose-500'
    },
    amber: {
      iconBg: 'bg-amber-500',
      borderColor: 'border-amber-100',
      memberBg: 'bg-amber-50',
      memberText: 'text-amber-500'
    }
  };

  const theme = themeClasses[group.colorTheme as keyof typeof themeClasses] || themeClasses.indigo;
  const initial = group.name.substring(0, 1);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  const profileSrc = group.profileImage ? (group.profileImage.startsWith('/uploads/') ? `${apiUrl}${group.profileImage}` : group.profileImage) : null;

  return (
    <div onClick={onClick} className={`bg-white rounded-2xl border ${theme.borderColor} p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden flex items-center gap-4`}>
      <div className={`w-12 h-12 ${theme.iconBg} rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-sm shrink-0 group-hover:scale-105 transition-transform overflow-hidden relative`}>
        {profileSrc ? (
          <Image src={profileSrc} alt={group.name} fill className="object-cover" />
        ) : (
          initial
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-black text-gray-800 truncate group-hover:text-indigo-600 transition-colors">{group.name}</h3>
        <p className="text-[10px] text-gray-400 mt-1 truncate font-medium">{group.description || '설명이 없습니다.'}</p>
        <div className="flex items-center gap-1.5 mt-2">
          <div className="flex -space-x-1.5">
            {group.members.slice(0, 3).map((member) => (
              <div 
                key={member.id} 
                className={`w-5 h-5 rounded-full ${theme.memberBg} ${theme.memberText} border border-white flex items-center justify-center text-[8px] font-bold overflow-hidden shadow-sm shrink-0`}
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
          </div>
          <span className="text-[9px] text-gray-400 font-bold ml-1">{group.memberCount}명 참여 중</span>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
      <div className={`absolute -right-2 -bottom-2 w-16 h-16 ${theme.iconBg} opacity-[0.03] rounded-full pointer-events-none`} />
    </div>
  );
}
