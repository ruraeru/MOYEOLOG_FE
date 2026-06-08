'use client';

import React, { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useSession } from 'next-auth/react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format, isSameDay, parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ImageWithFallback from '@/components/ImageWithFallback';
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
import { stripMarkdown } from '@/lib/utils';

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
            className="bg-indigo-50 text-indigo-500 p-1 rounded-md hover:bg-indigo-100 cursor-pointer transition-colors"
          >
            <Plus className="w-3 h-3" />
          </div>
        </div>
        {daySchedules.slice(0, 2).map(s => {
          const group = userGroups.find(g => g.id === s.groupId);
          const themeKey = group?.colorTheme || 'indigo';
          const pastelColors = {
            indigo: 'bg-indigo-100 text-indigo-600',
            blue: 'bg-sky-100 text-sky-600',
            emerald: 'bg-emerald-100 text-emerald-600',
            orange: 'bg-orange-100 text-orange-600',
            rose: 'bg-rose-100 text-rose-600',
            amber: 'bg-amber-100 text-amber-600'
          };
          const colorClass = pastelColors[themeKey as keyof typeof pastelColors] || pastelColors.indigo;
          return (
            <div key={s.id} className={`${colorClass} text-[8px] px-1 py-0.5 rounded font-bold truncate`}>
              {s.title}
            </div>
          );
        })}
        {daySchedules.length > 2 && (
          <div className="text-[8px] text-gray-400 font-bold text-center">+{daySchedules.length - 2}</div>
        )}
      </div>
    );
  };

  return (
    <div className="h-screen flex flex-col bg-white text-gray-900 overflow-hidden font-sans">
      <Navbar />
      <main className="flex-1 w-full flex flex-col lg:grid lg:grid-cols-[320px_1fr] xl:grid-cols-[320px_1fr_320px] gap-6 p-6 lg:p-8 overflow-y-auto lg:overflow-hidden no-scrollbar">

        {/* Left Section: Memo */}
        <section className="order-2 lg:order-1 flex flex-col gap-4 overflow-hidden h-full">
          <div className="flex items-center justify-between shrink-0 px-1">
            <h2 className="text-xl font-black tracking-tight text-gray-800">최근 메모</h2>
            <Link href="/memo" className="text-[11px] font-bold text-indigo-400 hover:text-indigo-600 transition-colors">전체보기</Link>
          </div>

          <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-1 no-scrollbar min-h-0">
            {loading ? (
              <div className="py-20 flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-300" />
                <span className="text-xs text-gray-400 font-semibold tracking-tight">불러오는 중...</span>
              </div>
            ) : recentMemos.length === 0 ? (
              <div className="bg-gray-50/50 rounded-[2rem] border border-dashed border-gray-200 py-16 flex flex-col items-center justify-center gap-3 text-center px-6">
                <Plus className="w-8 h-8 text-gray-200" />
                <p className="text-xs text-gray-400 font-semibold leading-relaxed">아직 메모가 없습니다.<br/>새로운 생각을 기록해보세요!</p>
              </div>
            ) : (
              recentMemos.map((memo) => (
                <MemoCard
                  key={memo.id}
                  title={memo.title}
                  description={stripMarkdown(memo.content)}
                  author={session?.user?.name || '나'}
                  date={format(new Date(memo.createdAt), 'yyyy.MM.dd')}
                  tags={memo.tags.map((t) => `#${t}`)}
                  onClick={() => handleMemoClick(memo.id)}
                />
              ))
            )}
          </div>
        </section>

        {/* Center Section: Calendar */}
        <section className="order-1 lg:order-2 bg-white rounded-[2.5rem] border border-gray-100 p-6 lg:p-10 shadow-pastel flex flex-col h-fit lg:h-full lg:overflow-hidden relative group">
          <div className="flex items-center justify-between mb-4 lg:hidden">
            <h2 className="text-xl font-black tracking-tight text-gray-800">일정 캘린더</h2>
          </div>
          {isMounted ? (
            <div className="flex-1 min-h-[440px]">
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
            <div className="flex-1 flex items-center justify-center min-h-[440px]">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
            </div>
          )}
        </section>

        {/* Right Section: Groups */}
        <section className="order-3 lg:order-3 flex flex-col gap-4 h-full overflow-hidden">
          <div className="flex items-center justify-between shrink-0 px-1">
            <h2 className="text-xl font-black tracking-tight text-gray-800">내 모임</h2>
            <Link href="/groups" className="text-[11px] font-bold text-indigo-400 hover:text-indigo-600 transition-colors">전체보기</Link>
          </div>
          <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-1 no-scrollbar min-h-0">
            {loading ? (
              <div className="py-20 flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-300" />
                <span className="text-xs text-gray-400 font-semibold tracking-tight">불러오는 중...</span>
              </div>
            ) : userGroups.length === 0 ? (
              <div className="bg-gray-50/50 rounded-[2rem] border border-dashed border-gray-200 py-16 flex flex-col items-center justify-center gap-3 text-center px-6">
                <Users className="w-8 h-8 text-gray-200" />
                <p className="text-xs text-gray-400 font-semibold leading-relaxed">참여 중인 모임이 없습니다.<br/>친구들을 초대해 모임을 만들어보세요!</p>
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
    </div>
  );
}

function MemoCard({ title, description, author, date, tags, onClick }: { title: string, description: string, author: string, date: string, tags: string[], onClick: () => void }) {
  return (
    <div onClick={onClick} className="bg-white border border-gray-100 p-5 rounded-2xl hover:border-indigo-200 hover:shadow-sm transition-all cursor-pointer group">
      <div className="flex items-start justify-between mb-1.5">
        <h3 className="font-bold text-gray-800 text-sm line-clamp-1 group-hover:text-indigo-500 transition-colors tracking-tight">{title}</h3>
        <Share2 className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mb-3.5 font-medium">{description}</p>
      <div className="flex items-center justify-between pt-3 border-t border-gray-50">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-400 text-[8px] font-black">{author[0]}</div>
          <span className="text-[10px] text-gray-400 font-semibold">{author}</span>
        </div>
        <span className="text-[10px] text-gray-300 font-bold uppercase">{date}</span>
      </div>
    </div>
  );
}

function EventBadge({ color, text }: { color: string, text: string }) {
  return (
    <div className={`${color} text-[8px] px-1 py-0.5 rounded font-bold truncate`}>
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
    indigo: { iconBg: 'bg-indigo-100', text: 'text-indigo-500', memberBg: 'bg-indigo-50', memberText: 'text-indigo-400' },
    blue: { iconBg: 'bg-sky-100', text: 'text-sky-500', memberBg: 'bg-sky-50', memberText: 'text-sky-400' },
    emerald: { iconBg: 'bg-emerald-100', text: 'text-emerald-500', memberBg: 'bg-emerald-50', memberText: 'text-emerald-400' },
    orange: { iconBg: 'bg-orange-100', text: 'text-orange-500', memberBg: 'bg-orange-50', memberText: 'text-orange-400' },
    rose: { iconBg: 'bg-rose-100', text: 'text-rose-500', memberBg: 'bg-rose-50', memberText: 'text-rose-400' },
    amber: { iconBg: 'bg-amber-100', text: 'text-amber-500', memberBg: 'bg-amber-50', memberText: 'text-amber-400' }
  };

  const theme = themeClasses[group.colorTheme as keyof typeof themeClasses] || themeClasses.indigo;
  const initial = group.name.substring(0, 1);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  const profileSrc = group.profileImage ? (group.profileImage.startsWith('/uploads/') ? `${apiUrl}${group.profileImage}` : group.profileImage) : null;

  return (
    <div onClick={onClick} className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-indigo-100 hover:shadow-sm transition-all cursor-pointer group flex items-center gap-4">
      <ImageWithFallback 
        src={profileSrc || ''} 
        alt={group.name} 
        fill 
        containerClassName={`w-12 h-12 ${theme.iconBg} rounded-xl flex items-center justify-center ${theme.text} text-xl font-black shrink-0 group-hover:scale-105 transition-transform border border-white shadow-sm relative`} 
        className="object-cover"
        fallbackIcon={initial}
      />
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-bold text-gray-800 truncate group-hover:text-indigo-500 transition-colors tracking-tight">{group.name}</h3>
        <div className="flex items-center gap-1.5 mt-1.5">
          <div className="flex -space-x-1.5">
            {group.members.slice(0, 3).map((member) => (
              <div
                key={member.id}
                className={`w-5 h-5 rounded-full ${theme.memberBg} ${theme.memberText} border border-white flex items-center justify-center text-[8px] font-bold overflow-hidden shrink-0 shadow-sm relative`}
                title={member.nickname}
              >
                {member.profileImage ? (
                  <ImageWithFallback 
                    src={member.profileImage.startsWith('/uploads/') ? `${apiUrl}${member.profileImage}` : member.profileImage} 
                    alt={member.nickname} 
                    fill 
                    containerClassName="w-full h-full"
                    className="object-cover" 
                  />
                ) : member.nickname.substring(0, 1)}
              </div>
            ))}
          </div>
          <span className="text-[10px] text-gray-400 font-semibold ml-1">{group.memberCount} members</span>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-200 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
    </div>
  );
}
