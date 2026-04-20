'use client';

import { X, Calendar, Clock, MapPin, Users, Tag, FileText, Edit2, Trash2 } from 'lucide-react';

interface Appointment {
  id: number;
  date: string;
  title: string;
  time: string;
  location: string;
  participants: string[];
  color: string;
  memo?: string;
  tags?: string[];
  group?: string;
}

interface AppointmentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  onEdit?: (appointment: Appointment) => void;
  onDelete?: (id: number) => void;
}

export default function AppointmentDetailModal({
  isOpen,
  onClose,
  appointment,
  onEdit,
  onDelete
}: AppointmentDetailModalProps) {
  if (!isOpen || !appointment) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${appointment.color}`} />
            <h2 className="text-xl font-bold text-gray-800">일정 상세</h2>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => onEdit?.(appointment)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-indigo-600"
            >
              <Edit2 className="w-5 h-5" />
            </button>
            <button 
              onClick={() => onDelete?.(appointment.id)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-red-500"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto no-scrollbar space-y-6">
          {/* Title */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{appointment.title}</h1>
            {appointment.group && (
              <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold">
                <Users className="w-3.5 h-3.5" />
                {appointment.group}
              </div>
            )}
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-1 gap-4 bg-gray-50 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-gray-400">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase">날짜</p>
                <p className="text-sm font-semibold text-gray-700">{appointment.date}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-gray-400">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase">시간</p>
                <p className="text-sm font-semibold text-gray-700">{appointment.time}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-gray-400">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-bold uppercase">장소</p>
                <p className="text-sm font-semibold text-gray-700">{appointment.location}</p>
              </div>
            </div>
          </div>

          {/* Participants */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-400" />
              참여자 ({appointment.participants.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {appointment.participants.map((p, idx) => (
                <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-100 rounded-full shadow-sm">
                  <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600">
                    {p[0]}
                  </div>
                  <span className="text-xs font-medium text-gray-700">{p}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tags */}
          {appointment.tags && appointment.tags.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <Tag className="w-4 h-4 text-gray-400" />
                태그
              </h3>
              <div className="flex flex-wrap gap-2">
                {appointment.tags.map((tag, idx) => (
                  <span key={idx} className="text-xs font-bold text-indigo-500 bg-indigo-50 px-2.5 py-1 rounded-lg">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Memo */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-400" />
              기타 사항
            </h3>
            <div className="bg-gray-50 rounded-2xl p-4 text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
              {appointment.memo || '추가된 메모가 없습니다.'}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 transition-colors shadow-lg shadow-gray-200"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
