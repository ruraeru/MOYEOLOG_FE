import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import { UNAUTHORIZED_EVENT } from '@/lib/axios';

/**
 * 실시간 갱신(SSE). 서버는 '무엇이 바뀌었는지'(토픽)만 보내고, 화면은 그 토픽을 구독해 기존의 조용한 다시 불러오기를 부른다.
 * 계약: GET /api/events (Authorization: Bearer) → `event: ready` 한 번, `event: changed` + `data: {"topics":[...]}`, 주석 하트비트 `: ping`,
 * 사용자당 연결 상한으로 닫히기 직전 `event: evicted`.
 * 토픽: schedules, schedule:{id}, memos, friends, groups, group:{id}, messages, notifications. 모르는 토픽·이벤트는 무시한다.
 */

/** SSE 가 붙어 있는 동안의 안전망 폴링 주기. 끊겨 있으면 화면별 원래 주기로 돌아간다. */
export const LIVE_POLL_MS = 60_000;
/** 같은 토픽이 짧은 시간에 여러 번 오면 한 번으로 합친다 */
const COALESCE_MS = 250;
const BACKOFF_MIN_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;
/** 하트비트(25초 이내)가 이만큼 없으면 죽은 연결로 보고 다시 붙는다 */
const STALL_MS = 60_000;
/** 상한으로 밀려난(evicted) 탭은 이만큼 다시 붙지 않는다(그동안은 원래 주기 폴링). 탭을 숨겼다 보이면 바로 붙는다 */
const EVICTED_PAUSE_MS = 5 * 60_000;
/** 탭으로 돌아왔을 때 SSE 재접속(→ 전체 새로 고침)을 기다리는 시간 */
const VISIBLE_GRACE_MS = 3_000;

export const useLiveStore = create<{ connected: boolean }>(() => ({ connected: false }));

/** null: 다시 붙음 — 끊긴 동안 놓친 변경이 있을 수 있어 전부 새로 고친다 */
type Listener = (topics: string[] | null) => void;
const listeners = new Set<Listener>();

export function onLiveChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function emit(topics: string[] | null) {
  listeners.forEach((fn) => fn(topics));
}

/** SSE 가 붙어 있으면 폴링 주기를 LIVE_POLL_MS 로 늘린다(이미 더 길면 그대로). */
export function useLivePollMs(ms: number): number {
  const connected = useLiveStore((s) => s.connected);
  return connected ? Math.max(ms, LIVE_POLL_MS) : ms;
}

/**
 * topics 중 하나가 바뀌었거나 다시 붙었을 때 fn 을 부른다. 짧은 시간(250ms)에 여러 번 오면 한 번만 부른다.
 * fn 은 화면을 깜빡이게 하지 않는 조용한 다시 불러오기여야 한다.
 */
export function useLiveTopics(topics: string[], fn: () => void, enabled = true) {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);
  const key = topics.join('\n');
  useEffect(() => {
    if (!enabled) return;
    const wanted = new Set(key.split('\n'));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = onLiveChange((changed) => {
      if (changed && !changed.some((t) => wanted.has(t))) return;
      timer ??= setTimeout(() => {
        timer = undefined;
        fnRef.current();
      }, COALESCE_MS);
    });
    return () => {
      off();
      clearTimeout(timer);
    };
  }, [key, enabled]);
}

/** 짧은 시간에 온 토픽을 모아 한 번에 넘긴다(전역 처리용: react-query 무효화, 배지). */
export function onLiveChangeBatched(fn: (topics: Set<string> | null) => void): () => void {
  let pending: Set<string> | null | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const off = onLiveChange((changed) => {
    if (changed === null) pending = null;
    else if (pending !== null) changed.forEach((t) => (pending ??= new Set()).add(t));
    timer ??= setTimeout(() => {
      timer = undefined;
      const batch = pending;
      pending = undefined;
      if (batch !== undefined) fn(batch);
    }, COALESCE_MS);
  });
  return () => {
    off();
    clearTimeout(timer);
  };
}

/** 표준 SSE 스트림을 줄 단위로 읽어 (event, data) 를 넘긴다. 주석(하트비트)을 포함해 바이트가 올 때마다 onActivity. */
export async function readSse(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: string, data: string) => void,
  onActivity: () => void
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let event = '';
  let data: string[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    onActivity();
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r\n|\r|\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line === '') {
        if (data.length) onEvent(event || 'message', data.join('\n'));
        event = '';
        data = [];
        continue;
      }
      if (line.startsWith(':')) continue;
      const colon = line.indexOf(':');
      const field = colon < 0 ? line : line.slice(0, colon);
      let value = colon < 0 ? '' : line.slice(colon + 1);
      if (value.startsWith(' ')) value = value.slice(1);
      if (field === 'event') event = value;
      else if (field === 'data') data.push(value);
    }
  }
}

/** `changed` 의 data 에서 토픽 문자열만 꺼낸다. 형식이 틀리면 빈 배열. */
export function parseTopics(data: string): string[] {
  try {
    const topics = (JSON.parse(data) as { topics?: unknown })?.topics;
    return Array.isArray(topics) ? topics.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(id);
      signal.removeEventListener('abort', done);
      resolve();
    };
    const id = setTimeout(done, ms);
    signal.addEventListener('abort', done, { once: true });
  });

/**
 * 탭으로 돌아왔을 때 fn 을 부른다. live 면 바로 부르지 않고 3초 기다려 그때도 SSE 가 안 붙어 있을 때만 부른다
 * (붙었으면 재접속 직후의 전체 새로 고침이 이미 불렀다). 리스너를 떼는 함수를 돌려준다.
 */
export function onVisibleAgain(fn: () => void, live = true): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const onChange = () => {
    clearTimeout(timer);
    if (document.visibilityState !== 'visible') return;
    if (!live) {
      fn();
      return;
    }
    timer = setTimeout(() => {
      if (document.visibilityState === 'visible' && !useLiveStore.getState().connected) fn();
    }, VISIBLE_GRACE_MS);
  };
  document.addEventListener('visibilitychange', onChange);
  return () => {
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', onChange);
  };
}

/**
 * signal 이 끊길 때까지 /api/events 에 붙어 있는다. 끊기면(서버의 정상 종료 포함) 지수 백오프(1초 → 30초)로 다시 붙는다.
 * getToken 은 붙을 때마다 부른다(서버가 30분 안에 닫으면 그때의 새 토큰으로 붙는다).
 * onReady 는 붙을 때마다 부른다.
 */
export async function runLiveConnection(getToken: () => string | undefined, signal: AbortSignal, onReady: () => void) {
  let attempt = 0;
  while (!signal.aborted) {
    const token = getToken();
    if (!token) return;
    const conn = new AbortController();
    const abortConn = () => conn.abort();
    signal.addEventListener('abort', abortConn, { once: true });
    let stall: ReturnType<typeof setTimeout> | undefined;
    let readyAt = 0;
    let evicted = false;
    const alive = () => {
      clearTimeout(stall);
      stall = setTimeout(abortConn, STALL_MS);
    };
    try {
      alive();
      const res = await fetch('/api/events', {
        headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
        cache: 'no-store',
        signal: conn.signal,
      });
      if (res.status === 401) {
        // 세션 재확인(토큰 갱신 또는 로그아웃)은 SessionGuard 가 한다. 새 토큰이 오면 다음 시도에 쓴다.
        window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
      } else if (res.ok && res.body && res.headers.get('content-type')?.includes('text/event-stream')) {
        await readSse(
          res.body,
          (event, data) => {
            if (event === 'ready') {
              readyAt = Date.now();
              useLiveStore.setState({ connected: true });
              onReady();
            } else if (event === 'evicted') {
              evicted = true;
            } else if (event === 'changed') {
              const topics = parseTopics(data);
              if (topics.length) emit(topics);
            }
          },
          alive
        );
      }
      void res.body?.cancel().catch(() => {});
    } catch {
      // 네트워크 오류·중단·하트비트 끊김: 아래에서 다시 붙는다
    } finally {
      clearTimeout(stall);
      signal.removeEventListener('abort', abortConn);
      // 한동안 잘 붙어 있다 끊긴 것(30분 정상 종료 등)이면 1초부터. 붙자마자 끊기면(연결 수 상한으로 밀려남 등) 백오프를 이어 간다
      if (readyAt && Date.now() - readyAt > STALL_MS) attempt = 0;
      useLiveStore.setState({ connected: false });
    }
    if (signal.aborted) return;
    if (evicted) {
      // 같은 사용자의 다른 탭들과 서로 밀어내지 않게 한동안 쉰다. 탭을 숨기면 signal 이 끊겨 여기서 빠지고, 다시 보이면 새로 붙는다
      attempt = 0;
      await sleep(EVICTED_PAUSE_MS, signal);
      continue;
    }
    const delay = Math.min(BACKOFF_MAX_MS, BACKOFF_MIN_MS * 2 ** attempt);
    attempt += 1;
    // 백엔드 재시작 뒤 모든 탭이 같은 순간에 몰리지 않게 ±20% 흔든다
    await sleep(delay * (0.8 + Math.random() * 0.4), signal);
  }
}

/** 구독 중인 화면 전부에 '다시 붙음 — 전부 새로 고쳐라'를 알린다. */
export function resyncAll() {
  emit(null);
}
