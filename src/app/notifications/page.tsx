'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
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
  Trash2,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import axios from 'axios';
import { groupApi, type GroupInvitationResponse } from '@/lib/group-api';
import {
  notificationApi,
  refreshUnreadCounts,
  safeNotificationLink,
  useUnreadStore,
  NOTIFICATION_PAGE_SIZE,
  type NotificationResponse,
  type NotificationType,
} from '@/lib/notification-api';
import { getApiErrorMessage } from '@/lib/axios';
import { format, isToday, isThisWeek } from 'date-fns';
import { useTimeFormat } from '@/lib/schedule-utils';
import { ko } from 'date-fns/locale';

import { useAlert } from '@/hooks/useAlert';
import { useVisiblePolling, LIST_POLL_MS } from '@/hooks/useVisiblePolling';
import { useLiveTopics } from '@/lib/live';
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

/** 목록 시각: 오늘이면 시각만, 아니면 날짜와 시각 (터치 기기는 title 툴팁을 못 보므로 시각을 늘 보인다) */
const rowStamp = (value: string, tf: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return isToday(date) ? format(date, tf, { locale: ko }) : format(date, `M.d ${tf}`, { locale: ko });
};

/** 지운 알림을 되돌릴 수 있는 시간 */
const UNDO_MS = 5000;
/** 알림을 열었다가 돌아왔을 때 이어 보기(불러온 개수·스크롤) */
const RESTORE_KEY = 'moyeolog.notifications.restore';
const NOTIF_SUMMARY = '친구 요청, 모임 초대·공지, 메모 공유, 일정, 토픽 댓글 소식';

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
  const { toast, confirm } = useAlert();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const filter: 'all' | 'invitations' = tabParam === 'invites' ? 'invitations' : 'all';
  const unreadOnly = filter === 'all' && tabParam === 'unread';
  const mainRef = useRef<HTMLElement>(null);
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);
  const serverUnread = useUnreadStore((s) => s.notifications);

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
  /** 지우기를 누르고 되돌리기를 기다리는 알림 */
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const pendingRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pageRef = useRef(0);

  /** 보기 바꾸기. 뒤로 가기로 이전 보기에 돌아오도록 기록을 남긴다. */
  const changeView = (next: 'all' | 'unread' | 'invitations') => {
    const href = next === 'invitations' ? '/notifications?tab=invites' : next === 'unread' ? '/notifications?tab=unread' : '/notifications';
    // router.push 는 쿼리를 달고 처음 연 화면에서 같은 경로·다른 쿼리로 이동하지 않을 때가 있어(Next 16) 기록을 직접 쌓는다.
    // 앱 라우터가 pushState 를 받아 useSearchParams 를 맞춰 준다
    window.history.pushState(null, '', href);
  };

  /** pages 쪽(0..pages-1)을 한 번에 불러온다 */
  const loadPages = useCallback(
    async (pages: number) => {
      const results = await Promise.all(
        Array.from({ length: pages }, (_, i) => notificationApi.getNotifications(session, i)),
      );
      const seen = new Set<string>();
      const merged = results.flat().filter((n) => (seen.has(n.id) ? false : (seen.add(n.id), true)));
      return { merged, more: results[results.length - 1].length >= NOTIFICATION_PAGE_SIZE };
    },
    [session],
  );

  /** silent: 자동 갱신. 로딩 표시 없이, 실패해도 보던 목록을 둔다. 불러온 쪽 수만큼 다시 불러온다. */
  const fetchNotifications = useCallback(
    async (opts?: { silent?: boolean; pages?: number }) => {
      if (!session) return;
      const pages = Math.min(Math.max(opts?.pages ?? (opts?.silent ? pageRef.current + 1 : 1), 1), 4);
      try {
        if (!opts?.silent) setNotifLoading(true);
        const { merged, more } = await loadPages(pages);
        setNotifications(merged);
        pageRef.current = pages - 1;
        setPage(pages - 1);
        setHasMore(more);
        setNotifError(null);
      } catch (error) {
        if (opts?.silent) return;
        console.error('Failed to fetch notifications:', error);
        setNotifError(getApiErrorMessage(error, '알림을 불러오지 못했어요.'));
      } finally {
        if (!opts?.silent) setNotifLoading(false);
      }
    },
    [session, loadPages],
  );

  const fetchInvitations = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!session) return;
      try {
        if (!opts?.silent) setInviteLoading(true);
        const data = await groupApi.getMyInvitations(session);
        setInvitations(data.filter((i) => !i.status || i.status === 'PENDING'));
        setInviteError(null);
      } catch (error) {
        if (opts?.silent) return;
        console.error('Failed to fetch invitations:', error);
        setInviteError(getApiErrorMessage(error, '초대 목록을 불러오지 못했어요.'));
      } finally {
        if (!opts?.silent) setInviteLoading(false);
      }
    },
    [session],
  );

  // 처음 열 때: 알림을 열었다가 돌아온 경우면 그때 불러온 만큼 다시 불러오고 스크롤을 되돌린다.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (!session || restoredRef.current) return;
    restoredRef.current = true;
    let saved: { scroll: number; count: number } | null = null;
    try {
      saved = JSON.parse(sessionStorage.getItem(RESTORE_KEY) || 'null');
      sessionStorage.removeItem(RESTORE_KEY);
    } catch {
      saved = null;
    }
    const pages = saved ? Math.ceil(Math.max(saved.count, 1) / NOTIFICATION_PAGE_SIZE) : 1;
    fetchNotifications({ pages }).then(() => {
      if (!saved) return;
      const top = saved.scroll;
      requestAnimationFrame(() => requestAnimationFrame(() => mainRef.current?.scrollTo(0, top)));
    });
  }, [session, fetchNotifications]);

  // 실시간: 새 알림·읽음·삭제·초대가 바뀌면 조용히 다시 불러온다. SSE 가 끊기면 폴링이 대신한다.
  const silentRefresh = useCallback(() => {
    fetchNotifications({ silent: true });
    fetchInvitations({ silent: true });
  }, [fetchNotifications, fetchInvitations]);
  useLiveTopics(['notifications'], silentRefresh, !!session);
  useVisiblePolling(silentRefresh, !!session, LIST_POLL_MS);

  // 화면을 떠날 때 되돌리기를 기다리던 지우기는 바로 보낸다.
  useEffect(() => {
    const pending = pendingRef.current;
    return () => {
      for (const [id, timer] of pending) {
        clearTimeout(timer);
        notificationApi.remove(id, sessionRef.current).then(() => refreshUnreadCounts()).catch(() => {});
      }
      pending.clear();
    };
  }, []);

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
      pageRef.current = next;
      setPage(next);
      setHasMore(data.length >= NOTIFICATION_PAGE_SIZE);
    } catch (error) {
      toast.error(getApiErrorMessage(error, '알림을 더 불러오지 못했어요.'));
    } finally {
      setLoadingMore(false);
    }
  };

  // 머리의 안 읽음 수는 서버 값(배지와 같음). 아직 못 받았거나 낡았으면 불러온 목록 기준으로 보완한다.
  const unreadCount = Math.max(serverUnread, notifications.filter((n) => !n.read).length);

  const handleMarkAllRead = async () => {
    if (markingAll) return;
    setMarkingAll(true);
    try {
      await notificationApi.markAllRead(session);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      useUnreadStore.setState({ notifications: 0 });
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
      useUnreadStore.setState((s) => ({ notifications: Math.max(0, s.notifications - 1) }));
      notificationApi
        .markRead(n.id, session)
        .then(() => refreshUnreadCounts())
        .catch((error) => console.error('Failed to mark notification read:', error));
    }
    const link = safeNotificationLink(n.link);
    if (!link) return;
    try {
      sessionStorage.setItem(RESTORE_KEY, JSON.stringify({ scroll: mainRef.current?.scrollTop ?? 0, count: notifications.length }));
    } catch {
      // 저장소를 못 쓰면 이어 보기만 빠진다
    }
    router.push(link);
  };

  /** 되돌리기 시간이 지나면 실제로 지운다. 실패하면 행을 다시 보인다. */
  const commitRemove = async (id: string) => {
    pendingRef.current.delete(id);
    try {
      await notificationApi.remove(id, session);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      refreshUnreadCounts();
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        setNotifications((prev) => prev.filter((n) => n.id !== id)); // 이미 지워진 알림
      } else {
        toast.error(getApiErrorMessage(error, '알림을 지우지 못했어요.'));
      }
    } finally {
      setPendingIds((prev) => prev.filter((x) => x !== id));
    }
  };

  const handleRemove = (id: string) => {
    if (pendingRef.current.has(id)) return;
    setPendingIds((prev) => [...prev, id]);
    pendingRef.current.set(id, setTimeout(() => commitRemove(id), UNDO_MS));
  };

  const undoRemove = (id: string) => {
    clearTimeout(pendingRef.current.get(id));
    pendingRef.current.delete(id);
    setPendingIds((prev) => prev.filter((x) => x !== id));
  };

  /** 읽은 알림 모두 지우기 */
  const [removingRead, setRemovingRead] = useState(false);
  const handleRemoveRead = async () => {
    if (removingRead) return;
    const ok = await confirm('읽은 알림을 모두 지울까요? 지운 알림은 되돌릴 수 없어요.', '읽은 알림 지우기', '지우기');
    if (!ok) return;
    setRemovingRead(true);
    try {
      await notificationApi.removeRead(session);
      setNotifications((prev) => prev.filter((n) => !n.read));
      toast.success('읽은 알림을 지웠어요');
      fetchNotifications({ silent: true });
    } catch (error) {
      toast.error(getApiErrorMessage(error, '알림을 지우지 못했어요.'));
    } finally {
      setRemovingRead(false);
    }
  };

  /** 초대 수락·거절. 이미 처리됐거나(409) 모임·초대가 사라졌으면(404) 안내하고 카드를 없앱니다. */
  const handleInvitation = async (invite: GroupInvitationResponse, kind: 'accept' | 'reject') => {
    if (processingId) return;
    // 거절은 되돌릴 수 없다. 방장이 아닌 멤버는 며칠 동안 다시 초대하지 못한다(백엔드 GroupService 재초대 대기)
    if (kind === 'reject' && !(await confirm(
      '거절하면 이 초대는 사라져요. 며칠 동안은 방장만 다시 초대할 수 있어요.',
      `'${invite.groupName}' 모임 초대를 거절할까요?`,
      '거절',
      '취소',
    ))) return;
    setProcessingId(invite.id);
    try {
      if (kind === 'accept') await groupApi.acceptInvitation(invite.id, session);
      else await groupApi.rejectInvitation(invite.id, session);
      setInvitations((prev) => prev.filter((i) => i.id !== invite.id));
      toast.success(kind === 'accept' ? `"${invite.groupName}" 모임에 참여했어요` : '모임 초대를 거절했어요');
      refreshUnreadCounts();
      // 수락하면 바로 그 모임으로 간다
      if (kind === 'accept') router.push(`/groups/${invite.groupId}`);
    } catch (error) {
      const code = axios.isAxiosError(error) ? error.response?.status : undefined;
      if (code === 409) {
        toast.info(getApiErrorMessage(error, '이미 처리된 초대예요.'));
        setInvitations((prev) => prev.filter((i) => i.id !== invite.id));
        fetchInvitations({ silent: true });
      } else if (code === 404) {
        toast.info(getApiErrorMessage(error, '삭제된 모임이거나 더 이상 없는 초대예요.'));
        setInvitations((prev) => prev.filter((i) => i.id !== invite.id));
        fetchInvitations({ silent: true });
      } else if (code === 403) {
        toast.error(getApiErrorMessage(error, '이 초대는 처리할 수 없어요.'));
        fetchInvitations({ silent: true });
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

  const visible = view === 'unread' ? notifications.filter((n) => !n.read) : notifications;
  const groups = (['today', 'week', 'earlier'] as GroupKey[])
    .map((key) => ({ key, items: visible.filter((n) => groupOf(n.createdAt) === key) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="h-screen flex flex-col bg-canvas text-ink overflow-hidden">
      <Navbar />

      <main ref={mainRef} className="flex-1 overflow-y-auto no-scrollbar px-4 pt-6 pb-24 lg:px-8 lg:pt-8 lg:pb-12">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-5">
            <PageHeader
              title="알림"
              count={!notifLoading && !notifError && unreadCount > 0 ? `안 읽음 ${unreadCount}` : undefined}
              actions={
                <div className="flex flex-wrap items-center justify-end gap-2 whitespace-nowrap lg:gap-3">
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
                  <Link href="/settings?menu=notif" aria-label="알림 설정" title="알림 설정" className="btn-icon size-11 lg:hidden">
                    <Settings size={18} strokeWidth={1.5} />
                  </Link>
                </div>
              }
            />

            {view === 'invitations' ? (
              inviteLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 size={18} strokeWidth={1.5} className="animate-spin text-ink-3" />
                  <p className="text-sm text-ink-3">초대 목록을 불러오는 중…</p>
                </div>
              ) : inviteError ? (
                <ErrorState title="초대 목록을 불러오지 못했어요" message={inviteError} onRetry={() => fetchInvitations()} />
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
                          <p className="text-sm text-ink-2 leading-relaxed break-keep break-words pt-1">
                            <span className="font-medium text-ink">{invite.inviterNickname}</span>님이{' '}
                            <span className="font-medium text-ink">{invite.groupName}</span> 모임에 초대했어요
                          </p>
                          <span className="stamp shrink-0 pt-1.5 max-lg:hidden">{formatStamp(invite.invitedAt, tf)}</span>
                        </div>
                        {/* 수락 전에 어떤 모임인지(인원·방장·소개) */}
                        {(invite.memberCount != null || invite.ownerNickname || invite.groupDescription) && (
                          <div className="mt-1 text-[13px] text-ink-3">
                            {(invite.memberCount != null || invite.ownerNickname) && (
                              <p className="tabular-nums">
                                {[invite.memberCount != null ? `멤버 ${invite.memberCount}명` : '', invite.ownerNickname ? `방장 ${invite.ownerNickname}` : '']
                                  .filter(Boolean).join(' · ')}
                              </p>
                            )}
                            {invite.groupDescription && (
                              <p className="mt-0.5 line-clamp-2 break-words break-keep text-ink-2">{invite.groupDescription}</p>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-2.5">
                          <button
                            onClick={() => handleInvitation(invite, 'accept')}
                            disabled={processingId === invite.id}
                            className="btn-primary btn-sm max-lg:min-h-11 max-lg:px-4"
                          >
                            수락
                          </button>
                          <button
                            onClick={() => handleInvitation(invite, 'reject')}
                            disabled={processingId === invite.id}
                            className="btn-secondary btn-sm max-lg:min-h-11 max-lg:px-4"
                          >
                            거절
                          </button>
                          <span className="stamp ml-auto lg:hidden">{formatStamp(invite.invitedAt, tf)}</span>
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
                          pendingIds.includes(n.id) ? (
                            <li key={n.id} className="flex min-h-14 items-center gap-3 py-2 pl-4 pr-2 lg:pl-5 lg:pr-3">
                              <span role="status" className="flex-1 text-sm text-ink-3">알림을 지웠어요</span>
                              <button onClick={() => undoRemove(n.id)} className="btn-secondary btn-sm max-lg:min-h-11 max-lg:px-4">
                                되돌리기
                              </button>
                            </li>
                          ) : (
                          <li
                            key={n.id}
                            className={`group relative flex items-start gap-1 pr-1 transition-colors hover:bg-raised/60 lg:pr-3 ${n.read ? '' : 'bg-accent-soft/40'}`}
                          >
                            <button
                              onClick={() => handleOpen(n)}
                              className={`flex min-h-14 flex-1 min-w-0 items-start gap-3 py-3.5 pl-4 lg:pl-5 text-left ${link ? 'cursor-pointer' : 'cursor-default'}`}
                            >
                              <span className="hidden w-2 shrink-0 justify-center pt-3 lg:flex">
                                {!n.read && <span aria-hidden className="size-1.5 rounded-full bg-mark" />}
                              </span>
                              <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-raised text-ink-2">
                                <Icon size={16} strokeWidth={1.5} aria-hidden />
                                {!n.read && (
                                  <span aria-hidden className="absolute -left-0.5 -top-0.5 size-2 rounded-full bg-mark ring-2 ring-surface lg:hidden" />
                                )}
                              </span>
                              <span className="flex-1 min-w-0 pt-1.5">
                                <span className="sr-only">{meta.label}{!n.read && ', 안 읽음'}: </span>
                                <span
                                  className={`block text-sm leading-relaxed break-keep break-words ${n.read ? 'text-ink-2' : 'font-medium text-ink'}`}
                                >
                                  {n.message}
                                </span>
                                <span className="stamp mt-0.5 block lg:hidden">{rowStamp(n.createdAt, tf)}</span>
                              </span>
                              <span className="stamp shrink-0 pt-2 max-lg:hidden" title={formatStamp(n.createdAt, tf)}>
                                {rowStamp(n.createdAt, tf)}
                              </span>
                            </button>
                            <button
                              onClick={() => handleRemove(n.id)}
                              aria-label="알림 지우기"
                              title="알림 지우기"
                              className="btn-icon mt-1.5 size-11 shrink-0 lg:mt-2.5 lg:size-9 lg:opacity-0 lg:group-hover:opacity-100 focus-visible:opacity-100"
                            >
                              <X size={16} strokeWidth={1.5} />
                            </button>
                          </li>
                          )
                        );
                      })}
                    </ul>
                  </section>
                ))}
                {(hasMore || notifications.some((n) => n.read)) && (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {hasMore && (
                      <button onClick={loadMore} disabled={loadingMore} className="btn-secondary max-lg:min-h-11 max-lg:px-5">
                        {loadingMore && <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />}
                        더 보기
                      </button>
                    )}
                    {notifications.some((n) => n.read) && (
                      <button onClick={handleRemoveRead} disabled={removingRead} className="btn-ghost max-lg:min-h-11">
                        {removingRead ? (
                          <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
                        ) : (
                          <Trash2 size={16} strokeWidth={1.5} />
                        )}
                        읽은 알림 지우기
                      </button>
                    )}
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
                      : `${NOTIF_SUMMARY}이 여기에 모여요`
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
              <p className="mt-1 text-[13px] leading-5 text-ink-2 break-keep">{NOTIF_SUMMARY}을 알려 드려요</p>
              <Link href="/settings?menu=notif" className="btn-secondary mt-3">
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
