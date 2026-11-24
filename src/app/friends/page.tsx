'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { UserPlus, MessageCircle, Loader2, Users, AlertCircle, RotateCw, Search, MoreHorizontal, Link2, Check, Inbox, Send } from 'lucide-react';
import ImageWithFallback from '@/components/ImageWithFallback';
import { useSession } from 'next-auth/react';
import { friendApi, resolveImageUrl, type FriendResponse } from '@/lib/friend-api';
import { getApiErrorMessage } from '@/lib/axios';
import { refreshUnreadCounts } from '@/lib/notification-api';
import FriendSearchModal from '@/components/FriendSearchModal';
import axios from 'axios';

import { useAlert } from '@/hooks/useAlert';
import { initialOf } from '@/lib/utils';
import { PageHeader, UnderlineTabs, EmptyState } from '@/components/ui';

type Tab = 'friends' | 'received' | 'sent';

function Avatar({ src, name, size = 'md' }: { src?: string | null; name: string; size?: 'sm' | 'md' }) {
  const px = size === 'sm' ? 32 : 40;
  return (
    <div
      className={`relative shrink-0 rounded-full bg-raised flex items-center justify-center overflow-hidden ${size === 'sm' ? 'size-8' : 'size-10'}`}
    >
      {src ? (
        <ImageWithFallback
          src={resolveImageUrl(src) ?? ''}
          alt={name}
          fill
          sizes={`${px}px`}
          containerClassName="w-full h-full"
          className="object-cover"
          unoptimized
        />
      ) : (
        <span className={`text-ink-2 ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>{initialOf(name)}</span>
      )}
    </div>
  );
}

/** 사람 행의 왼쪽: 아바타 + 주아 이름 + @아이디 (+ 한 줄 설명) */
function PersonLink({ person, sub }: { person: FriendResponse; sub?: React.ReactNode }) {
  return (
    <Link href={`/profile/${person.userId}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg">
      <Avatar src={person.profileImage} name={person.nickname} />
      <span className="min-w-0">
        <span className="flex items-baseline gap-2">
          <span className="font-display text-base leading-6 text-ink truncate">{person.nickname}</span>
          <span className="text-xs text-ink-3 truncate">@{person.customId}</span>
        </span>
        {sub && <span className="block text-xs text-ink-3 truncate mt-0.5">{sub}</span>}
      </span>
    </Link>
  );
}

export default function FriendsPage() {
  const { data: session } = useSession();
  const { confirm, toast } = useAlert();
  const [friends, setFriends] = useState<FriendResponse[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendResponse[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('friends');
  const [query, setQuery] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchFriendsData = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!session) return;
    try {
      if (!opts.silent) setLoading(true);
      const [friendsData, requestsData, sentData] = await Promise.all([
        friendApi.getFriends(session),
        friendApi.getRequests(session),
        friendApi.getSentRequests(session),
      ]);
      setFriends(friendsData);
      setFriendRequests(requestsData);
      setSentRequests(sentData);
      setLoadError(null);
    } catch (error) {
      console.error('Failed to fetch friends data:', error);
      if (!opts.silent) setLoadError(getApiErrorMessage(error, '친구 목록을 불러오지 못했어요.'));
      else toast.error(getApiErrorMessage(error, '친구 목록을 새로 불러오지 못했어요.'));
    } finally {
      if (!opts.silent) setLoading(false);
    }
    // toast 는 렌더마다 새로 만들어지므로 의존성에서 뺍니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    fetchFriendsData();
  }, [fetchFriendsData]);

  /** 이미 처리됐거나 사라진 요청(404/409)이면 목록을 새로 고칩니다. */
  const isStale = (error: unknown) =>
    axios.isAxiosError(error) && (error.response?.status === 404 || error.response?.status === 409);

  const runAction = async (id: string, action: () => Promise<void>, success: string, failure: string) => {
    if (pendingId) return;
    setPendingId(id);
    try {
      await action();
      toast.success(success);
      refreshUnreadCounts();
    } catch (error) {
      console.error(failure, error);
      toast.error(
        isStale(error)
          ? getApiErrorMessage(error, '이미 처리된 요청이에요. 목록을 새로 불러올게요.')
          : getApiErrorMessage(error, failure),
      );
    } finally {
      setPendingId(null);
      fetchFriendsData({ silent: true });
    }
  };

  const handleAccept = (requestId: string) =>
    runAction(requestId, () => friendApi.acceptRequest(requestId, session), '친구 요청을 수락했어요', '요청을 수락하지 못했어요.');

  const handleReject = (requestId: string) =>
    runAction(requestId, () => friendApi.deleteFriendship(requestId, session), '친구 요청을 거절했어요', '요청을 거절하지 못했어요.');

  const handleCancel = async (requestId: string, name: string) => {
    if (!(await confirm(`${name}님에게 보낸 친구 요청을 취소할까요?`, undefined, '요청 취소', '닫기'))) return;
    runAction(requestId, () => friendApi.deleteFriendship(requestId, session), '친구 요청을 취소했어요', '요청을 취소하지 못했어요.');
  };

  const handleDelete = async (id: string, name: string) => {
    setMenuId(null);
    if (!(await confirm(`${name}님을 친구 목록에서 삭제할까요?`, undefined, '삭제'))) return;
    runAction(id, () => friendApi.deleteFriendship(id, session), '친구 목록에서 삭제했어요', '친구를 삭제하지 못했어요.');
  };

  // 초대 링크는 오른쪽 위 내 프로필 메뉴와 같은 주소예요.
  const myCustomId = session?.user?.customId;
  const inviteLink =
    myCustomId && typeof window !== 'undefined' ? `${window.location.origin}/invite/friend?code=${myCustomId}` : '';

  const handleCopyInviteLink = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const q = query.trim().toLowerCase();
  const matches = (p: FriendResponse) =>
    !q || p.nickname.toLowerCase().includes(q) || p.customId.toLowerCase().includes(q);
  const list = (tab === 'friends' ? friends : tab === 'received' ? friendRequests : sentRequests).filter(matches);

  const searchInput = (
    <div className="relative w-full">
      <Search size={16} strokeWidth={1.5} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="이름이나 아이디로 찾기"
        aria-label="친구 찾기"
        className="form-input h-9 py-0 pl-9"
      />
    </div>
  );

  const emptyText: Record<Tab, { title: string; description: string }> = {
    friends: { title: '아직 친구가 없어요', description: '친구를 추가하면 메모와 일정을 함께 쓸 수 있어요' },
    received: { title: '받은 요청이 없어요', description: '누군가 친구 신청을 보내면 여기에 보여요' },
    sent: { title: '보낸 요청이 없어요', description: '수락을 기다리는 친구 신청이 여기에 보여요' },
  };

  return (
    <div className="h-screen flex flex-col bg-canvas text-ink overflow-hidden">
      <Navbar />

      <main className="flex-1 overflow-y-auto no-scrollbar px-4 pt-6 pb-24 lg:px-8 lg:pt-8 lg:pb-12">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* 왼쪽: 머리 + 탭 + 목록 */}
          <div className="min-w-0 space-y-5">
            <PageHeader
              title="친구"
              count={loading || loadError ? undefined : `${friends.length}명`}
              actions={
                <>
                  <div className="hidden w-64 md:block">{searchInput}</div>
                  <button onClick={() => setIsSearchModalOpen(true)} className="btn-primary shrink-0">
                    <UserPlus size={16} strokeWidth={1.5} />
                    친구 추가
                  </button>
                </>
              }
            />

            <div className="md:hidden">{searchInput}</div>

            <UnderlineTabs<Tab>
              items={[
                { key: 'friends', label: '친구', count: loading ? undefined : friends.length },
                { key: 'received', label: '받은 요청', count: loading ? undefined : friendRequests.length },
                { key: 'sent', label: '보낸 요청', count: loading ? undefined : sentRequests.length },
              ]}
              active={tab}
              onChange={(k) => {
                setTab(k);
                setMenuId(null);
              }}
            />

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 size={18} strokeWidth={1.5} className="animate-spin text-ink-3" />
                <p className="text-sm text-ink-3">친구 목록을 불러오는 중…</p>
              </div>
            ) : loadError ? (
              <div className="card">
                <EmptyState
                  icon={AlertCircle}
                  title="친구 목록을 불러오지 못했어요"
                  description={loadError}
                  action={
                    <button onClick={() => fetchFriendsData()} className="btn-secondary">
                      <RotateCw size={16} strokeWidth={1.5} />
                      다시 시도
                    </button>
                  }
                />
              </div>
            ) : list.length === 0 ? (
              <div className="card">
                {q ? (
                  <EmptyState icon={Search} title="찾는 사람이 없어요" description="이름이나 아이디를 다시 확인해 주세요" />
                ) : (
                  <EmptyState
                    icon={tab === 'friends' ? Users : tab === 'received' ? Inbox : Send}
                    title={emptyText[tab].title}
                    description={emptyText[tab].description}
                    action={
                      tab === 'friends' ? (
                        <button onClick={() => setIsSearchModalOpen(true)} className="btn-secondary">
                          친구 찾기
                        </button>
                      ) : undefined
                    }
                  />
                )}
              </div>
            ) : (
              <ul className="card divide-y divide-line">
                {list.map((p) => (
                  <li key={p.id} className="flex min-h-16 items-center gap-3 px-4 py-3 lg:px-5">
                    {tab === 'friends' ? (
                      <>
                        <PersonLink person={p} sub={p.email || undefined} />
                        <Link href={`/messages/${p.userId}`} className="btn-secondary btn-sm shrink-0">
                          <MessageCircle size={16} strokeWidth={1.5} />
                          <span className="hidden sm:inline">메시지</span>
                          <span className="sr-only sm:hidden">메시지</span>
                        </Link>
                        <div className="relative shrink-0">
                          <button
                            onClick={() => setMenuId(menuId === p.id ? null : p.id)}
                            disabled={pendingId === p.id}
                            aria-label={`${p.nickname}님 더보기`}
                            aria-expanded={menuId === p.id}
                            className="btn-icon"
                          >
                            <MoreHorizontal size={16} strokeWidth={1.5} />
                          </button>
                          {menuId === p.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setMenuId(null)} />
                              <div className="absolute right-0 top-full z-20 mt-1 w-36 rounded-[10px] border border-line bg-surface p-1 shadow-float">
                                <Link
                                  href={`/profile/${p.userId}`}
                                  className="flex h-9 w-full items-center rounded-lg px-3 text-sm text-ink hover:bg-raised"
                                >
                                  프로필 보기
                                </Link>
                                <button
                                  onClick={() => handleDelete(p.id, p.nickname)}
                                  aria-label={`${p.nickname}님 친구 삭제`}
                                  className="flex h-9 w-full items-center rounded-lg px-3 text-left text-sm text-negative hover:bg-negative-soft"
                                >
                                  친구 삭제
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </>
                    ) : tab === 'received' ? (
                      <>
                        <PersonLink person={p} sub="나에게 친구 신청을 보냈어요" />
                        <button
                          onClick={() => handleReject(p.id)}
                          disabled={pendingId === p.id}
                          className="btn-ghost btn-sm shrink-0"
                        >
                          거절
                        </button>
                        <button
                          onClick={() => handleAccept(p.id)}
                          disabled={pendingId === p.id}
                          className="btn-primary btn-sm shrink-0"
                        >
                          수락
                        </button>
                      </>
                    ) : (
                      <>
                        <PersonLink person={p} sub="수락을 기다리고 있어요" />
                        <button
                          onClick={() => handleCancel(p.id, p.nickname)}
                          disabled={pendingId === p.id}
                          className="btn-ghost btn-sm shrink-0"
                        >
                          요청 취소
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 오른쪽: 받은 요청 · 초대 링크 */}
          <aside className="space-y-4 lg:pt-1">
            {!loading && !loadError && friendRequests.length > 0 && (
              <section className="card p-5">
                <div className="flex items-baseline gap-2">
                  <h2 className="font-display text-lg text-ink">받은 요청</h2>
                  <span className="stamp">{friendRequests.length}</span>
                </div>
                <ul className="mt-3 space-y-1">
                  {friendRequests.slice(0, 5).map((req) => (
                    <li key={req.id} className="flex items-center gap-3 py-2">
                      <Link href={`/profile/${req.userId}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg">
                        <Avatar src={req.profileImage} name={req.nickname} size="sm" />
                        <span className="min-w-0">
                          <span className="block font-display text-[15px] leading-5 text-ink truncate">{req.nickname}</span>
                          <span className="block text-xs text-ink-3 truncate">@{req.customId}</span>
                        </span>
                      </Link>
                      <button
                        onClick={() => handleReject(req.id)}
                        disabled={pendingId === req.id}
                        className="btn-ghost btn-sm shrink-0"
                      >
                        거절
                      </button>
                      <button
                        onClick={() => handleAccept(req.id)}
                        disabled={pendingId === req.id}
                        className="btn-primary btn-sm shrink-0"
                      >
                        수락
                      </button>
                    </li>
                  ))}
                </ul>
                {friendRequests.length > 5 && (
                  <button onClick={() => setTab('received')} className="btn-ghost btn-sm mt-2 -ml-3">
                    모두 보기
                  </button>
                )}
              </section>
            )}

            {inviteLink && (
              <section className="card p-5">
                <h2 className="font-display text-lg text-ink">초대 링크</h2>
                <p className="mt-1 text-[13px] text-ink-2">링크를 받은 사람이 열면 바로 친구 신청을 보낼 수 있어요</p>
                <p className="mt-3 truncate rounded-[10px] bg-raised px-3 py-2.5 text-[13px] text-ink-2">{inviteLink}</p>
                <button onClick={handleCopyInviteLink} className="btn-secondary mt-3">
                  {copied ? <Check size={16} strokeWidth={1.5} /> : <Link2 size={16} strokeWidth={1.5} />}
                  {copied ? '복사했어요' : '링크 복사'}
                </button>
              </section>
            )}
          </aside>
        </div>
      </main>

      <FriendSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onSuccess={() => fetchFriendsData({ silent: true })}
      />
    </div>
  );
}
