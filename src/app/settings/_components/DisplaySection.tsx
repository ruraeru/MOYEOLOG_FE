'use client';

import { setPref } from '@/lib/utils';
import { SettingsGroup, SettingsRow, Segmented, usePref } from './ui';

/** 화면 설정 (이 기기에만 저장: localStorage) */
export default function DisplaySection() {
  const memoView = usePref('memoView');
  const scheduleView = usePref('scheduleView');
  const weekStartsOn = usePref('weekStartsOn');

  return (
    <div className="space-y-6">
      <SettingsGroup title="화면" description="이 기기의 브라우저에만 저장돼요">
        <SettingsRow label="메모 기본 보기" description="메모 목록을 처음 열 때의 모양">
          <Segmented
            label="메모 기본 보기"
            value={memoView}
            onChange={(next) => setPref('memoView', next)}
            options={[
              { value: 'grid', label: '카드' },
              { value: 'list', label: '목록' },
            ]}
          />
        </SettingsRow>
        <SettingsRow label="일정 기본 보기" description="일정 화면을 처음 열 때의 보기">
          <Segmented
            label="일정 기본 보기"
            value={scheduleView}
            onChange={(next) => setPref('scheduleView', next)}
            options={[
              { value: 'month', label: '월' },
              { value: 'week', label: '주' },
              { value: 'list', label: '목록' },
            ]}
          />
        </SettingsRow>
        <SettingsRow label="한 주의 시작" description="달력과 주 보기의 첫 요일">
          <Segmented
            label="한 주의 시작"
            value={weekStartsOn}
            onChange={(next) => setPref('weekStartsOn', next)}
            options={[
              { value: '0', label: '일요일' },
              { value: '1', label: '월요일' },
            ]}
          />
        </SettingsRow>
      </SettingsGroup>
    </div>
  );
}
