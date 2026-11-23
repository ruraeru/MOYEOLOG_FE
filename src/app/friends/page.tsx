'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { UserPlus, MessageCircle, Loader2, UserX, Users, AlertCircle, RotateCw } from 'lucide-react';
import ImageWithFallback from '@/components/ImageWithFallback';
import { useSession } from 'next-auth/react';
import { friendApi, resolveImageUrl, type FriendResponse } from '@/lib/friend-api';
import { getApiErrorMessage } from '@/lib/axios';
import { refreshUnreadCounts } from '@/lib/notification-api';
import FriendSearchModal from '@/components/FriendSearchModal';
import axios from 'axios';

import { useAlert } from '@/hooks/useAlert';
import { initialOf } from '@/lib/utils';

function Avatar({ src, name, size }: { src?: string | null; name: string; size: 'sm' | 'lg' }) {
  const px = size === 'sm' ? 40 : 64;
  return (
    <div
      className={`relative shrink-0 rounded-full bg-raised flex items-center justify-center overflow-hidden ${size === 'sm' ? 'size-10' : 'size-16'}`}
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
        <span className={`font-medium text-ink-2 ${size === 'sm' ? 'text-base' : 'text-xl'}`}>{initialOf(name)}</span>
      )}
    </div>
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
    if (!(await confirm(`${name}님을 친구 목록에서 삭제할까요?`, undefined, '삭제'))) return;
    runAction(id, () => friendApi.deleteFriendship(id, session), '친구 목록에서 삭제했어요', '친구를 삭제하지 못했어요.');
  };

  return (
    <div className="h-screen flex flex-col bg-canvas text-ink overflow-hidden">
      <Navbar />

      <main className="flex-1 overflow-y-auto no-scrollbar p-4 sm:p-8">
        <div className="max-w-5xl mx-auto space-y-8">

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl font-semibold text-ink">친구</h2>
              <p className="text-sm text-ink-2 mt-1">친구와 연결하면 메모와 일정을 함께 쓸 수 있어요</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsSearchModalOpen(true)}
                className="btn-primary shrink-0"
              >
                <UserPlus size={16} strokeWidth={1.5} />
                친구 추가
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 size={18} strokeWidth={1.5} className="animate-spin text-ink-3" />
              <p className="text-sm text-ink-3">친구 목록을 불러오는 중…</p>
            </div>
          ) : loadError ? (
            <div className="card flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="size-10 rounded-full bg-raised flex items-center justify-center mb-3">
                <AlertCircle size={18} strokeWidth={1.5} className="text-negative" />
              </div>
              <h3 className="text-sm font-medium text-ink">친구 목록을 불러오지 못했어요</h3>
              <p className="text-sm text-ink-3 mt-1 mb-5">{loadError}</p>
              <button onClick={() => fetchFriendsData()} className="btn-secondary">
                <RotateCw size={16} strokeWidth={1.5} />
                다시 시도
              </button>
            </div>
          ) : (
            <>
              {/* Received requests */}
              {friendRequests.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-base font-semibold text-ink">받은 친구 요청</h3>
                    <span className="text-xs text-ink-3 tabular-nums">{friendRequests.length}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {friendRequests.map(req => (
                      <div key={req.id} className="card px-4 py-3 flex items-center justify-between gap-3">
                        <Link href={`/profile/${req.userId}`} className="flex items-center gap-3 min-w-0 rounded-lg">
                          <Avatar src={req.profileImage} name={req.nickname} size="sm" />
                          <div className="min-w-0">
                            <h4 className="text-sm font-medium text-ink truncate">{req.nickname}</h4>
                            <p className="text-xs text-ink-3 truncate tabular-nums">ID: {req.customId}</p>
                          </div>
                        </Link>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleAccept(req.id)}
                            disabled={pendingId === req.id}
                            className="btn-primary h-9 px-3"
                          >
                            수락
                          </button>
                          <button
                            onClick={() => handleReject(req.id)}
                            disabled={pendingId === req.id}
                            className="btn-ghost"
                          >
                            거절
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Sent requests */}
              {sentRequests.length > 0 && (
                <section className="space-y-3">
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-base font-semibold text-ink">보낸 친구 요청</h3>
                    <span className="text-xs text-ink-3 tabular-nums">{sentRequests.length}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {sentRequests.map(req => (
                      <div key={req.id} className="card px-4 py-3 flex items-center justify-between gap-3">
                        <Link href={`/profile/${req.userId}`} className="flex items-center gap-3 min-w-0 rounded-lg">
                          <Avatar src={req.profileImage} name={req.nickname} size="sm" />
                          <div className="min-w-0">
                            <h4 className="text-sm font-medium text-ink truncate">{req.nickname}</h4>
                            <p className="text-xs text-ink-3 truncate tabular-nums">ID: {req.customId} · 수락을 기다리고 있어요</p>
                          </div>
                        </Link>
                        <button
                          onClick={() => handleCancel(req.id, req.nickname)}
                          disabled={pendingId === req.id}
                          className="btn-ghost shrink-0"
                        >
                          요청 취소
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Friends list */}
              <section className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-base font-semibold text-ink">내 친구</h3>
                  <span className="text-xs text-ink-3 tabular-nums">{friends.length}</span>
                </div>

                {friends.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {friends.map(friend => (
                      <div key={friend.id} className="card p-5 flex flex-col items-center text-center relative">
                        <button
                          onClick={() => handleDelete(friend.id, friend.nickname)}
                          disabled={pendingId === friend.id}
                          aria-label={`${friend.nickname}님 친구 삭제`}
                          title="친구 삭제"
                          className="btn-ghost absolute top-3 right-3 size-9 px-0 hover:text-negative"
                        >
                          <UserX size={16} strokeWidth={1.5} />
                        </button>

                        <Link href={`/profile/${friend.userId}`} className="flex flex-col items-center max-w-full rounded-lg">
                          <div className="mb-4">
                            <Avatar src={friend.profileImage} name={friend.nickname} size="lg" />
                          </div>
                          <h4 className="text-base font-medium text-ink mb-0.5 max-w-full truncate">{friend.nickname}</h4>
                          <p className="text-xs text-ink-3 max-w-full truncate tabular-nums">ID: {friend.customId}</p>
                          {friend.email && <p className="text-xs text-ink-3 max-w-full truncate">{friend.email}</p>}
                        </Link>

                        <div className="w-full pt-4 mt-4 border-t border-line">
                          <Link href={`/messages/${friend.userId}`} className="btn-secondary w-full">
                            <MessageCircle size={16} strokeWidth={1.5} className="text-ink-3" />
                            메시지 보내기
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="card flex flex-col items-center justify-center py-16 text-center">
                    <div className="size-10 rounded-full bg-raised flex items-center justify-center mb-3">
                      <Users size={18} strokeWidth={1.5} className="text-ink-3" />
                    </div>
                    <h3 className="text-sm font-medium text-ink">아직 친구가 없어요</h3>
                    <p className="text-sm text-ink-3 mt-1 mb-5">친구를 찾아 추가하면 일정을 함께 볼 수 있어요</p>
                    <button
                      onClick={() => setIsSearchModalOpen(true)}
                      className="btn-secondary"
                    >
                      친구 찾기
                    </button>
                  </div>
                )}
              </section>
            </>
          )}
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
