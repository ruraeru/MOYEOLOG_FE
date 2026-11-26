'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { scheduleApi, type ScheduleResponse } from '@/lib/schedule-api';
import { useLiveTopics } from '@/lib/live';
import { useAlert } from '@/hooks/useAlert';
import AppointmentDetailView from './AppointmentDetailView';

interface AppointmentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: ScheduleResponse | null;
  onSuccess?: () => void;
  onEdit?: (schedule: ScheduleResponse) => void;
}

export default function AppointmentDetailModal({
  isOpen,
  onClose,
  schedule,
  onSuccess,
  onEdit
}: AppointmentDetailModalProps) {
  const { data: session } = useSession();
  const { toast } = useAlert();
  // 열려 있는 동안 다른 사람이 고치거나 지우면(schedules·schedule:{id} 토픽) 다시 불러와 창에 반영한다.
  // fresh 는 그 일정의 최신 값이고, 부모가 다른 일정을 넘기면 버린다
  const [fresh, setFresh] = useState<ScheduleResponse | null>(null);
  const shown = fresh && fresh.id === schedule?.id ? fresh : schedule;
  const scheduleId = isOpen ? schedule?.id : undefined;
  useLiveTopics(
    ['schedules', `schedule:${scheduleId}`],
    () => {
      if (!scheduleId) return;
      scheduleApi
        .getAll(session)
        .then((list) => {
          const found = list.find((s) => s.id === scheduleId);
          if (!found) {
            toast.info('일정이 지워졌어요');
            onClose();
            return;
          }
          setFresh((prev) => (prev && JSON.stringify(prev) === JSON.stringify(found) ? prev : found));
        })
        .catch(() => {
          // 조용한 갱신: 실패하면 보던 내용을 둔다
        });
    },
    !!scheduleId && !!session
  );

  // Esc 로 닫기 (메모·토픽 모달과 같게). 안쪽 확인창 등이 이미 처리한 Esc 는 무시한다.
  useEffect(() => {
    if (!isOpen || !schedule) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, schedule, onClose]);

  if (!isOpen || !schedule) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end md:items-center justify-center bg-black/40 p-0 md:p-4"
      onClick={onClose}
    >
      {/* Modal(ui.tsx)과 같은 모양. 안에서 수정 창(fixed)이 열리므로 transform 애니메이션은 넣지 않는다 */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={shown?.title}
        className="w-full md:max-w-[720px] max-h-[92dvh] md:max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <AppointmentDetailView 
          initialSchedule={shown}
          onClose={onClose}
          onSuccess={onSuccess}
          onEdit={onEdit}
          isPage={false}
        />
      </div>
    </div>
  );
}