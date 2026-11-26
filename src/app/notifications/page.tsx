'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import {
  Users,
  Check,
  Loader2,
  Bell,
  AlertCircle,
  RotateCw,
  UserPlus,
  UserCheck,
  FileText,
  MessageSquare,
  Calendar,
  UserMinus,
  X,
  Settings,
  ChevronRight,
  Megaphone,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import axios from 'axios';
import { groupApi, type GroupInvitationResponse } from '@/lib/group-api';
import {
  notificationApi,
  refreshUnreadCounts,
  safeNotificationLink,
  NOTIFICATION_PAGE_SIZE,
  type NotificationResponse,
  type NotificationType,
} from '@/lib/notification-api';
import { getApiErrorMessage } from '@/lib/axios';
import { format, isToday, isThisWeek } from 'date-fns';
import { useTimeFormat } from '@/lib/schedule-utils';
import { ko } from 'date-fns/locale';

import { useAlert } from '@/hooks/useAlert';
import { useLiveTopics } from '@/lib/live';
import { useVisiblePolling } from '@/hooks/useVisiblePolling';
import { PageHeader, Segmented, EmptyState } from '@/components/ui';

const TYPE_META: Record<NotificationType, { icon: React.ElementType; label: string }> = {
  FRIEND_REQUEST: { icon: UserPlus, label: '친구 요청' },
  FRIEND_ACCEPTED: { icon: UserCheck, label: '친구 수락' },
  GROUP_INVITE: { icon: Users, label: '모임 초대' },
  MEMO_SHARED: { icon: FileText, label: '메모 공유' },
  TOPIC_COMMENT: { icon: MessageSquare, label: '토픽 댓글' },
  SCHEDULE_PARTICIPANT: { icon: Calendar, label: '일정 참여' },
  GROUP_KICKED: { icon: UserMinus, label: '모임' },
  GROUP_NOTICE: { icon: Megaphone, label: '모임 공지' },
};

const formatStamp = (value: string, tf: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : format(date, `M.d EEE ${tf}`, { locale: ko });
};

/** 목록 오른쪽 시각: 오늘이면 시각만, 아니면 날짜만 */
const rowStamp = (value: string, tf: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return isToday(date) ? format(date, tf, { locale: ko }) : format(date, 'M.d', { locale: ko });
};

type GroupKey = 'today' | 'week' | 'earlier';
const GROUP_LABEL: Record<GroupKey, string> = { today: '오늘', week: '이번 주', earlier: '이전' };
const groupOf = (value: string): GroupKey => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'earlier';
  if (isToday(date)) return 'today';
  if (isThisWeek(date, { weekStartsOn: 1 })) return 'week';
  return 'earlier';
};

function ErrorState({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <div className="card">
      <EmptyState
        icon={AlertCircle}
        title={title}
        description={message}
        action={
          <button onClick={onRetry} className="btn-secondary">
            <RotateCw size={16} strokeWidth={1.5} />
            다시 시도
          </button>
        }
      />
    </div>
  );
}

function NotificationsContent() {
  const tf = useTimeFormat();
  const { data: session } = useSession();
  const { toast } = useAlert();
  const router = useRouter();
  const searchParams = useSearchParams();
  const filter: 'all' | 'invitations' = searchParams.get('tab') === 'invites' ? 'invitations' : 'all';

  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifError, setNotifError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const [invitations, setInvitations] = useState<GroupInvitationResponse[]>([]);
  const [inviteLoading, setInviteLoading] = useState(true);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const setFilter = (next: 'all' | 'invitations') => {
    router.replace(next === 'invitations' ? '/notifications?tab=invites' : '/notifications', { scroll: false });
  };

  // silent: 실시간 갱신·안전망 폴링용. 로딩 표시를 띄우지 않고, 실패해도 보던 목록을 두고, '더 보기'로 불러온 예전 알림도 남긴다
  const fetchNotifications = useCallback(async (silent = false) => {
    if (!session) return;
    try {
      if (!silent) setNotifLoading(true);
      const data = await notificationApi.getNotifications(session, 0);
      if (silent) {
        setNotifications((prev) => {
          if (prev.length <= data.length) return data;
          const ids = new Set(data.map((n) => n.id));
          const oldest = data[data.length - 1]?.createdAt ?? '';
          return [...data, ...prev.filter((n) => !ids.has(n.id) && n.createdAt < oldest)];
        });
      } else {
        setNotifications(data);
        setPage(0);
        setHasMore(data.length >= NOTIFICATION_PAGE_SIZE);
      }
      setNotifError(null);
    } catch (error) {
      if (silent) return;
      console.error('Failed to fetch notifications:', error);
      setNotifError(getApiErrorMessage(error, '알림을 불러오지 못했어요.'));
    } finally {
      if (!silent) setNotifLoading(false);
    }
  }, [session]);

  // 보고 있는 동안 새 알림을 바로 목록에 넣는다(SSE). 끊겼을 때는 배지와 같은 30초 폴링이 안전망이다
  useLiveTopics(['notifications'], () => fetchNotifications(true), !!session);
  useVisiblePolling(() => fetchNotifications(true), !!session, 30000);

  const fetchInvitations = useCallback(async () => {
    if (!session) return;
    try {
      setInviteLoading(true);
      const data = await groupApi.getMyInvitations(session);
      setInvitations(data.filter((i) => !i.status || i.status === 'PENDING'));
      setInviteError(null);
    } catch (error) {
      console.error('Failed to fetch invitations:', error);
      setInviteError(getApiErrorMessage(error, '초대 목록을 불러오지 못했어요.'));
    } finally {
      setInviteLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // 초대 탭으로 올 때마다(알림의 '모임 초대' 링크 포함) 최신 초대를 다시 가져옵니다.
  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations, filter]);

  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const data = await notificationApi.getNotifications(session, next);
      setNotifications((prev) => {
        const seen = new Set(prev.map((n) => n.id));
        return [...prev, ...data.filter((n) => !seen.has(n.id))];
      });
      setPage(next);
      setHasMore(data.length >= NOTIFICATION_PAGE_SIZE);
    } catch (error) {
      toast.error(getApiErrorMessage(error, '알림을 더 불러오지 못했어요.'));
    } finally {
      setLoadingMore(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = async () => {
    if (markingAll) return;
    setMarkingAll(true);
    try {
      await notificationApi.markAllRead(session);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      refreshUnreadCounts();
      toast.success('모든 알림을 읽음으로 표시했어요');
    } catch (error) {
      toast.error(getApiErrorMessage(error, '읽음으로 표시하지 못했어요.'));
    } finally {
      setMarkingAll(false);
    }
  };

  const handleOpen = async (n: NotificationResponse) => {
    if (!n.read) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      notificationApi
        .markRead(n.id, session)
        .then(() => refreshUnreadCounts())
        .catch((error) => console.error('Failed to mark notification read:', error));
    }
    const link = safeNotificationLink(n.link);
    if (link) router.push(link);
  };

  const handleRemove = async (id: string) => {
    const before = notifications;
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await notificationApi.remove(id, session);
      refreshUnreadCounts();
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) return; // 이미 지워진 알림
      setNotifications(before);
      toast.error(getApiErrorMessage(error, '알림을 지우지 못했어요.'));
    }
  };

  /** 초대 수락·거절. 이미 처리됐거나(409) 모임·초대가 사라졌으면(404) 안내하고 카드를 없앱니다. */
  const handleInvitation = async (invite: GroupInvitationResponse, kind: 'accept' | 'reject') => {
    if (processingId) return;
    setProcessingId(invite.id);
    try {
      if (kind === 'accept') await groupApi.acceptInvitation(invite.id, session);
      else await groupApi.rejectInvitation(invite.id, session);
      setInvitations((prev) => prev.filter((i) => i.id !== invite.id));
      toast.success(kind === 'accept' ? `"${invite.groupName}" 모임에 참여했어요` : '모임 초대를 거절했어요');
      refreshUnreadCounts();
    } catch (error) {
      const code = axios.isAxiosError(error) ? error.response?.status : undefined;
      if (code === 409) {
        toast.info(getApiErrorMessage(error, '이미 처리된 초대예요.'));
        setInvitations((prev) => prev.filter((i) => i.id !== invite.id));
        fetchInvitations();
      } else if (code === 404) {
        toast.info(getApiErrorMessage(error, '삭제된 모임이거나 더 이상 없는 초대예요.'));
        setInvitations((prev) => prev.filter((i) => i.id !== invite.id));
        fetchInvitations();
      } else if (code === 403) {
        toast.error(getApiErrorMessage(error, '이 초대는 처리할 수 없어요.'));
        fetchInvitations();
      } else {
        toast.error(
          getApiErrorMessage(error, kind === 'accept' ? '초대를 수락하지 못했어요.' : '초대를 거절하지 못했어요.'),
        );
      }
    } finally {
      setProcessingId(null);
    }
  };

  const view: 'all' | 'unread' | 'invitations' = filter === 'invitations' ? 'invitations' : unreadOnly ? 'unread' : 'all';
  const changeView = (next: 'all' | 'unread' | 'invitations') => {
    setUnreadOnly(next === 'unread');
    setFilter(next === 'invitations' ? 'invitations' : 'all');
  };

  const visible = view === 'unread' ? notifications.filter((n) => !n.read) : notifications;
  const groups = (['today', 'week', 'earlier'] as GroupKey[])
    .map((key) => ({ key, items: visible.filter((n) => groupOf(n.createdAt) === key) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="h-screen flex flex-col bg-canvas text-ink overflow-hidden">
      <Navbar />

      <main className="flex-1 overflow-y-auto no-scrollbar px-4 pt-6 pb-24 lg:px-8 lg:pt-8 lg:pb-12">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-5">
            <PageHeader
              title="알림"
              count={!notifLoading && !notifError && unreadCount > 0 ? `안 읽음 ${unreadCount}` : undefined}
              actions={
                <>
                  <Segmented
                    ariaLabel="알림 보기"
                    active={view}
                    onChange={changeView}
                    items={[
                      { key: 'all', label: '전체' },
                      { key: 'unread', label: '안 읽음' },
                      {
                        key: 'invitations',
                        label: (
                          <>
                            모임 초대
                            {invitations.length > 0 && <span className="stamp text-[11px]">{invitations.length}</span>}
                          </>
                        ),
                      },
                    ]}
                  />
                  {view !== 'invitations' && unreadCount > 0 && (
                    <button onClick={handleMarkAllRead} disabled={markingAll} className="btn-secondary">
                      {markingAll ? (
                        <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
                      ) : (
                        <Check size={16} strokeWidth={1.5} />
                      )}
                      모두 읽음
                    </button>
                  )}
                </>
              }
            />

            {view === 'invitations' ? (
              inviteLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 size={18} strokeWidth={1.5} className="animate-spin text-ink-3" />
                  <p className="text-sm text-ink-3">초대 목록을 불러오는 중…</p>
                </div>
              ) : inviteError ? (
                <ErrorState title="초대 목록을 불러오지 못했어요" message={inviteError} onRetry={fetchInvitations} />
              ) : invitations.length > 0 ? (
                <ul className="card divide-y divide-line">
                  {invitations.map((invite) => (
                    <li key={invite.id} className="flex items-start gap-3 px-4 py-4 lg:px-5">
                      <span className="flex w-2 shrink-0 justify-center pt-3.5">
                        <span aria-hidden className="size-1.5 rounded-full bg-mark" />
                      </span>
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-raised text-ink-2">
                        <Users size={16} strokeWidth={1.5} aria-hidden />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm text-ink-2 leading-relaxed break-words pt-1">
                            <span className="font-medium text-ink">{invite.inviterNickname}</span>님이{' '}
                            <span className="font-medium text-ink">{invite.groupName}</span> 모임에 초대했어요
                          </p>
                          <span className="stamp shrink-0 pt-1.5">{formatStamp(invite.invitedAt, tf)}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2.5">
                          <button
                            onClick={() => handleInvitation(invite, 'accept')}
                            disabled={processingId === invite.id}
                            className="btn-primary btn-sm"
                          >
                            수락
                          </button>
                          <button
                            onClick={() => handleInvitation(invite, 'reject')}
                            disabled={processingId === invite.id}
                            className="btn-secondary btn-sm"
                          >
                            거절
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="card">
                  <EmptyState icon={Users} title="받은 초대가 없어요" description="모임 초대가 오면 여기에 모여요" />
                </div>
              )
            ) : notifLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 size={18} strokeWidth={1.5} className="animate-spin text-ink-3" />
                <p className="text-sm text-ink-3">알림을 불러오는 중…</p>
              </div>
            ) : notifError ? (
              <ErrorState title="알림을 불러오지 못했어요" message={notifError} onRetry={() => fetchNotifications()} />
            ) : visible.length > 0 ? (
              <>
                {invitations.length > 0 && (
                  <button
                    onClick={() => changeView('invitations')}
                    className="card w-full min-h-14 px-4 lg:px-5 flex items-center gap-3 text-left hover:bg-raised transition-colors"
                  >
                    <span className="flex w-2 shrink-0 justify-center">
                      <span aria-hidden className="size-1.5 rounded-full bg-mark" />
                    </span>
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-raised text-ink-2">
                      <Users size={16} strokeWidth={1.5} aria-hidden />
                    </span>
                    <span className="flex-1 text-sm text-ink">답하지 않은 모임 초대가 {invitations.length}건 있어요</span>
                    <ChevronRight size={16} strokeWidth={1.5} className="text-ink-3" aria-hidden />
                  </button>
                )}
                {groups.map((g) => (
                  <section key={g.key} className="space-y-2">
                    <h2 className="px-1 text-[13px] font-medium text-ink-3">{GROUP_LABEL[g.key]}</h2>
                    <ul className="card divide-y divide-line overflow-hidden">
                      {g.items.map((n) => {
                        const meta = TYPE_META[n.type] ?? { icon: Bell, label: '알림' };
                        const Icon = meta.icon;
                        const link = safeNotificationLink(n.link);
                        return (
                          <li key={n.id} className="group relative flex items-center gap-1 pr-2 lg:pr-3">
                            <button
                              onClick={() => handleOpen(n)}
                              className={`flex min-h-14 flex-1 min-w-0 items-start gap-3 py-3.5 pl-4 lg:pl-5 text-left transition-colors hover:bg-raised/60 ${link ? 'cursor-pointer' : 'cursor-default'}`}
                            >
                              <span className="flex w-2 shrink-0 justify-center pt-3">
                                {!n.read && <span aria-hidden className="size-1.5 rounded-full bg-mark" />}
                              </span>
                              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-raised text-ink-2">
                                <Icon size={16} strokeWidth={1.5} aria-hidden />
                              </span>
                              <span className="flex-1 min-w-0 pt-1.5">
                                <span className="sr-only">{meta.label}{!n.read && ', 안 읽음'}: </span>
                                <span className={`block text-sm leading-relaxed break-words ${n.read ? 'text-ink-2' : 'text-ink'}`}>
                                  {n.message}
                                </span>
                              </span>
                              <span className="stamp shrink-0 pt-2" title={formatStamp(n.createdAt, tf)}>
                                {rowStamp(n.createdAt, tf)}
                              </span>
                            </button>
                            <button
                              onClick={() => handleRemove(n.id)}
                              aria-label="알림 지우기"
                              title="알림 지우기"
                              className="btn-icon shrink-0 lg:opacity-0 lg:group-hover:opacity-100 focus-visible:opacity-100"
                            >
                              <X size={16} strokeWidth={1.5} />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
                {hasMore && (
                  <div className="flex justify-center">
                    <button onClick={loadMore} disabled={loadingMore} className="btn-secondary">
                      {loadingMore && <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />}
                      더 보기
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="card">
                <EmptyState
                  icon={Bell}
                  title={view === 'unread' && notifications.length > 0 ? '안 읽은 알림이 없어요' : '새 알림이 없어요'}
                  description={
                    invitations.length > 0
                      ? `답하지 않은 모임 초대가 ${invitations.length}건 있어요`
                      : '친구 요청, 모임 초대, 공유받은 메모 소식이 여기에 모여요'
                  }
                  action={
                    invitations.length > 0 ? (
                      <button onClick={() => changeView('invitations')} className="btn-secondary">
                        모임 초대 보기
                      </button>
                    ) : undefined
                  }
                />
              </div>
            )}
          </div>

          <aside className="lg:pt-1">
            <section className="card p-5">
              <h2 className="font-display text-lg text-ink">받는 알림</h2>
              <p className="mt-1 text-[13px] leading-5 text-ink-2">친구, 메모 공유, 일정, 모임, 토픽 댓글 소식을 알려 드려요</p>
              <Link href="/settings" className="btn-secondary mt-3">
                <Settings size={16} strokeWidth={1.5} />
                알림 설정
              </Link>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center bg-canvas">
          <Loader2 size={18} strokeWidth={1.5} className="animate-spin text-ink-3" />
        </div>
      }
    >
      <NotificationsContent />
    </Suspense>
  );
}
