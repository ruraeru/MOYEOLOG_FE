'use client';

import { useSyncExternalStore } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { setPref } from '@/lib/utils';
import { SettingsGroup, SettingsRow, Segmented, usePref } from './ui';

// 미리보기 시각은 1분마다 바뀌면 충분합니다.
const subscribeMinute = (callback: () => void) => {
  const timer = setInterval(callback, 30 * 1000);
  return () => clearInterval(timer);
};
const currentMinute = () => Math.floor(Date.now() / 60000);

/** 언어 및 지역 (언어는 한국어만 제공, 시각 표시 형식은 이 기기에 저장) */
export default function LanguageSection() {
  const hour12 = usePref('hour12');
  const minute = useSyncExternalStore(subscribeMinute, currentMinute, () => 0);
  const now = minute ? new Date(minute * 60000) : null;

  return (
    <div className="space-y-6">
      <SettingsGroup title="언어">
        <SettingsRow label="표시 언어" description="지금은 한국어만 제공해요.">
          <span className="text-sm text-ink">한국어</span>
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="지역" description="이 기기의 브라우저에만 저장돼요. 일정 시각은 한국 시간 기준이에요.">
        <SettingsRow
          label="시각 표시"
          description={
            now ? (
              <span className="stamp">
                지금 {format(now, `M.d EEE ${hour12 === 'true' ? 'a h:mm' : 'HH:mm'}`, { locale: ko })}
              </span>
            ) : undefined
          }
        >
          <Segmented
            label="시각 표시"
            value={hour12}
            onChange={(next) => setPref('hour12', next)}
            options={[
              { value: 'false', label: '24시간' },
              { value: 'true', label: '12시간' },
            ]}
          />
        </SettingsRow>
      </SettingsGroup>
    </div>
  );
}
