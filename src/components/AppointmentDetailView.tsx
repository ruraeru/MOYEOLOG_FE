'use client';

import { 
  X, Calendar, Clock, MapPin, Trash2, Loader2, FileText, 
  MessageSquare, ChevronRight, Map as MapIcon, ExternalLink, 
  Edit2, ChevronLeft, Users, User as UserIcon
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
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

import { useAlert } from '@/hooks/useAlert';

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
  const { confirm, toast } = useAlert();
  
  const [schedule, setSchedule] = useState<ScheduleResponse | null>(initialSchedule || null);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // 장소 상세 정보 상태
  const [locationDetail, setLocationDetail] = useState<LocationDetail | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

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
                  imageUrl = `${window.location.origin}/api/proxy-image?url=${encodeURIComponent(json.imageUrl)}`;
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
      <div className={`flex items-center justify-center bg-surface ${isPage ? 'h-full flex-1' : 'p-20 rounded-2xl'}`}>
        <Loader2 size={18} strokeWidth={1.5} className="animate-spin text-ink-3" />
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className={`flex flex-col items-center justify-center bg-surface gap-3 ${isPage ? 'h-full flex-1' : 'p-20 rounded-2xl'}`}>
        <div className="size-10 rounded-full bg-raised flex items-center justify-center"><Calendar size={18} strokeWidth={1.5} className="text-ink-3" /></div>
        <p className="text-sm font-medium text-ink">일정을 찾을 수 없어요</p>
        {isPage && (
          <button onClick={() => router.back()} className="btn-secondary">
            뒤로가기
          </button>
        )}
      </div>
    );
  }

  const handleDelete = async () => {
    if (!(await confirm('이 일정을 삭제할까요?'))) return;

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
      toast.error('일정 삭제에 실패했습니다.');
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
    <div className={`flex flex-col lg:flex-row bg-surface overflow-hidden ${isPage ? 'h-full' : 'w-full h-full rounded-2xl border border-line shadow-float'}`}>
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col p-6 lg:p-8 overflow-y-auto no-scrollbar border-r border-line">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            {isPage && (
              <button
                onClick={() => router.back()}
                className="btn-ghost"
                title="뒤로가기"
              >
                <ChevronLeft size={18} strokeWidth={1.5} />
              </button>
            )}
            <h2 className="text-lg font-semibold text-ink">일정 상세</h2>
          </div>

          <div className="flex items-center gap-2">
            {session?.user?.id === schedule.authorId && (
              <>
                <button 
                  onClick={() => onEdit ? onEdit(schedule) : setIsEditModalOpen(true)}
                  className="btn-ghost text-ink-2"
                  title="일정 수정"
                >
                  <Edit2 size={18} strokeWidth={1.5} />
                </button>
                <button 
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="btn-ghost text-ink-2 hover:text-negative disabled:opacity-50"
                  title="삭제하기"
                >
                  {isDeleting ? <Loader2 size={18} strokeWidth={1.5} className="animate-spin" /> : <Trash2 size={18} strokeWidth={1.5} />}
                </button>
              </>
            )}
            {!isPage && onClose && (
              <button onClick={onClose} className="btn-ghost lg:hidden">
                <X size={18} strokeWidth={1.5} />
              </button>
            )}
          </div>
        </div>

        <div className="space-y-3 mb-8">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-raised px-2 py-0.5 text-xs text-ink-2">
              {schedule.groupId ? '모임 일정' : '개인 일정'}
            </span>
          </div>
          <h1 className="text-2xl font-semibold text-ink">
            {schedule.title}
          </h1>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
          <div className="flex items-center gap-3 card px-4 py-3">
            <Calendar size={18} strokeWidth={1.5} className="text-ink-3 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-ink-3">날짜</p>
              <p className="stamp !text-sm !text-ink truncate">
                {format(startTime, 'M.d EEE', { locale: ko })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 card px-4 py-3">
            <Clock size={18} strokeWidth={1.5} className="text-ink-3 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-ink-3">시간</p>
              <p className="stamp !text-sm !text-ink truncate">
                {format(startTime, 'HH:mm')} - {format(endTime, 'HH:mm')}
              </p>
            </div>
          </div>
        </div>

        {/* Location Detail Section */}
        {schedule.location && (
          <div className="space-y-3 mb-8">
            <h3 className="text-base font-semibold text-ink flex items-center gap-2">
              <MapPin size={16} strokeWidth={1.5} className="text-ink-3" /> 장소 정보
            </h3>
            
            {isLoadingLocation ? (
              <div className="w-full h-40 bg-raised rounded-2xl flex items-center justify-center">
                <Loader2 size={18} strokeWidth={1.5} className="text-ink-3 animate-spin" />
              </div>
            ) : locationDetail ? (
              <div className="card relative overflow-hidden">
                <div className="flex flex-col md:flex-row">
                  {locationDetail.imageUrl && (
                    <div className="relative w-full md:w-56 h-48 md:h-auto overflow-hidden bg-raised shrink-0">
                      <ImageWithFallback 
                        src={locationDetail.imageUrl} 
                        alt={schedule.location} 
                        fill
                        containerClassName="w-full h-full"
                        className="object-cover" 
                        unoptimized
                      />
                    </div>
                  )}
                  <div className="flex-1 p-5 flex flex-col justify-center">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="text-lg font-semibold text-ink">{schedule.location}</h4>
                      <a 
                        href={locationDetail.placeUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="btn-ghost text-ink-2 shrink-0"
                      >
                        <ExternalLink size={16} strokeWidth={1.5} />
                      </a>
                    </div>
                    <p className="text-sm text-ink-2 flex items-center gap-1.5 mb-3">
                      <MapIcon size={16} strokeWidth={1.5} className="text-ink-3" />
                      {locationDetail.address}
                    </p>
                    <span className="inline-block rounded-md bg-raised px-2 py-0.5 text-xs text-ink-2 self-start">
                      {locationDetail.category}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 card px-4 py-3">
                <MapPin size={18} strokeWidth={1.5} className="text-ink-3 shrink-0" />
                <div>
                  <p className="text-xs text-ink-3">장소</p>
                  <p className="text-sm font-medium text-ink">{schedule.location}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Description */}
        <div className="space-y-3 mb-8">
          <h3 className="text-base font-semibold text-ink flex items-center gap-2">
            <FileText size={16} strokeWidth={1.5} className="text-ink-3" /> 상세 설명
          </h3>
          <div className="bg-raised rounded-2xl p-5 text-sm text-ink-2 leading-relaxed min-h-[120px] whitespace-pre-wrap">
            {schedule.description || '추가된 설명이 없어요'}
          </div>
        </div>
      </div>

      {/* Sidebar Area */}
      <div className="w-full lg:w-[360px] bg-canvas p-6 overflow-y-auto no-scrollbar flex flex-col gap-6 shrink-0 relative">
        {!isPage && onClose && (
          <button
            onClick={onClose}
            className="btn-ghost absolute top-4 right-4 hidden lg:inline-flex"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        )}

        {/* Author */}
        <div className="space-y-3 pt-4 lg:pt-0">
          <h3 className="text-base font-semibold text-ink flex items-center gap-2">
            <UserIcon size={16} strokeWidth={1.5} className="text-ink-3" /> 작성자
          </h3>
          <div className="flex items-center gap-3 card px-4 py-3">
            <div className="size-8 rounded-full bg-accent-soft flex items-center justify-center text-sm font-medium text-accent">
              {schedule.authorNickname[0]}
            </div>
            <span className="text-sm font-medium text-ink">{schedule.authorNickname}</span>
          </div>
        </div>

        {/* Participants */}
        {schedule.participants && schedule.participants.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-ink flex items-center gap-2">
              <Users size={16} strokeWidth={1.5} className="text-ink-3" /> 참여자
            </h3>
            <div className="flex flex-wrap gap-2">
              {schedule.participants.map((p) => (
                <div key={p.id} className="flex items-center gap-2 pl-1.5 pr-3 py-1.5 card !rounded-full">
                  <div className="size-6 rounded-full bg-accent-soft flex items-center justify-center overflow-hidden relative shrink-0">
                    {p.profileImage ? (
                      <ImageWithFallback 
                        src={p.profileImage.startsWith('/uploads/') ? `${apiUrl}${p.profileImage}` : p.profileImage} 
                        alt={p.nickname} 
                        fill 
                        containerClassName="w-full h-full" 
                        className="object-cover" 
                        unoptimized
                      />
                    ) : (
                      <span className="text-xs text-accent">{p.nickname[0]}</span>
                    )}
                  </div>
                  <span className="text-sm text-ink">{p.nickname}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tagged Memos */}
        {schedule.taggedMemos && schedule.taggedMemos.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-ink flex items-center gap-2">
              <MessageSquare size={16} strokeWidth={1.5} className="text-ink-3" /> 연결된 메모
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {schedule.taggedMemos.map((memo) => (
                <div
                  key={memo.id}
                  onClick={() => handleMemoClick(memo.id)}
                  className="flex items-center gap-3 card px-4 py-3 hover:bg-raised transition-colors duration-150 ease-out cursor-pointer"
                >
                  <FileText size={16} strokeWidth={1.5} className="text-ink-3 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm text-ink truncate">
                      {memo.title}
                    </h4>
                  </div>
                  <ChevronRight size={16} strokeWidth={1.5} className="text-ink-3" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="mt-auto pt-6 border-t border-line flex flex-col gap-1 stamp">
          <span>ID {schedule.id.slice(0, 8)}</span>
          <span>작성 {format(parseISO(schedule.createdAt), 'M.d EEE HH:mm', { locale: ko })}</span>
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