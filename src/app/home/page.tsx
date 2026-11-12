'use client';

import React, { useState, useSyncExternalStore } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format, isSameDay, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ImageWithFallback from '@/components/ImageWithFallback';
import {
  Plus,
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

  const queryClient = useQueryClient();

  const { data: memoData, isLoading: memosLoading } = useQuery({
    queryKey: ['memos'],
    queryFn: () => memoApi.getAll(session!),
    enabled: !!session
  });

  const { data: scheduleData, isLoading: schedulesLoading } = useQuery({
    queryKey: ['schedules'],
    queryFn: () => scheduleApi.getAll(session!),
    enabled: !!session
  });

  const { data: groupData, isLoading: groupsLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: () => groupApi.getAll(session!),
    enabled: !!session
  });

  const recentMemos = memoData ? memoData.slice(0, 5) : [];
  const schedules = scheduleData || [];
  const userGroups = groupData || [];
  const loading = memosLoading || schedulesLoading || groupsLoading;

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
  const [currentDate, setCurrentDate] = useState(new Date());

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
            className="bg-raised text-ink-2 p-1 rounded-md hover:bg-line cursor-pointer transition-colors"
          >
            <Plus size={12} strokeWidth={1.5} />
          </div>
        </div>
        {daySchedules.slice(0, 2).map(s => (
          <div key={s.id} className="bg-accent-soft text-accent text-xs px-1.5 py-0.5 rounded-md truncate w-full text-left">
            {s.title}
          </div>
        ))}
        {daySchedules.length > 2 && (
          <div className="text-xs text-ink-3 tabular-nums">+{daySchedules.length - 2}</div>
        )}
      </div>
    );
  };

  return (
    <div className="h-screen flex flex-col bg-canvas text-ink overflow-hidden font-sans">
      <Navbar />
      <main className="flex-1 w-full flex flex-col lg:grid lg:grid-cols-[320px_1fr] xl:grid-cols-[320px_1fr_320px] gap-6 p-4 lg:p-6 overflow-y-auto lg:overflow-hidden no-scrollbar">

        {/* Left Section: Memo */}
        <section className="order-2 lg:order-1 flex flex-col gap-3 lg:overflow-hidden lg:h-full">
          <div className="flex items-center justify-between shrink-0">
            <h2 className="text-base font-semibold text-ink">최근 메모 <span className="ml-1 text-xs font-normal text-ink-3 tabular-nums">{recentMemos.length}</span></h2>
            <Link href="/memo" className="text-xs text-ink-3 hover:text-ink transition-colors">전체 보기</Link>
          </div>

          <div className="flex-1 flex flex-col gap-2 overflow-y-auto no-scrollbar min-h-0">
            {loading ? (
              <div className="py-16 flex flex-col items-center gap-3">
                <Loader2 size={18} strokeWidth={1.5} className="animate-spin text-ink-3" />
                <span className="text-sm text-ink-3">불러오는 중</span>
              </div>
            ) : recentMemos.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-center px-6">
                <div className="size-10 rounded-full bg-raised flex items-center justify-center">
                  <Plus size={18} strokeWidth={1.5} className="text-ink-3" />
                </div>
                <p className="text-sm font-medium text-ink">아직 메모가 없어요</p>
                <p className="text-sm text-ink-3">새 메모를 쓰면 여기에 모여요</p>
              </div>
            ) : (
              recentMemos.map((memo) => (
                <MemoCard
                  key={memo.id}
                  title={memo.title}
                  description={stripMarkdown(memo.content)}
                  author={session?.user?.name || '나'}
                  date={format(new Date(memo.createdAt), 'M.d EEE HH:mm', { locale: ko })}
                  tags={memo.tags.map((t) => `#${t}`)}
                  onClick={() => handleMemoClick(memo.id)}
                />
              ))
            )}
          </div>
        </section>

        {/* Center Section: Calendar */}
        <section className="order-1 lg:order-2 card p-5 lg:p-6 flex flex-col h-fit lg:h-full lg:overflow-hidden relative group">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-base font-semibold text-ink">오늘</h2>
            <span className="stamp">{format(new Date(), 'M.d EEE', { locale: ko })}</span>
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
              <Loader2 size={18} strokeWidth={1.5} className="animate-spin text-ink-3" />
            </div>
          )}
        </section>

        {/* Right Section: Groups */}
        <section className="order-3 lg:order-3 flex flex-col gap-3 lg:h-full lg:overflow-hidden">
          <div className="flex items-center justify-between shrink-0">
            <h2 className="text-base font-semibold text-ink">내 모임 <span className="ml-1 text-xs font-normal text-ink-3 tabular-nums">{userGroups.length}</span></h2>
            <Link href="/groups" className="text-xs text-ink-3 hover:text-ink transition-colors">전체 보기</Link>
          </div>
          <div className="flex-1 flex flex-col gap-2 overflow-y-auto no-scrollbar min-h-0">
            {loading ? (
              <div className="py-16 flex flex-col items-center gap-3">
                <Loader2 size={18} strokeWidth={1.5} className="animate-spin text-ink-3" />
                <span className="text-sm text-ink-3">불러오는 중</span>
              </div>
            ) : userGroups.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-center px-6">
                <div className="size-10 rounded-full bg-raised flex items-center justify-center">
                  <Users size={18} strokeWidth={1.5} className="text-ink-3" />
                </div>
                <p className="text-sm font-medium text-ink">참여 중인 모임이 없어요</p>
                <p className="text-sm text-ink-3">친구를 초대해 모임을 만들어 보세요</p>
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
        onSuccess={refreshData}
        initialSchedule={selectedSchedule}
      />

      <AppointmentListModal
        isOpen={isListModalOpen}
        onClose={() => setIsListModalOpen(false)}
        date={selectedDate}
        appointments={schedules.filter(s => isSameDay(parseISO(s.startTime), parseISO(selectedDate)))}
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

function MemoCard({ title, description, author, date, tags, onClick }: { title: string, description: string, author: string, date: string, tags: string[], onClick: () => void }) {
  const { data: session } = useSession();
  const userImage = session?.user?.image;
  const userName = session?.user?.name || author;

  return (
    <div onClick={onClick} className="card px-4 py-3 hover:bg-raised transition-colors cursor-pointer group">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="font-medium text-ink text-sm line-clamp-1">{title}</h3>
        <Share2 size={16} strokeWidth={1.5} className="text-ink-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </div>
      <p className="text-sm text-ink-2 line-clamp-2 leading-relaxed mb-3">{description}</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-5 rounded-full bg-raised flex items-center justify-center text-ink-2 text-xs overflow-hidden relative shrink-0">
            {userImage ? (
              <ImageWithFallback
                src={userImage}
                alt={userName}
                fill
                containerClassName="w-full h-full"
                className="object-cover"
                unoptimized
              />
            ) : (
              userName[0]
            )}
          </div>
          <span className="text-xs text-ink-3 truncate">{userName}</span>
        </div>
        <span className="stamp shrink-0">{date}</span>
      </div>
    </div>
  );
}

function EventBadge({ color, text }: { color: string, text: string }) {
  return (
    <div className={`${color} text-xs px-1.5 py-0.5 rounded-md truncate`}>
      {text}
    </div>
  );
}

interface GroupCardProps {
  group: GroupResponse;
  onClick: () => void;
}

function GroupCard({ group, onClick }: GroupCardProps) {
  const initial = group.name.substring(0, 1);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  const profileSrc = group.profileImage ? (group.profileImage.startsWith('/uploads/') ? `${apiUrl}${group.profileImage}` : group.profileImage) : null;

  return (
    <div onClick={onClick} className="card px-4 py-3 hover:bg-raised transition-colors cursor-pointer group flex items-center gap-3">
      {profileSrc ? (
        <ImageWithFallback
          src={profileSrc}
          alt={group.name}
          fill
          containerClassName="size-10 bg-raised rounded-[10px] flex items-center justify-center text-ink-2 text-base font-medium shrink-0 relative"
          className="object-cover"
          fallbackIcon={initial}
        />
      ) : (
        <div className="size-10 bg-raised rounded-[10px] flex items-center justify-center text-ink-2 text-base font-medium shrink-0 relative overflow-hidden">
          {initial}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-ink truncate">{group.name}</h3>
        <div className="flex items-center gap-1.5 mt-1">
          <div className="flex -space-x-1.5">
            {group.members.slice(0, 3).map((member) => (
              <div
                key={member.id}
                className="size-5 rounded-full bg-raised text-ink-2 border border-surface flex items-center justify-center text-xs overflow-hidden shrink-0 relative"
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
          <span className="text-xs text-ink-3 ml-1 tabular-nums">{group.memberCount}명</span>
        </div>
      </div>
      <ChevronRight size={16} strokeWidth={1.5} className="text-ink-3" />
    </div>
  );
}
