'use client';

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
  if (!isOpen || !schedule) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[90vh] flex flex-col"
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