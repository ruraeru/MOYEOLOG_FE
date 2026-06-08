'use client';

import { X, Calendar, Clock, MapPin, Trash2, Loader2, FileText, MessageSquare, ChevronRight, Map as MapIcon, ExternalLink, Edit2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { type ScheduleResponse, scheduleApi } from '@/lib/schedule-api';
import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface AppointmentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: ScheduleResponse | null;
  onSuccess?: () => void;
  onEdit?: (schedule: ScheduleResponse) => void;
}

interface LocationDetail {
  address: string;
  category: string;
  imageUrl?: string;
  placeUrl?: string;
}

export default function AppointmentDetailModal({
  isOpen,
  onClose,
  schedule,
  onSuccess,
  onEdit
}: AppointmentDetailModalProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [isDeleting, setIsDeleting] = useState(false);
  
  // 장소 상세 정보 상태
  const [locationDetail, setLocationDetail] = useState<LocationDetail | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  // 장소 정보 로드
  useEffect(() => {
    if (isOpen && schedule?.location) {
      const fetchLocationInfo = async () => {
        setIsLoadingLocation(true);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const kakao = (window as any).kakao;
        if (kakao && kakao.maps && kakao.maps.services) {
          const ps = new kakao.maps.services.Places();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ps.keywordSearch(schedule.location, async (data: any, status: any) => {
            if (status === kakao.maps.services.Status.OK && data[0]) {
              const place = data[0];
              let imageUrl = '';
              try {
                const res = await fetch(`/api/search-image?query=${encodeURIComponent(place.place_name)}`);
                const json = await res.json();
                if (json.imageUrl) {
                  // 프록시 서버 경유하여 403 Forbidden 방지
                  imageUrl = `/api/proxy-image?url=${encodeURIComponent(json.imageUrl)}`;
                } else {
                  imageUrl = 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400&h=300&fit=crop';
                }
              } catch (err) {
                console.error('Failed to fetch place image:', err);
                imageUrl = 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400&h=300&fit=crop';
              }
              
              setLocationDetail({
                address: place.road_address_name || place.address_name,
                category: place.category_group_name || place.category_name,
                placeUrl: `https://map.kakao.com/link/map/${place.id}`,
                imageUrl: imageUrl
              });
            } else {
              setLocationDetail(null);
            }
            setIsLoadingLocation(false);
          });
        } else {
          setIsLoadingLocation(false);
        }
      };
      fetchLocationInfo();
    } else {
      setLocationDetail(null);
    }
  }, [isOpen, schedule?.location]);

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

  const handleMemoClick = (id: string) => {
    router.push(`/memo/${id}`);
    onClose();
  };

  const startTime = parseISO(schedule.startTime);
  const endTime = parseISO(schedule.endTime);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-8 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
              <Calendar className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-black text-gray-900 tracking-tight">일정 상세 정보</h2>
          </div>
          <div className="flex items-center gap-2">
            {session?.user?.id === schedule.authorId && (
              <>
                <button 
                  onClick={() => onEdit?.(schedule)}
                  className="p-2 hover:bg-indigo-50 rounded-full transition-colors text-gray-400 hover:text-indigo-500"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
                <button 
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="p-2 hover:bg-red-50 rounded-full transition-colors text-gray-400 hover:text-red-500 disabled:opacity-50"
                >
                  {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                </button>
              </>
            )}
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto no-scrollbar space-y-10">
          {/* Title Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="px-4 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100">
                {schedule.groupId ? 'Group Event' : 'Personal'}
              </span>
              {schedule.groupId && (
                <span className="px-4 py-1.5 bg-amber-50 text-amber-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-100">
                  모임 일정
                </span>
              )}
            </div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tighter leading-[1.1]">
              {schedule.title}
            </h1>
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-4 bg-gray-50/50 rounded-3xl p-6 border border-gray-100/50">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-indigo-500 border border-indigo-50 shrink-0">
                <Calendar className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-wider mb-0.5">날짜</p>
                <p className="text-sm font-black text-gray-800 truncate">
                  {format(startTime, 'yyyy. MM. dd')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-gray-50/50 rounded-3xl p-6 border border-gray-100/50">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-emerald-500 border border-emerald-50 shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-wider mb-0.5">시간</p>
                <p className="text-sm font-black text-gray-800 truncate">
                  {format(startTime, 'HH:mm')} - {format(endTime, 'HH:mm')}
                </p>
              </div>
            </div>
          </div>

          {/* Location Detail Section */}
          {schedule.location && (
            <div className="space-y-4">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <MapPin className="w-4 h-4 text-rose-500" /> 장소 정보
              </h3>
              
              {isLoadingLocation ? (
                <div className="w-full h-40 bg-gray-50 rounded-[2rem] border border-dashed border-gray-200 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                </div>
              ) : locationDetail ? (
                <div className="group relative overflow-hidden bg-white border border-gray-100 rounded-[2rem] shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-500">
                  <div className="flex flex-col md:flex-row">
                    {locationDetail.imageUrl && (
                      <div className="relative w-full md:w-48 h-40 md:h-auto overflow-hidden bg-gray-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={locationDetail.imageUrl} 
                          alt={schedule.location} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}
                    <div className="flex-1 p-6 flex flex-col justify-center">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="text-lg font-black text-gray-900 leading-tight">{schedule.location}</h4>
                        <a 
                          href={locationDetail.placeUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                      <p className="text-sm font-bold text-gray-500 flex items-center gap-1.5 mb-3">
                        <MapIcon className="w-3.5 h-3.5" />
                        {locationDetail.address}
                      </p>
                      <span className="inline-block px-3 py-1 bg-gray-50 text-gray-400 rounded-lg text-[10px] font-black uppercase self-start border border-gray-100">
                        {locationDetail.category}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4 bg-gray-50/50 rounded-3xl p-6 border border-gray-100/50">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-rose-500 border border-rose-50 shrink-0">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-wider mb-0.5">장소</p>
                    <p className="text-sm font-black text-gray-800">{schedule.location}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Author & Participants Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">작성자</h3>
              <div className="flex items-center gap-3 p-4 bg-white border border-gray-100 rounded-3xl shadow-sm">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center text-sm font-black text-indigo-600 border border-indigo-200 shadow-inner">
                  {schedule.authorNickname[0]}
                </div>
                <span className="text-sm font-black text-gray-700">{schedule.authorNickname}</span>
              </div>
            </div>

            {schedule.participants && schedule.participants.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">참여자</h3>
                <div className="flex flex-wrap gap-2">
                  {schedule.participants.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 pl-2 pr-3 py-2 bg-white border border-gray-100 rounded-2xl shadow-sm hover:border-indigo-200 transition-colors">
                      <div className="w-7 h-7 rounded-xl bg-indigo-50 flex items-center justify-center overflow-hidden border border-indigo-100 shrink-0">
                        {p.profileImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.profileImage} alt={p.nickname} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[10px] font-black text-indigo-500">{p.nickname[0]}</span>
                        )}
                      </div>
                      <span className="text-xs font-bold text-gray-700">{p.nickname}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-400" /> 상세 메모
            </h3>
            <div className="bg-gray-50/50 border-2 border-transparent rounded-[2rem] p-7 text-sm text-gray-600 leading-relaxed font-medium min-h-[100px] hover:bg-white hover:border-gray-100 transition-all duration-300">
              {schedule.description || '추가된 설명이 없습니다.'}
            </div>
          </div>

          {/* Tagged Memos */}
          {schedule.taggedMemos && schedule.taggedMemos.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-500" /> 연결된 메모
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {schedule.taggedMemos.map((memo) => (
                  <div
                    key={memo.id}
                    onClick={() => handleMemoClick(memo.id)}
                    className="flex items-center gap-4 p-5 bg-white border border-gray-100 rounded-[1.5rem] hover:border-indigo-200 hover:shadow-xl transition-all duration-300 cursor-pointer group"
                  >
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500 shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 shadow-sm">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-black text-gray-800 truncate group-hover:text-indigo-600 transition-colors">
                        {memo.title}
                      </h4>
                      <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-0.5">상세 내용 보기</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="pt-8 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400 font-black uppercase tracking-widest px-2">
            <span className="opacity-50">ID: {schedule.id.slice(0, 8)}</span>
            <span>Created at: {format(parseISO(schedule.createdAt), 'yyyy. MM. dd. HH:mm')}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-gray-100 shrink-0 bg-gray-50/30">
          <button
            onClick={onClose}
            className="w-full px-4 py-5 bg-indigo-600 text-white rounded-2xl text-sm font-black hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95 flex items-center justify-center gap-2 uppercase tracking-widest"
          >
            Confirm & Close
          </button>
        </div>
      </div>
    </div>
  );
}