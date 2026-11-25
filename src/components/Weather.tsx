import { Cloud, CloudHail, CloudRain, CloudSnow, CloudSun, Sun, type LucideIcon } from 'lucide-react';
import { weatherText, type Sky, type WeatherAt } from '@/lib/weather';

const ICONS: Record<Sky, LucideIcon> = {
  CLEAR: Sun,
  PARTLY: CloudSun,
  CLOUDY: Cloud,
  RAIN: CloudRain,
  SLEET: CloudHail,
  SNOW: CloudSnow,
};

/** 아이콘 색(globals.css 의 --wx-*). 글자에는 쓰지 않는다. */
const COLORS: Record<Sky, string> = {
  CLEAR: 'text-wx-sun',
  PARTLY: 'text-wx-sun',
  CLOUDY: 'text-ink-3',
  RAIN: 'text-wx-rain',
  SLEET: 'text-wx-rain',
  SNOW: 'text-wx-snow',
};

/** 날씨 아이콘 하나. 설명은 title·aria-label 로 준다. */
export function WeatherIcon({ weather, size = 14, className = '' }: { weather: WeatherAt; size?: number; className?: string }) {
  const Icon = ICONS[weather.sky];
  const text = weatherText(weather);
  return (
    <span role="img" aria-label={`날씨 ${text}`} title={text} className={`inline-flex shrink-0 ${COLORS[weather.sky]} ${className}`}>
      <Icon size={size} strokeWidth={1.5} aria-hidden />
    </span>
  );
}

/** 아이콘 + '비 8° · 강수 70%'. */
export function WeatherLine({ weather, className = '' }: { weather: WeatherAt; className?: string }) {
  const Icon = ICONS[weather.sky];
  return (
    <span className={`inline-flex items-center gap-1.5 tabular-nums ${className}`}>
      <Icon size={14} strokeWidth={1.5} aria-hidden className={`shrink-0 ${COLORS[weather.sky]}`} />
      {weatherText(weather)}
    </span>
  );
}
