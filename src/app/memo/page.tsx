'use client';

import React, { useCallback, useEffect, useState, useMemo, Suspense } from 'react';
import { useVisiblePolling, LIST_POLL_MS } from '@/hooks/useVisiblePolling';
import { useLiveTopics } from '@/lib/live';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import {
  Search,
  FileText,
  User,
  Share2,
  Star,
  Pin,
  Lock,
  Loader2,
  RefreshCw,
  PenLine,
  Image as ImageIcon,
} from 'lucide-react';
import { PageHeader, Ribbon, Segmented, EmptyState, Modal, SideLabel, SideItem } from '@/components/ui';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import ImageWithFallback from '@/components/ImageWithFallback';
import MemoCreateModal from '@/components/MemoCreateModal';
import { memoApi, isSharedByMe, getMemoPermissions, comparePinned, compareGroupPinned, type MemoResponse } from '@/lib/memo-api';
import { groupApi, type GroupResponse } from '@/lib/group-api';
import { GroupAvatar } from '@/components/groups/GroupIdentity';
import type { MemoCardView } from '@/types/memo';
import { getThemeColors, getFileUrl, stripMarkdown } from '@/lib/utils';
import { getApiErrorMessage } from '@/lib/axios';
import { useAlert } from '@/hooks/useAlert';

type FilterType = 'all' | 'my' | 'shared' | 'group' | 'favorites' | 'tag';

/** 카드에 모임 띠 색(hex)과 작성자, 내가 공유했는지, 고정 여부·고정 가능 여부를 더한 것 */
type MemoCardItem = MemoCardView & {
  ribbon: string; author?: string; groupId?: string; group?: GroupResponse; sharedByMe?: boolean;
  pinned: boolean; canPin: boolean;
};

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

  /** silent: 자동 갱신. 로딩 표시를 띄우지 않고, 실패해도 보던 목록을 그대로 둔다. */
  const loadData = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!session) return;
    try {
      if (!opts.silent) {
        setLoading(true);
        setLoadError(null);
      }
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
      // 즐겨찾기는 조용한 갱신에서 비우지 않는다(비우면 즐겨찾기 탭이 15초마다 로딩으로 깜빡인다)
      if (!opts.silent) setFavoriteMemos(null);
      setLoaded(true);
      setLoadError(null);
    } catch (error) {
      console.error('Failed to load data:', error);
      if (!opts.silent) setLoadError(getApiErrorMessage(error));
    } finally {
      if (!opts.silent) setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /** silent: 자동 갱신. 로딩 표시를 띄우지 않고, 실패해도 보던 목록을 그대로 둔다. */
  const loadFavorites = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!session) return;
    try {
      if (!opts.silent) {
        setFavoritesLoading(true);
        setFavoritesError(null);
      }
      setFavoriteMemos(await memoApi.getFavorites(session));
    } catch (error) {
      console.error('Failed to load favorites:', error);
      if (!opts.silent) setFavoritesError(getApiErrorMessage(error));
    } finally {
      if (!opts.silent) setFavoritesLoading(false);
    }
  }, [session]);

  /** 자동 갱신: 목록과, 즐겨찾기 탭을 보고 있으면 즐겨찾기도 조용히 다시 불러온다. */
  const refreshSilently = () => {
    loadData({ silent: true });
    if (filter.type === 'favorites' && favoriteMemos !== null) loadFavorites({ silent: true });
  };

  // 공유받은 메모·모임 메모를 새로고침 없이 반영한다. 모임마다 요청을 하나씩 보내므로 주기를 두 배로 둔다
  useVisiblePolling(refreshSilently, !!session && loaded, LIST_POLL_MS * 2);
  // 실시간 갱신: 메모(공유·모임 메모·즐겨찾기 포함)나 모임 목록이 바뀌면 바로 다시 불러온다
  useLiveTopics(['memos', 'groups'], refreshSilently, !!session && loaded);

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

  const memos = useMemo((): MemoCardItem[] => {
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

    // 고정된 메모를 맨 위로(고정 시각 최신순), 나머지는 지금 순서 그대로.
    // 모임 폴더는 모임 고정(모임 탭과 같은 값), 그 밖의 보기는 내 고정
    const groupView = filter.type === 'group';
    return [...filtered].sort(groupView ? compareGroupPinned : comparePinned).map(m => {
      const permissions = getMemoPermissions(m, userId);
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
        ribbon: m.groupId ? theme.hex : (isShared ? 'var(--accent)' : 'var(--line-strong)'),
        author: m.groupId || isShared ? m.authorNickname : undefined,
        date: format(new Date(m.createdAt), 'M.d', { locale: ko }),
        locked: false,
        isFavorite: m.isFavorite,
        pinned: groupView ? !!m.groupPinnedAt : !!m.pinnedAt,
        canPin: groupView ? permissions.groupPin : permissions.pin,
        groupId: m.groupId,
        group,
        sharedByMe: isSharedByMe(m, userId)
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

  const handleTogglePin = async (e: React.MouseEvent, id: string, pinned: boolean) => {
    e.stopPropagation();
    if (!session) return;
    try {
      const updated = filter.type === 'group'
        ? await memoApi.setGroupPinned(id, !pinned, session)
        : await memoApi.setPinned(id, !pinned, session);
      const updateFn = (prev: MemoResponse[]) =>
        prev.map(m => m.id === id
          ? { ...m, pinnedAt: updated.pinnedAt ?? null, groupPinnedAt: updated.groupPinnedAt ?? null }
          : m);
      setMyMemos(updateFn);
      setSharedMemos(updateFn);
      setGroupMemos(prev => Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, updateFn(v)])));
      setFavoriteMemos(prev => (prev ? updateFn(prev) : prev));
    } catch (error) {
      console.error(error);
      toast.error(getApiErrorMessage(error, '고정을 바꾸지 못했어요'));
      loadData({ silent: true });
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

  if (status === 'loading') return <div className="h-screen flex items-center justify-center bg-canvas"><Loader2 size={24} strokeWidth={1.5} className="animate-spin text-ink-3" /></div>;

  const isFavoritesView = filter.type === 'favorites';
  const listError = loadError ?? (isFavoritesView ? favoritesError : null);
  const listLoading = (loading && !loaded) || (isFavoritesView && (favoritesLoading || (favoriteMemos === null && !favoritesError)));

  const counts = loaded
    ? {
        all: combinedUniqueMemos.length,
        my: myMemos.filter(m => !m.groupId).length,
        shared: sharedMemos.length,
        favorites: combinedUniqueMemos.filter(m => m.isFavorite).length,
      }
    : null;

  const tagPanel = (
    <TagPanel
      tags={allTags}
      dataState={loaded ? 'ready' : loadError ? 'error' : 'loading'}
      selectedTags={selectedTags}
      showAllTags={showAllTags}
      onToggleShowAllTags={() => setShowAllTags(v => !v)}
      onToggleTag={toggleTag}
    />
  );

  const createButton = (
    <button type="button" onClick={() => setIsCreateOpen(true)} className="btn-primary">
      <PenLine size={16} strokeWidth={1.5} />
      <span className="lg:hidden">쓰기</span>
      <span className="hidden lg:inline">메모 쓰기</span>
    </button>
  );

  const isActive = (type: FilterType, id?: string) => filter.type === type && (id === undefined || filter.id === id);

  return (
    <div className="h-screen flex flex-col bg-canvas text-ink overflow-hidden">
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        <aside className="hidden lg:flex w-[264px] shrink-0 flex-col border-r border-line px-4 py-6 overflow-y-auto no-scrollbar">
          <nav className="space-y-0.5" aria-label="메모 분류">
            <SideItem icon={FileText} label="전체 메모" count={counts?.all} active={isActive('all')} onClick={() => selectFilter({ type: 'all' })} />
            <SideItem icon={User} label="내 메모" count={counts?.my} active={isActive('my')} onClick={() => selectFilter({ type: 'my' })} />
            <SideItem icon={Share2} label="공유받은 메모" count={counts?.shared} active={isActive('shared')} onClick={() => selectFilter({ type: 'shared' })} />
            <SideItem icon={Star} label="즐겨찾기" count={counts?.favorites} active={isActive('favorites')} onClick={() => selectFilter({ type: 'favorites' })} />
          </nav>

          <SideLabel>모임 폴더</SideLabel>
          <div className="space-y-0.5">
            {userGroups.length > 0 ? userGroups.map(g => (
              <SideItem
                key={g.id}
                label={
                  <span className="flex min-w-0 items-center gap-2.5">
                    <GroupAvatar name={g.name} src={g.profileImage} theme={g.colorTheme} size="xs" />
                    <span className="min-w-0 truncate">{g.name}</span>
                  </span>
                }
                count={groupMemos[g.id]?.length}
                active={isActive('group', g.id)}
                onClick={() => selectFilter({ type: 'group', id: g.id })}
              />
            )) : (
              <p className="px-3 text-xs text-ink-3">
                {loaded ? '참여한 모임이 없어요' : loadError ? '불러오지 못했어요' : '불러오는 중…'}
              </p>
            )}
          </div>

          <SideLabel>태그</SideLabel>
          <div className="px-3">{tagPanel}</div>
        </aside>

        <main className="flex-1 min-w-0 overflow-y-auto no-scrollbar">
          <div className="px-4 pt-5 pb-24 sm:px-6 lg:px-8 lg:pt-6 lg:pb-10">
            <PageHeader
              title={getPageTitle()}
              count={counts ? `${memos.length}개` : undefined}
              actions={
                <>
                  {loading && loaded && <Loader2 size={16} strokeWidth={1.5} className="animate-spin text-ink-3" aria-label="불러오는 중" />}
                  <div className="hidden lg:block w-64">
                    <SearchBox value={searchQuery} onChange={setSearchQuery} />
                  </div>
                  <div className="hidden sm:block">
                    <Segmented
                      ariaLabel="메모 보기"
                      items={[{ key: 'grid', label: '카드' }, { key: 'list', label: '목록' }]}
                      active={viewMode}
                      onChange={changeViewMode}
                    />
                  </div>
                  {createButton}
                </>
              }
            />

            {/* 모바일·태블릿: 검색 + 분류 칩 가로 스크롤 */}
            <div className="lg:hidden mt-4 space-y-3">
              <SearchBox value={searchQuery} onChange={setSearchQuery} />
              <div className="-mx-4 flex gap-2 overflow-x-auto no-scrollbar px-4 sm:-mx-6 sm:px-6">
                <FilterChip label="전체" active={isActive('all')} onClick={() => selectFilter({ type: 'all' })} />
                <FilterChip label="내 메모" active={isActive('my')} onClick={() => selectFilter({ type: 'my' })} />
                <FilterChip label="공유받은" active={isActive('shared')} onClick={() => selectFilter({ type: 'shared' })} />
                <FilterChip label="즐겨찾기" active={isActive('favorites')} onClick={() => selectFilter({ type: 'favorites' })} />
                {userGroups.map(g => (
                  <FilterChip
                    key={g.id}
                    label={g.name}
                    lead={<GroupAvatar name={g.name} src={g.profileImage} theme={g.colorTheme} size="xs" />}
                    active={isActive('group', g.id)}
                    onClick={() => selectFilter({ type: 'group', id: g.id })}
                  />
                ))}
                {allTags.length > 0 && (
                  <FilterChip
                    label={selectedTags.length > 0 ? `태그 ${selectedTags.length}` : '태그'}
                    active={selectedTags.length > 0}
                    onClick={() => setIsFilterSheetOpen(true)}
                  />
                )}
              </div>
            </div>

            <div className="mt-5 lg:mt-6">
              {listError ? (
                <EmptyState
                  title="메모를 불러오지 못했어요"
                  description={listError}
                  action={
                    <button type="button" onClick={() => (loadError ? loadData() : loadFavorites())} className="btn-secondary">
                      <RefreshCw size={16} strokeWidth={1.5} />
                      다시 시도
                    </button>
                  }
                  className="py-20"
                />
              ) : listLoading ? <LoadingState /> : memos.length === 0 ? (
                <MemoEmpty
                  type={searchQuery.trim() ? 'search' : (selectedTags.length > 0 ? 'tag' : filter.type)}
                  onCreate={() => setIsCreateOpen(true)}
                />
              ) : (
                <div className={`grid gap-3 sm:gap-4 ${viewMode === 'grid' ? 'grid-cols-1 items-start sm:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'}`}>
                  {memos.map(memo => (
                    <MemoCard
                      key={memo.id}
                      {...memo}
                      viewMode={viewMode}
                      onClick={() => router.push(`/memo/${memo.id}`)}
                      onToggleFavorite={(e: React.MouseEvent) => handleToggleFavorite(e, memo.id)}
                      onTogglePin={(e: React.MouseEvent) => handleTogglePin(e, memo.id, memo.pinned)}
                      onTagClick={(e: React.MouseEvent, tag: string) => { e.stopPropagation(); toggleTag(tag); }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      <Modal open={isFilterSheetOpen} onClose={() => setIsFilterSheetOpen(false)} title="태그로 거르기" size="sm">
        {tagPanel}
      </Modal>

      {userId && (
        <MemoCreateModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} userId={userId} onSuccess={() => loadData({ silent: true })} />
      )}
    </div>
  );
}

// ─── Sub Components ─────────────────────────────────────────────

function SearchBox({ value, onChange }: { value: string; onChange: (q: string) => void }) {
  return (
    <form className="relative w-full" role="search" onSubmit={(e) => e.preventDefault()}>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') onChange(''); }}
        placeholder="제목·내용 검색"
        aria-label="메모 검색"
        className="form-input h-9 pl-9"
      />
      <Search size={16} strokeWidth={1.5} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
    </form>
  );
}

function FilterChip({ label, active, lead, onClick }: { label: string; active: boolean; lead?: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`touch-hit inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-colors ${
        active ? 'bg-accent text-white' : 'border border-line-strong bg-surface text-ink-2 hover:bg-raised hover:text-ink'
      }`}
    >
      {lead}
      {label}
    </button>
  );
}

interface TagPanelProps {
  tags: string[];
  /** 목록을 아직 한 번도 못 불러왔으면 '없어요' 대신 불러오는 중·불러오지 못함을 보여 준다 */
  dataState: 'loading' | 'error' | 'ready';
  selectedTags: string[];
  showAllTags: boolean;
  onToggleShowAllTags: () => void;
  onToggleTag: (tag: string) => void;
}

function TagPanel({ tags, dataState, selectedTags, showAllTags, onToggleShowAllTags, onToggleTag }: TagPanelProps) {
  // 선택된 태그는 접혀 있어도 항상 보이게
  const visibleTags = showAllTags
    ? tags
    : Array.from(new Set([...tags.slice(0, TAG_PREVIEW_COUNT), ...selectedTags.filter(t => tags.includes(t))]));
  const unavailable =
    dataState === 'ready' ? null : dataState === 'error' ? '불러오지 못했어요' : '불러오는 중…';
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {visibleTags.length > 0 ? visibleTags.map(tag => {
          const on = selectedTags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => onToggleTag(tag)}
              aria-pressed={on}
              className={`chip transition-colors ${on ? 'bg-accent text-white' : 'hover:text-ink'}`}
            >
              #{tag}
            </button>
          );
        }) : <p className="text-xs text-ink-3">{unavailable ?? '사용한 태그가 없어요'}</p>}
      </div>
      {tags.length > TAG_PREVIEW_COUNT && (
        <button type="button" onClick={onToggleShowAllTags} className="mt-2 text-xs text-ink-2 hover:text-ink transition-colors">
          {showAllTags ? '접기' : `태그 ${tags.length - TAG_PREVIEW_COUNT}개 더 보기`}
        </button>
      )}
    </div>
  );
}

function LoadingState() {
  return <div className="flex flex-col items-center justify-center py-24 gap-3"><Loader2 size={20} strokeWidth={1.5} className="animate-spin text-ink-3" /><p className="text-sm text-ink-3">메모를 불러오고 있어요</p></div>;
}

function MemoEmpty({ type, onCreate }: { type: string; onCreate: () => void }) {
  const messages: Record<string, string> = { group: '이 모임에 쓴 메모가 없어요', shared: '공유받은 메모가 없어요', favorites: '즐겨찾기한 메모가 없어요', tag: '이 태그가 붙은 메모가 없어요', search: '검색 결과가 없어요' };
  const sub: Record<string, string> = { search: '다른 낱말로 찾아보세요', favorites: '메모의 별을 누르면 여기에 모여요', shared: '친구가 메모를 공유하면 여기에 보여요' };
  const canCreate = type === 'all' || type === 'my';
  return (
    <EmptyState
      title={messages[type] || '메모가 없어요'}
      description={sub[type] || '새 메모를 쓰면 여기에 모여요'}
      action={canCreate ? <button type="button" onClick={onCreate} className="btn-secondary">메모 쓰기</button> : undefined}
      className="py-20"
    />
  );
}

interface MemoCardProps extends MemoCardItem {
  viewMode: 'grid' | 'list';
  onClick?: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onTogglePin: (e: React.MouseEvent) => void;
  onTagClick: (e: React.MouseEvent, tag: string) => void;
}

function MemoCard({ title, description, image, tags, category, ribbon, author, group, date, locked, isFavorite, sharedByMe, pinned, canPin, viewMode, onClick, onToggleFavorite, onTogglePin, onTagClick }: MemoCardProps) {
  const isList = viewMode === 'list';
  return (
    <div
      onClick={onClick}
      className={`card relative flex cursor-pointer gap-4 overflow-hidden py-4 pl-5 pr-4 transition-colors hover:border-line-strong ${isList ? 'items-center' : 'sm:py-5'}`}
    >
      <Ribbon color={ribbon} className="absolute inset-y-0 left-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-[17px] leading-6 text-ink truncate">{title}</h3>
          <div className="-mr-1.5 -mt-1 flex shrink-0 items-center gap-1">
            {locked && <Lock size={16} strokeWidth={1.5} className="text-ink-3" />}
            {/* 내가 친구나 모임에 공유한 메모 */}
            {sharedByMe && <span className="chip">공유함</span>}
            {canPin ? (
              <button
                type="button"
                onClick={(e: React.MouseEvent) => { e.stopPropagation(); onTogglePin(e); }}
                aria-label={pinned ? '고정 해제' : '고정'}
                aria-pressed={pinned}
                title={pinned ? '고정 해제' : '고정'}
                className={`btn-icon ${pinned ? 'text-accent hover:text-accent' : 'text-ink-3'}`}
              >
                <Pin size={16} strokeWidth={1.5} className={pinned ? 'fill-current' : ''} />
              </button>
            ) : pinned && (
              <span className="inline-flex size-8 items-center justify-center text-ink-2" title="고정됨">
                <Pin size={16} strokeWidth={1.5} className="fill-current" aria-label="고정됨" />
              </span>
            )}
            {/* 즐겨찾기는 모임 메모도 된다(모임 화면에서는 별을 보이지 않는다) */}
            <button
              type="button"
              onClick={(e: React.MouseEvent) => { e.stopPropagation(); onToggleFavorite(e); }}
              aria-label={isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}
              className={`btn-icon ${isFavorite ? 'text-accent hover:text-accent' : 'text-ink-3'}`}
            >
              <Star size={16} strokeWidth={1.5} className={isFavorite ? 'fill-current' : ''} />
            </button>
          </div>
        </div>
        {description && (
          <p className={`text-sm leading-relaxed text-ink-2 ${isList ? 'line-clamp-1' : 'line-clamp-2 sm:line-clamp-3'}`}>{description}</p>
        )}
        {!isList && tags.length > 0 && (
          <div className="hidden flex-wrap gap-1.5 sm:flex">
            {tags.map((tag) => (
              <span
                key={tag}
                onClick={(e: React.MouseEvent) => onTagClick(e, tag)}
                className="chip transition-colors hover:text-ink"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
        {!isList && image && (
          <p className="flex items-center gap-1.5 text-xs text-ink-3">
            <ImageIcon size={16} strokeWidth={1.5} />
            사진 1장
          </p>
        )}
        <div className="mt-1 flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-ink-3">
            {group && <GroupAvatar name={group.name} src={group.profileImage} theme={group.colorTheme} size="xs" />}
            <span className="min-w-0 truncate">
              {category}
              {author && <> · {author}</>}
            </span>
          </span>
          <span className="stamp shrink-0">{date}</span>
        </div>
      </div>
      {isList && image && (
        <ImageWithFallback
          src={image}
          alt=""
          fill
          containerClassName="hidden sm:block size-16 shrink-0 rounded-lg bg-raised"
          className="object-cover"
        />
      )}
    </div>
  );
}
