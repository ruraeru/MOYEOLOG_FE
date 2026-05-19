import { X, Calendar, Clock, MapPin, Trash2, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { type ScheduleResponse, scheduleApi } from '@/lib/schedule-api';
import { useSession } from 'next-auth/react';
import { useState } from 'react';

interface AppointmentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: ScheduleResponse | null;
  onSuccess?: () => void;
}

export default function AppointmentDetailModal({
  isOpen,
  onClose,
  schedule,
  onSuccess
}: AppointmentDetailModalProps) {
  const { data: session } = useSession();
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !schedule) return null;

  const handleDelete = async () => {
    if (!confirm('정말로 이 일정을 삭제하시겠습니까?')) return;

    setIsDeleting(true);
    try {
      await scheduleApi.delete(schedule.id, session);
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Failed to delete schedule:', error);
      alert('일정 삭제에 실패했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  const startTime = parseISO(schedule.startTime);
  const endTime = parseISO(schedule.endTime);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h2 className="text-xl font-bold text-gray-800">일정 상세 정보</h2>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-2 hover:bg-red-50 rounded-full transition-colors text-gray-400 hover:text-red-500 disabled:opacity-50"
            >
              {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto no-scrollbar space-y-8">
          {/* Title Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-widest">
                {schedule.groupId ? 'Group Schedule' : 'Personal'}
              </span>
            </div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight leading-tight">
              {schedule.title}
            </h1>
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-1 gap-4">
            <div className="flex items-center gap-4 bg-gray-50/50 rounded-2xl p-5 border border-gray-100/50">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-indigo-500 border border-indigo-50">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-wider mb-0.5">날짜</p>
                <p className="text-base font-bold text-gray-800">
                  {format(startTime, 'yyyy년 M월 d일 (EEEE)', { locale: ko })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-gray-50/50 rounded-2xl p-5 border border-gray-100/50">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-emerald-500 border border-emerald-50">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-wider mb-0.5">시간</p>
                <p className="text-base font-bold text-gray-800">
                  {format(startTime, 'HH:mm')} ~ {format(endTime, 'HH:mm')}
                </p>
              </div>
            </div>

            {schedule.location && (
              <div className="flex items-center gap-4 bg-gray-50/50 rounded-2xl p-5 border border-gray-100/50">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-rose-500 border border-rose-50">
                  <MapPin className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-black uppercase tracking-wider mb-0.5">장소</p>
                  <p className="text-base font-bold text-gray-800">{schedule.location}</p>
                </div>
              </div>
            )}
          </div>

          {/* Author */}
          <div className="space-y-3">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">작성자</h3>
            <div className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-100 rounded-2xl shadow-sm">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-black text-indigo-600 border border-indigo-200">
                {schedule.authorNickname[0]}
              </div>
              <span className="text-sm font-bold text-gray-700">{schedule.authorNickname}</span>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-3">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">설명 및 메모</h3>
            <div className="bg-gray-50/50 border border-dashed border-gray-200 rounded-2xl p-5 text-sm text-gray-600 leading-relaxed font-medium">
              {schedule.description || '추가된 설명이 없습니다.'}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 shrink-0 bg-white">
          <button
            onClick={onClose}
            className="w-full px-4 py-4 bg-indigo-600 text-white rounded-2xl text-sm font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
