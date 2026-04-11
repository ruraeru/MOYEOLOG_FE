'use client';

import { useState } from 'react';
import { 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Lock, 
  Share2, 
  Users, 
  Calendar as CalendarIcon 
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import AppointmentModal from '@/components/AppointmentModal';
import MemoDetailModal from '@/components/MemoDetailModal';

export default function HomePage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);
  const [selectedMemo, setSelectedMemo] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState('2026-04-11');

  const handleOpenModal = (day: number) => {
    const formattedDate = `2026-04-${day.toString().padStart(2, '0')}`;
    setSelectedDate(formattedDate);
    setIsModalOpen(true);
  };

  const handleMemoClick = (memo: any) => {
    setSelectedMemo(memo);
    setIsMemoModalOpen(true);
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

          <div className="flex gap-2 text-[11px] font-medium text-gray-500 pb-2 shrink-0 overflow-x-auto no-scrollbar">
            <button className="hover:text-indigo-600 shrink-0">전체</button>
            <button className="hover:text-indigo-600 shrink-0">#모임</button>
            <button className="hover:text-indigo-600 shrink-0">#계획</button>
            <button className="hover:text-indigo-600 shrink-0">#업무</button>
            <button className="hover:text-indigo-600 shrink-0">#회의</button>
          </div>

          <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-1 no-scrollbar">
            <MemoCard 
              title="다음 주 모임 계획" 
              description="홍대에서 만나서 저녁 먹고 영화 보기. 지민이가 좋아하는 파스타 집 예약했음. 영화는 CGV에서 7시 반 예매."
              author="민수"
              date="2026-04-05"
              tags={['#모임', '#계획']}
              onClick={() => handleMemoClick({
                title: "다음 주 모임 계획",
                description: "홍대에서 만나서 저녁 먹고 영화 보기. 지민이가 좋아하는 파스타 집 예약했음. 영화는 CGV에서 7시 반 예매.",
                author: "민수",
                date: "2026-04-05",
                tags: ['#모임', '#계획']
              })}
            />
            <MemoCard 
              title="회의록" 
              description="프로젝트 진행 상황 논의. 다음 마일스톤까지 2주 남음. UI 디자인 완료, 백엔드 API 개발 중."
              author="나"
              date="2026-04-04"
              tags={['#업무', '#회의']}
              isLocked
              onClick={() => handleMemoClick({
                title: "회의록",
                description: "프로젝트 진행 상황 논의. 다음 마일스톤까지 2주 남음. UI 디자인 완료, 백엔드 API 개발 중.",
                author: "나",
                date: "2026-04-04",
                tags: ['#업무', '#회의'],
                locked: true
              })}
            />
            <MemoCard 
              title="주말 계획" 
              description="토요일 오전 10시 운동, 오후 2시 친구 만나기. 일요일은 집에서 쉬면서 책 읽기."
              author="나"
              date="2026-04-03"
              tags={['#개인', '#주말']}
              onClick={() => handleMemoClick({
                title: "주말 계획",
                description: "토요일 오전 10시 운동, 오후 2시 친구 만나기. 일요일은 집에서 쉬면서 책 읽기.",
                author: "나",
                date: "2026-04-03",
                tags: ['#개인', '#주말']
              })}
            />
          </div>
        </section>

        {/* Center Section: Calendar */}
        <section className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 shadow-sm flex flex-col h-full overflow-hidden relative">
          <div className="flex items-center justify-between mb-6 shrink-0">
            <h2 className="text-xl font-bold">2026년 4월</h2>
            <div className="flex gap-4">
              <button className="p-1 hover:bg-gray-100 rounded text-gray-600">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button className="p-1 hover:bg-gray-100 rounded text-gray-600">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div className="flex-1 grid grid-cols-7 gap-px bg-gray-100 border border-gray-100 rounded-lg overflow-hidden h-full">
            {['일', '월', '화', '수', '목', '금', '토'].map((day, i) => (
              <div key={day} className={`bg-white p-2 text-center text-xs sm:text-sm font-bold shrink-0 ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'}`}>
                {day}
              </div>
            ))}
            {Array.from({ length: 30 }).map((_, i) => {
              const day = i + 1;
              return (
                <div key={i} className="bg-white min-h-[60px] sm:min-h-[100px] p-1 sm:p-2 relative group hover:bg-gray-50 transition-colors overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs sm:text-sm font-medium ${[5, 12, 19, 26].includes(i+1) ? 'text-red-500' : ''}`}>{day}</span>
                    <button 
                      onClick={() => handleOpenModal(day)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-50 text-indigo-600 p-1 rounded-md hover:bg-indigo-100"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="mt-1 flex flex-col gap-0.5">
                    {day === 6 && <EventBadge color="bg-indigo-500" text="팀 회의" />}
                    {day === 7 && <EventBadge color="bg-emerald-500" text="헬스" />}
                    {day === 8 && <EventBadge color="bg-blue-500" text="친구들과 저녁" />}
                    {day === 12 && <EventBadge color="bg-orange-500" text="독서 모임" />}
                  </div>
                </div>
              );
            })}
          </div>
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

      <MemoDetailModal 
        isOpen={isMemoModalOpen} 
        onClose={() => setIsMemoModalOpen(false)} 
        memo={selectedMemo} 
      />
    </div>
  );
}

function MemoCard({ title, description, author, date, tags, isLocked = false, onClick }: any) {
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

function GroupCard({ icon, title, desc, members }: any) {
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
