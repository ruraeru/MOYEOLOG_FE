'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Navbar from '@/components/Navbar';
import {
  Search,
  Plus,
  Grid,
  List,
  ChevronDown,
  Archive,
  User,
  Share2,
  Star,
  Lock,
  Circle,
} from 'lucide-react';
import Image from 'next/image';
import MemoDetailModal from '@/components/MemoDetailModal';
import MemoCreateModal from '@/components/MemoCreateModal';
import { memoApi } from '@/lib/memo-api';
import type { MemoCardView } from '@/types/memo';

export default function MemoPage() {
  const { data: session, status } = useSession();
  const userId = session?.user?.id;

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [memos, setMemos] = useState<MemoCardView[]>([]);
  const [selectedMemoId, setSelectedMemoId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const loadMemos = useCallback(async () => {
    if (!session) return;
    try {
      const data = await memoApi.getAll(session);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const items: MemoCardView[] = data.map(m => ({
        id: m.id,
        title: m.title,
        description: m.content,
        image: m.imageUrl ? (m.imageUrl.startsWith('/uploads/') ? `${apiUrl}${m.imageUrl}` : m.imageUrl) : undefined,
        tags: [], // 우선 빈 배열
        category: '내 메모',
        categoryColor: 'bg-indigo-500',
        date: new Date(m.createdAt).toLocaleDateString(),
        locked: false
      }));
      setMemos(items);
    } catch (error) {
      console.error('Failed to load memos:', error);
    }
  }, [session]);

  useEffect(() => {
    loadMemos();
  }, [loadMemos]);

  const handleMemoClick = (memo: MemoCardView) => {
    setSelectedMemoId(memo.id);
    setIsDetailOpen(true);
  };

  if (status === 'loading') {
    return (
      <div className="h-screen flex items-center justify-center bg-[#F8F9FB]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white text-gray-900 overflow-hidden font-sans">
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-65 border-r border-gray-100 flex flex-col p-5 gap-10 overflow-y-auto no-scrollbar lg:flex">
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 flex items-center gap-2">
              <ChevronDown className="w-3 h-3" /> 카테고리
            </h3>
            <div className="space-y-1">
              <SidebarItem icon={Archive} label="전체 메모" active />
              <SidebarItem icon={User} label="내 메모" />
              <SidebarItem icon={Share2} label="공유받은 메모" />
              <SidebarItem icon={Star} label="즐겨찾기" />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 flex items-center gap-2">
              <ChevronDown className="w-3 h-3" /> 모임별 폴더
            </h3>
            <div className="space-y-1">
              <SidebarItem label="대학 동기들" count={3} color="text-blue-500" />
              <SidebarItem label="헬스 크루" count={1} color="text-emerald-500" />
              <SidebarItem label="독서 모임" count={1} color="text-orange-500" />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 flex items-center gap-2">
              <ChevronDown className="w-3 h-3" /> 태그
            </h3>
            <div className="flex flex-wrap gap-2 px-1">
              {['React', '시험기간', '독서모임', '프로젝트', '스터디', '회의록', '아이디어'].map((tag) => (
                <span
                  key={tag}
                  className="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded-md cursor-pointer hover:bg-gray-200 transition-colors"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden bg-[#F8F9FB]">
          <div className="p-8 pb-4 space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">메모 보관함</h2>

            <div className="flex items-center gap-4 justify-between">
              <div className="relative flex-1 max-w-5xl">
                <input
                  type="text"
                  placeholder="AI 통합 검색..."
                  className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all outline-none shadow-sm"
                />
                <Search className="w-5 h-5 absolute left-3.5 top-3 text-gray-300" />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                  최신순 <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>
                <div className="flex p-1 bg-white border border-gray-200 rounded-lg shadow-sm">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-50'}`}
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-50'}`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-8 pt-4 no-scrollbar">
            {memos.length === 0 ? (
              <p className="text-center text-sm text-gray-400 font-medium py-20">
                메모가 없습니다. 우측 하단 + 버튼으로 첫 메모를 작성해보세요.
              </p>
            ) : (
              <div
                className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}
              >
                {memos.map((memo) => (
                  <div
                    key={memo.id}
                    onClick={() => handleMemoClick(memo)}
                    className="contents"
                  >
                    <MemoCard {...memo} viewMode={viewMode} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="fixed bottom-10 right-10 w-14 h-14 bg-[#6366F1] text-white rounded-full flex items-center justify-center shadow-xl hover:bg-[#5558E6] transition-all transform hover:scale-110 group"
          >
            <Plus className="w-8 h-8 group-hover:rotate-90 transition-transform duration-300" />
          </button>
        </main>
      </div>

      {userId && (
        <>
          <MemoDetailModal
            isOpen={isDetailOpen}
            onClose={() => setIsDetailOpen(false)}
            memoId={selectedMemoId}
            userId={userId}
            authorName={session?.user?.name}
          />

          <MemoCreateModal
            isOpen={isCreateOpen}
            onClose={() => setIsCreateOpen(false)}
            userId={userId}
            onSuccess={loadMemos}
          />
        </>
      )}
    </div>
  );
}

interface SidebarItemProps {
  icon?: React.ElementType;
  label: string;
  count?: number;
  active?: boolean;
  color?: string;
}

function SidebarItem({ icon: Icon, label, count, active, color }: SidebarItemProps) {
  return (
    <div
      className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all ${active ? 'bg-[#F0F2FF] text-[#6366F1]' : 'hover:bg-gray-50 text-gray-600'}`}
    >
      <div className="flex items-center gap-3">
        {Icon && <Icon className={`w-4 h-4 ${active ? 'text-[#6366F1]' : 'text-gray-400'}`} />}
        {!Icon && <Circle className={`w-1.5 h-1.5 fill-current ${color || 'text-gray-300'}`} />}
        <span className="text-sm font-bold">{label}</span>
      </div>
      {count !== undefined && <span className="text-xs font-medium text-gray-400">{count}</span>}
    </div>
  );
}

interface MemoCardProps extends MemoCardView {
  viewMode: 'grid' | 'list';
}

function MemoCard({
  title,
  description,
  image,
  tags,
  category,
  categoryColor,
  date,
  locked,
  viewMode,
}: MemoCardProps) {
  const thumb = image ? <MemoThumbnail src={image} alt={title} viewMode={viewMode} /> : null;

  if (viewMode === 'list') {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:border-indigo-100 transition-all group flex overflow-hidden p-6 gap-6 relative cursor-pointer">
        {thumb}
        <div className="flex flex-col flex-1 min-w-0 py-1">
          <h4 className="font-bold text-gray-800 text-[17px] truncate mb-2">{title}</h4>
          <p className="text-sm text-gray-500 leading-relaxed line-clamp-2 mb-4">{description}</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {tags.map((tag) => (
              <span
                key={tag}
                className="text-[11px] text-[#6366F1] font-bold bg-[#F0F2FF] px-2.5 py-0.5 rounded-md"
              >
                {tag}
              </span>
            ))}
          </div>
          <div className="flex items-center justify-between mt-auto">
            <div className="flex items-center gap-3">
              {category && (
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${categoryColor || 'bg-gray-300'}`} />
                  <span className="text-xs text-[#6366F1] font-bold">{category}</span>
                </div>
              )}
              <span className="text-xs text-gray-400 font-medium">{date}</span>
            </div>
            {locked && <Lock className="w-4 h-4 text-gray-300" />}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-indigo-100 hover:shadow-md transition-all group flex flex-col overflow-hidden relative cursor-pointer">
      {image && (
        <div className="h-44 w-full relative bg-gray-50">
          <MemoThumbnail src={image} alt={title} viewMode="grid" />
        </div>
      )}
      <div className="p-5 flex flex-col gap-3 flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-bold text-gray-800 text-[15px] truncate">{title}</h4>
          {locked && <Lock className="w-3.5 h-3.5 text-gray-300 shrink-0" />}
        </div>
        <p className="text-xs text-gray-500 leading-relaxed line-clamp-3 flex-1">{description}</p>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] text-indigo-500 font-bold bg-[#F0F2FF] px-2 py-0.5 rounded-md"
              >
                {tag}
              </span>
            ))}
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-gray-50">
            <div className="flex items-center gap-1.5">
              {category && (
                <>
                  <Circle className={`w-1.5 h-1.5 fill-current ${categoryColor}`} />
                  <span className="text-[10px] text-blue-500 font-bold">{category}</span>
                </>
              )}
            </div>
            <span className="text-[10px] text-gray-400 font-medium">{date}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MemoThumbnail({
  src,
  alt,
  viewMode,
}: {
  src: string;
  alt: string;
  viewMode: 'grid' | 'list';
}) {
  if (src.startsWith('data:')) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className={
          viewMode === 'list'
            ? 'w-30 h-30 rounded-xl object-cover shrink-0'
            : 'absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500'
        }
      />
    );
  }

  if (viewMode === 'list') {
    return (
      <div className="w-30 h-30 relative rounded-xl overflow-hidden shrink-0 bg-gray-50 border border-gray-50">
        <Image src={src} alt={alt} fill sizes="120px" className="object-cover" />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      className="object-cover group-hover:scale-105 transition-transform duration-500"
    />
  );
}
