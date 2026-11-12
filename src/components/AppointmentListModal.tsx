import { X, Clock, MapPin, Plus, ChevronRight } from 'lucide-react';
import { type ScheduleResponse } from '@/lib/schedule-api';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';

interface AppointmentListModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  appointments: ScheduleResponse[];
  onCreateNew: () => void;
  onAppointmentClick: (appointment: ScheduleResponse) => void;
}

export default function AppointmentListModal({
  isOpen,
  onClose,
  date,
  appointments,
  onCreateNew,
  onAppointmentClick
}: AppointmentListModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-line bg-surface shadow-float overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <div>
            <h2 className="text-lg font-semibold text-ink">일정 조회</h2>
            <p className="stamp mt-0.5">{format(parseISO(date), 'M.d EEE', { locale: ko })}</p>
          </div>
          <button onClick={onClose} className="btn-ghost"><X size={18} strokeWidth={1.5} /></button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto no-scrollbar">
          {appointments.length > 0 ? (
            <div className="space-y-2">
              {appointments.map((apt) => (
                <div
                  key={apt.id}
                  onClick={() => onAppointmentClick(apt)}
                  className="group flex items-center gap-3 rounded-[10px] border border-line px-4 py-3 hover:bg-raised transition-colors duration-150 ease-out cursor-pointer"
                >
                  <div className="w-0.5 h-10 rounded-full bg-accent shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-ink truncate">{apt.title}</h3>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                      <div className="flex items-center gap-1.5">
                        <Clock size={16} strokeWidth={1.5} className="text-ink-3" />
                        <span className="stamp">{format(parseISO(apt.startTime), 'HH:mm')}</span>
                      </div>
                      {apt.location && (
                        <div className="flex items-center gap-1.5 text-xs text-ink-2 min-w-0">
                          <MapPin size={16} strokeWidth={1.5} className="text-ink-3 shrink-0" />
                          <span className="truncate">{apt.location}</span>
                        </div>
                      )}
                      <span className="rounded-md bg-raised px-2 py-0.5 text-xs text-ink-2">
                        {apt.groupId ? '모임' : '개인'}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={16} strokeWidth={1.5} className="text-ink-3 shrink-0" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="size-10 rounded-full bg-raised flex items-center justify-center mb-3">
                <Clock size={18} strokeWidth={1.5} className="text-ink-3" />
              </div>
              <p className="text-sm font-medium text-ink">등록된 일정이 없어요</p>
              <p className="text-sm text-ink-3 mt-1">새 일정을 추가하면 여기에 모여요</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-line flex justify-end gap-2">
          <button
            onClick={() => {
              onClose();
              onCreateNew();
            }}
            className="btn-primary"
          >
            <Plus size={16} strokeWidth={1.5} />
            새 일정 추가
          </button>
        </div>
      </div>
    </div>
  );
}
