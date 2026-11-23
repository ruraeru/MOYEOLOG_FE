import { X, Clock, MapPin, Plus, ChevronRight } from 'lucide-react';
import { type ScheduleResponse } from '@/lib/schedule-api';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { type GroupResponse } from '@/lib/group-api';
import { formatTimeOnDay, isMultiDaySchedule, formatScheduleRange, scheduleDotClass, sortSchedules, useTimeFormat } from '@/lib/schedule-utils';

interface AppointmentListModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  appointments: ScheduleResponse[];
  onCreateNew: () => void;
  onAppointmentClick: (appointment: ScheduleResponse) => void;
  /** 모임 일정 색을 칠할 때 쓴다(없으면 중립색) */
  groups?: GroupResponse[];
}

export default function AppointmentListModal({
  isOpen,
  onClose,
  date,
  appointments,
  onCreateNew,
  onAppointmentClick,
  groups = []
}: AppointmentListModalProps) {
  const tf = useTimeFormat();
  if (!isOpen) return null;
  const day = parseISO(date);
  const sorted = sortSchedules(appointments);

  return (
    <div
      className="fixed inset-0 z-[105] flex items-end md:items-center justify-center bg-black/40 p-0 md:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl md:rounded-2xl border border-line bg-surface shadow-float overflow-hidden flex flex-col max-h-[85dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <div>
            <h2 className="text-lg font-semibold text-ink">일정 조회</h2>
            <p className="stamp mt-0.5">{format(day, 'M.d EEE', { locale: ko })}</p>
          </div>
          <button onClick={onClose} className="btn-ghost"><X size={18} strokeWidth={1.5} /></button>
        </div>

        {/* Content */}
        <div className="p-5 md:p-6 flex-1 min-h-0 overflow-y-auto no-scrollbar">
          {sorted.length > 0 ? (
            <div className="space-y-2">
              {sorted.map((apt) => (
                <div
                  key={apt.id}
                  onClick={() => onAppointmentClick(apt)}
                  className="group flex items-center gap-3 rounded-[10px] border border-line px-4 py-3 hover:bg-raised transition-colors duration-150 ease-out cursor-pointer"
                >
                  <div className={`w-0.5 h-10 rounded-full shrink-0 ${scheduleDotClass(apt, groups)}`} />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-ink truncate">{apt.title}</h3>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                      <div className="flex items-center gap-1.5">
                        <Clock size={16} strokeWidth={1.5} className="text-ink-3" />
                        <span className="stamp">{isMultiDaySchedule(apt) ? formatScheduleRange(apt, tf) : `${formatTimeOnDay(apt, day, tf)} – ${format(parseISO(apt.endTime), tf, { locale: ko })}`}</span>
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
        <div className="px-5 md:px-6 py-4 border-t border-line flex justify-end gap-2 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
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
