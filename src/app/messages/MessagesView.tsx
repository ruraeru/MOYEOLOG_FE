'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import axios from 'axios';
import { format, isSameDay } from 'date-fns';
import { useTimeFormat } from '@/lib/schedule-utils';
import { ko } from 'date-fns/locale';
import { ArrowDown, ArrowLeft, Loader2, MessageCircle, AlertCircle, RotateCw, Send, Search, Trash2, User, X } from 'lucide-react';
import Navbar from '@/components/Navbar';
import ImageWithFallback from '@/components/ImageWithFallback';
import { messageApi, MESSAGE_MAX_LENGTH, isBlankMessage, type ConversationResponse, type MessageResponse } from '@/lib/message-api';
import { friendApi, resolveImageUrl, type UserProfileResponse } from '@/lib/friend-api';
import { getApiErrorMessage } from '@/lib/axios';
import { refreshUnreadCounts, badgeText } from '@/lib/notification-api';
import { useAlert } from '@/hooks/useAlert';
import { initialOf } from '@/lib/utils';
import { EmptyState } from '@/components/ui';

import { useVisiblePolling } from '@/hooks/useVisiblePolling';
import { useLiveTopics } from '@/lib/live';

// SSE 가 끊겨 있을 때의 주기. 붙어 있으면 메시지 보내기·읽음이 `messages` 토픽으로 와서 60초 안전망으로 늘어난다
const POLL_MS = 5000;
const PAGE_SIZE = 50;
/** 입력창이 자라는 최대 높이(max-h-32) */
const DRAFT_MAX_HEIGHT = 128;

/** 대화별 보내지 않은 글. 다른 대화로 갔다 와도 남는다(새로고침하면 사라짐) */
const drafts = new Map<string, string>();

/** 터치 기기: Enter 가 줄바꿈이고 보내기는 버튼으로 한다 (화면 키보드에는 Shift+Enter 가 없다) */
const COARSE_QUERY = '(pointer: coarse)';
const subscribeCoarse = (onChange: () => void) => {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia(COARSE_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
};
const getCoarse = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(COARSE_QUERY).matches;

/** 같은 사람이 같은 분에 연달아 보낸 메시지는 마지막 것에만 시각을 붙인다 */
const minuteKey = (value: string) => value.slice(0, 16);

const parseDate = (value: string) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const listStamp = (value: string, tf: string) => {
  const d = parseDate(value);
  if (!d) return '';
  return isSameDay(d, new Date()) ? format(d, tf, { locale: ko }) : format(d, 'M.d EEE', { locale: ko });
};

/** createdAt(같은 형식의 문자열) 기준으로 정렬하고 id 로 중복을 없앱니다. */
const mergeMessages = (a: MessageResponse[], b: MessageResponse[]) => {
  const map = new Map<string, MessageResponse>();
  for (const m of a) map.set(m.id, m);
  for (const m of b) map.set(m.id, m);
  return [...map.values()].sort((x, y) => (x.createdAt < y.createdAt ? -1 : x.createdAt > y.createdAt ? 1 : 0));
};

function Avatar({ src, name, className = 'size-10' }: { src?: string | null; name: string; className?: string }) {
  const image = resolveImageUrl(src);
  return (
    <div className={`relative shrink-0 rounded-full bg-raised flex items-center justify-center overflow-hidden ${className}`}>
      {image ? (
        <ImageWithFallback
          src={image}
          alt={name}
          fill
          sizes="40px"
          containerClassName="w-full h-full"
          className="object-cover"
          unoptimized
        />
      ) : (
        <span className="text-sm text-ink-2">{initialOf(name)}</span>
      )}
    </div>
  );
}

export default function MessagesView({ friendId }: { friendId?: string }) {
  const tf = useTimeFormat();
  const { data: session, status } = useSession();
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationResponse[]>([]);
  const [convLoading, setConvLoading] = useState(true);
  const [convError, setConvError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { confirm, toast } = useAlert();

  useEffect(() => {
    if (status === 'unauthenticated') {
      const target = friendId ? `/messages/${encodeURIComponent(friendId)}` : '/messages';
      router.replace(`/?callbackUrl=${encodeURIComponent(target)}`);
    }
  }, [status, router, friendId]);

  const fetchConversations = useCallback(async (silent = false) => {
    if (!session) return;
    try {
      if (!silent) setConvLoading(true);
      const data = await messageApi.getConversations(session);
      setConversations(data);
      setConvError(null);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
      // 폴링 중 실패는 기존 목록을 그대로 둡니다.
      if (!silent) setConvError(getApiErrorMessage(error, '대화 목록을 불러오지 못했어요.'));
    } finally {
      if (!silent) setConvLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const pollConversations = useCallback(() => {
    fetchConversations(true);
  }, [fetchConversations]);
  useVisiblePolling(pollConversations, status === 'authenticated' && !convError, POLL_MS);
  useLiveTopics(['messages', 'friends'], pollConversations, status === 'authenticated' && !convError);

  /** 대화 지우기: 내 화면에서만 지운다. 열려 있던 대화면 목록으로 돌아간다 */
  const handleDelete = async (c: ConversationResponse) => {
    const ok = await confirm(`${c.friend.nickname}님과의 대화를 지울까요?\n내 화면에서만 지워지고 상대에게는 남아요.`, undefined, '지우기');
    if (!ok) return;
    setDeletingId(c.friend.id);
    try {
      await messageApi.deleteConversation(c.friend.id, session);
      setConversations((prev) => prev.map((x) => (x.friend.id === c.friend.id ? { ...x, lastMessage: null, unreadCount: 0 } : x)));
      refreshUnreadCounts();
      fetchConversations(true);
      toast.success('대화를 지웠어요.');
      if (c.friend.id === friendId) router.push('/messages');
    } catch (error) {
      toast.error(getApiErrorMessage(error, '대화를 지우지 못했어요.'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleRead = useCallback((id: string) => {
    setConversations((prev) => prev.map((c) => (c.friend.id === id ? { ...c, unreadCount: 0 } : c)));
  }, []);

  const current = friendId ? conversations.find((c) => c.friend.id === friendId) : undefined;
  const myId = session?.user?.id;
  const q = query.trim().toLowerCase();
  const shown = q
    ? conversations.filter((c) => c.friend.nickname.toLowerCase().includes(q) || c.friend.customId.toLowerCase().includes(q))
    : conversations;

  return (
    <div className="h-[calc(100dvh-4rem)] lg:h-screen flex flex-col bg-canvas text-ink overflow-hidden">
      <Navbar />
      <main className="flex-1 min-h-0 flex w-full">
        {/* 대화 목록 */}
        <aside
          className={`${friendId ? 'hidden lg:flex' : 'flex'} w-full lg:w-[360px] shrink-0 flex-col min-h-0 lg:border-r lg:border-line`}
        >
          <div className="px-4 pt-5 pb-3 lg:px-5 lg:pt-6 space-y-3">
            <h1 className="font-display text-2xl leading-8 text-ink lg:text-[26px]">메시지</h1>
            <div className="relative">
              <Search size={16} strokeWidth={1.5} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="이름으로 찾기"
                aria-label="대화 찾기"
                className="form-input h-9 py-0 pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="찾기 지우기"
                  className="btn-icon absolute right-0.5 top-1/2 -translate-y-1/2"
                >
                  <X size={16} strokeWidth={1.5} />
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-2 pb-4 lg:px-3">
            {convLoading || status !== 'authenticated' ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 size={18} strokeWidth={1.5} className="animate-spin text-ink-3" />
                <p className="text-sm text-ink-3">대화 목록을 불러오는 중…</p>
              </div>
            ) : convError ? (
              <EmptyState
                icon={AlertCircle}
                title="대화 목록을 불러오지 못했어요"
                description={convError}
                action={
                  <button onClick={() => fetchConversations()} className="btn-secondary">
                    <RotateCw size={16} strokeWidth={1.5} />
                    다시 시도
                  </button>
                }
              />
            ) : conversations.length === 0 ? (
              <EmptyState
                title="아직 대화가 없어요"
                description="친구 목록의 '메시지'로 대화를 시작해요"
                action={<Link href="/friends" className="btn-secondary">친구 목록으로</Link>}
              />
            ) : shown.length === 0 ? (
              <EmptyState title="찾는 대화가 없어요" description="이름을 다시 확인해 주세요" />
            ) : (
              <ul className="space-y-0.5">
                {shown.map((c) => {
                  const active = c.friend.id === friendId;
                  const last = c.lastMessage;
                  const unreadNow = c.unreadCount > 0;
                  return (
                    <li key={c.friend.id} className="flex items-center gap-2 lg:gap-1">
                      <Link
                        href={`/messages/${c.friend.id}`}
                        aria-current={active ? 'page' : undefined}
                        className={`flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-3 transition-colors ${
                          active ? 'bg-surface shadow-[inset_0_0_0_1px_var(--line)]' : 'hover:bg-raised'
                        }`}
                      >
                        <Avatar src={c.friend.profileImage} name={c.friend.nickname} />
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center justify-between gap-2">
                            <span className="flex min-w-0 items-center gap-1.5">
                              <span className="font-display text-[15px] leading-5 text-ink truncate">{c.friend.nickname}</span>
                              {c.canSend === false && <span className="chip h-5 shrink-0 px-1.5 text-[11px]">친구 아님</span>}
                            </span>
                            {last && <span className="stamp shrink-0">{listStamp(last.createdAt, tf)}</span>}
                          </span>
                          <span className="flex items-center justify-between gap-2 mt-1">
                            <span className={`text-[13px] truncate ${unreadNow ? 'text-ink' : 'text-ink-2'}`}>
                              {last ? `${last.senderId === myId ? '나: ' : ''}${last.content}` : '아직 주고받은 메시지가 없어요'}
                            </span>
                            {unreadNow && (
                              <span className="min-w-[18px] h-[18px] px-1 shrink-0 rounded-full bg-mark text-ink text-[11px] leading-[18px] text-center tabular-nums">
                                {badgeText(c.unreadCount)}
                              </span>
                            )}
                          </span>
                        </span>
                      </Link>
                      {last && (
                        <button
                          type="button"
                          onClick={() => handleDelete(c)}
                          disabled={deletingId === c.friend.id}
                          className="btn-icon size-11 lg:size-8 shrink-0 hover:text-negative"
                          title="대화 지우기"
                          aria-label={`${c.friend.nickname}님과의 대화 지우기`}
                        >
                          {deletingId === c.friend.id
                            ? <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
                            : <Trash2 size={16} strokeWidth={1.5} />}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* 대화 */}
        <section className={`${friendId ? 'flex' : 'hidden lg:flex'} flex-1 min-w-0 min-h-0 flex-col`}>
          {friendId && status === 'authenticated' ? (
            <ChatPanel
              key={friendId}
              friendId={friendId}
              conversation={current}
              onRead={handleRead}
              onSent={pollConversations}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState icon={MessageCircle} title="대화를 골라 주세요" description="왼쪽 목록에서 친구를 고르면 대화가 열려요" />
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

interface ChatPanelProps {
  friendId: string;
  conversation?: ConversationResponse;
  onRead: (friendId: string) => void;
  onSent: () => void;
}

function ChatPanel({ friendId, conversation, onRead, onSent }: ChatPanelProps) {
  const tf = useTimeFormat();
  const { data: session } = useSession();
  const { toast } = useAlert();
  const myId = session?.user?.id;
  const isSelf = !!myId && friendId === myId;
  const coarse = useSyncExternalStore(subscribeCoarse, getCoarse, () => false);

  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [profileMissing, setProfileMissing] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [draft, setDraftState] = useState(() => drafts.get(friendId) ?? '');
  const [sending, setSending] = useState(false);
  /** 처음 열었을 때 첫 안 읽은 메시지. 그 앞에 구분선을 긋는다 */
  const [unreadFromId, setUnreadFromId] = useState<string | null>(null);
  /** 위로 올려 보는 중 아래에 새 메시지가 왔는지 */
  const [newBelow, setNewBelow] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);
  const restoreHeight = useRef<number | null>(null);
  const lastIdRef = useRef<string | null>(null);
  const scrollToUnread = useRef(false);

  const setDraft = (value: string) => {
    setDraftState(value);
    if (value) drafts.set(friendId, value);
    else drafts.delete(friendId);
  };

  // 상대 정보와 친구 여부(친구가 아니면 보낼 수 없음)
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    friendApi
      .getUserProfile(friendId, session)
      .then((p) => {
        if (cancelled) return;
        setProfile(p);
        if (p.friendStatus !== 'FRIEND') setBlocked('친구에게만 메시지를 보낼 수 있어요.');
      })
      .catch((err) => {
        if (cancelled) return;
        const code = axios.isAxiosError(err) ? err.response?.status : undefined;
        if (code === 404 || code === 400) {
          setProfileMissing(true);
          setBlocked('사용자를 찾을 수 없어요.');
        }
      });
    return () => {
      cancelled = true;
    };
    // 세션 객체가 바뀔 때마다 다시 부르지 않도록 토큰 유무만 봅니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendId, !!session]);

  const markReadIfNeeded = useCallback(
    (list: MessageResponse[]) => {
      if (!list.some((m) => m.senderId !== myId && !m.read)) return;
      messageApi
        .markRead(friendId, session)
        .then(() => {
          setMessages((prev) => prev.map((m) => (m.senderId !== myId ? { ...m, read: true } : m)));
          onRead(friendId);
          refreshUnreadCounts();
        })
        .catch((err) => console.error('Failed to mark messages read:', err));
    },
    [friendId, session, myId, onRead],
  );

  const fetchLatest = useCallback(
    async (initial = false) => {
      if (!session) return;
      try {
        if (initial) setLoading(true);
        const data = await messageApi.getMessages(friendId, session, { size: PAGE_SIZE });
        if (initial) {
          setMessages(data);
          setHasOlder(data.length >= PAGE_SIZE);
          const firstUnread = data.find((m) => m.senderId !== myId && !m.read);
          setUnreadFromId(firstUnread?.id ?? null);
          scrollToUnread.current = !!firstUnread;
        } else {
          // 최신 페이지 범위는 서버 것으로 바꾼다(다른 탭에서 대화를 지운 경우 등). 그보다 오래된 것만 남긴다.
          setMessages((prev) => {
            if (data.length < PAGE_SIZE) return data;
            const oldest = data[0].createdAt;
            return mergeMessages(prev.filter((m) => m.createdAt < oldest), data);
          });
          if (data.length < PAGE_SIZE) setHasOlder(false);
          const last = data[data.length - 1];
          if (!stickToBottom.current && last && last.id !== lastIdRef.current && last.senderId !== myId) setNewBelow(true);
        }
        setError(null);
        markReadIfNeeded(data);
      } catch (err) {
        console.error('Failed to fetch messages:', err);
        const code = axios.isAxiosError(err) ? err.response?.status : undefined;
        if (initial) {
          if (code === 404 || code === 400) {
            setProfileMissing(true);
            setBlocked('사용자를 찾을 수 없어요.');
          }
          setError(getApiErrorMessage(err, '메시지를 불러오지 못했어요.'));
          if (code === 403) setBlocked(getApiErrorMessage(err, '친구에게만 메시지를 보낼 수 있어요.'));
        }
      } finally {
        if (initial) setLoading(false);
      }
    },
    [friendId, session, markReadIfNeeded, myId],
  );

  useEffect(() => {
    fetchLatest(true);
    // 대화가 바뀌면 컴포넌트가 새로 만들어지므로 처음 한 번만 부릅니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const poll = useCallback(() => {
    fetchLatest(false);
  }, [fetchLatest]);
  useVisiblePolling(poll, !error, POLL_MS);
  useLiveTopics(['messages'], poll, !error);

  const loadOlder = async () => {
    if (loadingOlder || messages.length === 0) return;
    setLoadingOlder(true);
    try {
      const data = await messageApi.getMessages(friendId, session, { before: messages[0].createdAt, size: PAGE_SIZE });
      restoreHeight.current = scrollRef.current?.scrollHeight ?? null;
      stickToBottom.current = false;
      setMessages((prev) => mergeMessages(data, prev));
      setHasOlder(data.length >= PAGE_SIZE);
    } catch (err) {
      toast.error(getApiErrorMessage(err, '이전 메시지를 불러오지 못했어요.'));
    } finally {
      setLoadingOlder(false);
    }
  };

  // 새 메시지가 오면 맨 아래에 붙어 있을 때만 따라 내려가고, 이전 메시지를 불러오면 보던 위치를 지킵니다.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    lastIdRef.current = messages[messages.length - 1]?.id ?? null;
    if (!el) return;
    if (restoreHeight.current !== null) {
      el.scrollTop = el.scrollHeight - restoreHeight.current + el.scrollTop;
      restoreHeight.current = null;
      return;
    }
    if (scrollToUnread.current && !loading) {
      scrollToUnread.current = false;
      const divider = el.querySelector<HTMLElement>('[data-unread-divider]');
      // 안 읽은 메시지가 한 화면을 넘으면 구분선부터 보여 준다
      if (divider && el.scrollHeight - divider.offsetTop > el.clientHeight) {
        el.scrollTop = divider.offsetTop - 8;
        stickToBottom.current = false;
        return;
      }
    }
    if (stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  // 화면 높이가 바뀌면(모바일 키보드, 입력창이 자람) 맨 아래에 붙어 있던 경우 다시 맨 아래로
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (stickToBottom.current) el.scrollTop = el.scrollHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 입력창은 내용만큼 자란다(최대 128px, 넘으면 안에서 스크롤)
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight + (el.offsetHeight - el.clientHeight), DRAFT_MAX_HEIGHT)}px`;
  }, [draft, blocked]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (stickToBottom.current && newBelow) setNewBelow(false);
  };

  const jumpToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setNewBelow(false);
  };

  const length = [...draft.trim()].length;
  const tooLong = length > MESSAGE_MAX_LENGTH;
  const blank = isBlankMessage(draft);
  const canSend = !blocked && !isSelf && !sending && !blank && length > 0 && !tooLong;

  const handleSend = async () => {
    if (!canSend) return;
    const content = draft.trim();
    setSending(true);
    try {
      const sent = await messageApi.send(friendId, content, session);
      stickToBottom.current = true;
      setNewBelow(false);
      setMessages((prev) => mergeMessages(prev, [sent]));
      setDraft('');
      onSent();
    } catch (err) {
      const code = axios.isAxiosError(err) ? err.response?.status : undefined;
      const message = getApiErrorMessage(err, '메시지를 보내지 못했어요.');
      if (code === 403) setBlocked(message);
      toast.error(message);
    } finally {
      setSending(false);
      // 보내는 동안 버튼이 꺼지며 포커스를 잃으므로 이어 쓸 수 있게 입력창으로 돌려준다
      inputRef.current?.focus();
    }
  };

  const friendInfo = conversation?.friend ?? (profile
    ? { id: profile.id, nickname: profile.nickname, profileImage: profile.profileImage, customId: profile.customId }
    : null);
  // 친구가 아니라서 막힌 경우(친구를 끊음 등): 프로필로 가서 다시 친구 요청을 할 수 있게
  const notFriend = !isSelf && !profileMissing && !!profile && profile.friendStatus !== 'FRIEND';

  return (
    <>
      <header className="flex items-center gap-3 px-3 sm:px-4 lg:px-7 h-16 lg:h-[72px] border-b border-line shrink-0">
        <Link href="/messages" className="btn-icon size-11 -ml-1 lg:hidden" aria-label="대화 목록으로">
          <ArrowLeft size={18} strokeWidth={1.5} />
        </Link>
        {friendInfo && !profileMissing ? (
          <>
            <Link href={`/profile/${friendInfo.id}`} className="flex flex-1 items-center gap-3 min-w-0 rounded-lg">
              <Avatar src={friendInfo.profileImage} name={friendInfo.nickname} className="size-9" />
              <span className="min-w-0">
                <span className="block font-display text-[17px] leading-6 text-ink truncate">{friendInfo.nickname}</span>
                <span className="block text-xs text-ink-3 truncate">@{friendInfo.customId}</span>
              </span>
            </Link>
            <Link href={`/profile/${friendInfo.id}`} className="btn-secondary shrink-0 hidden sm:inline-flex">
              <User size={16} strokeWidth={1.5} />
              프로필
            </Link>
          </>
        ) : (
          <span className="text-sm text-ink-3">{profileMissing ? '알 수 없는 사용자' : '불러오는 중…'}</span>
        )}
      </header>

      <div className="relative flex-1 min-h-0 flex flex-col">
        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 lg:px-7 py-5">
          {profileMissing ? (
            <div className="h-full flex items-center justify-center">
              <EmptyState
                icon={AlertCircle}
                title="대화 상대를 찾을 수 없어요"
                description="탈퇴했거나 주소가 잘못됐을 수 있어요."
                action={<Link href="/messages" className="btn-secondary">메시지 목록으로</Link>}
              />
            </div>
          ) : isSelf ? (
            <div className="h-full flex items-center justify-center">
              <EmptyState
                icon={MessageCircle}
                title="나에게는 메시지를 보낼 수 없어요"
                description="친구를 골라 대화를 시작해요."
                action={<Link href="/messages" className="btn-secondary">메시지 목록으로</Link>}
              />
            </div>
          ) : loading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 size={18} strokeWidth={1.5} className="animate-spin text-ink-3" />
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center">
              <EmptyState
                icon={AlertCircle}
                title="메시지를 불러오지 못했어요"
                description={error}
                action={
                  <button onClick={() => fetchLatest(true)} className="btn-secondary">
                    <RotateCw size={16} strokeWidth={1.5} />
                    다시 시도
                  </button>
                }
              />
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <EmptyState
                title="아직 메시지가 없어요"
                description={notFriend ? '친구가 되면 메시지를 주고받을 수 있어요' : '첫 메시지를 보내 보세요'}
              />
            </div>
          ) : (
            <div className="space-y-2">
              {hasOlder && (
                <div className="flex justify-center pb-2">
                  <button onClick={loadOlder} disabled={loadingOlder} className="btn-ghost btn-sm max-lg:h-11">
                    {loadingOlder && <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />}
                    이전 메시지 보기
                  </button>
                </div>
              )}
              {messages.map((m, i) => {
                const mine = m.senderId === myId;
                const d = parseDate(m.createdAt);
                const prev = i > 0 ? parseDate(messages[i - 1].createdAt) : null;
                const newDay = d && (!prev || !isSameDay(prev, d));
                const isLastMine = mine && !messages.slice(i + 1).some((x) => x.senderId === myId);
                const next = messages[i + 1];
                // 다음 메시지가 같은 사람·같은 분이면 시각은 그쪽에 붙인다
                const showStamp = !next || next.senderId !== m.senderId || minuteKey(next.createdAt) !== minuteKey(m.createdAt);
                // 보낸 사람이 바뀌면 묶음 사이를 조금 더 띄운다
                const senderChanged = i > 0 && messages[i - 1].senderId !== m.senderId && !newDay;
                const stamp = showStamp && d ? format(d, tf, { locale: ko }) : '';
                return (
                  <React.Fragment key={m.id}>
                    {newDay && d && (
                      <div className="flex justify-center py-3">
                        <span className="text-xs font-medium text-ink-3">{format(d, 'M월 d일 EEEE', { locale: ko })}</span>
                      </div>
                    )}
                    {m.id === unreadFromId && (
                      <div data-unread-divider className="flex items-center gap-3 py-2" role="separator" aria-label="여기부터 안 읽은 메시지">
                        <span className="h-px flex-1 bg-line-strong" />
                        <span className="text-xs text-ink-2">여기부터 안 읽은 메시지</span>
                        <span className="h-px flex-1 bg-line-strong" />
                      </div>
                    )}
                    <div className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'} ${senderChanged ? 'pt-2' : ''}`}>
                      {mine && (stamp || (isLastMine && m.read)) && (
                        <span className="flex flex-col items-end shrink-0">
                          {isLastMine && m.read && <span className="text-[11px] text-ink-3">읽음</span>}
                          {stamp && <span className="stamp text-[11px]">{stamp}</span>}
                        </span>
                      )}
                      <p
                        className={`max-w-[75%] lg:max-w-[60%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                          mine ? 'bg-accent text-white' : 'bg-surface text-ink border border-line'
                        }`}
                      >
                        {m.content}
                      </p>
                      {!mine && stamp && <span className="stamp text-[11px] shrink-0">{stamp}</span>}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
        {newBelow && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
            <button type="button" onClick={jumpToBottom} className="btn-secondary pointer-events-auto shadow-float max-lg:h-11">
              <ArrowDown size={16} strokeWidth={1.5} />
              새 메시지
            </button>
          </div>
        )}
      </div>

      {!profileMissing && !isSelf && (
        <div className="border-t border-line px-3 sm:px-4 lg:px-7 py-3 shrink-0">
          {blocked ? (
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 py-1">
              <p className="text-sm text-ink-3 text-center">{blocked}</p>
              {notFriend && friendInfo && (
                <Link href={`/profile/${friendInfo.id}`} className="btn-secondary btn-sm max-lg:h-11">
                  <User size={14} strokeWidth={1.5} />
                  프로필에서 친구 요청
                </Link>
              )}
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
            >
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    // 터치 기기는 Enter 가 줄바꿈이다(보내기는 버튼)
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !coarse) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  rows={1}
                  placeholder={coarse ? '메시지 쓰기' : '메시지 쓰기 (줄바꿈은 Shift+Enter)'}
                  aria-label="메시지 입력"
                  className="form-input block flex-1 min-w-0 resize-none max-h-32 min-h-9 py-[7px] leading-5 max-lg:min-h-11 max-lg:py-[11px]"
                />
                <button
                  type="submit"
                  disabled={!canSend}
                  // 누를 때 입력창 포커스를 뺏지 않는다(모바일 키보드가 내려가지 않게)
                  onPointerDown={(e) => e.preventDefault()}
                  className="btn-primary shrink-0 max-lg:h-11 max-sm:w-11 max-sm:px-0"
                  aria-label="보내기"
                >
                  {sending ? <Loader2 size={16} strokeWidth={1.5} className="animate-spin" /> : <Send size={16} strokeWidth={1.5} />}
                  <span className="hidden sm:inline">보내기</span>
                </button>
              </div>
              {length > MESSAGE_MAX_LENGTH - 200 && (
                <p className={`text-xs mt-1 tabular-nums ${tooLong ? 'text-negative' : 'text-ink-3'}`}>
                  {length}/{MESSAGE_MAX_LENGTH}
                  {tooLong && ' · 2000자까지 보낼 수 있어요'}
                </p>
              )}
            </form>
          )}
        </div>
      )}
    </>
  );
}
