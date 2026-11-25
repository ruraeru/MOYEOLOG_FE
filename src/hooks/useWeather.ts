import { useQueries, useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { addDays, parseISO, startOfDay } from 'date-fns';
import { Session } from 'next-auth';
import type { ScheduleResponse } from '@/lib/schedule-api';
import { placeKey, roundCoord, weatherApi, weatherAt, type WeatherAt } from '@/lib/weather';

// 예보는 하루 몇 번만 바뀐다. 실패(키 없음·기상청 장애)는 날씨만 숨기면 되므로 다시 시도하지 않는다.
const forecastQuery = (lat: number, lng: number, session: Session | null) => ({
  queryKey: ['weather', placeKey(lat, lng)],
  queryFn: () => weatherApi.get(roundCoord(lat), roundCoord(lng), session),
  staleTime: 30 * 60 * 1000,
  retry: false,
  enabled: !!session,
});

/** 한 장소의 예보. 좌표가 없으면 묻지 않는다. */
export function usePlaceWeather(lat?: number | null, lng?: number | null) {
  const { data: session } = useSession();
  const has = lat != null && lng != null;
  return useQuery({ ...forecastQuery(lat ?? 0, lng ?? 0, session), enabled: !!session && has });
}

/** 한 화면에서 묻는 장소 수 상한(nginx rate limit 보호). */
const MAX_PLACES = 8;

/**
 * 일정 목록 → 일정의 시작 시각·장소 날씨를 돌려주는 함수.
 * 좌표가 있고 오늘부터 10일 안에 시작하는 일정만 값이 있다.
 */
export function useScheduleWeather(schedules: ScheduleResponse[]): (s: ScheduleResponse) => WeatherAt | null {
  const { data: session } = useSession();
  const from = startOfDay(new Date());
  const to = addDays(from, 11);
  const places = new Map<string, { lat: number; lng: number }>();
  for (const s of schedules) {
    if (s.latitude == null || s.longitude == null || places.size >= MAX_PLACES) continue;
    const start = parseISO(s.startTime);
    if (start >= from && start < to) places.set(placeKey(s.latitude, s.longitude), { lat: s.latitude, lng: s.longitude });
  }
  const keys = [...places.keys()];
  const results = useQueries({ queries: [...places.values()].map((p) => forecastQuery(p.lat, p.lng, session)) });
  return (s) => {
    if (s.latitude == null || s.longitude == null) return null;
    const forecast = results[keys.indexOf(placeKey(s.latitude, s.longitude))]?.data;
    return forecast ? weatherAt(forecast, s.startTime) : null;
  };
}
