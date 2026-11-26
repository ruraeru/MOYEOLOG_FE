'use client';

import React, { useCallback, useEffect, useRef, useState, useMemo, Suspense } from 'react';
import { useVisiblePolling, LIST_POLL_MS } from '@/hooks/useVisiblePolling';
import { useLiveTopics } from '@/lib/live';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  X,
} from 'lucide-react';
import { PageHeader, Ribbon, Segmented, EmptyState, Modal, SideLabel, SideItem } from '@/components/ui';
import { format, isSameDay, isSameYear } from 'date-fns';
import { ko } from 'date-fns/locale';
import ImageWithFallback from '@/components/ImageWithFallback';
import MemoCreateModal from '@/components/MemoCreateModal';
import { memoApi, isSharedByMe, getMemoPermissions, comparePinned, compareGroupPinned, type MemoResponse } from '@/lib/memo-api';
import { groupApi, type GroupResponse } from '@/lib/group-api';
import { GroupAvatar, groupStyle } from '@/components/groups/GroupIdentity';
import type { MemoCardView } from '@/types/memo';
import { getThemeColors, getFileUrl, stripMarkdown, getTimeFormat } from '@/lib/utils';
import { getApiErrorMessage } from '@/lib/axios';
import { useAlert } from '@/hooks/useAlert';

type FilterType = 'all' | 'my' | 'shared' | 'group' | 'favorites' | 'tag';
type SortKey = 'created-desc' | 'created-asc' | 'updated-desc' | 'title';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'created-desc', label: '최신순' },
  { key: 'created-asc', label: '오래된순' },
  { key: 'updated-desc', label: '최근 수정순' },
  { key: 'title', label: '제목순' },
];
const MEMO_SORT_KEY = 'moyeolog.memoSort';
const MEMO_SCROLL_KEY = 'moyeolog.memoScroll';
/** 카드에 보이는 태그 수. 넘으면 '+n' */
const CARD_TAG_COUNT = 5;

function readStoredSort(): SortKey {
  try {
    const v = window.localStorage.getItem(MEMO_SORT_KEY);
    return SORT_OPTIONS.some(o => o.key === v) ? (v as SortKey) : 'created-desc';
  } catch {
    return 'created-desc';
  }
}

const SORTERS: Record<SortKey, (a: MemoResponse, b: MemoResponse) => number> = {
  'created-desc': (a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0),
  'created-asc': (a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0),
  'updated-desc': (a, b) => {
    const ua = a.updatedAt || a.createdAt, ub = b.updatedAt || b.createdAt;
    return ua < ub ? 1 : ua > ub ? -1 : 0;
  },
  title: (a, b) => a.title.localeCompare(b.title, 'ko', { numeric: true }),
};

/** 오늘이면 시각, 올해면 월.일, 그 전이면 연도까지 */
function formatCardDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (isSameDay(d, now)) return format(d, getTimeFormat(), { locale: ko });
  if (isSameYear(d, now)) return format(d, 'M.d', { locale: ko });
  return format(d, 'yy.M.d', { locale: ko });
}

/** 주소의 ?view=&id= 를 보기로 바꾼다(새로고침·뒤로 가기에도 같은 보기) */
function parseFilter(params: URLSearchParams | null): { type: FilterType; id?: string } {
  const v = params?.get('view');
  if (v === 'my' || v === 'shared' || v === 'favorites') return { type: v };
  const id = params?.get('id');
  if (v === 'group' && id) return { type: 'group', id };
  return { type: 'all' };
}

/** 카드에 모임 띠 색(hex)과 작성자, 내가 공유했는지, 고정 여부·고정 가능 여부를 더한 것 */
type MemoCardItem = MemoCardView & {
  ribbon: string; author?: string; groupId?: string; group?: GroupResponse; sharedByMe?: boolean; sharedTitle?: string; sharedChip?: string;
  pinned: boolean; canPin: boolean;
  /** 모임 폴더 보기: 고정이 모임 공통 고정 */
  groupPin?: boolean;
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
  const searchParams = useSearchParams();
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

  const [filter, setFilter] = useState<{ type: FilterType; id?: string }>(() => parseFilter(searchParams));
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('created-desc');
  /** 고정 요청 중인 메모(연속 클릭이 같은 요청을 여러 번 보내지 않게) */
  const [pinBusy, setPinBusy] = useState<Set<string>>(() => new Set());
  const mainRef = useRef<HTMLElement>(null);
  const scrollRestored = useRef(false);

  // 설정 화면의 '기본 메모 보기'(localStorage) 반영
  useEffect(() => {
    setViewMode(readStoredView());
    setSortKey(readStoredSort());
  }, []);

  // 주소가 바뀌면(상단 메뉴의 '메모'로 다시 들어오는 등) 보기를 주소에 맞춘다
  const viewParam = searchParams?.get('view') ?? '';
  const idParam = searchParams?.get('id') ?? '';
  useEffect(() => {
    const next = parseFilter(new URLSearchParams(viewParam ? `view=${viewParam}&id=${encodeURIComponent(idParam)}` : ''));
    setFilter(prev => (prev.type === next.type && prev.id === next.id ? prev : next));
  }, [viewParam, idParam]);

  const changeSort = (key: SortKey) => {
    setSortKey(key);
    try { window.localStorage.setItem(MEMO_SORT_KEY, key); } catch { /* 저장 못 해도 화면은 그대로 */ }
  };

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
    return Array.from(new Map(combined.map(m => [m.id, m])).values()).sort(SORTERS['created-desc']);
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
    const qs = next.type === 'all' ? '' : next.type === 'group' ? `?view=group&id=${encodeURIComponent(next.id ?? '')}` : `?view=${next.type}`;
    router.replace(`/memo${qs}`, { scroll: false });
    if (next.type === 'favorites') {
      // 즐겨찾기는 열 때마다 최신으로
      setFavoriteMemos(null);
      setFavoritesError(null);
    }
  };

  const memos = useMemo((): MemoCardItem[] => {
    let filtered: MemoResponse[] = [];
    const sharedIds = new Set(sharedMemos.map(m => m.id));

    if (filter.type === 'favorites') {
      // 이 보기에서 별을 끈 메모는 다시 열 때까지 남겨 둔다(잘못 눌렀으면 바로 다시 켤 수 있게)
      filtered = favoriteMemos ?? [];
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
    // 고른 정렬 다음에 고정을 맨 위로(sort 는 안정 정렬이라 고정 안에서도 고른 순서가 남는다)
    return [...filtered].sort(SORTERS[sortKey]).sort(groupView ? compareGroupPinned : comparePinned).map(m => {
      const permissions = getMemoPermissions(m, userId);
      const group = m.groupId ? userGroups.find(g => g.id === m.groupId) : undefined;
      const isShared = !m.groupId && !!userId && m.authorId !== userId;
      // 남의 개인 메모가 친구 공유 목록에 없으면 모임에 공유된 것이다('공유받은 메모' 보기에는 나오지 않는다)
      const viaGroup = isShared && !sharedIds.has(m.id);
      const sharedFriendCount = m.sharedWith?.length ?? 0;
      const sharedGroupCount = m.sharedGroupIds?.length ?? 0;
      const theme = getThemeColors(group?.colorTheme);

      return {
        id: m.id,
        title: m.title,
        description: stripMarkdown(m.content),
        image: getFileUrl(m.imageUrl) || undefined,
        tags: m.tags || [],
        category: m.groupId ? (group ? group.name : '모임 메모') : (viaGroup ? '모임에 공유됨' : isShared ? '공유받음' : '내 메모'),
        categoryColor: m.groupId ? theme.dot : (isShared ? 'bg-accent' : 'bg-ink-3'),
        ribbon: m.groupId ? theme.hex : (isShared ? 'var(--accent)' : 'var(--line-strong)'),
        author: m.groupId || isShared ? m.authorNickname : undefined,
        date: formatCardDate(m.createdAt),
        locked: false,
        isFavorite: m.isFavorite,
        pinned: groupView ? !!m.groupPinnedAt : !!m.pinnedAt,
        canPin: groupView ? permissions.groupPin : permissions.pin,
        groupPin: groupView,
        groupId: m.groupId,
        group,
        sharedByMe: isSharedByMe(m, userId),
        // 칩 글자로 친구 공유·모임 공유를 나눈다
        sharedChip: sharedFriendCount > 0 && sharedGroupCount > 0 ? '친구·모임 공유'
          : sharedGroupCount > 0 ? '모임 공유' : `공유 ${sharedFriendCount}명`,
        sharedTitle: [
          sharedFriendCount > 0 ? `친구 ${sharedFriendCount}명` : '',
          sharedGroupCount > 0 ? `모임 ${sharedGroupCount}곳` : '',
        ].filter(Boolean).join(' · ') + '에 공유함'
      };
    });
  }, [filter, myMemos, sharedMemos, groupMemos, favoriteMemos, userGroups, combinedUniqueMemos, selectedTags, searchQuery, userId, sortKey]);

  // 자주 쓴 태그부터
  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    combinedUniqueMemos.forEach(m => m.tags?.forEach(t => counts.set(t, (counts.get(t) ?? 0) + 1)));
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko', { numeric: true }))
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
    if (!session || pinBusy.has(id)) return;
    setPinBusy(prev => new Set(prev).add(id));
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
    } finally {
      setPinBusy(prev => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  /** 상세에서 뒤로 왔을 때 같은 자리로 돌아오게 스크롤을 남긴다 */
  const openMemo = (id: string) => {
    try {
      window.sessionStorage.setItem(MEMO_SCROLL_KEY, JSON.stringify({ search: window.location.search, top: mainRef.current?.scrollTop ?? 0 }));
    } catch { /* 저장 못 하면 맨 위에서 시작 */ }
    router.push(`/memo/${id}`);
  };

  useEffect(() => {
    if (!loaded || scrollRestored.current) return;
    scrollRestored.current = true;
    try {
      const raw = window.sessionStorage.getItem(MEMO_SCROLL_KEY);
      window.sessionStorage.removeItem(MEMO_SCROLL_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { search?: string; top?: number };
      if (saved.search === window.location.search && saved.top) {
        requestAnimationFrame(() => mainRef.current?.scrollTo(0, saved.top ?? 0));
      }
    } catch { /* 복원 못 해도 목록은 그대로 */ }
  }, [loaded]);

  const getPageTitle = () => {
    let baseTitle = '전체 메모';
    if (filter.type === 'group') baseTitle = userGroups.find(g => g.id === filter.id)?.name || '모임 메모';
    if (filter.type === 'shared') baseTitle = '공유받은 메모';
    if (filter.type === 'my') baseTitle = '내 메모';
    if (filter.type === 'favorites') baseTitle = '즐겨찾기';
    // 고른 태그는 제목에 붙이지 않고 머리 아래 칩 줄로 보여 준다(긴 태그가 머리 줄을 밀지 않게)
    return baseTitle;
  };
  const trimmedQuery = searchQuery.trim();

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
      onClearTags={() => setSelectedTags([])}
    />
  );

  const clearTags = () => setSelectedTags([]);
  const createGroupId = filter.type === 'group' ? filter.id : undefined;

  const sortSelect = (
    <select
      value={sortKey}
      onChange={(e) => changeSort(e.target.value as SortKey)}
      aria-label="메모 정렬"
      className="form-input h-9 w-auto pr-8"
    >
      {SORT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
    </select>
  );

  const viewToggle = (
    <Segmented
      ariaLabel="메모 보기"
      items={[{ key: 'grid', label: '카드' }, { key: 'list', label: '목록' }]}
      active={viewMode}
      onChange={changeViewMode}
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
                    <span className="min-w-0 truncate" title={g.name}>{g.name}</span>
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

        <main ref={mainRef} className="flex-1 min-w-0 overflow-y-auto no-scrollbar">
          <div className="px-4 pt-5 pb-24 sm:px-6 lg:px-8 lg:pt-6 lg:pb-10">
            <PageHeader
              title={getPageTitle()}
              count={counts ? `${memos.length}개` : undefined}
              description={trimmedQuery ? `‘${trimmedQuery}’ 검색 결과` : undefined}
              actions={
                <>
                  {loading && loaded && <Loader2 size={16} strokeWidth={1.5} className="animate-spin text-ink-3" aria-label="불러오는 중" />}
                  <div className="hidden lg:block w-64">
                    <SearchBox value={searchQuery} onChange={setSearchQuery} />
                  </div>
                  <div className="hidden sm:block">{sortSelect}</div>
                  <div className="hidden sm:block">{viewToggle}</div>
                  {createButton}
                </>
              }
            />

            {/* 모바일·태블릿: 검색 + 분류 칩 가로 스크롤 */}
            <div className="lg:hidden mt-4 space-y-3">
              <SearchBox value={searchQuery} onChange={setSearchQuery} />
              {/* 모바일: 정렬·보기 전환 (sm 이상은 머리에 있다) */}
              <div className="flex items-center justify-between gap-2 sm:hidden">
                {sortSelect}
                {viewToggle}
              </div>
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

            {selectedTags.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-1.5" aria-label="고른 태그">
                {selectedTags.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    aria-label={`#${tag} 태그 빼기`}
                    title={`#${tag}`}
                    className="chip max-w-full gap-1 bg-accent text-white pointer-coarse:h-11 pointer-coarse:px-3"
                  >
                    <span className="truncate">#{tag}</span>
                    <X size={12} strokeWidth={1.5} className="shrink-0" aria-hidden />
                  </button>
                ))}
                <button type="button" onClick={clearTags} className="btn-ghost btn-sm">태그 모두 지우기</button>
              </div>
            )}

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
                  type={trimmedQuery ? 'search' : (selectedTags.length > 0 ? 'tag' : filter.type)}
                  onCreate={() => setIsCreateOpen(true)}
                  onClearSearch={() => setSearchQuery('')}
                  onClearTags={clearTags}
                />
              ) : (
                <div className={`grid ${viewMode === 'grid' ? 'gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3' : 'gap-2 grid-cols-1'}`}>
                  {memos.map(memo => (
                    <MemoCard
                      key={memo.id}
                      {...memo}
                      viewMode={viewMode}
                      pinBusy={pinBusy.has(memo.id)}
                      onClick={() => openMemo(memo.id)}
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

      <Modal
        open={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        title="태그로 거르기"
        size="sm"
        footer={
          <button type="button" onClick={() => setIsFilterSheetOpen(false)} className="btn-primary w-full">
            {counts ? `메모 ${memos.length}개 보기` : '닫기'}
          </button>
        }
      >
        {tagPanel}
      </Modal>

      {userId && (
        <MemoCreateModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} userId={userId} defaultGroupId={createGroupId} onSuccess={() => loadData({ silent: true })} />
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
      title={label}
      // 높이는 32 그대로 두고 위아래 투명 영역으로 터치 영역을 44 로 넓힌다
      className={`relative inline-flex h-8 max-w-[200px] shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-colors after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] ${
        active ? 'bg-accent text-white' : 'border border-line-strong bg-surface text-ink-2 hover:bg-raised hover:text-ink'
      }`}
    >
      {lead && <span className="shrink-0">{lead}</span>}
      <span className="min-w-0 truncate">{label}</span>
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
  onClearTags: () => void;
}

function TagPanel({ tags, dataState, selectedTags, showAllTags, onToggleShowAllTags, onToggleTag, onClearTags }: TagPanelProps) {
  // 선택된 태그는 접혀 있어도 항상 보이게
  const visibleTags = showAllTags
    ? tags
    : Array.from(new Set([...tags.slice(0, TAG_PREVIEW_COUNT), ...selectedTags.filter(t => tags.includes(t))]));
  const unavailable =
    dataState === 'ready' ? null : dataState === 'error' ? '불러오지 못했어요' : '불러오는 중…';
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 pointer-coarse:gap-2">
        {visibleTags.length > 0 ? visibleTags.map(tag => {
          const on = selectedTags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => onToggleTag(tag)}
              aria-pressed={on}
              title={`#${tag}`}
              className={`chip max-w-full transition-colors pointer-coarse:h-11 pointer-coarse:px-3 ${on ? 'bg-accent text-white' : 'hover:text-ink'}`}
            >
              <span className="truncate">#{tag}</span>
            </button>
          );
        }) : <p className="text-xs text-ink-3">{unavailable ?? '사용한 태그가 없어요'}</p>}
      </div>
      {(tags.length > TAG_PREVIEW_COUNT || selectedTags.length > 0) && (
        <div className="mt-2 flex items-center gap-3">
          {tags.length > TAG_PREVIEW_COUNT && (
            <button type="button" onClick={onToggleShowAllTags} className="text-xs text-ink-2 hover:text-ink transition-colors pointer-coarse:min-h-11">
              {showAllTags ? '접기' : `태그 ${tags.length - TAG_PREVIEW_COUNT}개 더 보기`}
            </button>
          )}
          {selectedTags.length > 0 && (
            <button type="button" onClick={onClearTags} className="text-xs text-ink-2 hover:text-ink transition-colors pointer-coarse:min-h-11">
              선택 지우기
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function LoadingState() {
  return <div className="flex flex-col items-center justify-center py-24 gap-3"><Loader2 size={20} strokeWidth={1.5} className="animate-spin text-ink-3" /><p className="text-sm text-ink-3">메모를 불러오고 있어요</p></div>;
}

function MemoEmpty({ type, onCreate, onClearSearch, onClearTags }: { type: string; onCreate: () => void; onClearSearch: () => void; onClearTags: () => void }) {
  const messages: Record<string, string> = { group: '이 모임에 쓴 메모가 없어요', shared: '공유받은 메모가 없어요', favorites: '즐겨찾기한 메모가 없어요', tag: '이 태그가 붙은 메모가 없어요', search: '검색 결과가 없어요' };
  const sub: Record<string, string> = { search: '다른 낱말로 찾아보세요', favorites: '메모의 별을 누르면 여기에 모여요', shared: '친구가 메모를 공유하면 여기에 보여요', tag: '다른 보기에서 찾거나 태그 선택을 지워 보세요', group: '이 모임에 새 메모를 쓰면 멤버가 함께 봐요' };
  const canCreate = type === 'all' || type === 'my' || type === 'group';
  const action = type === 'search'
    ? <button type="button" onClick={onClearSearch} className="btn-secondary">검색어 지우기</button>
    : type === 'tag'
      ? <button type="button" onClick={onClearTags} className="btn-secondary">태그 선택 지우기</button>
      : canCreate ? <button type="button" onClick={onCreate} className="btn-secondary">메모 쓰기</button> : undefined;
  return (
    <EmptyState
      title={messages[type] || '메모가 없어요'}
      description={sub[type] || '새 메모를 쓰면 여기에 모여요'}
      action={action}
      className="py-20"
    />
  );
}

interface MemoCardProps extends MemoCardItem {
  viewMode: 'grid' | 'list';
  pinBusy?: boolean;
  onClick?: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onTogglePin: (e: React.MouseEvent) => void;
  onTagClick: (e: React.MouseEvent, tag: string) => void;
}

function MemoCard({ title, description, image, tags, category, ribbon, author, group, date, locked, isFavorite, sharedByMe, sharedTitle, sharedChip, pinned, canPin, groupPin, viewMode, pinBusy, onClick, onToggleFavorite, onTogglePin, onTagClick }: MemoCardProps) {
  const isList = viewMode === 'list';
  const shownTags = tags.slice(0, CARD_TAG_COUNT);
  const pinLabel = groupPin ? (pinned ? '모임 고정 해제' : '모임에 고정') : (pinned ? '고정 해제' : '고정');
  const pinColor = groupPin ? 'text-group-ink hover:text-group-ink' : 'text-accent hover:text-accent';
  return (
    <div
      onClick={onClick}
      role="link"
      tabIndex={0}
      aria-label={title}
      // 모임 폴더에선 고정 색을 모임 탭과 같게(text-group-ink)
      style={groupPin ? groupStyle(group?.colorTheme) : undefined}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); }
      }}
      className={`card relative flex cursor-pointer gap-4 overflow-hidden pl-5 pr-4 transition-colors hover:border-line-strong focus-visible:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${isList ? 'items-center py-3' : 'py-4 sm:py-5'}`}
    >
      <Ribbon color={ribbon} className="absolute inset-y-0 left-0" />
      <div className={`flex min-w-0 flex-1 flex-col ${isList ? 'gap-1' : 'gap-2'}`}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-[17px] leading-6 text-ink truncate" title={title}>{title}</h3>
          <div className="-mr-1.5 -mt-1 flex shrink-0 items-center gap-1 pointer-coarse:-mt-2.5 pointer-coarse:gap-2">
            {locked && <Lock size={16} strokeWidth={1.5} className="text-ink-3" />}
            {/* 내가 친구나 모임에 공유한 메모 */}
            {sharedByMe && <span className="chip" title={sharedTitle}>{sharedChip}</span>}
            {canPin ? (
              <button
                type="button"
                onClick={(e: React.MouseEvent) => { e.stopPropagation(); onTogglePin(e); }}
                aria-label={pinLabel}
                aria-pressed={pinned}
                aria-busy={pinBusy || undefined}
                disabled={pinBusy}
                title={pinLabel}
                className={`btn-icon pointer-coarse:size-11 ${pinned ? pinColor : 'text-ink-3'}`}
              >
                <Pin size={16} strokeWidth={1.5} className={pinned ? 'fill-current' : ''} />
              </button>
            ) : pinned && (
              <span className={`inline-flex size-8 items-center justify-center pointer-coarse:size-11 ${groupPin ? 'text-group-ink' : 'text-ink-2'}`} title={groupPin ? '모임에 고정됨' : '고정됨'}>
                <Pin size={16} strokeWidth={1.5} className="fill-current" aria-label={groupPin ? '모임에 고정됨' : '고정됨'} />
              </span>
            )}
            {/* 즐겨찾기는 모임 메모도 된다(모임 화면에서는 별을 보이지 않는다) */}
            <button
              type="button"
              onClick={(e: React.MouseEvent) => { e.stopPropagation(); onToggleFavorite(e); }}
              aria-label={isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}
              aria-pressed={!!isFavorite}
              className={`btn-icon pointer-coarse:size-11 ${isFavorite ? 'text-accent hover:text-accent' : 'text-ink-3'}`}
            >
              <Star size={16} strokeWidth={1.5} className={isFavorite ? 'fill-current' : ''} />
            </button>
          </div>
        </div>
        {description && (
          <p className={`text-sm leading-relaxed text-ink-2 ${isList ? 'line-clamp-1' : 'line-clamp-2 sm:line-clamp-3'}`}>{description}</p>
        )}
        {!isList && tags.length > 0 && (
          // 모바일에도 보인다. 태그가 많으면 앞의 몇 개만 + '+n'(카드 높이가 크게 달라지지 않게)
          <div className="flex flex-wrap gap-1.5">
            {shownTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={(e: React.MouseEvent) => onTagClick(e, tag)}
                title={`#${tag} 태그로 거르기`}
                className="chip max-w-full transition-colors hover:text-ink"
              >
                <span className="truncate">#{tag}</span>
              </button>
            ))}
            {tags.length > shownTags.length && (
              <span className="chip" title={tags.slice(CARD_TAG_COUNT).map(t => `#${t}`).join(' ')}>+{tags.length - shownTags.length}</span>
            )}
          </div>
        )}
        {!isList && image && (
          <p className="flex items-center gap-1.5 text-xs text-ink-3">
            <ImageIcon size={16} strokeWidth={1.5} />
            사진 1장
          </p>
        )}
        {/* 카드 보기에서는 같은 줄 카드 높이를 맞추고 메타 줄을 바닥에 붙인다 */}
        <div className={`flex items-center justify-between gap-3 ${isList ? 'mt-0.5' : 'mt-auto pt-1'}`}>
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
