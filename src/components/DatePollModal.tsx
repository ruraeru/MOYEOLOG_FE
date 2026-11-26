'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type Session } from 'next-auth';
import { addDays, differenceInCalendarDays, format, getDay, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Check, Loader2, Sparkles } from 'lucide-react';
import { datePollApi, type DatePollDetail, type PollUser } from '@/lib/date-poll-api';
import { getApiErrorMessage, getApiErrorStatus } from '@/lib/axios';
import { useAlert } from '@/hooks/useAlert';
import { useVisiblePolling } from '@/hooks/useVisiblePolling';
import { useLiveTopics } from '@/lib/live';
import { Modal } from './ui';
import { Avatar } from './groups/GroupUI';

/** 열린 조율 창을 다시 불러오는 간격 (SSE 가 붙어 있으면 60초 안전망) */
const POLL_MS = 15000;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MAX_DAYS = 31;
/** 서버(@CodePointSize)와 같은 기준: 글자(코드포인트) 50개 */
const TITLE_MAX = 50;

/** 'yyyy-MM-dd' → '11/30(토)' */
export function pollDateLabel(date: string): string {
  return format(parseISO(date), 'M/d(EEE)', { locale: ko });
}

/** 기간 표시 '11/28(금)~12/5(금)' */
export function pollRangeLabel(start: string, end: string): string {
  return start === end ? pollDateLabel(start) : `${pollDateLabel(start)}~${pollDateLabel(end)}`;
}

/** 날짜 조율 만들기 (모임 멤버 누구나) */
export function DatePollCreateModal({
  open,
  onClose,
  groupId,
  session,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  groupId: string;
  session: Session | null;
  onCreated: (poll: DatePollDetail) => void;
}) {
  const { toast } = useAlert();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(() => format(addDays(new Date(), 6), 'yyyy-MM-dd'));
  const [saving, setSaving] = useState(false);
  const [titleTouched, setTitleTouched] = useState(false);

  // 시작을 끝 뒤로 옮기면 끝도 같은 길이만큼 따라 옮긴다
  const changeStart = (value: string) => {
    setStartDate(value);
    if (value && endDate && value > endDate) {
      const span = startDate ? Math.max(0, differenceInCalendarDays(parseISO(endDate), parseISO(startDate))) : 0;
      setEndDate(format(addDays(parseISO(value), span), 'yyyy-MM-dd'));
    }
  };

  const days = startDate && endDate ? differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1 : 0;
  const problem = !title.trim()
    ? '제목을 적어 주세요'
    : !startDate || !endDate
      ? '기간을 골라 주세요'
      : startDate < today
        ? '시작 날짜는 오늘부터 고를 수 있어요'
        : days < 1
          ? '끝 날짜가 시작 날짜보다 빨라요'
          : days > MAX_DAYS
            ? `기간은 ${MAX_DAYS}일까지 고를 수 있어요`
            : null;

  const submit = async () => {
    if (problem || saving) return;
    setSaving(true);
    try {
      const poll = await datePollApi.create(groupId, { title: title.trim(), startDate, endDate }, session);
      toast.success('날짜 조율을 시작했어요');
      setTitle('');
      setTitleTouched(false);
      onCreated(poll);
    } catch (error) {
      toast.error(getApiErrorMessage(error, '날짜 조율을 만들지 못했어요'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="날짜 조율"
      subtitle="기간을 정하면 멤버들이 가능한 날을 골라요"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-ghost">취소</button>
          <button type="button" onClick={submit} disabled={!!problem || saving} className="btn-primary">
            {saving && <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />}
            시작하기
          </button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-[13px] text-ink-2">제목</span>
          <input
            value={title}
            onChange={(e) => setTitle([...e.target.value].slice(0, TITLE_MAX).join(''))}
            onBlur={() => setTitleTouched(true)}
            placeholder="예: 12월 송년회"
            className="form-input"
            autoFocus
          />
        </label>
        <div>
          <span className="mb-1.5 block text-[13px] text-ink-2">후보 기간</span>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" aria-label="시작 날짜" value={startDate} min={today} onChange={(e) => changeStart(e.target.value)} className="form-input px-2 tabular-nums md:px-3" />
            <input type="date" aria-label="끝 날짜" value={endDate} min={startDate || today} onChange={(e) => setEndDate(e.target.value)} className="form-input px-2 tabular-nums md:px-3" />
          </div>
          {/* 제목 칸을 건드린 뒤에는 '제목을 적어 주세요' 도 보여 준다(버튼이 왜 꺼졌는지) */}
          <p className={`mt-1.5 text-xs ${problem && (title.trim() || titleTouched) ? 'text-negative' : 'text-ink-3'}`}>
            {problem && (title.trim() || titleTouched) ? problem : days >= 1 ? `${days}일 동안에서 골라요 (최대 ${MAX_DAYS}일)` : `최대 ${MAX_DAYS}일`}
          </p>
        </div>
      </form>
    </Modal>
  );
}

/**
 * 날짜 조율 창. 후보 기간을 달력 격자로 그리고, 칸을 누르면 내 가능 여부가 바뀐다('저장'으로 한 번에 보낸다).
 * 조율마다 key={pollId} 로 그린다(다른 조율을 열면 상태를 새로 시작).
 * 실시간(group:{id})·폴링으로 조용히 다시 불러오지만, 저장하지 않은 내 선택은 덮어쓰지 않는다.
 */
export default function DatePollModal({
  open,
  onClose,
  groupId,
  pollId,
  session,
  onChanged,
  onOpenSchedule,
}: {
  open: boolean;
  onClose: () => void;
  groupId: string;
  pollId: string | null;
  session: Session | null;
  /** 조율이 바뀌었을 때(저장·확정·삭제) 바깥 목록을 다시 불러오게 */
  onChanged: () => void;
  /** 확정된 조율의 '일정 보기' */
  onOpenSchedule: (scheduleId: string) => void;
}) {
  const { confirm, toast } = useAlert();
  const [detail, setDetail] = useState<DatePollDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** 저장하지 않은 내 선택. null 이면 서버의 myDates 그대로 */
  const [draft, setDraft] = useState<Set<string> | null>(null);
  const [focusDate, setFocusDate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [recommending, setRecommending] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);
  const [confirmDate, setConfirmDate] = useState<string | null>(null);
  const [startTime, setStartTime] = useState('19:00');
  const [endTime, setEndTime] = useState('');
  const [busy, setBusy] = useState(false);
  /** 이 창에서 재촉을 보냈으면 다시 누르지 않게 */
  const [reminded, setReminded] = useState(false);
  const closingRef = useRef(false);
  const confirmRef = useRef<HTMLElement>(null);
  // '날짜 정하기'(아래쪽 버튼)로 열어도 정하기 칸이 보이게
  useEffect(() => {
    if (confirmDate) confirmRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [confirmDate]);

  // 부모가 바뀔 때마다 새 함수를 넘겨도 load 가 다시 만들어지지 않게
  const cbRef = useRef({ onChanged, onClose });
  useEffect(() => {
    cbRef.current = { onChanged, onClose };
  }, [onChanged, onClose]);

  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const retryLoadRef = useRef<() => void>(() => {});

  /** silent: 로딩·오류 표시 없이, 실패하면 보던 것을 둔다. 요청 제한(429)이면 한 번만 1.5초 뒤에 다시 부른다 */
  const load = useCallback(async (silent = false, isRetry = false) => {
    if (!pollId || !session) return;
    try {
      setDetail(await datePollApi.get(groupId, pollId, session));
      setLoadError(null);
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
        toast.info('조율이 지워졌어요');
        cbRef.current.onChanged();
        cbRef.current.onClose();
        return;
      }
      setLoadError(getApiErrorMessage(error, '날짜 조율을 불러오지 못했어요'));
    }
  }, [groupId, pollId, session, toast]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  useEffect(() => {
    retryLoadRef.current = () => load(true, true);
    return () => clearTimeout(retryTimerRef.current);
  }, [load]);

  const watching = open && !!detail;
  useVisiblePolling(() => load(true), watching, POLL_MS);
  useLiveTopics([`group:${groupId}`], () => load(true), watching);

  const readOnly = detail?.status !== 'OPEN';
  // 이 날로 정하기·응답 재촉·지우기: 조율을 만든 사람 또는 모임장
  const canManage = !!detail?.canManage;
  const myId = session?.user?.id;
  // 재촉은 나(재촉하는 사람)를 빼고 보낸다
  const remindCount = detail ? detail.notResponded.filter((u) => u.id !== myId).length : 0;
  const serverMine = useMemo(() => new Set(detail?.myDates ?? []), [detail]);
  // 고르는 중에 다른 사람이 확정하면(읽기 전용) 저장 안 한 선택은 버린다
  const mine = (!readOnly && draft) || serverMine;
  const dirty = !readOnly && draft !== null;

  /** 저장하지 않은 선택이 있으면 닫기 전에 묻는다(Esc·닫기·바깥 누르기 모두) */
  const requestClose = async () => {
    if (closingRef.current) return;
    if (dirty) {
      closingRef.current = true;
      const ok = await confirm('고른 날짜는 저장되지 않아요.', '저장하지 않고 닫을까요?', '닫기', '계속 고르기');
      closingRef.current = false;
      if (!ok) return;
    }
    onClose();
  };

  // 칸에 보일 인원: 서버 집계에서 저장 안 한 내 변경만 더하고 뺀다
  const cells = useMemo(() => (detail?.dates ?? []).map((d) => {
    const wasMine = serverMine.has(d.date);
    const isMine = mine.has(d.date);
    return { ...d, count: d.count - (wasMine ? 1 : 0) + (isMine ? 1 : 0), isMine };
  }), [detail, serverMine, mine]);
  const maxCount = Math.max(1, ...cells.map((c) => c.count));
  const lead = detail ? getDay(parseISO(detail.startDate)) : 0;

  if (!open) return null;

  const toggle = (date: string) => {
    setFocusDate(date);
    if (readOnly) return;
    const next = new Set(mine);
    if (next.has(date)) next.delete(date);
    else next.add(date);
    // 서버와 같아지면 '저장 안 함' 상태를 푼다
    const same = next.size === serverMine.size && [...next].every((d) => serverMine.has(d));
    setDraft(same && detail?.myResponded ? null : next);
  };

  const save = async (dates: string[]) => {
    if (!detail || saving) return;
    setSaving(true);
    try {
      const next = await datePollApi.vote(groupId, detail.id, [...dates].sort(), session);
      setDetail(next);
      setDraft(null);
      toast.success(dates.length ? '가능한 날을 저장했어요' : '가능한 날이 없다고 알렸어요');
      onChanged();
    } catch (error) {
      toast.error(getApiErrorMessage(error, '저장하지 못했어요'));
    } finally {
      setSaving(false);
    }
  };

  const recommend = async () => {
    if (!detail || recommending) return;
    setRecommending(true);
    setRecError(null);
    try {
      setDetail(await datePollApi.recommend(groupId, detail.id, session));
    } catch (error) {
      const status = getApiErrorStatus(error);
      setRecError(
        status === 409
          ? '이미 추천을 만들고 있어요. 잠시 뒤에 다시 열어 보세요'
          : status === 400
            ? getApiErrorMessage(error, '아직 응답한 사람이 없어요')
            : '지금은 추천을 만들지 못했어요. 아래 집계를 참고해 주세요',
      );
    } finally {
      setRecommending(false);
    }
  };

  const remind = async () => {
    if (!detail || busy) return;
    setBusy(true);
    try {
      await datePollApi.remind(groupId, detail.id, session);
      setReminded(true);
      toast.success(`아직 응답 안 한 ${remindCount}명에게 알렸어요`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, '알림을 보내지 못했어요'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!detail || busy) return;
    // 되돌릴 수 없는 동작이라 확인 버튼을 위험 색으로(5번째 인자 danger 는 q25 가 useAlert confirm 에 더한다.
    // 합치기 전에는 무시되는 인자라 타입만 넓혀 넘긴다)
    const confirmDanger = confirm as (message: string, title?: string, confirmText?: string, cancelText?: string, danger?: boolean) => Promise<boolean>;
    const ok = await confirmDanger(
      detail.scheduleId ? '만들어진 일정은 그대로 남아요.' : '멤버들이 고른 날짜도 함께 지워져요.',
      `'${detail.title}' 조율을 지울까요?`,
      '지우기',
      '취소',
      true,
    );
    if (!ok) return;
    setBusy(true);
    try {
      await datePollApi.remove(groupId, detail.id, session);
      toast.success('조율을 지웠어요');
      onChanged();
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, '조율을 지우지 못했어요'));
    } finally {
      setBusy(false);
    }
  };

  const timeProblem = !startTime ? '시작 시각을 골라 주세요' : endTime && endTime <= startTime ? '끝 시각이 시작 시각보다 빨라요' : null;
  // 막지는 않고 알려만 준다
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const pastWarning = !confirmDate || timeProblem
    ? null
    : confirmDate < todayStr
      ? '이미 지난 날짜예요. 그래도 일정을 만들 수 있어요'
      : confirmDate === todayStr && startTime < format(new Date(), 'HH:mm')
        ? '이미 지난 시각이에요. 그래도 일정을 만들 수 있어요'
        : null;
  const confirmPoll = async () => {
    if (!detail || !confirmDate || timeProblem || busy) return;
    setBusy(true);
    try {
      // 저장하지 않은 내 선택이 있으면 먼저 저장한다(안내한 참여자 수와 실제 일정이 같게)
      if (dirty) {
        setDetail(await datePollApi.vote(groupId, detail.id, [...mine].sort(), session));
        setDraft(null);
      }
      const next = await datePollApi.confirm(groupId, detail.id, { date: confirmDate, startTime, ...(endTime ? { endTime } : {}) }, session);
      setDetail(next);
      setDraft(null);
      setConfirmDate(null);
      toast.success(`${pollDateLabel(confirmDate)}로 정하고 모임 일정을 만들었어요`);
      onChanged();
    } catch (error) {
      toast.error(getApiErrorMessage(error, '날짜를 정하지 못했어요'));
    } finally {
      setBusy(false);
    }
  };

  const countOf = (date: string) => cells.find((c) => c.date === date)?.count ?? 0;
  /** 칸을 누르지 않고(내 선택을 바꾸지 않고) 정하기를 연다: 보고 있는 날 → 많이 되는 날 1위 → 첫날 */
  const openConfirm = () => {
    if (!detail) return;
    setConfirmDate(focusDate ?? detail.best[0] ?? detail.startDate);
  };
  const focus = focusDate ? cells.find((c) => c.date === focusDate) : undefined;
  // 저장 안 한 내 변경을 반영한 '가능한 사람' 이름
  const focusVoters = focus
    ? [...focus.voters.filter((v) => v.id !== myId), ...(focus.isMine ? [{ id: myId ?? 'me', nickname: '나' }] : [])]
    : [];

  return (
    <Modal
      open={open}
      onClose={requestClose}
      size="md"
      title={<span className="break-keep">{detail?.title ?? '날짜 조율'}</span>}
      subtitle={detail && (
        <span className="stamp">
          {pollRangeLabel(detail.startDate, detail.endDate)} · {detail.memberCount}명 중 {detail.respondedCount}명 응답
        </span>
      )}
      footer={detail && !readOnly ? (
        <>
          {dirty && <span className="mr-auto text-xs text-ink-3">아직 저장하지 않았어요</span>}
          <button type="button" onClick={() => save([])} disabled={saving} className="btn-ghost max-sm:h-11">
            가능한 날이 없어요
          </button>
          <button type="button" onClick={() => save([...mine])} disabled={saving || (!dirty && detail.myResponded) || mine.size === 0} className="btn-primary max-sm:h-11">
            {saving && <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />}
            저장
          </button>
        </>
      ) : detail?.scheduleId ? (
        <button type="button" onClick={() => onOpenSchedule(detail.scheduleId!)} className="btn-primary max-sm:h-11">일정 보기</button>
      ) : undefined}
    >
      {!detail ? (
        loadError ? (
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
          {detail.status === 'CONFIRMED' && detail.confirmedDate && (
            <p className="rounded-lg bg-group-wash px-3 py-2.5 text-sm text-ink">
              <span className="font-display text-group-ink">{pollDateLabel(detail.confirmedDate)}</span>로 정해졌어요
            </p>
          )}

          {/* 달력 격자 */}
          <section>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-medium text-ink-2">{readOnly ? '날짜별 가능 인원' : '가능한 날을 눌러 주세요'}</h3>
              {!readOnly && detail.myResponded && !dirty && detail.myDates.length === 0 && (
                <span className="text-xs text-ink-3">가능한 날 없음으로 응답했어요</span>
              )}
            </div>
            <div className="grid grid-cols-7 gap-1 text-center max-[359px]:-mx-2 max-[359px]:gap-0.5">
              {WEEKDAYS.map((w, i) => (
                <div key={w} className={`pb-1 text-xs ${i === 0 ? 'text-negative' : 'text-ink-3'}`}>{w}</div>
              ))}
              {Array.from({ length: lead }, (_, i) => <div key={`blank-${i}`} aria-hidden />)}
              {cells.map((c) => {
                const level = c.count === 0 ? 0 : c.count / maxCount <= 0.5 ? 1 : c.count < maxCount ? 2 : 3;
                const shade = ['bg-surface', 'bg-group-wash', 'bg-group-soft/60', 'bg-group-soft'][level];
                const d = parseISO(c.date);
                return (
                  <button
                    key={c.date}
                    type="button"
                    onClick={() => toggle(c.date)}
                    onMouseEnter={() => setFocusDate(c.date)}
                    aria-pressed={readOnly ? undefined : c.isMine}
                    aria-label={`${pollDateLabel(c.date)} ${c.count}명 가능${c.isMine ? ', 나도 가능' : ''}`}
                    title={c.voters.map((v) => v.nickname).join(', ') || undefined}
                    className={`relative flex min-h-12 min-w-0 flex-col items-center justify-center rounded-lg border transition-colors ${shade} ${
                      c.isMine ? 'border-2 border-group-ink' : focusDate === c.date ? 'border-line-strong' : 'border-line'
                    } ${readOnly ? 'cursor-default' : c.isMine ? '' : 'hover:border-line-strong'}`}
                  >
                    {/* 좁은 화면(칸 44px)에서는 체크가 '11/27' 글자와 겹쳐 테두리로만 표시한다. 날짜는 모든 칸이 M/d 라 좁은 화면에서 12px 로 줄인다 */}
                    {c.isMine && <Check size={12} strokeWidth={2} aria-hidden className="absolute right-0.5 top-0.5 text-group-ink max-sm:hidden" />}
                    {/* .stamp 는 @layer 밖이라 색·크기 유틸을 덮어쓴다. 여기서는 같은 모양을 유틸로 쓴다 */}
                    <span className={`whitespace-nowrap text-xs font-medium leading-4 tabular-nums sm:text-[13px] ${getDay(d) === 0 ? 'text-negative' : 'text-ink'}`}>
                      {format(d, 'M/d')}
                    </span>
                    <span className={`text-[11px] font-medium leading-4 tabular-nums ${c.count ? 'text-group-ink' : 'text-ink-3'}`}>{c.count}명</span>
                  </button>
                );
              })}
            </div>

            {/* 누르거나 가리킨 날의 가능한 사람 */}
            <div className="mt-3 min-h-10 rounded-lg bg-raised px-3 py-2.5 text-[13px]">
              {focus ? (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                  <span className="font-display text-ink">{pollDateLabel(focus.date)}</span>
                  <span className="text-ink-2">
                    {focusVoters.length ? focusVoters.map((v) => v.nickname).join(', ') : '가능한 사람이 없어요'}
                  </span>
                  {canManage && !readOnly && (
                    <button type="button" onClick={() => setConfirmDate(focus.date)} className="btn-secondary btn-sm ml-auto max-sm:h-11">
                      이 날로 정하기
                    </button>
                  )}
                </div>
              ) : (
                <span className="text-ink-3">날짜를 누르면 그 날 가능한 사람이 보여요</span>
              )}
            </div>
          </section>

          {/* 만든 사람·모임장: 날짜 확정 */}
          {canManage && !readOnly && confirmDate && (
            <section ref={confirmRef} className="rounded-xl border border-line p-4">
              <h3 className="font-display text-base text-ink">{pollDateLabel(confirmDate)}로 정하기</h3>
              <p className="mt-1 text-xs text-ink-3">
                모임 일정을 만들고, 그 날 가능하다고 한 {countOf(confirmDate)}명을 참여자로 넣어요
                {dirty && ' (저장하지 않은 내 선택도 함께 저장돼요)'}
              </p>
              {/* 칸을 누르면 내 선택이 바뀌므로, 정할 날은 여기서도 고를 수 있다 */}
              <label className="mt-3 block">
                <span className="mb-1 block text-xs text-ink-2">날짜</span>
                <select value={confirmDate} onChange={(e) => setConfirmDate(e.target.value)} className="form-input px-2 tabular-nums md:px-3">
                  {cells.map((c) => (
                    <option key={c.date} value={c.date}>{pollDateLabel(c.date)} · {c.count}명 가능</option>
                  ))}
                </select>
              </label>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="min-w-0">
                  <span className="mb-1 block text-xs text-ink-2">시작 시각</span>
                  <input type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)} className="form-input px-2 tabular-nums md:px-3" />
                </label>
                <label className="min-w-0">
                  <span className="mb-1 block text-xs text-ink-2">끝 시각 (선택)</span>
                  <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="form-input px-2 tabular-nums md:px-3" />
                </label>
              </div>
              {timeProblem && <p className="mt-1.5 text-xs text-negative">{timeProblem}</p>}
              {pastWarning && <p className="mt-1.5 text-xs text-ink-2">{pastWarning}</p>}
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" onClick={() => setConfirmDate(null)} className="btn-ghost btn-sm max-sm:h-11">취소</button>
                <button type="button" onClick={confirmPoll} disabled={!!timeProblem || busy} className="btn-primary btn-sm max-sm:h-11">
                  {busy && <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />}
                  정하고 일정 만들기
                </button>
              </div>
            </section>
          )}

          {/* 추천: 코드 순위 + AI */}
          <section>
            <h3 className="text-sm font-medium text-ink-2">많이 되는 날</h3>
            {detail.best.length ? (
              <ol className="mt-2 flex flex-wrap gap-2">
                {detail.best.map((date, i) => (
                  <li key={date}>
                    <button
                      type="button"
                      onClick={() => setFocusDate(date)}
                      className={`chip gap-1.5 ${focusDate === date ? 'bg-group-soft text-group-sel' : ''}`}
                    >
                      <span className="text-xs font-medium tabular-nums text-ink-3">{i + 1}</span>
                      <span>{pollDateLabel(date)}</span>
                      <span className="text-xs font-medium tabular-nums text-group-ink">{detail.dates.find((d) => d.date === date)?.count ?? 0}명</span>
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-ink-3">아직 고른 사람이 없어요</p>
            )}

            <div className="mt-4 rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="inline-flex items-center gap-1.5 font-display text-base text-ink">
                  <Sparkles size={16} strokeWidth={1.5} className="text-group-ink" aria-hidden /> AI 추천
                </h4>
                {!readOnly && (!detail.ai || detail.ai.stale) && (
                  <button
                    type="button"
                    onClick={recommend}
                    disabled={recommending || detail.respondedCount === 0}
                    className="btn-secondary btn-sm max-sm:h-11"
                  >
                    {recommending && <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />}
                    {detail.ai ? '다시 받기' : 'AI 추천 받기'}
                  </button>
                )}
              </div>
              {recommending ? (
                <p className="mt-2 text-sm text-ink-3">추천을 만드는 중이에요. 1분쯤 걸릴 수 있어요</p>
              ) : recError ? (
                <p className="mt-2 text-sm text-negative">{recError}</p>
              ) : null}
              {detail.ai ? (
                <div className="mt-2">
                  {detail.ai.stale && !readOnly && (
                    <p className="mb-2 text-xs text-ink-3">선택이 바뀌었어요. 다시 받으면 지금 집계로 추천해요</p>
                  )}
                  <p className={`text-sm leading-6 ${detail.ai.stale ? 'text-ink-3' : 'text-ink'}`}>{detail.ai.summary}</p>
                  <ul className="mt-3 space-y-2">
                    {detail.ai.recommended.map((r) => (
                      <li key={r.date}>
                        <button type="button" onClick={() => setFocusDate(r.date)} className="flex w-full gap-3 text-left">
                          <span className="w-20 shrink-0 font-display text-[15px] text-group-ink">{pollDateLabel(r.date)}</span>
                          <span className="min-w-0 text-[13px] leading-5 text-ink-2">{r.reason}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : !recommending && !recError ? (
                <p className="mt-2 text-sm text-ink-3">
                  {detail.respondedCount === 0 ? '한 명 이상 응답하면 추천을 받을 수 있어요' : '모인 선택을 보고 좋은 날과 이유를 알려 줘요'}
                </p>
              ) : null}
            </div>
          </section>

          {/* 응답한 사람 / 아직인 사람 */}
          <section className="grid gap-4 sm:grid-cols-2">
            <PeopleList title="응답했어요" people={detail.responded} />
            <PeopleList title="아직이에요" people={detail.notResponded} />
          </section>

          {canManage && (
            <section className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
              {!readOnly && !confirmDate && (
                <button type="button" onClick={openConfirm} disabled={busy} className="btn-secondary btn-sm max-sm:h-11">날짜 정하기</button>
              )}
              {!readOnly && remindCount > 0 && (
                <button type="button" onClick={remind} disabled={busy || reminded} className="btn-secondary btn-sm max-sm:h-11">
                  {reminded ? '재촉했어요' : '응답 재촉'}
                </button>
              )}
              <button type="button" onClick={remove} disabled={busy} className="btn-danger btn-sm max-sm:h-11">조율 지우기</button>
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}

function PeopleList({ title, people }: { title: string; people: PollUser[] }) {
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
