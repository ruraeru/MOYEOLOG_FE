'use client';

import { useEffect } from 'react';
import { type ScheduleResponse } from '@/lib/schedule-api';
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
      <div
        className="w-full max-w-5xl max-h-[92dvh] md:max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <AppointmentDetailView 
          initialSchedule={schedule}
          onClose={onClose}
          onSuccess={onSuccess}
          onEdit={onEdit}
          isPage={false}
        />
      </div>
    </div>
  );
}