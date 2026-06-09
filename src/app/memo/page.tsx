'use client';

import React, { useCallback, useEffect, useState, useMemo, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
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
  Loader2,
} from 'lucide-react';
import ImageWithFallback from '@/components/ImageWithFallback';
import MemoCreateModal from '@/components/MemoCreateModal';
import { memoApi, type MemoResponse } from '@/lib/memo-api';
import { groupApi, type GroupResponse } from '@/lib/group-api';
import type { MemoCardView } from '@/types/memo';
import { getThemeColors, getFileUrl, stripMarkdown } from '@/lib/utils';

type FilterType = 'all' | 'my' | 'shared' | 'group' | 'favorites' | 'tag';

export default function MemoPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center bg-[#F8F9FB]"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>}>
      <MemoContent />
    </Suspense>
  );
}

function MemoContent() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const userId = session?.user?.id;

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [allMemos, setAllMemos] = useState<MemoResponse[]>([]);
  const [sharedMemos, setSharedMemos] = useState<MemoResponse[]>([]);
  const [userGroups, setUserGroups] = useState<GroupResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [filter, setFilter] = useState<{ type: FilterType; id?: string }>({ type: 'all' });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

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

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const memos = useMemo((): MemoCardView[] => {
    let filtered: MemoResponse[] = [];

    // Category filtering
    if (filter.type === 'favorites') {
      filtered = combinedUniqueMemos.filter(m => m.isFavorite);
    } else {
      const source = filter.type === 'shared' ? sharedMemos : allMemos;
      filtered = source;
      if (filter.type === 'group' && filter.id) {
        filtered = source.filter(m => m.groupId === filter.id);
      } else if (filter.type === 'my') {
        filtered = source.filter(m => !m.groupId);
      }
    }

    // Tag filtering (Multi-select AND condition)
    if (selectedTags.length > 0) {
      filtered = filtered.filter(m =>
        selectedTags.every(tag => m.tags?.includes(tag))
      );
    }

    return filtered.map(m => {
      const group = userGroups.find(g => g.id === m.groupId);
      const isShared = sharedMemos.some(sm => sm.id === m.id);
      const theme = getThemeColors(group?.colorTheme);

      return {
        id: m.id,
        title: m.title,
        description: stripMarkdown(m.content),
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
  }, [filter, allMemos, sharedMemos, userGroups, combinedUniqueMemos, selectedTags]);

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
    let baseTitle = '전체 메모';
    if (filter.type === 'group') baseTitle = userGroups.find(g => g.id === filter.id)?.name || '모임 메모';
    if (filter.type === 'shared') baseTitle = '공유받은 메모';
    if (filter.type === 'my') baseTitle = '내 메모';
    if (filter.type === 'favorites') baseTitle = '즐겨찾기';

    if (selectedTags.length > 0) {
      return `${baseTitle} (#${selectedTags.join(', #')})`;
    }
    return baseTitle;
  };

  if (status === 'loading') return <div className="h-screen flex items-center justify-center bg-[#F8F9FB]"><div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" /></div>;

  return (
    <div className="h-screen flex flex-col bg-white text-gray-900 overflow-hidden font-sans">
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-72 border-r border-gray-100 flex flex-col p-6 gap-10 overflow-y-auto no-scrollbar hidden lg:flex bg-white">
          <div>
            <SectionTitle label="카테고리" />
            <div className="space-y-1">
              <SidebarItem icon={Archive} label="전체 메모" active={filter.type === 'all'} onClick={() => setFilter({ type: 'all' })} />
              <SidebarItem icon={User} label="내 메모" active={filter.type === 'my'} onClick={() => setFilter({ type: 'my' })} />
              <SidebarItem icon={Share2} label="공유받은 메모" active={filter.type === 'shared'} onClick={() => setFilter({ type: 'shared' })} />
              <SidebarItem icon={Star} label="즐겨찾기" active={filter.type === 'favorites'} onClick={() => setFilter({ type: 'favorites' })} />
            </div>
          </div>

          <div>
            <SectionTitle label="모임별 폴더" />
            <div className="space-y-1">
              {userGroups.map(g => (
                <SidebarItem
                  key={g.id}
                  label={g.name}
                  active={filter.type === 'group' && filter.id === g.id}
                  color={getThemeColors(g.colorTheme).bg}
                  onClick={() => setFilter({ type: 'group', id: g.id })}
                />
              ))}
            </div>
          </div>

          <div>
            <SectionTitle label="태그" />
            <div className="flex flex-wrap gap-2 px-1">
              {dynamicTags.length > 0 ? dynamicTags.map(tag => (
                <TagBadge key={tag} label={tag} isActive={selectedTags.includes(tag)} onClick={() => toggleTag(tag)} />
              )) : <p className="text-[10px] text-gray-400 font-medium">사용된 태그가 없습니다.</p>}
            </div>
          </div>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden bg-white">
          <Header title={getPageTitle()} loading={loading} onViewChange={setViewMode} currentView={viewMode} />

          <div className="flex-1 overflow-y-auto p-8 pt-4 no-scrollbar">
            {loading && allMemos.length === 0 ? <LoadingState /> : memos.length === 0 ? <EmptyState type={filter.type} /> : (
              <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>
                {memos.map(memo => (
                  <MemoCard
                    key={memo.id}
                    {...memo}
                    viewMode={viewMode}
                    onClick={() => router.push(`/memo/${memo.id}`)}
                    onToggleFavorite={(e: React.MouseEvent) => handleToggleFavorite(e, memo.id)}
                    onTagClick={(e: React.MouseEvent, tag: string) => { e.stopPropagation(); toggleTag(tag); }}
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
        <MemoCreateModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} userId={userId} onSuccess={loadData} />
      )}
    </div>
  );
}

// ─── Sub Components ─────────────────────────────────────────────

interface SectionTitleProps {
  label: string;
}

function SectionTitle({ label }: SectionTitleProps) {
  return <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-4 px-2"><ChevronDown className="w-3 h-3" /> {label}</h3>;
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
    <div
      onClick={onClick}
      className={`flex items-center justify-between px-4 py-3 rounded-2xl cursor-pointer transition-all duration-300 group ${active
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
          : 'hover:bg-white text-gray-500 hover:text-indigo-600'
        }`}
    >
      <div className="flex items-center gap-3">
        {Icon ? (
          <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-gray-400 group-hover:text-indigo-500'}`} />
        ) : (
          <div className={`w-2 h-2 rounded-full ${active ? 'bg-white' : (color || 'bg-gray-300')}`} />
        )}
        <span className={`text-sm font-black ${active ? 'text-white' : ''}`}>{label}</span>
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
    <span
      onClick={onClick}
      className={`text-[10px] font-black px-3 py-1.5 rounded-xl cursor-pointer transition-all duration-300 ${isActive
          ? 'bg-indigo-600 text-white shadow-md'
          : 'bg-white text-gray-400 hover:text-indigo-600 hover:shadow-sm border border-transparent hover:border-indigo-100'
        }`}
    >
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
    <div className="p-10 pb-6 space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-black text-gray-900 tracking-tight">{title}</h2>
        {loading && <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />}
      </div>
      <div className="flex items-center gap-4 justify-between">
        <div className="relative flex-1 w-full group">
          <input
            type="text"
            placeholder="메모 제목 또는 내용 검색"
            className="w-full bg-white border-0 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold focus:ring-4 focus:ring-indigo-50 transition-all outline-none shadow-sm group-hover:shadow-md"
          />
          <Search className="w-5 h-5 absolute left-4 top-4 text-gray-300 group-hover:text-indigo-400 transition-colors" />
        </div>
        <div className="flex p-1.5 bg-gray-200/50 rounded-2xl">
          <button
            onClick={() => onViewChange('grid')}
            className={`p-2.5 rounded-xl transition-all ${currentView === 'grid' ? 'bg-white shadow-md text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewChange('list')}
            className={`p-2.5 rounded-xl transition-all ${currentView === 'list' ? 'bg-white shadow-md text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return <div className="flex flex-col items-center justify-center py-24 gap-3"><Loader2 className="w-8 h-8 animate-spin text-indigo-400" /><p className="text-sm font-semibold text-gray-400 tracking-tight">메모를 불러오는 중...</p></div>;
}

function EmptyState({ type }: { type: string }) {
  const messages: Record<string, string> = { group: '이 모임에 작성된 메모가 없습니다.', shared: '공유받은 메모가 없습니다.', favorites: '즐겨찾기한 메모가 없습니다.', tag: '해당 태그가 포함된 메모가 없습니다.' };
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center border-2 border-dashed border-gray-50 rounded-3xl mx-8">
      <Archive className="w-12 h-12 text-gray-200 mb-4 stroke-[1.5]" />
      <p className="text-gray-500 font-semibold">{messages[type] || '메모가 없습니다.'}</p>
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
  const { data: session } = useSession();
  const isList = viewMode === 'list';
  return (
    <div
      onClick={onClick}
      className={`bg-white border border-gray-100 transition-all duration-300 group flex overflow-hidden cursor-pointer ${isList
          ? 'rounded-2xl p-5 gap-6 hover:border-indigo-200 hover:bg-indigo-50/10'
          : 'rounded-3xl flex-col hover:border-indigo-200 hover:shadow-sm'
        }`}
    >
      {image && (
        <ImageWithFallback
          src={image}
          alt={title}
          fill
          containerClassName={isList ? "w-28 h-28 rounded-xl shrink-0 shadow-sm" : "h-44 w-full bg-gray-50"}
          className="object-cover group-hover:scale-105 transition-transform duration-500"
        />
      )}
      {!isList && image && (
        <button
          onClick={(e: React.MouseEvent) => { e.stopPropagation(); onToggleFavorite(e); }}
          className={`absolute top-3 right-3 z-10 p-1.5 rounded-lg backdrop-blur-md transition-all ${isFavorite ? 'bg-amber-400 text-white' : 'bg-white/80 text-gray-300 hover:text-indigo-400'
            }`}
        >
          <Star className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
        </button>
      )}
      <div className={isList ? "flex flex-col flex-1 min-w-0 py-0.5" : "p-6 flex flex-col gap-3.5 flex-1 min-w-0"}>
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-gray-800 text-base truncate group-hover:text-indigo-500 transition-colors tracking-tight">{title}</h4>
          <div className="flex items-center gap-1.5">
            {(isList || !image) && (
              <button
                onClick={(e: React.MouseEvent) => { e.stopPropagation(); onToggleFavorite(e); }}
                className={`p-1 rounded-md transition-all ${isFavorite ? 'text-amber-400' : 'text-gray-200 hover:text-indigo-400 hover:bg-indigo-50'}`}
              >
                <Star className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
              </button>
            )}
            {locked && <Lock className="w-3.5 h-3.5 text-gray-300" />}
          </div>
        </div>
        <p className="text-[13px] text-gray-500 leading-relaxed line-clamp-2 font-medium">{description}</p>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              onClick={(e: React.MouseEvent) => onTagClick(e, tag)}
              className="text-[10px] text-indigo-400 font-bold bg-indigo-50/50 px-2 py-0.5 rounded-lg hover:bg-indigo-100 transition-colors"
            >
              #{tag}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between mt-auto pt-3.5 border-t border-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-400 text-[8px] font-black overflow-hidden relative shrink-0">
              {session?.user?.image ? (
                <ImageWithFallback 
                  src={session.user.image} 
                  alt={session.user.name || '나'} 
                  fill 
                  containerClassName="w-full h-full"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                (session?.user?.name || '나')[0]
              )}
            </div>
            <span className="text-[10px] text-gray-500 font-black tracking-tight">{session?.user?.name || '나'}</span>
            {category && (
              <div className="flex items-center gap-1.5 ml-2 border-l border-gray-100 pl-2">
                <div className={`w-1.5 h-1.5 rounded-full ${categoryColor || 'bg-gray-300'}`} />
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{category}</span>
              </div>
            )}
          </div>
          <span className="text-[10px] text-gray-300 font-bold uppercase">{date}</span>
        </div>
      </div>
    </div>
  );
}