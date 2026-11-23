'use client';

import { useEffect } from 'react';
import { Session } from 'next-auth';
import { useSession } from 'next-auth/react';
import { create } from 'zustand';
import { axiosInstance, getAuthHeaders } from './axios';
import { messageApi } from './message-api';

export type NotificationType =
  | 'FRIEND_REQUEST'
  | 'FRIEND_ACCEPTED'
  | 'GROUP_INVITE'
  | 'MEMO_SHARED'
  | 'TOPIC_COMMENT'
  | 'SCHEDULE_PARTICIPANT'
  | 'GROUP_KICKED';

export interface NotificationResponse {
  id: string;
  type: NotificationType;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
  actor: { id: string; nickname: string; profileImage?: string | null } | null;
}

export const NOTIFICATION_PAGE_SIZE = 30;

export const notificationApi = {
  async getNotifications(session: Session | null, page = 0, size = NOTIFICATION_PAGE_SIZE): Promise<NotificationResponse[]> {
    const response = await axiosInstance.get<NotificationResponse[]>('/api/notifications', {
      headers: getAuthHeaders(session),
      params: { page, size },
    });
    return response.data;
  },

  async getUnreadCount(session: Session | null): Promise<number> {
    const response = await axiosInstance.get<{ count: number }>('/api/notifications/unread-count', {
      headers: getAuthHeaders(session),
    });
    return response.data?.count ?? 0;
  },

  async markRead(id: string, session: Session | null): Promise<void> {
    await axiosInstance.put(`/api/notifications/${id}/read`, {}, { headers: getAuthHeaders(session) });
  },

  async markAllRead(session: Session | null): Promise<void> {
    await axiosInstance.put('/api/notifications/read-all', {}, { headers: getAuthHeaders(session) });
  },

  async remove(id: string, session: Session | null): Promise<void> {
    await axiosInstance.delete(`/api/notifications/${id}`, { headers: getAuthHeaders(session) });
  },
};

/** 알림 link 는 앱 안 경로만 따라갑니다. */
export const safeNotificationLink = (link: string | null | undefined): string | null => {
  if (!link || !link.startsWith('/') || link.startsWith('//') || link.includes('\\')) return null;
  return link;
};

// ── 헤더·하단 내비 배지: 알림 + 메시지 안 읽은 수 (30초 폴링, 여러 컴포넌트가 하나의 타이머를 공유) ──

const POLL_INTERVAL_MS = 30 * 1000;

interface UnreadStore {
  notifications: number;
  messages: number;
}

export const useUnreadStore = create<UnreadStore>(() => ({ notifications: 0, messages: 0 }));

let latestSession: Session | null = null;
let subscribers = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let inflight = false;

/** 배지 숫자를 지금 다시 가져옵니다(읽음 처리 직후 등). */
export async function refreshUnreadCounts(): Promise<void> {
  if (!latestSession?.user?.accessToken || inflight) return;
  inflight = true;
  try {
    const [n, m] = await Promise.allSettled([
      notificationApi.getUnreadCount(latestSession),
      messageApi.getUnreadCount(latestSession),
    ]);
    useUnreadStore.setState((prev) => ({
      notifications: n.status === 'fulfilled' ? n.value : prev.notifications,
      messages: m.status === 'fulfilled' ? m.value : prev.messages,
    }));
  } finally {
    inflight = false;
  }
}

const onVisible = () => {
  if (document.visibilityState === 'visible') refreshUnreadCounts();
};

function startPolling() {
  if (timer) return;
  refreshUnreadCounts();
  timer = setInterval(() => {
    if (document.visibilityState === 'visible') refreshUnreadCounts();
  }, POLL_INTERVAL_MS);
  document.addEventListener('visibilitychange', onVisible);
}

function stopPolling() {
  if (timer) clearInterval(timer);
  timer = null;
  document.removeEventListener('visibilitychange', onVisible);
}

/** 로그인 상태에서 안 읽은 알림·메시지 수를 돌려줍니다. */
export function useUnreadCounts(): UnreadStore & { total: number } {
  const { data: session, status } = useSession();
  const counts = useUnreadStore();
  const authenticated = status === 'authenticated' && !!session?.user?.accessToken;

  useEffect(() => {
    latestSession = authenticated ? session : null;
  }, [authenticated, session]);

  useEffect(() => {
    if (!authenticated) return;
    subscribers += 1;
    startPolling();
    return () => {
      subscribers -= 1;
      if (subscribers <= 0) {
        subscribers = 0;
        stopPolling();
      }
    };
  }, [authenticated]);

  if (!authenticated) return { notifications: 0, messages: 0, total: 0 };
  return { ...counts, total: counts.notifications + counts.messages };
}

/** 배지 숫자 표기 (99 넘으면 99+) */
export const badgeText = (count: number) => (count > 99 ? '99+' : String(count));
