import { X, Clock, MapPin, Users, Plus, ChevronRight } from 'lucide-react';
import { type ScheduleResponse } from '@/lib/schedule-api';
import { format, parseISO } from 'date-fns';

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800">일정 조회</h2>
            <p className="text-sm text-gray-500 mt-0.5">{date}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto no-scrollbar">
          {appointments.length > 0 ? (
            <div className="space-y-4">
              {appointments.map((apt) => (
                <div
                  key={apt.id}
                  onClick={() => onAppointmentClick(apt)}
                  className="group bg-white border border-gray-100 rounded-2xl p-4 hover:border-indigo-200 hover:shadow-sm transition-all cursor-pointer relative"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-1 h-10 rounded-full bg-indigo-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-800 truncate">{apt.title}</h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          {format(parseISO(apt.startTime), 'HH:mm')}
                        </div>
                        {apt.location && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                            <MapPin className="w-3.5 h-3.5 text-gray-400" />
                            {apt.location}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 text-xs text-indigo-500 font-bold uppercase tracking-wider">
                          <Users className="w-3.5 h-3.5" />
                          {apt.groupId ? 'Group' : 'Personal'}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-indigo-400 transition-colors self-center" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <Clock className="w-8 h-8 text-gray-300" />
              </div>
              <p className="text-gray-500 font-bold">등록된 일정이 없습니다.</p>
              <p className="text-xs text-gray-400 mt-1 font-medium">새로운 일정을 추가해보세요!</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={() => {
              onClose();
              onCreateNew();
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-black hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
          >
            <Plus className="w-4 h-4" />
            새 일정 추가하기
          </button>
        </div>
      </div>
    </div>
  );
}
