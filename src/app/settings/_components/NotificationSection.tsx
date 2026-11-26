'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2 } from 'lucide-react';
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
const SAVE_KEY = ['notifications', 'preferences', 'save'];

export default function NotificationSection() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError, error: loadError, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => userApi.getNotificationPreferences(session),
    enabled: !!session?.user?.accessToken,
  });

  // 저장 안내('저장했어요')를 잠깐 보여 준다
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (savedTimer.current) clearTimeout(savedTimer.current);
  }, []);

  // 스위치를 연달아 눌러도 모두 반영되게: 화면은 바로 바꾸고(낙관적), 저장 요청은 같은 scope 로 차례대로 보낸다.
  // 각 요청은 그때까지 바뀐 값을 모두 담고, 마지막 요청의 응답만 화면에 덮어쓴다.
  const mutation = useMutation({
    mutationKey: SAVE_KEY,
    scope: { id: 'notification-preferences' },
    mutationFn: (next: NotificationPreferences) => userApi.updateNotificationPreferences(next, session),
    onMutate: async () => {
      setError(null);
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
    },
    onError: (err) => {
      setSaved(false);
      setError(getApiErrorMessage(err, '알림 설정을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.'));
      // 서버에 실제로 저장된 값으로 되돌린다
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onSuccess: (result) => {
      if (queryClient.isMutating({ mutationKey: SAVE_KEY }) > 1) return; // 뒤에 보낼 요청이 남아 있다
      queryClient.setQueryData(QUERY_KEY, result);
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 2000);
    },
  });

  const toggle = (key: keyof NotificationPreferences, value: boolean) => {
    const current = queryClient.getQueryData<NotificationPreferences>(QUERY_KEY) ?? data;
    if (!current) return;
    const next = { ...current, [key]: value };
    queryClient.setQueryData(QUERY_KEY, next);
    mutation.mutate(next);
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
                onChange={(next) => toggle(item.key, next)}
              />
            </SettingsRow>
          ))
        )}
      </SettingsGroup>
      {error && <InlineError message={error} />}
      {saved && !error && (
        <p role="status" className="flex items-center gap-1.5 px-1 text-sm text-ink-2">
          <CheckCircle2 size={16} strokeWidth={1.5} className="text-positive" aria-hidden />
          저장했어요
        </p>
      )}
    </div>
  );
}
