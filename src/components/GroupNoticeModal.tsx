'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type AnchorHTMLAttributes, type ImgHTMLAttributes } from 'react';
import { useSession } from 'next-auth/react';
import type { Session } from 'next-auth';
import dynamic from 'next/dynamic';
import { Check, Loader2, Pin } from 'lucide-react';
import { groupNoticeApi, isNoticeEdited, type NoticeDetail, type NoticeUser } from '@/lib/group-notice-api';
import { getApiErrorMessage, getApiErrorStatus } from '@/lib/axios';
import { useAlert } from '@/hooks/useAlert';
import { useVisiblePolling } from '@/hooks/useVisiblePolling';
import { useLiveTopics } from '@/lib/live';
import { markdownListClassName, markdownRehypePlugins } from '@/lib/markdown';
import { formatStamp, useTimeFormat } from '@/lib/schedule-utils';
import '@uiw/react-markdown-preview/markdown.css';
import GroupNoticeFormModal from './GroupNoticeFormModal';
import { Modal } from './ui';
import { Avatar } from './groups/GroupUI';

const loadMarkdown = () => import('@uiw/react-md-editor').then((mod) => mod.default.Markdown);
const EdMarkdown = dynamic(loadMarkdown, { ssr: false });

/** 본문 링크: 바깥 주소는 새 탭에서 연다(모임 화면을 떠나지 않게) */
function NoticeLink({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const external = !!href && /^https?:\/\//i.test(href);
  return (
    <a href={href} {...rest} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      {children}
    </a>
  );
}

/** 본문 그림: 못 불러오면 깨진 그림 표시 대신 숨긴다 */
function NoticeImage(props: ImgHTMLAttributes<HTMLImageElement>) {
  const [broken, setBroken] = useState(false);
  if (broken || !props.src) return null;
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  return <img {...props} onError={() => setBroken(true)} />;
}

const markdownComponents = { a: NoticeLink, img: NoticeImage };

/** 열린 공지 창을 다시 불러오는 간격 (SSE 가 붙어 있으면 60초 안전망) */
const POLL_MS = 15000;
/** 마감 시각 타이머를 거는 최대 거리(setTimeout 한도 안, 그보다 멀면 폴링이 맡는다) */
const CLOSE_TIMER_MAX_MS = 24 * 60 * 60 * 1000;

/** 오프셋 없는 한국 시간 문자열이 지금부터 몇 ms 뒤인지 */
export function msUntil(localDateTime: string): number {
  return new Date(localDateTime).getTime() - Date.now();
}

/**
 * 공지 상세 창. noticeId 가 null 이면 닫혀 있다.
 * 공지마다 상태를 새로 시작한다(key={noticeId}). 열면 서버가 읽음으로 기록한다.
 */
export default function GroupNoticeModal({
  groupId,
  noticeId,
  onClose,
  onChanged,
}: {
  groupId: string;
  /** null 이면 닫힘 */
  noticeId: string | null;
  onClose: () => void;
  /** 목록을 조용히 다시 불러오게 */
  onChanged: () => void;
}) {
  const { data: session } = useSession();
  if (!noticeId) return null;
  return (
    <NoticeView key={noticeId} groupId={groupId} noticeId={noticeId} session={session ?? null} onClose={onClose} onChanged={onChanged} />
  );
}

/**
 * 실시간(group:{id})·폴링으로 조용히 다시 불러오지만, 저장하지 않은 투표 선택은 덮어쓰지 않는다(DatePollModal 과 같은 방식).
 */
function NoticeView({
  groupId,
  noticeId,
  session,
  onClose,
  onChanged,
}: {
  groupId: string;
  noticeId: string;
  session: Session | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { confirm, toast } = useAlert();
  const tf = useTimeFormat();
  const [detail, setDetail] = useState<NoticeDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** 저장하지 않은 내 투표 선택. null 이면 서버의 mine 그대로 */
  const [draft, setDraft] = useState<Set<string> | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  /** 이 창에서 재촉을 보냈나(연달아 누르지 않게) */
  const [reminded, setReminded] = useState(false);
  /** 본문 렌더러를 받기 전에는 창을 비워 두지 않고 로딩을 보여 준다(뒤늦게 본문이 끼어들어 아래 내용이 밀리지 않게) */
  const [markdownReady, setMarkdownReady] = useState(false);
  useEffect(() => {
    let alive = true;
    loadMarkdown().then(() => alive && setMarkdownReady(true), () => alive && setMarkdownReady(true));
    return () => {
      alive = false;
    };
  }, []);

  // 부모가 바뀔 때마다 새 함수를 넘겨도 load 가 다시 만들어지지 않게
  const cbRef = useRef({ onChanged, onClose });
  useEffect(() => {
    cbRef.current = { onChanged, onClose };
  }, [onChanged, onClose]);

  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const retryLoadRef = useRef<() => void>(() => {});

  /** silent: 로딩·오류 표시 없이, 실패하면 보던 것을 둔다. 요청 제한(429)이면 한 번만 1.5초 뒤에 다시 부른다 */
  const load = useCallback(async (silent = false, isRetry = false) => {
    if (!session) return;
    try {
      setDetail(await groupNoticeApi.get(groupId, noticeId, session));
      setLoadError(null);
      // 처음 열 때 읽음이 기록되니 목록의 안 읽음 점·숫자를 바로 갱신한다
      if (!silent) cbRef.current.onChanged();
    } catch (error) {
      const status = getApiErrorStatus(error);
      if (silent && status === 429 && !isRetry && !retryTimerRef.current) {
        retryTimerRef.current = setTimeout(() => {
          retryTimerRef.current = undefined;
          retryLoadRef.current();
        }, 1500);
      }
      if (silent && status !== 404) return;
      if (status === 404 && silent) {
        toast.info('공지가 지워졌어요');
        cbRef.current.onChanged();
        cbRef.current.onClose();
        return;
      }
      setLoadError(getApiErrorMessage(error, '공지를 불러오지 못했어요'));
    }
  }, [groupId, noticeId, session, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    retryLoadRef.current = () => load(true, true);
    return () => clearTimeout(retryTimerRef.current);
  }, [load]);

  const watching = !!detail;
  useVisiblePolling(() => load(true), watching, POLL_MS);
  useLiveTopics([`group:${groupId}`], () => load(true), watching);

  const poll = detail?.poll ?? null;
  const pollOpen = !!poll && !poll.closed;
  const canManage = !!detail?.canManage;
  const myId = session?.user?.id;
  const serverMine = useMemo(() => new Set(poll?.options.filter((o) => o.mine).map((o) => o.id) ?? []), [poll]);
  // 고르는 중에 마감되면 저장 안 한 선택은 버린다
  const mine = (pollOpen && draft) || serverMine;
  const dirty = pollOpen && draft !== null;

  // 고르는 중에 (다른 사람·마감 시각 때문에) 닫히면 저장 안 한 선택을 버리고 알린다
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  const pollClosed = !!poll?.closed;
  useEffect(() => {
    if (!pollClosed || draftRef.current === null) return;
    setDraft(null);
    toast.info('투표가 마감돼서 고른 것은 저장되지 않았어요');
  }, [pollClosed, toast]);

  // 창을 열어 둔 채 마감 시각이 지나면 다시 불러와 '마감됨'으로 바꾼다(서버는 그 시각에 알려 주지 않는다)
  const closesAt = poll && !poll.closed ? poll.closesAt : null;
  useEffect(() => {
    if (!closesAt) return;
    const ms = msUntil(closesAt);
    if (ms > CLOSE_TIMER_MAX_MS) return;
    const timer = setTimeout(() => {
      load(true);
      cbRef.current.onChanged();
    }, Math.max(0, ms) + 1000);
    return () => clearTimeout(timer);
  }, [closesAt, load]);

  /** 저장 안 한 선택이 있으면 닫기 전에 묻는다 */
  const requestClose = async () => {
    if (dirty && !(await confirm('고른 것을 아직 저장하지 않았어요. 닫으면 사라져요.', '닫을까요?', '닫기', '계속 고르기'))) return;
    onClose();
  };

  // 보이는 인원: 서버 집계에서 저장 안 한 내 변경만 더하고 뺀다
  const options = useMemo(() => (poll?.options ?? []).map((o) => {
    const wasMine = serverMine.has(o.id);
    const isMine = mine.has(o.id);
    const voters = poll?.anonymous
      ? []
      : [...o.voters.filter((v) => v.id !== myId), ...(isMine ? [{ id: myId ?? 'me', nickname: '나', profileImage: null }] : [])];
    return { ...o, count: o.count - (wasMine ? 1 : 0) + (isMine ? 1 : 0), isMine, voters };
  }), [poll, serverMine, mine, myId]);
  const topCount = Math.max(0, ...(poll?.options.map((o) => o.count) ?? []));
  const voterCount = poll ? poll.voterCount - (serverMine.size ? 1 : 0) + (mine.size ? 1 : 0) : 0;
  // 재촉은 나(재촉하는 사람)를 빼고 보낸다. 익명이면 notVoted 가 비어 있어 인원으로 센다
  const remindCount = detail && poll ? Math.max(0, detail.memberCount - poll.voterCount - (detail.myVoted ? 0 : 1)) : 0;

  const toggle = (id: string) => {
    if (!poll || !pollOpen) return;
    let next: Set<string>;
    if (poll.multiple) {
      next = new Set(mine);
      if (next.has(id)) next.delete(id);
      else next.add(id);
    } else {
      next = mine.has(id) ? new Set() : new Set([id]);
    }
    // 서버와 같아지면 '저장 안 함' 상태를 푼다
    const same = next.size === serverMine.size && [...next].every((x) => serverMine.has(x));
    setDraft(same ? null : next);
  };

  const vote = async (optionIds: string[]) => {
    if (!detail || saving) return;
    setSaving(true);
    try {
      setDetail(await groupNoticeApi.vote(groupId, detail.id, optionIds, session));
      setDraft(null);
      toast.success(optionIds.length ? '투표했어요' : '투표를 취소했어요');
      onChanged();
    } catch (error) {
      if (getApiErrorStatus(error) === 409) {
        setDraft(null);
        load(true);
        toast.error(getApiErrorMessage(error, '투표가 마감됐어요'));
      } else {
        toast.error(getApiErrorMessage(error, '투표하지 못했어요'));
      }
    } finally {
      setSaving(false);
    }
  };

  /** 방장의 작업. 응답이 공지면 화면을 바꾼다 */
  const run = async (task: () => Promise<NoticeDetail | void>, done: string, fail: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const next = await task();
      if (next) setDetail(next);
      toast.success(done);
      onChanged();
    } catch (error) {
      toast.error(getApiErrorMessage(error, fail));
    } finally {
      setBusy(false);
    }
  };

  const togglePin = () => {
    if (!detail) return;
    const pin = !detail.pinnedAt;
    run(() => groupNoticeApi.setPinned(groupId, detail.id, pin, session), pin ? '맨 위에 고정했어요' : '고정을 풀었어요', '고정을 바꾸지 못했어요');
  };

  const closePoll = async () => {
    if (!detail) return;
    if (!(await confirm('마감하면 더 이상 고르거나 바꿀 수 없어요.', '투표를 마감할까요?', '마감', '취소'))) return;
    setDraft(null);
    run(() => groupNoticeApi.closePoll(groupId, detail.id, session), '투표를 마감했어요', '투표를 마감하지 못했어요');
  };

  const remind = async () => {
    if (!detail || busy || reminded) return;
    setBusy(true);
    try {
      await groupNoticeApi.remindPoll(groupId, detail.id, session);
      setReminded(true);
      toast.success(`아직 투표 안 한 ${remindCount}명에게 알렸어요`);
    } catch (error) {
      // 409: 방금 재촉함(서버가 몇 분 동안 막는다)
      if (getApiErrorStatus(error) === 409) setReminded(true);
      toast.error(getApiErrorMessage(error, '알림을 보내지 못했어요'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!detail || busy) return;
    const ok = await confirm(
      poll ? '투표와 읽음 기록도 함께 지워져요.' : '읽음 기록도 함께 지워져요.',
      `'${detail.title}' 공지를 지울까요?`,
      '지우기',
      '취소',
    );
    if (!ok) return;
    setBusy(true);
    try {
      await groupNoticeApi.remove(groupId, detail.id, session);
      toast.success('공지를 지웠어요');
      onChanged();
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, '공지를 지우지 못했어요'));
      setBusy(false);
    }
  };

  return (
    <>
      <Modal
        open
        onClose={requestClose}
        size="md"
        title={<span className="break-keep [overflow-wrap:anywhere]">{detail?.title ?? '공지'}</span>}
        subtitle={detail && (
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            {detail.pinnedAt && (
              <span className="inline-flex items-center gap-1 text-group-ink">
                <Pin size={12} strokeWidth={1.5} aria-hidden /> 고정
              </span>
            )}
            <span>{detail.author.nickname}</span>
            <span className="stamp">{formatStamp(detail.createdAt, tf)}</span>
            {isNoticeEdited(detail) && <span title={formatStamp(detail.updatedAt, tf)}>수정됨</span>}
            <span aria-hidden>·</span>
            <span className="stamp">{detail.memberCount}명 중 {detail.readCount}명 읽음</span>
          </span>
        )}
        footer={detail && pollOpen ? (
          <>
            {dirty && <span className="mr-auto text-xs text-ink-3">아직 저장하지 않았어요</span>}
            {!dirty && serverMine.size > 0 && (
              <>
                <span className="mr-auto inline-flex items-center gap-1 text-xs text-ink-2">
                  <Check size={14} strokeWidth={1.5} className="text-group-ink" aria-hidden />
                  투표했어요 · 바꾸려면 다시 골라요
                </span>
                <button type="button" onClick={() => vote([])} disabled={saving} className="btn-ghost">투표 취소</button>
              </>
            )}
            {!dirty && serverMine.size === 0 && <span className="mr-auto text-xs text-ink-3">선택지를 골라 주세요</span>}
            {(dirty || serverMine.size === 0) && (
              <button type="button" onClick={() => vote([...mine])} disabled={saving || !dirty} className="btn-primary">
                {saving && <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />}
                {dirty && mine.size === 0 ? '투표 취소' : '투표하기'}
              </button>
            )}
          </>
        ) : undefined}
      >
        {!detail || !markdownReady ? (
          loadError && !detail ? (
            <div className="py-8 text-center">
              <p className="text-sm text-ink-2">{loadError}</p>
              <button type="button" onClick={() => load()} className="btn-secondary mt-4">다시 시도</button>
            </div>
          ) : (
            <div className="flex justify-center py-12">
              <Loader2 size={18} strokeWidth={1.5} className="animate-spin text-ink-3" />
            </div>
          )
        ) : (
          <div className="space-y-6">
            {detail.content.trim() && (
              <div className={`break-words leading-relaxed text-ink ${markdownListClassName}`} data-color-mode="light">
                <EdMarkdown
                  components={markdownComponents}
                  rehypePlugins={markdownRehypePlugins}
                  source={detail.content}
                  style={{ backgroundColor: 'transparent', fontSize: '0.9375rem', fontWeight: 400, color: 'inherit' }}
                />
              </div>
            )}

            {poll && (
              <section className="rounded-xl border border-line p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-base text-ink">투표</h3>
                  <span className="chip">{poll.multiple ? '여러 개 고르기' : '하나 고르기'}</span>
                  {poll.anonymous && <span className="chip">익명</span>}
                  <span className="stamp ml-auto text-xs text-ink-3">
                    {poll.closed
                      ? '마감됨'
                      : poll.closesAt
                        ? `${formatStamp(poll.closesAt, tf)} 마감`
                        : '방장이 마감해요'}
                  </span>
                </div>

                <ul className="mt-3 space-y-2">
                  {options.map((o) => {
                    const pct = voterCount ? Math.round((o.count / voterCount) * 100) : 0;
                    // 마감된 투표는 가장 많이 받은 항목을 굵게
                    const top = !pollOpen && topCount > 0 && o.count === topCount;
                    return (
                      <li key={o.id}>
                        <button
                          type="button"
                          onClick={() => toggle(o.id)}
                          disabled={!pollOpen || saving}
                          aria-pressed={pollOpen ? o.isMine : undefined}
                          aria-label={`${o.text} ${o.count}명${o.isMine ? ', 내가 고름' : ''}${top ? ', 가장 많음' : ''}`}
                          className={`relative flex min-h-11 w-full min-w-0 items-center gap-2.5 overflow-hidden rounded-lg border px-3 py-2.5 text-left md:min-h-0 transition-colors disabled:cursor-default ${
                            o.isMine ? 'border-group-ink' : 'border-line'
                          } ${pollOpen ? 'hover:border-line-strong' : ''}`}
                        >
                          <span aria-hidden className="absolute inset-y-0 left-0 bg-group-wash transition-[width]" style={{ width: `${pct}%` }} />
                          {pollOpen ? (
                            <span
                              aria-hidden
                              className={`relative flex size-4 shrink-0 items-center justify-center border ${poll.multiple ? 'rounded' : 'rounded-full'} ${
                                o.isMine ? 'border-group-ink bg-group-soft' : 'border-line-strong bg-surface'
                              }`}
                            >
                              {o.isMine && <Check size={11} strokeWidth={2} className="text-group-ink" />}
                            </span>
                          ) : (
                            // 마감 뒤에도 내가 고른 것은 체크로 남긴다(칸 맞춤용 빈 자리)
                            <span aria-hidden className="relative flex size-4 shrink-0 items-center justify-center">
                              {o.isMine && <Check size={14} strokeWidth={2} className="text-group-ink" />}
                            </span>
                          )}
                          <span className={`relative min-w-0 flex-1 break-words text-sm text-ink ${top ? 'font-medium' : ''}`}>{o.text}</span>
                          {!pollOpen && o.isMine && <span className="relative shrink-0 text-xs text-ink-3">내 선택</span>}
                          <span className={`stamp relative shrink-0 text-[13px] ${o.count ? 'text-group-ink' : 'text-ink-3'} ${top ? 'font-medium' : ''}`}>
                            {o.count}명
                          </span>
                        </button>
                        {!poll.anonymous && o.voters.length > 0 && (
                          <p className="mt-1 px-1 text-xs text-ink-3">{o.voters.map((v) => v.nickname).join(', ')}</p>
                        )}
                      </li>
                    );
                  })}
                </ul>

                <p className="stamp mt-3 text-xs text-ink-3">
                  {detail.memberCount}명 중 {voterCount}명 투표
                </p>
                {!poll.anonymous && poll.notVoted.length > 0 && (
                  <div className="mt-3">
                    <PeopleList title={pollOpen ? '아직 투표 안 했어요' : '투표 안 했어요'} people={poll.notVoted} />
                  </div>
                )}

                {canManage && pollOpen && (
                  <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-line pt-3">
                    {remindCount > 0 && (
                      <button type="button" onClick={remind} disabled={busy || reminded} className="btn-secondary btn-sm max-md:h-11">
                        {reminded ? '재촉했어요' : '투표 재촉'}
                      </button>
                    )}
                    <button type="button" onClick={closePoll} disabled={busy} className="btn-secondary btn-sm max-md:h-11">투표 마감</button>
                  </div>
                )}
              </section>
            )}

            {/* 읽은 사람 / 아직인 사람 */}
            <section className="grid gap-4 sm:grid-cols-2">
              <PeopleList title="읽었어요" people={detail.readers} />
              <PeopleList title="아직이에요" people={detail.notReaders} />
            </section>

            {canManage && (
              <section className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
                <button type="button" onClick={togglePin} disabled={busy} className="btn-secondary btn-sm max-md:h-11">
                  {detail.pinnedAt ? '고정 풀기' : '맨 위 고정'}
                </button>
                <button type="button" onClick={() => setEditing(true)} disabled={busy} className="btn-secondary btn-sm max-md:h-11">수정</button>
                <button type="button" onClick={remove} disabled={busy} className="btn-danger btn-sm max-md:ml-2 max-md:h-11">지우기</button>
              </section>
            )}
          </div>
        )}
      </Modal>

      {detail && canManage && (
        <GroupNoticeFormModal
          groupId={groupId}
          open={editing}
          notice={detail}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            setDetail(saved);
            onChanged();
          }}
        />
      )}
    </>
  );
}

function PeopleList({ title, people }: { title: string; people: NoticeUser[] }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-ink-2">
        {title} <span className="stamp text-ink-3">{people.length}</span>
      </h3>
      {people.length ? (
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-2">
          {people.map((p) => (
            <li key={p.id} className="flex items-center gap-1.5 text-[13px] text-ink">
              <Avatar name={p.nickname} src={p.profileImage} size="size-6" />
              {p.nickname}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[13px] text-ink-3">없어요</p>
      )}
    </div>
  );
}
