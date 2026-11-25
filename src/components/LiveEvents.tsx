'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';
import { onLiveChangeBatched, resyncAll, runLiveConnection } from '@/lib/live';
import { refreshUnreadCounts } from '@/lib/notification-api';

const isVisible = () => typeof document === 'undefined' || document.visibilityState === 'visible';

/**
 * 로그인한 동안, 탭이 보이는 동안 실시간 갱신(SSE) 연결을 하나 유지한다. 탭이 숨겨지면 끊고, 다시 보이면 붙는다.
 * 다시 붙으면(백엔드 재시작·탭 복귀, 탭이 숨겨진 채 열렸다 처음 보일 때 포함) 끊긴 동안 놓친 변경을 위해
 * 구독 중인 화면 전체를 한 번 새로 고친다. 화면을 막 불러온 첫 연결에서는 하지 않는다.
 * react-query 를 쓰는 화면(홈·중간 지점·토픽 상세)과 배지는 여기서 토픽 → 쿼리 무효화로 처리한다.
 */
export default function LiveEvents() {
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();
  const token = session?.user?.accessToken;
  const tokenRef = useRef(token);
  // 다음 ready 때 전체 새로 고침이 필요한가: 숨겨진 채 열린 탭이면 처음부터 필요하다
  const resyncNext = useRef(!isVisible());
  const [visible, setVisible] = useState(isVisible);
  const enabled = status === 'authenticated' && !!token && !session?.user?.error;

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    const onChange = () => {
      if (!isVisible()) resyncNext.current = true;
      setVisible(isVisible());
    };
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  useEffect(() => {
    if (!enabled || !visible) return;
    const ctrl = new AbortController();
    runLiveConnection(() => tokenRef.current, ctrl.signal, () => {
      if (resyncNext.current) resyncAll();
      resyncNext.current = true;
    });
    return () => ctrl.abort();
  }, [enabled, visible]);

  useEffect(
    () =>
      onLiveChangeBatched((topics) => {
        if (topics === null) {
          // 보이는 쿼리만 다시 불러오고 나머지는 다음에 쓸 때 불러오게 표시한다. 날씨는 다른 사람의 변경과 무관해(30분 캐시) 뺀다
          queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'weather' });
          refreshUnreadCounts();
          return;
        }
        for (const key of ['schedules', 'memos', 'groups'] as const) {
          if (topics.has(key)) queryClient.invalidateQueries({ queryKey: [key] });
        }
        topics.forEach((t) => {
          if (t.startsWith('schedule:')) queryClient.invalidateQueries({ queryKey: ['midpoint', t.slice('schedule:'.length)] });
        });
        // 토픽이 어느 모임 것인지 여기선 모르므로 토픽 상세 전체를 무효화한다(열린 것 하나만 다시 불러온다)
        if ([...topics].some((t) => t.startsWith('group:'))) queryClient.invalidateQueries({ queryKey: ['topic'] });
        if (topics.has('notifications') || topics.has('messages')) refreshUnreadCounts();
      }),
    [queryClient]
  );

  return null;
}
