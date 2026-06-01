'use client';

import React, { useCallback, useEffect, useState, useMemo } from 'react';
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
  Loader2,
} from 'lucide-react';
import Image from 'next/image';
import MemoDetailModal from '@/components/MemoDetailModal';
import MemoCreateModal from '@/components/MemoCreateModal';
import { memoApi, type MemoResponse } from '@/lib/memo-api';
import { groupApi, type GroupResponse } from '@/lib/group-api';
import type { MemoCardView } from '@/types/memo';

type FilterType = 'all' | 'my' | 'shared' | 'group' | 'favorites';

export default function MemoPage() {
  const { data: session, status } = useSession();
  const userId = session?.user?.id;

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [allMemos, setAllMemos] = useState<MemoResponse[]>([]); // 내 메모 + 그룹 메모 원본
  const [sharedMemos, setSharedMemos] = useState<MemoResponse[]>([]); // 공유받은 메모 원본
  const [memos, setMemos] = useState<MemoCardView[]>([]); // 필터링된 뷰 데이터
  const [userGroups, setUserGroups] = useState<GroupResponse[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedMemoId, setSelectedMemoId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  
  const [filter, setFilter] = useState<{ type: FilterType; id?: string }>({ type: 'all' });

  const loadData = useCallback(async () => {
    if (!session) return;
    try {
      setLoading(true);
      const [memoData, sharedData, groupData] = await Promise.all([
        memoApi.getAll(session),
        memoApi.getSharedMemos(session),
        groupApi.getAll(session)
      ]);
      setAllMemos(memoData);
      setSharedMemos(sharedData);
      setUserGroups(groupData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 필터링 및 데이터 변환 로직
  useEffect(() => {
    let filtered: MemoResponse[] = [];
    
    if (filter.type === 'favorites') {
      const combined = [...allMemos, ...sharedMemos];
      const unique = Array.from(new Map(combined.map(m => [m.id, m])).values());
      filtered = unique.filter(m => m.isFavorite);
    } else {
      const source = filter.type === 'shared' ? sharedMemos : allMemos;
      filtered = source;
      
      if (filter.type === 'group' && filter.id) {
        filtered = source.filter(m => m.groupId === filter.id);
      } else if (filter.type === 'my') {
        filtered = source.filter(m => !m.groupId);
      }
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    const items: MemoCardView[] = filtered.map(m => {
      const group = userGroups.find(g => g.id === m.groupId);
      const isShared = sharedMemos.some(sm => sm.id === m.id);
      return {
        id: m.id,
        title: m.title,
        description: m.content,
        image: m.imageUrl ? (m.imageUrl.startsWith('/uploads/') ? `${apiUrl}${m.imageUrl}` : m.imageUrl) : undefined,
        tags: m.tags || [],
        category: isShared ? '공유받음' : (group ? group.name : '내 메모'),
        categoryColor: group ? (
          group.colorTheme === 'indigo' ? 'bg-indigo-500' :
          group.colorTheme === 'blue' ? 'bg-blue-500' :
          group.colorTheme === 'emerald' ? 'bg-emerald-500' :
          group.colorTheme === 'orange' ? 'bg-orange-500' :
          group.colorTheme === 'rose' ? 'bg-rose-500' : 'bg-amber-500'
        ) : (isShared ? 'bg-purple-500' : 'bg-indigo-500'),
        date: new Date(m.createdAt).toLocaleDateString(),
        locked: false,
        isFavorite: m.isFavorite,
        groupId: m.groupId
      };
    });
    setMemos(items);
  }, [filter, allMemos, sharedMemos, userGroups]);

  // 동적 태그 추출
  const dynamicTags = useMemo(() => {
    const tagSet = new Set<string>();
    [...allMemos, ...sharedMemos].forEach(m => {
      if (m.tags) m.tags.forEach((t: string) => tagSet.add(t));
    });
    return Array.from(tagSet).slice(0, 15);
  }, [allMemos, sharedMemos]);

  const handleMemoClick = (memo: MemoCardView) => {
    setSelectedMemoId(memo.id);
    setIsDetailOpen(true);
  };

  const handleToggleFavorite = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!session) return;
    try {
      await memoApi.toggleFavorite(id, session);
      loadData(); // 단순하게 전체 리로드. 필요시 최적화 가능
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  if (status === 'loading') {
    return (
      <div className="h-screen flex items-center justify-center bg-[#F8F9FB]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  const getPageTitle = () => {
    if (filter.type === 'group') return userGroups.find(g => g.id === filter.id)?.name || '모임 메모';
    if (filter.type === 'shared') return '공유받은 메모';
    if (filter.type === 'my') return '내 메모';
    if (filter.type === 'favorites') return '즐겨찾기';
    return '전체 메모';
  };

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
              <SidebarItem 
                icon={Archive} 
                label="전체 메모" 
                active={filter.type === 'all'} 
                onClick={() => setFilter({ type: 'all' })} 
              />
              <SidebarItem 
                icon={User} 
                label="내 메모" 
                active={filter.type === 'my'}
                onClick={() => setFilter({ type: 'my' })}
              />
              <SidebarItem 
                icon={Share2} 
                label="공유받은 메모" 
                active={filter.type === 'shared'}
                onClick={() => setFilter({ type: 'shared' })}
              />
              <SidebarItem 
                icon={Star} 
                label="즐겨찾기" 
                active={filter.type === 'favorites'}
                onClick={() => setFilter({ type: 'favorites' })}
              />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 flex items-center gap-2">
              <ChevronDown className="w-3 h-3" /> 모임별 폴더
            </h3>
            <div className="space-y-1">
              {userGroups.map(group => {
                const colorMap = {
                  indigo: 'text-indigo-500',
                  blue: 'text-blue-500',
                  emerald: 'text-emerald-500',
                  orange: 'text-orange-500',
                  rose: 'text-rose-500',
                  amber: 'text-amber-500'
                };
                return (
                  <SidebarItem 
                    key={group.id}
                    label={group.name} 
                    active={filter.type === 'group' && filter.id === group.id}
                    color={colorMap[group.colorTheme as keyof typeof colorMap] || 'text-indigo-500'} 
                    onClick={() => setFilter({ type: 'group', id: group.id })}
                  />
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 flex items-center gap-2">
              <ChevronDown className="w-3 h-3" /> 태그
            </h3>
            <div className="flex flex-wrap gap-2 px-1">
              {dynamicTags.length > 0 ? dynamicTags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded-md cursor-pointer hover:bg-gray-200 transition-colors"
                >
                  #{tag}
                </span>
              )) : (
                <p className="text-[10px] text-gray-400">사용된 태그가 없습니다.</p>
              )}
            </div>
          </div>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden bg-[#F8F9FB]">
          <div className="p-8 pb-4 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-800">{getPageTitle()}</h2>
              {loading && <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />}
            </div>

            <div className="flex items-center gap-4 justify-between">
              <div className="relative flex-1 max-w-5xl">
                <input
                  type="text"
                  placeholder="메모 제목 또는 내용 검색"
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
            {loading && allMemos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                <p className="text-sm font-bold text-gray-500">메모를 불러오는 중...</p>
              </div>
            ) : memos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                 <Archive className="w-16 h-16 text-gray-200 mb-4" />
                 <p className="text-gray-500 font-bold">
                  {filter.type === 'group' ? '이 모임에 작성된 메모가 없습니다.' : 
                   filter.type === 'shared' ? '공유받은 메모가 없습니다.' : 
                   filter.type === 'favorites' ? '즐겨찾기한 메모가 없습니다.' : '메모가 없습니다.'}
                </p>
                <p className="text-xs text-gray-400 mt-1 font-medium">새로운 메모를 작성해보세요!</p>
              </div>
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
                    <MemoCard 
                      {...memo} 
                      viewMode={viewMode} 
                      onToggleFavorite={(e) => handleToggleFavorite(e, memo.id)} 
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="fixed bottom-10 right-10 w-16 h-16 bg-[#6366F1] text-white rounded-[2rem] flex items-center justify-center shadow-2xl hover:bg-[#5558E6] transition-all transform hover:scale-110 active:scale-95 group z-30"
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
            onDelete={loadData}
          />

          <MemoCreateModal
            isOpen={isCreateOpen}
            onClose={() => setIsCreateOpen(false)}
            userId={userId}
            onSuccess={loadData}
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
  onClick?: () => void;
}

function SidebarItem({ icon: Icon, label, count, active, color, onClick }: SidebarItemProps) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center justify-between px-4 py-3 rounded-2xl cursor-pointer transition-all ${active ? 'bg-indigo-50 text-indigo-600 shadow-sm shadow-indigo-100' : 'hover:bg-gray-50 text-gray-600'}`}
    >
      <div className="flex items-center gap-3">
        {Icon && <Icon className={`w-4 h-4 ${active ? 'text-indigo-600' : 'text-gray-400'}`} />}
        {!Icon && <Circle className={`w-2 h-2 fill-current ${color || 'text-gray-300'}`} />}
        <span className={`text-sm font-bold ${active ? 'text-indigo-600' : ''}`}>{label}</span>
      </div>
      {count !== undefined && <span className="text-[10px] font-black bg-gray-50 px-2 py-0.5 rounded-lg text-gray-400">{count}</span>}
    </div>
  );
}

interface MemoCardProps extends MemoCardView {
  viewMode: 'grid' | 'list';
  onToggleFavorite?: (e: React.MouseEvent) => void;
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
  isFavorite,
  viewMode,
  onToggleFavorite,
}: MemoCardProps) {
  const thumb = image ? <MemoThumbnail src={image} alt={title} viewMode={viewMode} /> : null;

  if (viewMode === 'list') {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-indigo-100 hover:shadow-md transition-all group flex overflow-hidden p-6 gap-6 relative cursor-pointer">
        {thumb}
        <div className="flex flex-col flex-1 min-w-0 py-1">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-black text-gray-800 text-lg truncate group-hover:text-indigo-600 transition-colors">{title}</h4>
            <div className="flex items-center gap-2">
              <button 
                onClick={onToggleFavorite}
                className={`p-1.5 rounded-full hover:bg-gray-100 transition-all ${isFavorite ? 'text-amber-400' : 'text-gray-300'}`}
              >
                <Star className={`w-4 h-4 ${isFavorite ? 'fill-amber-400' : ''}`} />
              </button>
              {locked && <Lock className="w-4 h-4 text-gray-300" />}
            </div>
          </div>
          <p className="text-sm text-gray-500 leading-relaxed line-clamp-2 mb-5 font-medium">{description}</p>
          <div className="flex flex-wrap gap-2 mb-5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] text-indigo-500 font-black bg-indigo-50 px-2.5 py-1 rounded-lg"
              >
                #{tag}
              </span>
            ))}
          </div>
          <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-50">
            <div className="flex items-center gap-4">
              {category && (
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${categoryColor || 'bg-gray-300'} shadow-sm`} />
                  <span className="text-[10px] text-indigo-600 font-black uppercase tracking-wider">{category}</span>
                </div>
              )}
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{date}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm hover:border-indigo-200 hover:shadow-xl hover:-translate-y-1 transition-all group flex flex-col overflow-hidden relative cursor-pointer">
      {image && (
        <div className="h-48 w-full relative bg-gray-50 overflow-hidden">
          <MemoThumbnail src={image} alt={title} viewMode="grid" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          <button 
            onClick={onToggleFavorite}
            className={`absolute top-4 right-4 z-10 p-2 rounded-2xl bg-white/90 backdrop-blur-sm shadow-lg hover:scale-110 active:scale-95 transition-all ${isFavorite ? 'text-amber-400' : 'text-gray-400'}`}
          >
            <Star className={`w-5 h-5 ${isFavorite ? 'fill-amber-400' : ''}`} />
          </button>
        </div>
      )}
      <div className="p-6 flex flex-col gap-4 flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-black text-gray-800 text-lg truncate group-hover:text-indigo-600 transition-colors">{title}</h4>
          <div className="flex items-center gap-2 shrink-0">
            <button 
              onClick={onToggleFavorite}
              className={`p-1.5 rounded-full hover:bg-gray-50 transition-all ${isFavorite ? 'text-amber-400' : 'text-gray-300'}`}
            >
              <Star className={`w-4 h-4 ${isFavorite ? 'fill-amber-400' : ''}`} />
            </button>
            {locked && <Lock className="w-3.5 h-3.5 text-gray-300" />}
          </div>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed line-clamp-3 flex-1 font-medium">{description}</p>
        <div className="space-y-4 mt-2">
          <div className="flex flex-wrap gap-1.5">
            {tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-[9px] text-indigo-500 font-black bg-indigo-50 px-2.5 py-1 rounded-md"
              >
                #{tag}
              </span>
            ))}
            {tags.length > 3 && <span className="text-[9px] text-gray-300 font-bold">+{tags.length - 3}</span>}
          </div>
          <div className="flex items-center justify-between pt-4 border-t border-gray-50">
            <div className="flex items-center gap-2">
              {category && (
                <>
                  <div className={`w-1.5 h-1.5 rounded-full ${categoryColor} shadow-sm`} />
                  <span className="text-[9px] text-indigo-600 font-black uppercase tracking-wider">{category}</span>
                </>
              )}
            </div>
            <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest">{date}</span>
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
            ? 'w-32 h-32 rounded-2xl object-cover shrink-0 shadow-md'
            : 'absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700'
        }
      />
    );
  }

  if (viewMode === 'list') {
    return (
      <div className="w-32 h-32 relative rounded-2xl overflow-hidden shrink-0 shadow-md border border-gray-50">
        <Image src={src} alt={alt} fill sizes="128px" className="object-cover" />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      className="object-cover group-hover:scale-110 transition-transform duration-700"
    />
  );
}
