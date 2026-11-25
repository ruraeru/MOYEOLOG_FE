import { useEffect, useRef } from 'react';
import { onVisibleAgain, useLivePollMs } from '@/lib/live';

/**
 * 화면이 보이는 동안 ms 마다, 그리고 탭으로 돌아왔을 때 fn 을 부른다.
 * 다른 사람이 바꾼 내용(일정·메모·친구 요청)을 새로고침 없이 반영하는 데 쓴다.
 * fn 은 화면을 깜빡이게 하지 않는 조용한 다시 불러오기여야 한다.
 * 실시간 갱신(SSE)이 붙어 있는 동안은 안전망으로만 남아 60초마다 돈다(live=false 면 늘 ms).
 * live 면 탭 복귀 때 바로 부르지 않고 3초 안에 SSE 가 다시 붙지 못했을 때만 부른다(붙으면 재접속 새로 고침이 부른다).
 */
export function useVisiblePolling(fn: () => void, enabled: boolean, baseMs: number, live = true) {
  const liveMs = useLivePollMs(baseMs);
  const ms = live ? liveMs : baseMs;
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') fnRef.current();
    }, ms);
    const offVisible = onVisibleAgain(() => fnRef.current(), live);
    return () => {
      clearInterval(id);
      offVisible();
    };
  }, [enabled, ms, live]);
}

/** 목록 화면의 자동 갱신 주기(모임 화면과 같다). SSE 가 끊겨 있을 때의 주기다. */
export const LIST_POLL_MS = 15000;
