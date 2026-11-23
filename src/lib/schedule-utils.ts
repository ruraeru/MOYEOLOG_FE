import { useSyncExternalStore } from 'react';
import { PREF_CHANGE_EVENT } from './constants';
import { addDays, format, isSameDay, parseISO, startOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { ScheduleResponse } from './schedule-api';
import type { GroupResponse } from './group-api';
import { getThemeColors, getTimeFormat } from './utils';

export type ScheduleView = 'month' | 'week' | 'list';
export type WeekStartsOn = 0 | 1;

export const SCHEDULE_TITLE_MAX = 255;
export const SCHEDULE_DESCRIPTION_MAX = 5000;
export const SCHEDULE_LOCATION_MAX = 255;

/** 글자 수는 코드 포인트 기준(이모지 1개 = 1자). */
export const codePointLength = (value: string) => [...value].length;
export const truncateCodePoints = (value: string, max: number) => {
  const chars = [...value];
  return chars.length > max ? chars.slice(0, max).join('') : value;
};

/** 일정이 차지하는 마지막 날. 종료가 자정 정각이면 그 날은 포함하지 않는다. */
const lastDayOf = (s: ScheduleResponse) => {
  const start = parseISO(s.startTime);
  const rawEnd = parseISO(s.endTime);
  const end = Number.isNaN(rawEnd.getTime()) || rawEnd <= start ? start : rawEnd;
  const endDay = startOfDay(end);
  if (end > start && end.getTime() === endDay.getTime()) return addDays(endDay, -1);
  return endDay;
};

/** 일정이 그 날짜에 걸쳐 있는지(여러 날 일정은 시작~종료의 모든 날짜). */
export const scheduleCoversDay = (s: ScheduleResponse, day: Date) => {
  const startDay = startOfDay(parseISO(s.startTime));
  const target = startOfDay(day);
  return target >= startDay && target <= lastDayOf(s);
};

export const isMultiDaySchedule = (s: ScheduleResponse) =>
  !isSameDay(parseISO(s.startTime), lastDayOf(s));

/** 시작 시각 → 종료 시각 → 제목 순. */
export const sortSchedules = (list: ScheduleResponse[]) =>
  [...list].sort(
    (a, b) =>
      a.startTime.localeCompare(b.startTime) ||
      (a.endTime || '').localeCompare(b.endTime || '') ||
      a.title.localeCompare(b.title)
  );

export const schedulesOnDay = (list: ScheduleResponse[], day: Date) =>
  sortSchedules(list.filter((s) => scheduleCoversDay(s, day)));

/** '11.28 토 10:00 – 18:00' 또는 여러 날이면 '11.28 토 10:00 – 11.30 월 18:00'. */
export const formatScheduleRange = (s: ScheduleResponse, tf: string = getTimeFormat()) => {
  const start = parseISO(s.startTime);
  const end = parseISO(s.endTime);
  const startText = format(start, `M.d EEE ${tf}`, { locale: ko });
  if (Number.isNaN(end.getTime())) return startText;
  if (isSameDay(start, end) || !isMultiDaySchedule(s)) {
    return `${startText} – ${format(end, tf, { locale: ko })}`;
  }
  return `${startText} – ${format(end, `M.d EEE ${tf}`, { locale: ko })}`;
};

/** 그 날짜 칸에 보여 줄 짧은 시각. 이어지는 날은 '종일' 또는 '~HH:mm'. */
export const formatTimeOnDay = (s: ScheduleResponse, day: Date, tf: string = getTimeFormat()) => {
  const start = parseISO(s.startTime);
  const end = parseISO(s.endTime);
  if (isSameDay(start, day)) return format(start, tf, { locale: ko });
  if (!Number.isNaN(end.getTime()) && isSameDay(end, day)) return `~${format(end, tf, { locale: ko })}`;
  return '종일';
};

/** 모임 일정은 모임 테마색 점, 개인 일정은 중립색 점. */
export const scheduleDotClass = (s: ScheduleResponse, groups: GroupResponse[]) => {
  if (!s.groupId) return 'bg-ink-3';
  const group = groups.find((g) => g.id === s.groupId);
  return getThemeColors(group?.colorTheme).dot;
};

// ─── localStorage 설정(설정 화면에서 바꿈) ─────────────────────────

const PREF_EVENT = PREF_CHANGE_EVENT;

const subscribePrefs = (callback: () => void) => {
  window.addEventListener('storage', callback);
  window.addEventListener(PREF_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(PREF_EVENT, callback);
  };
};

const readPref = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

function useLocalPref(key: string) {
  return useSyncExternalStore(subscribePrefs, () => readPref(key), () => null);
}

/**
 * 설정의 '시각 표시'(12/24시간)에 맞춘 date-fns 시각 형식. 'a h:mm'(오후 3:05) 또는 'HH:mm'.
 * 설정 저장(moyeolog:prefs)·다른 탭(storage)에 반응해 다시 그립니다. 서버 렌더링은 24시간.
 */
export function useTimeFormat(): string {
  return useLocalPref('moyeolog.hour12') === 'true' ? 'a h:mm' : 'HH:mm';
}

/** '11.22 일 15:30' 형식(시각 부분은 설정을 따름). tf 는 useTimeFormat() 값. */
export const formatStamp = (date: Date | string, tf: string = getTimeFormat()) => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return Number.isNaN(d.getTime()) ? '' : format(d, `M.d EEE ${tf}`, { locale: ko });
};

/** 설정의 '주 시작 요일'. `moyeolog.weekStartsOn` = '0'(일) | '1'(월), 기본 0. */
export function useWeekStartsOn(): WeekStartsOn {
  return useLocalPref('moyeolog.weekStartsOn') === '1' ? 1 : 0;
}

/** 설정의 '일정 기본 보기'. `moyeolog.scheduleView` = month | week | list, 기본 month. */
export function useDefaultScheduleView(): ScheduleView {
  const value = useLocalPref('moyeolog.scheduleView');
  return value === 'week' || value === 'list' ? value : 'month';
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

/** 주 시작 요일에 맞춘 요일 머리글. index 는 실제 요일(0=일). */
export const weekdayHeaders = (weekStartsOn: WeekStartsOn) =>
  Array.from({ length: 7 }, (_, i) => {
    const dayIndex = (i + weekStartsOn) % 7;
    return { label: WEEKDAY_LABELS[dayIndex], dayIndex };
  });
