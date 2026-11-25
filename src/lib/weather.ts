import { Session } from 'next-auth';
import { axiosInstance, getAuthHeaders } from './axios';

/** 백엔드 GET /api/weather (기상청 단기 + 중기예보). 시각은 오프셋 없는 한국 시간. */
export type Sky = 'CLEAR' | 'PARTLY' | 'CLOUDY' | 'RAIN' | 'SLEET' | 'SNOW';

export interface Forecast {
  /** 3~4일치. 뒤쪽은 3시간 간격일 수 있다. */
  hourly: Array<{ time: string; sky: Sky; temp: number | null; pop: number | null }>;
  /** 오늘부터 최대 10일. */
  daily: Array<{ date: string; sky: Sky; pop: number | null; min: number | null; max: number | null }>;
}

/** 어느 시각의 날씨. 시간별 예보가 없는 먼 날짜는 temp 없이 min·max 만 있다. */
export interface WeatherAt {
  sky: Sky;
  pop: number | null;
  temp: number | null;
  min: number | null;
  max: number | null;
}

export const SKY_LABEL: Record<Sky, string> = {
  CLEAR: '맑음',
  PARTLY: '구름 많음',
  CLOUDY: '흐림',
  RAIN: '비',
  SLEET: '비 또는 눈',
  SNOW: '눈',
};

export const weatherApi = {
  async get(lat: number, lng: number, session: Session | null): Promise<Forecast> {
    const response = await axiosInstance.get<Forecast>('/api/weather', {
      params: { lat, lng },
      headers: getAuthHeaders(session),
      timeout: 15000,
    });
    return response.data;
  },
};

/** 같은 동네는 한 번만 묻도록 좌표를 소수 둘째 자리(약 1km)로 맞춘다. 기상청 격자는 5km 다. */
export const roundCoord = (value: number) => Math.round(value * 100) / 100;
export const placeKey = (lat: number, lng: number) => `${roundCoord(lat)},${roundCoord(lng)}`;

const HOUR = 60 * 60 * 1000;

/** iso('yyyy-MM-ddTHH:mm:ss') 시각의 날씨. 3시간 안에 시간별 예보가 있으면 그것, 없으면 그 날짜의 일별 예보. */
export function weatherAt(forecast: Forecast, iso: string): WeatherAt | null {
  const day = forecast.daily.find((d) => d.date === iso.slice(0, 10));
  const target = new Date(iso).getTime();
  let nearest: Forecast['hourly'][number] | null = null;
  let gap = 3 * HOUR;
  for (const hour of forecast.hourly) {
    const diff = Math.abs(new Date(hour.time).getTime() - target);
    if (diff <= gap) {
      nearest = hour;
      gap = diff - 1; // 같은 거리면 앞선 시각을 유지
    }
  }
  if (nearest) {
    return { sky: nearest.sky, pop: nearest.pop, temp: nearest.temp, min: day?.min ?? null, max: day?.max ?? null };
  }
  return day ? { sky: day.sky, pop: day.pop, temp: null, min: day.min, max: day.max } : null;
}

/** '비 8° · 강수 70%' / 먼 날짜는 '맑음 1°/9° · 강수 10%'. */
export function weatherText(w: WeatherAt): string {
  const temp = w.temp != null ? `${w.temp}°` : w.min != null && w.max != null ? `${w.min}°/${w.max}°` : '';
  const pop = w.pop != null ? ` · 강수 ${w.pop}%` : '';
  return `${SKY_LABEL[w.sky]}${temp ? ` ${temp}` : ''}${pop}`;
}

// Kakao 장소 카테고리: FD6 음식점, CE7 카페, CT1 문화시설, AT4 관광명소
const INDOOR = ['CE7', 'CT1', 'FD6'];
export const DEFAULT_CATEGORIES = ['FD6', 'CE7'];

/** 날씨에 맞는 주변 추천 순서와, 화면에 보여 줄 이유(기본 순서면 null). */
export function recommendFor(w: WeatherAt | null): { categories: string[]; reason: string | null } {
  if (!w) return { categories: DEFAULT_CATEGORIES, reason: null };
  if (w.sky === 'RAIN' || w.sky === 'SLEET' || w.sky === 'SNOW' || (w.pop ?? 0) >= 60) {
    return { categories: INDOOR, reason: '비나 눈 소식이 있어 실내 장소를 먼저 골랐어요' };
  }
  if ((w.temp ?? w.max ?? 0) >= 33) return { categories: INDOOR, reason: '날이 더워 실내 장소를 먼저 골랐어요' };
  if ((w.temp ?? w.min ?? 0) <= -5) return { categories: INDOOR, reason: '날이 추워 실내 장소를 먼저 골랐어요' };
  if (w.sky === 'CLEAR' || w.sky === 'PARTLY') {
    return { categories: ['AT4', 'FD6', 'CE7'], reason: '날이 좋아 나들이 장소를 먼저 골랐어요' };
  }
  return { categories: DEFAULT_CATEGORIES, reason: null };
}
