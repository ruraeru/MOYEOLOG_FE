'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useSession } from 'next-auth/react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format } from 'date-fns';
import {
  Search,
  Plus,
  Lock,
  Share2,
  Users,
  ChevronRight
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import AppointmentModal from '@/components/AppointmentModal';
import AppointmentListModal from '@/components/AppointmentListModal';
import AppointmentDetailModal from '@/components/AppointmentDetailModal';
import MemoDetailModal from '@/components/MemoDetailModal';
import { listMemos, memoToCardView } from '@/lib/memo-storage';
import type { MemoCardView } from '@/types/memo';

interface Appointment {
  id: number;
  date: string;
  title: string;
  time: string;
  location: string;
  participants: string[];
  color: string;
  memo?: string;
  tags?: string[];
  group?: string;
}

const MOCK_APPOINTMENTS: Appointment[] = [
  { 
    id: 1, 
    date: '2026-04-06', 
    title: '팀 회의', 
    time: '14:00', 
    location: '회의실 A', 
    participants: ['나', '지민', '민수'], 
    color: 'bg-indigo-500',
    group: '대학 동기들',
    tags: ['#업무', '#프로젝트'],
    memo: '다음 마일스톤 일정 확정 및 역할 분담 논의 예정입니다.'
  },
  { 
    id: 2, 
    date: '2026-04-07', 
    title: '헬스', 
    time: '08:00', 
    location: '짐박스', 
    participants: ['나'], 
    color: 'bg-emerald-500',
    tags: ['#운동', '#오운완']
  },
  { 
    id: 3, 
    date: '2026-04-08', 
    title: '친구들과 저녁', 
    time: '19:00', 
    location: '홍대입구역', 
    participants: ['나', '지민', '현우'], 
    color: 'bg-blue-500',
    group: '대학 동기들',
    memo: '지민이가 가고 싶다던 파스타집 예약함.'
  },
  { 
    id: 4, 
    date: '2026-04-12', 
    title: '독서 모임', 
    time: '15:00', 
    location: '강남역 스타벅스', 
    participants: ['나', '예진', '동휘'], 
    color: 'bg-orange-500',
    group: '독서 모임',
    tags: ['#취미', '#독서'],
    memo: '이번 달 선정 도서: "사피엔스"'
  },
];

const emptySubscribe = () => () => { };

export default function HomePage() {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);
  const [selectedMemoId, setSelectedMemoId] = useState<string | null>(null);
  const [recentMemos, setRecentMemos] = useState<MemoCardView[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [currentDate, setCurrentDate] = useState(new Date());

  const isMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const handleOpenCreateModal = (date: Date) => {
    setSelectedDate(format(date, 'yyyy-MM-dd'));
    setIsModalOpen(true);
  };

  const handleOpenListModal = (date: Date) => {
    setSelectedDate(format(date, 'yyyy-MM-dd'));
    setIsListModalOpen(true);
  };

  const handleAppointmentClick = (apt: Appointment) => {
    setSelectedAppointment(apt);
    setIsDetailModalOpen(true);
  };

  const loadRecentMemos = useCallback(() => {
    if (!userId) return;
    setRecentMemos(listMemos(userId).slice(0, 3).map(memoToCardView));
  }, [userId]);

  useEffect(() => {
    loadRecentMemos();
  }, [loadRecentMemos]);

  const handleMemoClick = (memoId: string) => {
    setSelectedMemoId(memoId);
    setIsMemoModalOpen(true);
  };

  const getTileContent = ({ date, view }: { date: Date, view: string }) => {
    if (view !== 'month') return null;

    const dateStr = format(date, 'yyyy-MM-dd');
    const dayAppointments = MOCK_APPOINTMENTS.filter(apt => apt.date === dateStr);

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
        {dayAppointments.map(apt => (
          <EventBadge key={apt.id} color={apt.color} text={apt.title} />
        ))}
      </div>
    );
  };

  return (
    <div className="h-screen flex flex-col bg-[#F8F9FB] text-gray-900 overflow-hidden font-sans">
      <Navbar />
      <main className="flex-1 w-full grid grid-cols-1 lg:grid-cols-[320px_1fr] xl:grid-cols-[320px_1fr_320px] gap-6 p-4 sm:p-6 overflow-hidden">

        {/* Left Section: Memo */}
        <section className="hidden lg:flex flex-col gap-4 overflow-hidden h-full">
          <div className="flex items-center justify-between shrink-0">
            <h2 className="text-xl font-bold">메모</h2>
          </div>

          <div className="relative shrink-0">
            <input
              type="text"
              placeholder="검색..."
              className="w-full bg-white border border-gray-200 rounded-lg px-9 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          </div>

          <div className="flex gap-2 text-xs font-semibold shrink-0">
            <button className="px-3 py-1 bg-indigo-600 text-white rounded-full">전체</button>
            <button className="px-3 py-1 bg-white text-gray-600 border border-gray-100 rounded-full">내 메모</button>
            <button className="px-3 py-1 bg-white text-gray-600 border border-gray-100 rounded-full">공유받음</button>
          </div>

          <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-1 no-scrollbar">
            {recentMemos.length === 0 ? (
              <p className="text-xs text-gray-400 font-medium py-4">최근 메모가 없습니다.</p>
            ) : (
              recentMemos.map((memo) => (
                <MemoCard
                  key={memo.id}
                  title={memo.title}
                  description={memo.description}
                  author={session?.user?.name || '나'}
                  date={memo.date}
                  tags={memo.tags.map((t) => `#${t}`)}
                  isLocked={memo.locked}
                  onClick={() => handleMemoClick(memo.id)}
                />
              ))
            )}
          </div>
        </section>

        {/* Center Section: Calendar */}
        <section className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 shadow-sm flex flex-col h-full overflow-hidden relative">
          {isMounted ? (
            <Calendar
              onChange={(val) => val instanceof Date && setCurrentDate(val)}
              value={currentDate}
              className="w-full h-full border-none font-sans"
              tileContent={getTileContent}
              formatDay={(locale, date) => format(date, 'd')}
              calendarType="gregory"
              onClickDay={handleOpenListModal}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          )}
        </section>

        {/* Right Section: Groups */}
        <section className="hidden xl:flex flex-col gap-4 h-full overflow-hidden">
          <h2 className="text-xl font-bold shrink-0">모임</h2>
          <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-1 no-scrollbar">
            <GroupCard icon="bg-blue-500" title="대학 동기들" desc="같은 과 친구들과 정기적으로 모임" members="지민 외 4명" />
            <GroupCard icon="bg-emerald-500" title="헬스 크루" desc="매주 운동하는 모임" members="현우 외 2명" />
            <GroupCard icon="bg-orange-500" title="독서 모임" desc="한 달에 한 권씩 책 읽고 토론" members="예진 외 3명" />
          </div>
        </section>

      </main>

      <AppointmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialDate={selectedDate}
      />

      <AppointmentListModal
        isOpen={isListModalOpen}
        onClose={() => setIsListModalOpen(false)}
        date={selectedDate}
        appointments={MOCK_APPOINTMENTS.filter(apt => apt.date === selectedDate)}
        onCreateNew={() => setIsModalOpen(true)}
        onAppointmentClick={handleAppointmentClick}
      />

      <AppointmentDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        appointment={selectedAppointment}
      />

      {userId && (
        <MemoDetailModal
          isOpen={isMemoModalOpen}
          onClose={() => setIsMemoModalOpen(false)}
          memoId={selectedMemoId}
          userId={userId}
          authorName={session?.user?.name}
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
      className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-2 relative group hover:border-indigo-200 transition-all cursor-pointer"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm text-gray-800">{title}</h3>
        {isLocked ? (
          <Lock className="w-3.5 h-3.5 text-gray-400" />
        ) : (
          <Share2 className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" />
        )}
      </div>
      <p className="text-xs text-gray-500 line-clamp-3 leading-relaxed">{description}</p>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-gray-400 font-medium">{author}</span>
        <span className="text-[10px] text-gray-400">{date}</span>
      </div>
      <div className="flex gap-1.5 mt-1">
        {tags.map((tag: string) => (
          <span key={tag} className="text-[10px] text-indigo-500 font-bold">{tag}</span>
        ))}
      </div>
    </div>
  );
}

function EventBadge({ color, text }: { color: string, text: string }) {
  return (
    <div className={`${color} text-white text-[10px] px-1.5 py-0.5 rounded font-bold truncate`}>
      {text}
    </div>
  );
}

interface GroupCardProps {
  icon: string;
  title: string;
  desc: string;
  members: string;
}

function GroupCard({ icon, title, desc, members }: GroupCardProps) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-gray-50 shadow-sm flex items-center gap-4 hover:bg-gray-50 transition-colors cursor-pointer group">
      <div className={`w-10 h-10 ${icon} rounded-xl flex items-center justify-center text-white`}>
        <Users className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <h3 className="text-sm font-bold text-gray-800">{title}</h3>
        <p className="text-[11px] text-gray-400 mt-0.5">{desc}</p>
        <div className="flex items-center gap-1 mt-1.5">
          <Users className="w-3 h-3 text-gray-400" />
          <span className="text-[10px] text-indigo-500 font-bold">{members}</span>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors" />
    </div>
  );
}
