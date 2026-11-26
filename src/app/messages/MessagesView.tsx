'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import axios from 'axios';
import { format, isSameDay } from 'date-fns';
import { useTimeFormat } from '@/lib/schedule-utils';
import { ko } from 'date-fns/locale';
import { ArrowLeft, Loader2, MessageCircle, AlertCircle, RotateCw, Send, Search, Trash2, User } from 'lucide-react';
import Navbar from '@/components/Navbar';
import ImageWithFallback from '@/components/ImageWithFallback';
import { messageApi, MESSAGE_MAX_LENGTH, type ConversationResponse, type MessageResponse } from '@/lib/message-api';
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
    const ok = await confirm(`${c.friend.nickname}님과의 대화를 지울까요?\n내 화면에서만 지워지고 상대에게는 남아요.`);
    if (!ok) return;
    setDeletingId(c.friend.id);
    try {
      await messageApi.deleteConversation(c.friend.id, session);
      setConversations((prev) => prev.map((x) => (x.friend.id === c.friend.id ? { ...x, lastMessage: null, unreadCount: 0 } : x)));
      refreshUnreadCounts();
      fetchConversations(true);
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
            <h1 className="font-display text-2xl leading-8 text-ink lg:text-[30px] lg:leading-9">메시지</h1>
            <div className="relative">
              <Search size={16} strokeWidth={1.5} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="이름으로 찾기"
                aria-label="대화 찾기"
                className="form-input h-9 py-0 pl-9"
              />
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
                    <li key={c.friend.id} className="flex items-center gap-1">
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
                            <span className="font-display text-[15px] leading-5 text-ink truncate">{c.friend.nickname}</span>
                            {last && <span className="stamp shrink-0">{listStamp(last.createdAt, tf)}</span>}
                          </span>
                          <span className="flex items-center justify-between gap-2 mt-1">
                            <span className={`text-[13px] truncate ${unreadNow ? 'text-ink' : 'text-ink-2'}`}>
                              {last ? `${last.senderId === myId ? '나: ' : ''}${last.content}` : '아직 주고받은 메시지가 없어요'}
                            </span>
                            {unreadNow && (
                              <span className="min-w-[18px] h-[18px] px-1 shrink-0 rounded-full bg-mark text-white text-[11px] leading-[18px] text-center tabular-nums">
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
                          className="btn-icon shrink-0 hover:text-negative"
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

  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [profileMissing, setProfileMissing] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const restoreHeight = useRef<number | null>(null);

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
        setMessages((prev) => (initial ? data : mergeMessages(prev, data)));
        if (initial) setHasOlder(data.length >= PAGE_SIZE);
        setError(null);
        markReadIfNeeded(data);
      } catch (err) {
        console.error('Failed to fetch messages:', err);
        const code = axios.isAxiosError(err) ? err.response?.status : undefined;
        if (initial) {
          setError(getApiErrorMessage(err, '메시지를 불러오지 못했어요.'));
          if (code === 403) setBlocked(getApiErrorMessage(err, '친구에게만 메시지를 보낼 수 있어요.'));
        }
      } finally {
        if (initial) setLoading(false);
      }
    },
    [friendId, session, markReadIfNeeded],
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
    if (!el) return;
    if (restoreHeight.current !== null) {
      el.scrollTop = el.scrollHeight - restoreHeight.current + el.scrollTop;
      restoreHeight.current = null;
      return;
    }
    if (stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const length = [...draft.trim()].length;
  const tooLong = length > MESSAGE_MAX_LENGTH;
  const canSend = !blocked && !sending && length > 0 && !tooLong;

  const handleSend = async () => {
    if (!canSend) return;
    const content = draft.trim();
    setSending(true);
    try {
      const sent = await messageApi.send(friendId, content, session);
      stickToBottom.current = true;
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
    }
  };

  const friendInfo = conversation?.friend ?? (profile
    ? { id: profile.id, nickname: profile.nickname, profileImage: profile.profileImage, customId: profile.customId }
    : null);

  return (
    <>
      <header className="flex items-center gap-3 px-3 sm:px-4 lg:px-7 h-16 lg:h-[72px] border-b border-line shrink-0">
        <Link href="/messages" className="btn-icon size-9 lg:hidden" aria-label="대화 목록으로">
          <ArrowLeft size={18} strokeWidth={1.5} />
        </Link>
        {friendInfo ? (
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

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 lg:px-7 py-5">
        {loading ? (
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
            <EmptyState title="아직 메시지가 없어요" description="첫 메시지를 보내 보세요" />
          </div>
        ) : (
          <div className="space-y-2">
            {hasOlder && (
              <div className="flex justify-center pb-2">
                <button onClick={loadOlder} disabled={loadingOlder} className="btn-ghost btn-sm">
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
              return (
                <React.Fragment key={m.id}>
                  {newDay && d && (
                    <div className="flex justify-center py-3">
                      <span className="text-xs font-medium text-ink-3">{format(d, 'M월 d일 EEEE', { locale: ko })}</span>
                    </div>
                  )}
                  <div className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
                    {mine && (
                      <span className="flex flex-col items-end shrink-0">
                        {isLastMine && m.read && <span className="text-[11px] text-ink-3">읽음</span>}
                        <span className="stamp text-[11px]">{d ? format(d, tf, { locale: ko }) : ''}</span>
                      </span>
                    )}
                    <p
                      className={`max-w-[75%] lg:max-w-[60%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                        mine ? 'bg-accent text-white' : 'bg-surface text-ink border border-line'
                      }`}
                    >
                      {m.content}
                    </p>
                    {!mine && <span className="stamp text-[11px] shrink-0">{d ? format(d, tf, { locale: ko }) : ''}</span>}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-line px-3 sm:px-4 lg:px-7 py-3 shrink-0">
        {blocked ? (
          <p className="text-sm text-ink-3 text-center py-2">{blocked}</p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-end gap-2"
          >
            <div className="flex-1 min-w-0">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                rows={1}
                placeholder="메시지 쓰기 (줄바꿈은 Shift+Enter)"
                aria-label="메시지 입력"
                className="form-input block resize-none max-h-32 min-h-9 py-[7px] leading-5"
              />
              {length > MESSAGE_MAX_LENGTH - 200 && (
                <p className={`text-xs mt-1 tabular-nums ${tooLong ? 'text-negative' : 'text-ink-3'}`}>
                  {length}/{MESSAGE_MAX_LENGTH}
                  {tooLong && ' · 2000자까지 보낼 수 있어요'}
                </p>
              )}
            </div>
            <button type="submit" disabled={!canSend} className="btn-primary shrink-0" aria-label="보내기">
              {sending ? <Loader2 size={16} strokeWidth={1.5} className="animate-spin" /> : <Send size={16} strokeWidth={1.5} />}
              <span className="hidden sm:inline">보내기</span>
            </button>
          </form>
        )}
      </div>
    </>
  );
}
