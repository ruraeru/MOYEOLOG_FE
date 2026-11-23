'use client';

import React, { useCallback, useEffect, useState, useMemo, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
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
  RefreshCw,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import ImageWithFallback from '@/components/ImageWithFallback';
import MemoCreateModal from '@/components/MemoCreateModal';
import { memoApi, type MemoResponse } from '@/lib/memo-api';
import { groupApi, type GroupResponse } from '@/lib/group-api';
import type { MemoCardView } from '@/types/memo';
import { getThemeColors, getFileUrl, stripMarkdown } from '@/lib/utils';
import { getApiErrorMessage } from '@/lib/axios';
import { useAlert } from '@/hooks/useAlert';

type FilterType = 'all' | 'my' | 'shared' | 'group' | 'favorites' | 'tag';

const TAG_PREVIEW_COUNT = 15;
const MEMO_VIEW_KEY = 'moyeolog.memoView';

function readStoredView(): 'grid' | 'list' {
  try {
    const v = window.localStorage.getItem(MEMO_VIEW_KEY);
    return v === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

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
  const { toast } = useAlert();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [myMemos, setMyMemos] = useState<MemoResponse[]>([]);
  const [sharedMemos, setSharedMemos] = useState<MemoResponse[]>([]);
  const [groupMemos, setGroupMemos] = useState<Record<string, MemoResponse[]>>({});
  const [favoriteMemos, setFavoriteMemos] = useState<MemoResponse[] | null>(null);
  const [userGroups, setUserGroups] = useState<GroupResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [favoritesError, setFavoritesError] = useState<string | null>(null);
  const [favoritesLoading, setFavoritesLoading] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [filter, setFilter] = useState<{ type: FilterType; id?: string }>({ type: 'all' });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // 설정 화면의 '기본 메모 보기'(localStorage) 반영
  useEffect(() => {
    setViewMode(readStoredView());
  }, []);

  const changeViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    try { window.localStorage.setItem(MEMO_VIEW_KEY, mode); } catch { /* 저장 못 해도 화면은 그대로 */ }
  };

  const loadData = useCallback(async () => {
    if (!session) return;
    try {
      setLoading(true);
      setLoadError(null);
      const [memoData, sharedData, groupData] = await Promise.all([
        memoApi.getAll(session),
        memoApi.getSharedMemos(session),
        groupApi.getAll(session)
      ]);
      // 다른 멤버가 쓴 모임 메모는 /api/memos 에 없으므로 모임별로 따로 불러온다.
      const groupEntries = await Promise.all(
        groupData.map(async (g) => [g.id, await memoApi.getGroupMemos(g.id, session)] as const)
      );
      setMyMemos(memoData);
      setSharedMemos(sharedData);
      setUserGroups(groupData);
      setGroupMemos(Object.fromEntries(groupEntries));
      setFavoriteMemos(null);
      setLoaded(true);
    } catch (error) {
      console.error('Failed to load data:', error);
      setLoadError(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadFavorites = useCallback(async () => {
    if (!session) return;
    try {
      setFavoritesLoading(true);
      setFavoritesError(null);
      setFavoriteMemos(await memoApi.getFavorites(session));
    } catch (error) {
      console.error('Failed to load favorites:', error);
      setFavoritesError(getApiErrorMessage(error));
    } finally {
      setFavoritesLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (filter.type === 'favorites' && favoriteMemos === null && !favoritesLoading && !favoritesError && loaded) {
      loadFavorites();
    }
  }, [filter.type, favoriteMemos, favoritesLoading, favoritesError, loaded, loadFavorites]);

  const combinedUniqueMemos = useMemo(() => {
    const combined = [...myMemos, ...sharedMemos, ...Object.values(groupMemos).flat()];
    return Array.from(new Map(combined.map(m => [m.id, m])).values())
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  }, [myMemos, sharedMemos, groupMemos]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const selectFilter = (next: { type: FilterType; id?: string }) => {
    setFilter(next);
    if (next.type === 'favorites') {
      // 즐겨찾기는 열 때마다 최신으로
      setFavoriteMemos(null);
      setFavoritesError(null);
    }
  };

  const memos = useMemo((): MemoCardView[] => {
    let filtered: MemoResponse[] = [];

    if (filter.type === 'favorites') {
      filtered = (favoriteMemos ?? []).filter(m => m.isFavorite !== false);
    } else if (filter.type === 'shared') {
      filtered = sharedMemos;
    } else if (filter.type === 'my') {
      filtered = myMemos.filter(m => !m.groupId);
    } else if (filter.type === 'group' && filter.id) {
      filtered = groupMemos[filter.id] ?? combinedUniqueMemos.filter(m => m.groupId === filter.id);
    } else {
      filtered = combinedUniqueMemos;
    }

    if (selectedTags.length > 0) {
      filtered = filtered.filter(m =>
        selectedTags.every(tag => m.tags?.includes(tag))
      );
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(m =>
        m.title.toLowerCase().includes(q) || stripMarkdown(m.content || '').toLowerCase().includes(q)
      );
    }

    return filtered.map(m => {
      const group = m.groupId ? userGroups.find(g => g.id === m.groupId) : undefined;
      const isShared = !m.groupId && !!userId && m.authorId !== userId;
      const theme = getThemeColors(group?.colorTheme);

      return {
        id: m.id,
        title: m.title,
        description: stripMarkdown(m.content),
        image: getFileUrl(m.imageUrl) || undefined,
        tags: m.tags || [],
        category: m.groupId ? (group ? group.name : '모임 메모') : (isShared ? '공유받음' : '내 메모'),
        categoryColor: m.groupId ? theme.dot : (isShared ? 'bg-accent' : 'bg-ink-3'),
        date: format(new Date(m.createdAt), 'M.d EEE', { locale: ko }),
        locked: false,
        isFavorite: m.isFavorite,
        groupId: m.groupId
      };
    });
  }, [filter, myMemos, sharedMemos, groupMemos, favoriteMemos, userGroups, combinedUniqueMemos, selectedTags, searchQuery, userId]);

  // 자주 쓴 태그부터
  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    combinedUniqueMemos.forEach(m => m.tags?.forEach(t => counts.set(t, (counts.get(t) ?? 0) + 1)));
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
      .map(([t]) => t);
  }, [combinedUniqueMemos]);

  const handleToggleFavorite = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!session) return;

    const updateFn = (prev: MemoResponse[]) =>
      prev.map(m => m.id === id ? { ...m, isFavorite: !m.isFavorite } : m);

    setMyMemos(updateFn);
    setSharedMemos(updateFn);
    setGroupMemos(prev => Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, updateFn(v)])));
    setFavoriteMemos(prev => (prev ? updateFn(prev) : prev));

    try {
      await memoApi.toggleFavorite(id, session);
    } catch (error) {
      console.error(error);
      toast.error(getApiErrorMessage(error, '즐겨찾기를 바꾸지 못했어요'));
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

  const isFavoritesView = filter.type === 'favorites';
  const listError = loadError ?? (isFavoritesView ? favoritesError : null);
  const listLoading = (loading && !loaded) || (isFavoritesView && (favoritesLoading || (favoriteMemos === null && !favoritesError)));

  const filterPanel = (
    <FilterPanel
      filter={filter}
      groups={userGroups}
      tags={allTags}
      dataState={loaded ? 'ready' : loadError ? 'error' : 'loading'}
      selectedTags={selectedTags}
      showAllTags={showAllTags}
      onToggleShowAllTags={() => setShowAllTags(v => !v)}
      onSelectFilter={(f) => { selectFilter(f); setIsFilterSheetOpen(false); }}
      onToggleTag={toggleTag}
    />
  );

  return (
    <div className="h-screen flex flex-col bg-canvas text-ink overflow-hidden">
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-72 border-r border-line flex-col p-5 gap-8 overflow-y-auto no-scrollbar hidden lg:flex bg-canvas">
          {filterPanel}
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden bg-canvas">
          <Header
            title={getPageTitle()}
            loading={loading}
            onViewChange={changeViewMode}
            currentView={viewMode}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onOpenFilters={() => setIsFilterSheetOpen(true)}
            activeFilterCount={(filter.type !== 'all' ? 1 : 0) + selectedTags.length}
          />

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 pt-2 sm:pt-2 pb-32 lg:pb-6 no-scrollbar">
            {listError ? (
              <ErrorState message={listError} onRetry={loadError ? loadData : loadFavorites} />
            ) : listLoading ? <LoadingState /> : memos.length === 0 ? (
              <EmptyState type={searchQuery.trim() ? 'search' : (selectedTags.length > 0 ? 'tag' : filter.type)} />
            ) : (
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

          {/* 모바일에서는 하단 탭(높이 64px + 안전 영역) 위에 띄운다 */}
          <button onClick={() => setIsCreateOpen(true)} aria-label="새 메모" className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] lg:bottom-8 right-5 lg:right-8 size-12 bg-accent text-white rounded-full flex items-center justify-center shadow-float hover:bg-accent-hover transition-colors duration-150 ease-out active:scale-[0.98] z-30">
            <Plus size={20} strokeWidth={1.5} />
          </button>
        </main>
      </div>

      {isFilterSheetOpen && (
        <div className="fixed inset-0 z-[110] bg-black/40 flex items-end lg:hidden" onClick={() => setIsFilterSheetOpen(false)}>
          <div
            className="w-full max-h-[80dvh] overflow-y-auto no-scrollbar bg-surface rounded-t-2xl border-t border-line p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] flex flex-col gap-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink">메모 거르기</h2>
              <button type="button" onClick={() => setIsFilterSheetOpen(false)} className="btn-ghost" aria-label="닫기">
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>
            {filterPanel}
          </div>
        </div>
      )}

      {userId && (
        <MemoCreateModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} userId={userId} onSuccess={loadData} />
      )}
    </div>
  );
}

interface FilterPanelProps {
  filter: { type: FilterType; id?: string };
  groups: GroupResponse[];
  tags: string[];
  /** 목록을 아직 한 번도 못 불러왔으면 '없어요' 대신 불러오는 중·불러오지 못함을 보여 준다 */
  dataState: 'loading' | 'error' | 'ready';
  selectedTags: string[];
  showAllTags: boolean;
  onToggleShowAllTags: () => void;
  onSelectFilter: (f: { type: FilterType; id?: string }) => void;
  onToggleTag: (tag: string) => void;
}

function FilterPanel({ filter, groups, tags, dataState, selectedTags, showAllTags, onToggleShowAllTags, onSelectFilter, onToggleTag }: FilterPanelProps) {
  // 선택된 태그는 접혀 있어도 항상 보이게
  const visibleTags = showAllTags
    ? tags
    : Array.from(new Set([...tags.slice(0, TAG_PREVIEW_COUNT), ...selectedTags.filter(t => tags.includes(t))]));
  const unavailable =
    dataState === 'ready' ? null : dataState === 'error' ? '불러오지 못했어요' : '불러오는 중…';
  return (
    <>
      <div>
        <SectionTitle label="카테고리" />
        <div className="space-y-1">
          <SidebarItem icon={Archive} label="전체 메모" active={filter.type === 'all'} onClick={() => onSelectFilter({ type: 'all' })} />
          <SidebarItem icon={User} label="내 메모" active={filter.type === 'my'} onClick={() => onSelectFilter({ type: 'my' })} />
          <SidebarItem icon={Share2} label="공유받은 메모" active={filter.type === 'shared'} onClick={() => onSelectFilter({ type: 'shared' })} />
          <SidebarItem icon={Star} label="즐겨찾기" active={filter.type === 'favorites'} onClick={() => onSelectFilter({ type: 'favorites' })} />
        </div>
      </div>

      <div>
        <SectionTitle label="모임별 폴더" />
        <div className="space-y-1">
          {groups.length > 0 ? groups.map(g => (
            <SidebarItem
              key={g.id}
              label={g.name}
              active={filter.type === 'group' && filter.id === g.id}
              color={getThemeColors(g.colorTheme).dot}
              onClick={() => onSelectFilter({ type: 'group', id: g.id })}
            />
          )) : <p className="text-xs text-ink-3 px-2">{unavailable ?? '참여한 모임이 없어요'}</p>}
        </div>
      </div>

      <div>
        <SectionTitle label="태그" />
        <div className="flex flex-wrap gap-2 px-2">
          {visibleTags.length > 0 ? visibleTags.map(tag => (
            <TagBadge key={tag} label={tag} isActive={selectedTags.includes(tag)} onClick={() => onToggleTag(tag)} />
          )) : <p className="text-xs text-ink-3">{unavailable ?? '사용한 태그가 없어요'}</p>}
        </div>
        {tags.length > TAG_PREVIEW_COUNT && (
          <button type="button" onClick={onToggleShowAllTags} className="mt-2 mx-2 text-xs text-ink-2 hover:text-ink transition-colors duration-150 ease-out">
            {showAllTags ? '접기' : `태그 ${tags.length - TAG_PREVIEW_COUNT}개 더 보기`}
          </button>
        )}
      </div>
    </>
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
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenFilters: () => void;
  activeFilterCount: number;
}

function Header({ title, loading, onViewChange, currentView, searchQuery, onSearchChange, onOpenFilters, activeFilterCount }: HeaderProps) {
  return (
    <div className="px-4 sm:px-6 pt-5 sm:pt-6 pb-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl sm:text-2xl font-semibold text-ink truncate">{title}</h2>
        {loading && <Loader2 size={18} strokeWidth={1.5} className="animate-spin text-ink-3 shrink-0" />}
      </div>
      <div className="flex items-center gap-2 sm:gap-3 justify-between">
        <form className="relative flex-1 w-full min-w-0" role="search" onSubmit={(e) => e.preventDefault()}>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') onSearchChange(''); }}
            placeholder="메모 제목 또는 내용 검색"
            aria-label="메모 검색"
            className="form-input w-full pl-10"
          />
          <Search size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
        </form>
        <button
          type="button"
          onClick={onOpenFilters}
          className="lg:hidden btn-secondary flex items-center gap-1.5 shrink-0"
          aria-label="카테고리·모임·태그로 거르기"
        >
          <SlidersHorizontal size={16} strokeWidth={1.5} />
          <span className="text-sm">거르기{activeFilterCount > 0 ? ` ${activeFilterCount}` : ''}</span>
        </button>
        <div className="flex p-1 bg-raised rounded-[10px] shrink-0">
          <button
            onClick={() => onViewChange('grid')}
            aria-label="카드로 보기"
            className={`p-2 rounded-lg transition-colors duration-150 ease-out ${currentView === 'grid' ? 'bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.06)]' : 'text-ink-2 hover:text-ink'}`}
          >
            <Grid size={16} strokeWidth={1.5} />
          </button>
          <button
            onClick={() => onViewChange('list')}
            aria-label="목록으로 보기"
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

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center gap-1">
      <p className="text-sm font-medium text-ink">메모를 불러오지 못했어요</p>
      <p className="text-sm text-ink-3">{message}</p>
      <button type="button" onClick={onRetry} className="btn-secondary mt-3 flex items-center gap-1.5">
        <RefreshCw size={16} strokeWidth={1.5} />
        다시 시도
      </button>
    </div>
  );
}

function EmptyState({ type }: { type: string }) {
  const messages: Record<string, string> = { group: '이 모임에 쓴 메모가 없어요', shared: '공유받은 메모가 없어요', favorites: '즐겨찾기한 메모가 없어요', tag: '이 태그가 붙은 메모가 없어요', search: '검색 결과가 없어요' };
  const sub: Record<string, string> = { search: '다른 낱말로 찾아보세요', favorites: '메모의 별을 누르면 여기에 모여요', shared: '친구가 메모를 공유하면 여기에 보여요' };
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="size-10 rounded-full bg-raised flex items-center justify-center mb-3"><Archive size={18} strokeWidth={1.5} className="text-ink-3" /></div>
      <p className="text-sm font-medium text-ink">{messages[type] || '메모가 없어요'}</p>
      <p className="text-sm text-ink-3 mt-1">{sub[type] || '새 메모를 쓰면 여기에 모여요'}</p>
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
