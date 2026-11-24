'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { userApi, type NotificationPreferences } from '@/lib/user-api';
import { getApiErrorMessage } from '@/lib/axios';
import { InlineError, LoadError, SettingsGroup, SettingsRow, Toggle } from './ui';

const ITEMS: { key: keyof NotificationPreferences; label: string; description: string }[] = [
  { key: 'friendRequest', label: '친구 요청', description: '누군가 친구 요청을 보내거나 내 요청을 받아 줬을 때' },
  { key: 'groupInvite', label: '모임 초대', description: '모임에 초대받았을 때' },
  { key: 'memoShared', label: '메모 공유', description: '친구가 나에게 메모를 공유했을 때' },
  { key: 'topicComment', label: '토픽 댓글', description: '내가 쓴 토픽에 댓글이 달렸을 때' },
  { key: 'scheduleParticipant', label: '일정 참여', description: '일정 참여자로 추가됐을 때' },
  { key: 'message', label: '메시지', description: '끄면 새 메시지가 와도 알림 배지에 세지 않아요' },
];

const QUERY_KEY = ['notifications', 'preferences'];

export default function NotificationSection() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError, error: loadError, refetch, isRefetching } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => userApi.getNotificationPreferences(session),
    enabled: !!session?.user?.accessToken,
  });

  const mutation = useMutation({
    mutationFn: (next: NotificationPreferences) => userApi.updateNotificationPreferences(next, session),
    onMutate: async (next) => {
      setError(null);
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<NotificationPreferences>(QUERY_KEY);
      queryClient.setQueryData(QUERY_KEY, next);
      return { previous };
    },
    onError: (err, _next, context) => {
      if (context?.previous) queryClient.setQueryData(QUERY_KEY, context.previous);
      setError(getApiErrorMessage(err, '알림 설정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.'));
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(QUERY_KEY, saved);
    },
  });

  const toggle = (key: keyof NotificationPreferences, value: boolean) => {
    if (!data) return;
    mutation.mutate({ ...data, [key]: value });
  };

  return (
    <div className="space-y-6">
      <SettingsGroup title="알림" description="받고 싶은 알림만 골라요. 끈 종류는 알림 목록에도 쌓이지 않아요.">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 size={20} strokeWidth={1.5} className="animate-spin text-ink-3" />
          </div>
        ) : isError || !data ? (
          <LoadError
            message={getApiErrorMessage(loadError, '알림 설정을 불러오지 못했어요.')}
            onRetry={() => refetch()}
          />
        ) : (
          ITEMS.map((item) => (
            <SettingsRow key={item.key} label={item.label} description={item.description} htmlFor={`notif-${item.key}`}>
              <Toggle
                id={`notif-${item.key}`}
                label={`${item.label} 알림`}
                checked={data[item.key] !== false}
                disabled={mutation.isPending || isRefetching}
                onChange={(next) => toggle(item.key, next)}
              />
            </SettingsRow>
          ))
        )}
      </SettingsGroup>
      {error && <InlineError message={error} />}
    </div>
  );
}
