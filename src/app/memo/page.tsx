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
import { getThemeColors, getFileUrl } from '@/lib/utils';

type FilterType = 'all' | 'my' | 'shared' | 'group' | 'favorites' | 'tag';

export default function MemoPage() {
  const { data: session, status } = useSession();
  const userId = session?.user?.id;

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [allMemos, setAllMemos] = useState<MemoResponse[]>([]);
  const [sharedMemos, setSharedMemos] = useState<MemoResponse[]>([]);
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

  const combinedUniqueMemos = useMemo(() => {
    const combined = [...allMemos, ...sharedMemos];
    return Array.from(new Map(combined.map(m => [m.id, m])).values());
  }, [allMemos, sharedMemos]);

  const memos = useMemo((): MemoCardView[] => {
    let filtered: MemoResponse[] = [];

    if (filter.type === 'favorites') {
      filtered = combinedUniqueMemos.filter(m => m.isFavorite);
    } else if (filter.type === 'tag' && filter.id) {
      filtered = combinedUniqueMemos.filter(m => m.tags?.includes(filter.id!));
    } else {
      const source = filter.type === 'shared' ? sharedMemos : allMemos;
      filtered = source;
      if (filter.type === 'group' && filter.id) {
        filtered = source.filter(m => m.groupId === filter.id);
      } else if (filter.type === 'my') {
        filtered = source.filter(m => !m.groupId);
      }
    }

    return filtered.map(m => {
      const group = userGroups.find(g => g.id === m.groupId);
      const isShared = sharedMemos.some(sm => sm.id === m.id);
      const theme = getThemeColors(group?.colorTheme);

      return {
        id: m.id,
        title: m.title,
        description: m.content,
        image: getFileUrl(m.imageUrl) || undefined,
        tags: m.tags || [],
        category: isShared ? '공유받음' : (group ? group.name : '내 메모'),
        categoryColor: isShared ? 'bg-purple-500' : theme.bg,
        date: new Date(m.createdAt).toLocaleDateString(),
        locked: false,
        isFavorite: m.isFavorite,
        groupId: m.groupId
      };
    });
  }, [filter, allMemos, sharedMemos, userGroups, combinedUniqueMemos]);

  const dynamicTags = useMemo(() => {
    const tagSet = new Set<string>();
    combinedUniqueMemos.forEach(m => m.tags?.forEach(t => tagSet.add(t)));
    return Array.from(tagSet).slice(0, 15);
  }, [combinedUniqueMemos]);

  const handleToggleFavorite = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!session) return;

    const updateFn = (prev: MemoResponse[]) =>
      prev.map(m => m.id === id ? { ...m, isFavorite: !m.isFavorite } : m);

    setAllMemos(updateFn);
    setSharedMemos(updateFn);

    try {
      await memoApi.toggleFavorite(id, session);
    } catch (error) {
      console.error(error);
      loadData();
    }
  };

  const getPageTitle = () => {
    if (filter.type === 'group') return userGroups.find(g => g.id === filter.id)?.name || '모임 메모';
    if (filter.type === 'shared') return '공유받은 메모';
    if (filter.type === 'my') return '내 메모';
    if (filter.type === 'favorites') return '즐겨찾기';
    if (filter.type === 'tag') return `#${filter.id}`;
    return '전체 메모';
  };

  if (status === 'loading') return <div className="h-screen flex items-center justify-center bg-[#F8F9FB]"><div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" /></div>;

  return (
    <div className="h-screen flex flex-col bg-white text-gray-900 overflow-hidden font-sans">
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-64 border-r border-gray-100 flex flex-col p-5 gap-10 overflow-y-auto no-scrollbar hidden lg:flex">
          <SectionTitle label="카테고리" />
          <div className="space-y-1">
            <SidebarItem icon={Archive} label="전체 메모" active={filter.type === 'all'} onClick={() => setFilter({ type: 'all' })} />
            <SidebarItem icon={User} label="내 메모" active={filter.type === 'my'} onClick={() => setFilter({ type: 'my' })} />
            <SidebarItem icon={Share2} label="공유받은 메모" active={filter.type === 'shared'} onClick={() => setFilter({ type: 'shared' })} />
            <SidebarItem icon={Star} label="즐겨찾기" active={filter.type === 'favorites'} onClick={() => setFilter({ type: 'favorites' })} />
          </div>

          <SectionTitle label="모임별 폴더" />
          <div className="space-y-1">
            {userGroups.map(g => <SidebarItem key={g.id} label={g.name} active={filter.type === 'group' && filter.id === g.id} color={getThemeColors(g.colorTheme).text} onClick={() => setFilter({ type: 'group', id: g.id })} />)}
          </div>

          <SectionTitle label="태그" />
          <div className="flex flex-wrap gap-2 px-1">
            {dynamicTags.length > 0 ? dynamicTags.map(tag => (
              <TagBadge key={tag} label={tag} isActive={filter.type === 'tag' && filter.id === tag} onClick={() => setFilter({ type: 'tag', id: tag })} />
            )) : <p className="text-[10px] text-gray-400">사용된 태그가 없습니다.</p>}
          </div>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden bg-[#F8F9FB]">
          <Header title={getPageTitle()} loading={loading} onViewChange={setViewMode} currentView={viewMode} />
          
          <div className="flex-1 overflow-y-auto p-8 pt-4 no-scrollbar">
            {loading && allMemos.length === 0 ? <LoadingState /> : memos.length === 0 ? <EmptyState type={filter.type} /> : (
              <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>
                {memos.map(memo => (
                  <MemoCard 
                    key={memo.id} 
                    {...memo} 
                    viewMode={viewMode} 
                    onClick={() => { setSelectedMemoId(memo.id); setIsDetailOpen(true); }} 
                    onToggleFavorite={(e: React.MouseEvent) => handleToggleFavorite(e, memo.id)} 
                    onTagClick={(e: React.MouseEvent, tag: string) => { e.stopPropagation(); setFilter({ type: 'tag', id: tag }); }} 
                  />
                ))}
              </div>
            )}
          </div>

          <button onClick={() => setIsCreateOpen(true)} className="fixed bottom-10 right-10 w-16 h-16 bg-[#6366F1] text-white rounded-4xl flex items-center justify-center shadow-2xl hover:bg-[#5558E6] transition-all transform hover:scale-110 active:scale-95 z-30">
            <Plus className="w-8 h-8" />
          </button>
        </main>
      </div>

      {userId && (
        <>
          <MemoDetailModal isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} memoId={selectedMemoId} userId={userId} authorName={session?.user?.name} onDelete={loadData} />
          <MemoCreateModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} userId={userId} onSuccess={loadData} />
        </>
      )}
    </div>
  );
}

// ─── Sub Components ─────────────────────────────────────────────

interface SectionTitleProps {
  label: string;
}

function SectionTitle({ label }: SectionTitleProps) {
  return <h3 className="text-xs font-bold text-gray-400 flex items-center gap-2 mb-4"><ChevronDown className="w-3 h-3" /> {label}</h3>;
}

interface SidebarItemProps {
  icon?: React.ElementType;
  label: string;
  active?: boolean;
  color?: string;
  onClick?: () => void;
}

function SidebarItem({ icon: Icon, label, active, color, onClick }: SidebarItemProps) {
  return (
    <div onClick={onClick} className={`flex items-center justify-between px-4 py-3 rounded-2xl cursor-pointer transition-all ${active ? 'bg-indigo-50 text-indigo-600 shadow-sm shadow-indigo-100' : 'hover:bg-gray-50 text-gray-600'}`}>
      <div className="flex items-center gap-3">
        {Icon ? <Icon className={`w-4 h-4 ${active ? 'text-indigo-600' : 'text-gray-400'}`} /> : <Circle className={`w-2 h-2 fill-current ${color || 'text-gray-300'}`} />}
        <span className={`text-sm font-bold ${active ? 'text-indigo-600' : ''}`}>{label}</span>
      </div>
    </div>
  );
}

interface TagBadgeProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
}

function TagBadge({ label, isActive, onClick }: TagBadgeProps) {
  return (
    <span onClick={onClick} className={`text-xs font-bold px-2 py-1 rounded-md cursor-pointer transition-colors ${isActive ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
      #{label}
    </span>
  );
}

interface HeaderProps {
  title: string;
  loading: boolean;
  onViewChange: (view: 'grid' | 'list') => void;
  currentView: 'grid' | 'list';
}

function Header({ title, loading, onViewChange, currentView }: HeaderProps) {
  return (
    <div className="p-8 pb-4 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
        {loading && <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />}
      </div>
      <div className="flex items-center gap-4 justify-between">
        <div className="relative flex-1 max-w-5xl">
          <input type="text" placeholder="메모 제목 또는 내용 검색" className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:border-indigo-500 outline-none shadow-sm" />
          <Search className="w-5 h-5 absolute left-3.5 top-3 text-gray-300" />
        </div>
        <div className="flex p-1 bg-white border border-gray-200 rounded-lg shadow-sm">
          <button onClick={() => onViewChange('grid')} className={`p-1.5 rounded-md transition-all ${currentView === 'grid' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400'}`}><Grid className="w-4 h-4" /></button>
          <button onClick={() => onViewChange('list')} className={`p-1.5 rounded-md transition-all ${currentView === 'list' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400'}`}><List className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return <div className="flex flex-col items-center justify-center py-20 gap-3"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /><p className="text-sm font-bold text-gray-500">메모를 불러오는 중...</p></div>;
}

function EmptyState({ type }: { type: string }) {
  const messages: Record<string, string> = { group: '이 모임에 작성된 메모가 없습니다.', shared: '공유받은 메모가 없습니다.', favorites: '즐겨찾기한 메모가 없습니다.', tag: '해당 태그가 포함된 메모가 없습니다.' };
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <Archive className="w-16 h-16 text-gray-200 mb-4" />
      <p className="text-gray-500 font-bold">{messages[type] || '메모가 없습니다.'}</p>
      <p className="text-xs text-gray-400 mt-1 font-medium">새로운 메모를 작성해보세요!</p>
    </div>
  );
}

interface MemoCardProps extends MemoCardView {
  viewMode: 'grid' | 'list';
  onClick?: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onTagClick: (e: React.MouseEvent, tag: string) => void;
}

function MemoCard({ title, description, image, tags, category, categoryColor, date, locked, isFavorite, viewMode, onClick, onToggleFavorite, onTagClick }: MemoCardProps) {
  const isList = viewMode === 'list';
  return (
    <div onClick={onClick} className={`bg-white border border-gray-100 shadow-sm transition-all group flex overflow-hidden cursor-pointer ${isList ? 'rounded-2xl p-6 gap-6 hover:border-indigo-100 hover:shadow-md' : 'rounded-4xl flex-col hover:border-indigo-200 hover:shadow-xl hover:-translate-y-1'}`}>
      {image && (
        <div className={isList ? "w-32 h-32 relative rounded-2xl overflow-hidden shrink-0 shadow-md border border-gray-50" : "h-48 w-full relative bg-gray-50 overflow-hidden"}>
          <Image src={image} alt={title} fill className="object-cover" />
          {!isList && <button onClick={(e: React.MouseEvent) => { e.stopPropagation(); onToggleFavorite(e); }} className={`absolute top-4 right-4 z-10 p-2 rounded-2xl bg-white/90 backdrop-blur-sm shadow-lg hover:scale-110 active:scale-95 transition-all ${isFavorite ? 'text-amber-400' : 'text-gray-400'}`}><Star className={`w-5 h-5 ${isFavorite ? 'fill-amber-400' : ''}`} /></button>}
        </div>
      )}
      <div className={isList ? "flex flex-col flex-1 min-w-0 py-1" : "p-6 flex flex-col gap-4 flex-1 min-w-0"}>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-black text-gray-800 text-lg truncate group-hover:text-indigo-600 transition-colors">{title}</h4>
          <div className="flex items-center gap-2">
            {(isList || !image) && <button onClick={(e: React.MouseEvent) => { e.stopPropagation(); onToggleFavorite(e); }} className={`p-1.5 rounded-full hover:bg-gray-100 transition-all ${isFavorite ? 'text-amber-400' : 'text-gray-300'}`}><Star className={`w-4 h-4 ${isFavorite ? 'fill-amber-400' : ''}`} /></button>}
            {locked && <Lock className="w-4 h-4 text-gray-300" />}
          </div>
        </div>
        <p className="text-sm text-gray-500 leading-relaxed line-clamp-2 mb-5 font-medium">{description}</p>
        <div className="flex flex-wrap gap-2 mb-5">
          {tags.map((tag) => <span key={tag} onClick={(e: React.MouseEvent) => onTagClick(e, tag)} className="text-[10px] text-indigo-500 font-black bg-indigo-50 px-2.5 py-1 rounded-lg hover:bg-indigo-100">#{tag}</span>)}
        </div>
        <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-50">
          <div className="flex items-center gap-4">
            {category && <div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${categoryColor || 'bg-gray-300'} shadow-sm`} /><span className="text-[10px] text-indigo-600 font-black uppercase tracking-wider">{category}</span></div>}
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{date}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
