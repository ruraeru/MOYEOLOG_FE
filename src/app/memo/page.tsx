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
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import ImageWithFallback from '@/components/ImageWithFallback';
import MemoCreateModal from '@/components/MemoCreateModal';
import { memoApi, type MemoResponse } from '@/lib/memo-api';
import { groupApi, type GroupResponse } from '@/lib/group-api';
import type { MemoCardView } from '@/types/memo';
import { getThemeColors, getFileUrl, stripMarkdown } from '@/lib/utils';

type FilterType = 'all' | 'my' | 'shared' | 'group' | 'favorites' | 'tag';

export default function MemoPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center bg-canvas"><Loader2 size={24} strokeWidth={1.5} className="animate-spin text-accent" /></div>}>
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
    } else if (filter.type === 'shared') {
      filtered = sharedMemos;
    } else if (filter.type === 'my') {
      filtered = allMemos.filter(m => !m.groupId);
    } else if (filter.type === 'group' && filter.id) {
      filtered = combinedUniqueMemos.filter(m => m.groupId === filter.id);
    } else {
      // 'all' filter or default
      filtered = combinedUniqueMemos;
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
        categoryColor: isShared ? 'bg-accent' : theme.dot,
        date: format(new Date(m.createdAt), 'M.d EEE', { locale: ko }),
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

  if (status === 'loading') return <div className="h-screen flex items-center justify-center bg-canvas"><div className="size-8 animate-spin rounded-full border-2 border-accent border-t-transparent" /></div>;

  return (
    <div className="h-screen flex flex-col bg-canvas text-ink overflow-hidden">
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-72 border-r border-line flex-col p-5 gap-8 overflow-y-auto no-scrollbar hidden lg:flex bg-canvas">
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
                  color={getThemeColors(g.colorTheme).dot}
                  onClick={() => setFilter({ type: 'group', id: g.id })}
                />
              ))}
            </div>
          </div>

          <div>
            <SectionTitle label="태그" />
            <div className="flex flex-wrap gap-2 px-2">
              {dynamicTags.length > 0 ? dynamicTags.map(tag => (
                <TagBadge key={tag} label={tag} isActive={selectedTags.includes(tag)} onClick={() => toggleTag(tag)} />
              )) : <p className="text-xs text-ink-3">사용한 태그가 없어요</p>}
            </div>
          </div>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden bg-canvas">
          <Header title={getPageTitle()} loading={loading} onViewChange={setViewMode} currentView={viewMode} />

          <div className="flex-1 overflow-y-auto p-6 pt-2 no-scrollbar">
            {loading && allMemos.length === 0 ? <LoadingState /> : memos.length === 0 ? <EmptyState type={filter.type} /> : (
              <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 items-start sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>
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

          <button onClick={() => setIsCreateOpen(true)} aria-label="새 메모" className="fixed bottom-8 right-8 size-12 bg-accent text-white rounded-full flex items-center justify-center shadow-float hover:bg-accent-hover transition-colors duration-150 ease-out active:scale-[0.98] z-30">
            <Plus size={20} strokeWidth={1.5} />
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
  return <h3 className="text-xs text-ink-3 flex items-center gap-1.5 mb-2 px-2"><ChevronDown size={16} strokeWidth={1.5} /> {label}</h3>;
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
      className={`flex items-center justify-between px-3 py-2 rounded-[10px] cursor-pointer transition-colors duration-150 ease-out ${active
          ? 'bg-raised text-ink'
          : 'text-ink-2 hover:bg-raised'
        }`}
    >
      <div className="flex items-center gap-3">
        {Icon ? (
          <Icon size={16} strokeWidth={1.5} className={active ? 'text-ink' : 'text-ink-3'} />
        ) : (
          <div className={`size-2 rounded-full ${color || 'bg-ink-3'}`} />
        )}
        <span className={`text-sm ${active ? 'font-medium' : ''}`}>{label}</span>
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
      className={`text-xs rounded-md px-2 py-0.5 cursor-pointer transition-colors duration-150 ease-out ${isActive
          ? 'bg-accent-soft text-accent'
          : 'bg-raised text-ink-2 hover:text-ink'
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
    <div className="px-6 pt-6 pb-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-ink">{title}</h2>
        {loading && <Loader2 size={18} strokeWidth={1.5} className="animate-spin text-ink-3" />}
      </div>
      <div className="flex items-center gap-3 justify-between">
        <div className="relative flex-1 w-full">
          <input
            type="text"
            placeholder="메모 제목 또는 내용 검색"
            className="form-input w-full pl-10"
          />
          <Search size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
        </div>
        <div className="flex p-1 bg-raised rounded-[10px]">
          <button
            onClick={() => onViewChange('grid')}
            className={`p-2 rounded-lg transition-colors duration-150 ease-out ${currentView === 'grid' ? 'bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.06)]' : 'text-ink-2 hover:text-ink'}`}
          >
            <Grid size={16} strokeWidth={1.5} />
          </button>
          <button
            onClick={() => onViewChange('list')}
            className={`p-2 rounded-lg transition-colors duration-150 ease-out ${currentView === 'list' ? 'bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.06)]' : 'text-ink-2 hover:text-ink'}`}
          >
            <List size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return <div className="flex flex-col items-center justify-center py-24 gap-3"><Loader2 size={24} strokeWidth={1.5} className="animate-spin text-ink-3" /><p className="text-sm text-ink-3">메모를 불러오고 있어요</p></div>;
}

function EmptyState({ type }: { type: string }) {
  const messages: Record<string, string> = { group: '이 모임에 쓴 메모가 없어요', shared: '공유받은 메모가 없어요', favorites: '즐겨찾기한 메모가 없어요', tag: '이 태그가 붙은 메모가 없어요' };
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="size-10 rounded-full bg-raised flex items-center justify-center mb-3"><Archive size={18} strokeWidth={1.5} className="text-ink-3" /></div>
      <p className="text-sm font-medium text-ink">{messages[type] || '메모가 없어요'}</p>
      <p className="text-sm text-ink-3 mt-1">새 메모를 쓰면 여기에 모여요</p>
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
    <div
      onClick={onClick}
      className={`card group flex overflow-hidden cursor-pointer transition-colors duration-150 ease-out hover:border-line-strong ${isList ? 'p-4 gap-4' : 'flex-col'}`}
    >
      {image && (
        <ImageWithFallback
          src={image}
          alt={title}
          fill
          containerClassName={isList ? "size-24 rounded-[10px] shrink-0" : "h-40 w-full bg-raised"}
          className="object-cover"
        />
      )}
      <div className={isList ? "flex flex-col gap-2 flex-1 min-w-0" : "p-5 flex flex-col gap-3 flex-1 min-w-0"}>
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-semibold text-ink text-base truncate">{title}</h4>
          <div className="flex items-center gap-1.5 shrink-0">
            {locked && <Lock size={16} strokeWidth={1.5} className="text-ink-3" />}
            <button
              onClick={(e: React.MouseEvent) => { e.stopPropagation(); onToggleFavorite(e); }}
              className={`p-1 rounded-md transition-colors duration-150 ease-out ${isFavorite ? 'text-accent' : 'text-ink-3 hover:text-ink-2'}`}
            >
              <Star size={16} strokeWidth={1.5} className={isFavorite ? 'fill-current' : ''} />
            </button>
          </div>
        </div>
        <p className="text-sm text-ink-2 leading-relaxed line-clamp-3">{description}</p>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                onClick={(e: React.MouseEvent) => onTagClick(e, tag)}
                className="text-xs text-ink-2 bg-raised rounded-md px-2 py-0.5 hover:text-ink transition-colors duration-150 ease-out"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-line">
          {category ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <div className={`size-1.5 rounded-full shrink-0 ${categoryColor || 'bg-ink-3'}`} />
              <span className="text-xs text-ink-3 truncate">{category}</span>
            </div>
          ) : <span />}
          <span className="stamp">{date}</span>
        </div>
      </div>
    </div>
  );
}
