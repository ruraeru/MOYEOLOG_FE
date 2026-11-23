'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
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
import { format } from 'date-fns';
import { useTimeFormat } from '@/lib/schedule-utils';
import { ko } from 'date-fns/locale';

import { useAlert } from '@/hooks/useAlert';

const TYPE_META: Record<NotificationType, { icon: React.ElementType; label: string }> = {
  FRIEND_REQUEST: { icon: UserPlus, label: '친구 요청' },
  FRIEND_ACCEPTED: { icon: UserCheck, label: '친구 수락' },
  GROUP_INVITE: { icon: Users, label: '모임 초대' },
  MEMO_SHARED: { icon: FileText, label: '메모 공유' },
  TOPIC_COMMENT: { icon: MessageSquare, label: '토픽 댓글' },
  SCHEDULE_PARTICIPANT: { icon: Calendar, label: '일정 참여' },
  GROUP_KICKED: { icon: UserMinus, label: '모임' },
};

const formatStamp = (value: string, tf: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : format(date, `M.d EEE ${tf}`, { locale: ko });
};

function ErrorState({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <div className="size-10 rounded-full bg-raised flex items-center justify-center mb-3">
        <AlertCircle size={18} strokeWidth={1.5} className="text-negative" />
      </div>
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="text-sm text-ink-3 mt-1 mb-5">{message}</p>
      <button onClick={onRetry} className="btn-secondary">
        <RotateCw size={16} strokeWidth={1.5} />
        다시 시도
      </button>
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

  const setFilter = (next: 'all' | 'invitations') => {
    router.replace(next === 'invitations' ? '/notifications?tab=invites' : '/notifications', { scroll: false });
  };

  const fetchNotifications = useCallback(async () => {
    if (!session) return;
    try {
      setNotifLoading(true);
      const data = await notificationApi.getNotifications(session, 0);
      setNotifications(data);
      setPage(0);
      setHasMore(data.length >= NOTIFICATION_PAGE_SIZE);
      setNotifError(null);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      setNotifError(getApiErrorMessage(error, '알림을 불러오지 못했어요.'));
    } finally {
      setNotifLoading(false);
    }
  }, [session]);

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

  return (
    <div className="h-screen flex flex-col bg-canvas text-ink overflow-hidden">
      <Navbar />

      <main className="flex-1 overflow-y-auto no-scrollbar p-4 sm:p-8">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between mb-2 gap-3">
            <h2 className="text-2xl font-semibold text-ink">알림</h2>
            {filter === 'all' && unreadCount > 0 && (
              <button onClick={handleMarkAllRead} disabled={markingAll} className="btn-ghost">
                {markingAll ? (
                  <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
                ) : (
                  <Check size={16} strokeWidth={1.5} />
                )}
                모두 읽음 처리
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-line" role="tablist">
            <button
              role="tab"
              aria-selected={filter === 'all'}
              onClick={() => setFilter('all')}
              className={`px-4 py-3 text-sm transition-colors relative ${filter === 'all' ? 'text-ink font-medium' : 'text-ink-2 hover:text-ink'}`}
            >
              전체 알림
              {unreadCount > 0 && <span className="ml-1.5 text-xs text-accent tabular-nums">{unreadCount}</span>}
              {filter === 'all' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-accent" />}
            </button>
            <button
              role="tab"
              aria-selected={filter === 'invitations'}
              onClick={() => setFilter('invitations')}
              className={`px-4 py-3 text-sm transition-colors relative ${filter === 'invitations' ? 'text-ink font-medium' : 'text-ink-2 hover:text-ink'}`}
            >
              모임 초대
              {invitations.length > 0 && (
                <span className="ml-1.5 text-xs text-accent tabular-nums">{invitations.length}</span>
              )}
              {filter === 'invitations' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-accent" />}
            </button>
          </div>

          <div className="space-y-3">
            {filter === 'invitations' ? (
              inviteLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 size={18} strokeWidth={1.5} className="animate-spin text-ink-3" />
                  <p className="text-sm text-ink-3">초대 목록을 불러오는 중…</p>
                </div>
              ) : inviteError ? (
                <ErrorState title="초대 목록을 불러오지 못했어요" message={inviteError} onRetry={fetchInvitations} />
              ) : invitations.length > 0 ? (
                invitations.map((invite) => (
                  <div key={invite.id} className="card px-4 py-4 flex items-start gap-3">
                    <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <h4 className="text-sm font-medium text-ink">모임 초대</h4>
                        <span className="stamp shrink-0">{formatStamp(invite.invitedAt, tf)}</span>
                      </div>
                      <p className="text-sm text-ink-2 leading-relaxed break-words">
                        <span className="font-medium text-ink">{invite.inviterNickname}</span>님이
                        <span className="font-medium text-ink"> &quot;{invite.groupName}&quot;</span> 모임에 초대했어요
                      </p>
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={() => handleInvitation(invite, 'accept')}
                          disabled={processingId === invite.id}
                          className="btn-primary h-9 flex-1"
                        >
                          수락
                        </button>
                        <button
                          onClick={() => handleInvitation(invite, 'reject')}
                          disabled={processingId === invite.id}
                          className="btn-secondary h-9 flex-1"
                        >
                          거절
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="size-10 rounded-full bg-raised flex items-center justify-center mb-3">
                    <Users size={18} strokeWidth={1.5} className="text-ink-3" />
                  </div>
                  <p className="text-sm font-medium text-ink">받은 초대가 없어요</p>
                  <p className="text-sm text-ink-3 mt-1">모임 초대가 오면 여기에 모여요</p>
                </div>
              )
            ) : notifLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 size={18} strokeWidth={1.5} className="animate-spin text-ink-3" />
                <p className="text-sm text-ink-3">알림을 불러오는 중…</p>
              </div>
            ) : notifError ? (
              <ErrorState title="알림을 불러오지 못했어요" message={notifError} onRetry={fetchNotifications} />
            ) : notifications.length > 0 ? (
              <>
                {invitations.length > 0 && (
                  <button
                    onClick={() => setFilter('invitations')}
                    className="card w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-raised transition-colors"
                  >
                    <Users size={16} strokeWidth={1.5} className="text-accent shrink-0" />
                    <span className="flex-1 text-sm text-ink">답하지 않은 모임 초대가 {invitations.length}건 있어요</span>
                    <span className="text-xs text-ink-3">보기</span>
                  </button>
                )}
                <ul className="card divide-y divide-line overflow-hidden">
                  {notifications.map((n) => {
                    const meta = TYPE_META[n.type] ?? { icon: Bell, label: '알림' };
                    const Icon = meta.icon;
                    const link = safeNotificationLink(n.link);
                    return (
                      <li key={n.id} className={`group relative flex items-start gap-3 px-4 py-3.5 ${n.read ? '' : 'bg-accent-soft/60'}`}>
                        <button
                          onClick={() => handleOpen(n)}
                          className={`flex-1 min-w-0 flex items-start gap-3 text-left rounded-lg ${link ? 'cursor-pointer' : 'cursor-default'}`}
                        >
                          <span className="size-9 shrink-0 rounded-full bg-raised flex items-center justify-center">
                            <Icon size={16} strokeWidth={1.5} className={n.read ? 'text-ink-3' : 'text-accent'} />
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs text-ink-3">{meta.label}</span>
                              <span className="stamp">{formatStamp(n.createdAt, tf)}</span>
                              {!n.read && <span className="sr-only">안 읽음</span>}
                            </span>
                            <span className={`block text-sm leading-relaxed break-words ${n.read ? 'text-ink-2' : 'text-ink'}`}>
                              {n.message}
                            </span>
                          </span>
                          {!n.read && <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />}
                        </button>
                        <button
                          onClick={() => handleRemove(n.id)}
                          aria-label="알림 지우기"
                          title="알림 지우기"
                          className="btn-ghost size-8 !h-8 !px-0 shrink-0 lg:opacity-0 lg:group-hover:opacity-100 focus-visible:opacity-100"
                        >
                          <X size={14} strokeWidth={1.5} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
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
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="size-10 rounded-full bg-raised flex items-center justify-center mb-3">
                  <Bell size={18} strokeWidth={1.5} className="text-ink-3" />
                </div>
                <p className="text-sm font-medium text-ink">새 알림이 없어요</p>
                <p className="text-sm text-ink-3 mt-1">
                  {invitations.length > 0
                    ? `답하지 않은 모임 초대가 ${invitations.length}건 있어요`
                    : '친구 요청, 모임 초대, 공유받은 메모 소식이 여기에 모여요'}
                </p>
                {invitations.length > 0 && (
                  <button onClick={() => setFilter('invitations')} className="btn-secondary mt-5">
                    모임 초대 보기
                  </button>
                )}
              </div>
            )}
          </div>
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
