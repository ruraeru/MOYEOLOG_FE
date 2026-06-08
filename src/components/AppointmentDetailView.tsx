'use client';

import { 
  X, Calendar, Clock, MapPin, Trash2, Loader2, FileText, 
  MessageSquare, ChevronRight, Map as MapIcon, ExternalLink, 
  Edit2, ChevronLeft, Users, User as UserIcon
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { type ScheduleResponse, scheduleApi } from '@/lib/schedule-api';
import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ImageWithFallback from './ImageWithFallback';
import AppointmentModal from './AppointmentModal';

interface LocationDetail {
  address: string;
  category: string;
  imageUrl?: string;
  placeUrl?: string;
}

interface AppointmentDetailViewProps {
  scheduleId?: string;
  initialSchedule?: ScheduleResponse | null;
  onClose?: () => void;
  onSuccess?: () => void;
  onEdit?: (schedule: ScheduleResponse) => void;
  isPage?: boolean;
}

export default function AppointmentDetailView({
  scheduleId,
  initialSchedule,
  onClose,
  onSuccess,
  onEdit,
  isPage = false
}: AppointmentDetailViewProps) {
  const router = useRouter();
  const { data: session } = useSession();
  
  const [schedule, setSchedule] = useState<ScheduleResponse | null>(initialSchedule || null);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // 장소 상세 정보 상태
  const [locationDetail, setLocationDetail] = useState<LocationDetail | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  // 일정 정보 로드 (scheduleId만 주어졌을 경우)
  useEffect(() => {
    if (initialSchedule) {
      setSchedule(initialSchedule);
      return;
    }
    
    if (scheduleId && session) {
      const fetchSchedule = async () => {
        setLoadingSchedule(true);
        try {
          const res = await scheduleApi.getAll(session);
          const found = res.find(s => s.id === scheduleId);
          if (found) {
            setSchedule(found);
          } else {
            console.warn("해당 일정을 찾을 수 없습니다.");
          }
        } catch (e) {
          console.error(e);
        } finally {
          setLoadingSchedule(false);
        }
      };
      fetchSchedule();
    }
  }, [scheduleId, initialSchedule, session]);

  // 장소 정보 카카오 API 로드
  useEffect(() => {
    if (schedule?.location) {
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
  }, [schedule?.location]);

  if (loadingSchedule) {
    return (
      <div className={`flex items-center justify-center bg-white ${isPage ? 'h-full flex-1' : 'p-20 rounded-[2.5rem]'}`}>
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className={`flex flex-col items-center justify-center bg-white gap-4 ${isPage ? 'h-full flex-1' : 'p-20 rounded-[2.5rem]'}`}>
        <Calendar className="w-10 h-10 text-gray-200" />
        <p className="text-gray-400 font-medium">일정을 찾을 수 없습니다.</p>
        {isPage && (
          <button onClick={() => router.back()} className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-100 transition-colors">
            뒤로가기
          </button>
        )}
      </div>
    );
  }

  const handleDelete = async () => {
    if (!confirm('정말로 이 일정을 삭제하시겠습니까?')) return;

    setIsDeleting(true);
    try {
      await scheduleApi.delete(schedule.id, session);
      onSuccess?.();
      if (isPage) {
        router.back();
      } else {
        onClose?.();
      }
    } catch (error) {
      console.error('Failed to delete schedule:', error);
      alert('일정 삭제에 실패했습니다.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMemoClick = (id: string) => {
    if (!isPage && onClose) onClose();
    router.push(`/memo/${id}`);
  };

  const startTime = parseISO(schedule.startTime);
  const endTime = parseISO(schedule.endTime);

  return (
    <div className={`flex flex-col lg:flex-row bg-white overflow-hidden ${isPage ? 'h-full' : 'w-full h-full rounded-[2.5rem]'}`}>
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col p-6 lg:p-10 overflow-y-auto no-scrollbar border-r border-gray-100">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            {isPage && (
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 mr-2"
                title="뒤로가기"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
              <Calendar className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-black text-gray-900 tracking-tight">일정 상세 정보</h2>
          </div>

          <div className="flex items-center gap-2">
            {session?.user?.id === schedule.authorId && (
              <>
                <button 
                  onClick={() => onEdit ? onEdit(schedule) : setIsEditModalOpen(true)}
                  className="p-2 hover:bg-indigo-50 rounded-full transition-colors text-gray-400 hover:text-indigo-500"
                  title="일정 수정"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
                <button 
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="p-2 hover:bg-red-50 rounded-full transition-colors text-gray-400 hover:text-red-500 disabled:opacity-50"
                  title="삭제하기"
                >
                  {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                </button>
              </>
            )}
            {!isPage && onClose && (
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 lg:hidden ml-2">
                <X className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4 mb-10">
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
          <h1 className="text-3xl lg:text-4xl font-black text-gray-900 tracking-tighter leading-[1.2]">
            {schedule.title}
          </h1>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
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
          <div className="space-y-4 mb-10">
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
                    <div className="relative w-full md:w-56 h-48 md:h-auto overflow-hidden bg-gray-50 shrink-0">
                      <ImageWithFallback 
                        src={locationDetail.imageUrl} 
                        alt={schedule.location} 
                        fill
                        containerClassName="w-full h-full"
                        className="object-cover group-hover:scale-110 transition-transform duration-700" 
                      />
                    </div>
                  )}
                  <div className="flex-1 p-6 flex flex-col justify-center">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="text-xl font-black text-gray-900 leading-tight">{schedule.location}</h4>
                      <a 
                        href={locationDetail.placeUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm shrink-0"
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

        {/* Description */}
        <div className="space-y-4 mb-8">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400" /> 상세 설명
          </h3>
          <div className="bg-gray-50/50 border-2 border-transparent rounded-[2rem] p-7 text-sm text-gray-600 leading-relaxed font-medium min-h-[120px] hover:bg-white hover:border-gray-100 transition-all duration-300 whitespace-pre-wrap">
            {schedule.description || '추가된 설명이 없습니다.'}
          </div>
        </div>
      </div>

      {/* Sidebar Area */}
      <div className="w-full lg:w-[360px] bg-gray-50/50 p-6 lg:p-8 overflow-y-auto no-scrollbar flex flex-col gap-8 shrink-0 relative border-l border-gray-100/50">
        {!isPage && onClose && (
          <button
            onClick={onClose}
            className="absolute top-8 right-8 p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hidden lg:block"
          >
            <X className="w-6 h-6" />
          </button>
        )}

        {/* Author */}
        <div className="space-y-4 pt-4 lg:pt-0">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <UserIcon className="w-4 h-4 text-blue-500" /> 작성자
          </h3>
          <div className="flex items-center gap-3 p-4 bg-white border border-gray-100 rounded-3xl shadow-sm">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center text-sm font-black text-indigo-600 border border-indigo-200 shadow-inner">
              {schedule.authorNickname[0]}
            </div>
            <span className="text-sm font-black text-gray-700">{schedule.authorNickname}</span>
          </div>
        </div>

        {/* Participants */}
        {schedule.participants && schedule.participants.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" /> 참여자
            </h3>
            <div className="flex flex-wrap gap-2">
              {schedule.participants.map((p) => (
                <div key={p.id} className="flex items-center gap-2 pl-2 pr-3 py-2 bg-white border border-gray-100 rounded-2xl shadow-sm hover:border-indigo-200 transition-colors cursor-default">
                  <div className="w-7 h-7 rounded-xl bg-indigo-50 flex items-center justify-center overflow-hidden border border-indigo-100 shrink-0">
                    {p.profileImage ? (
                      <ImageWithFallback src={p.profileImage} alt={p.nickname} fill containerClassName="w-full h-full" className="object-cover" />
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
                  className="flex items-center gap-4 p-4 bg-white border border-gray-100 rounded-2xl hover:border-indigo-200 hover:shadow-md transition-all duration-300 cursor-pointer group"
                >
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500 shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 shadow-sm">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-gray-800 text-sm truncate group-hover:text-indigo-600 transition-colors">
                      {memo.title}
                    </h4>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 transition-all" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="mt-auto pt-8 border-t border-gray-100 flex flex-col gap-1 text-[10px] text-gray-400 font-black uppercase tracking-widest">
          <span>ID: {schedule.id.slice(0, 8)}</span>
          <span>Created: {format(parseISO(schedule.createdAt), 'yyyy. MM. dd. HH:mm')}</span>
        </div>
      </div>

      <AppointmentModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        initialSchedule={schedule} 
        onSuccess={() => {
          setIsEditModalOpen(false);
          onSuccess?.();
          // 페이지 모드라면 서버 액션 또는 강제 새로고침 (또는 상태 업데이트 로직 추가 필요)
          if (isPage) {
            window.location.reload();
          }
        }} 
      />
    </div>
  );
}