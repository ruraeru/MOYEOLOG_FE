'use client';

import {
  X, Calendar, Clock, MapPin, Trash2, Loader2, FileText,
  ChevronRight, ExternalLink, AlignLeft,
  Pencil, ChevronLeft, Users, type LucideIcon
} from 'lucide-react';
import { EmptyState, Ribbon } from './ui';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { type ScheduleResponse, scheduleApi } from '@/lib/schedule-api';
import { useSession } from 'next-auth/react';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { groupApi } from '@/lib/group-api';
import { getApiErrorMessage } from '@/lib/axios';
import { getThemeColors, initialOf } from '@/lib/utils';
import { formatScheduleRange, formatStamp, isMultiDaySchedule, useTimeFormat } from '@/lib/schedule-utils';
import ImageWithFallback from './ImageWithFallback';
import AppointmentModal from './AppointmentModal';
import { useAlert } from '@/hooks/useAlert';

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
  const tf = useTimeFormat();
  const router = useRouter();
  const { data: session } = useSession();
  const { confirm, toast } = useAlert();
  
  const [schedule, setSchedule] = useState<ScheduleResponse | null>(initialSchedule || null);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // 장소 상세 정보 상태
  const [locationDetail, setLocationDetail] = useState<LocationDetail | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  const { data: userGroups = [] } = useQuery({
    queryKey: ['groups'],
    queryFn: () => groupApi.getAll(session!),
    enabled: !!session && !!schedule?.groupId
  });
  const scheduleGroup = schedule?.groupId ? userGroups.find((g) => g.id === schedule.groupId) : undefined;

  const loadSchedule = useCallback(async () => {
    if (!scheduleId || !session) return;
    setLoadingSchedule(true);
    setLoadError(null);
    try {
      const res = await scheduleApi.getAll(session);
      setSchedule(res.find(s => s.id === scheduleId) || null);
    } catch (e) {
      console.error(e);
      setLoadError(getApiErrorMessage(e));
    } finally {
      setLoadingSchedule(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleId, session?.user?.accessToken, reloadKey]);

  // 일정 정보 로드 (scheduleId만 주어졌을 경우)
  useEffect(() => {
    if (initialSchedule) {
      setSchedule(initialSchedule);
      return;
    }
    loadSchedule();
  }, [initialSchedule, loadSchedule]);

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

  const stateBox = `flex items-center justify-center bg-surface ${isPage ? 'h-full flex-1' : 'min-h-[320px] rounded-t-2xl md:rounded-2xl'}`;

  if (loadingSchedule) {
    return (
      <div className={stateBox}>
        <Loader2 size={18} strokeWidth={1.5} className="animate-spin text-ink-3" />
      </div>
    );
  }

  if (!schedule && loadError) {
    return (
      <div className={stateBox}>
        <EmptyState
          title="일정을 불러오지 못했어요"
          description={loadError}
          action={
            <div className="flex gap-2">
              {isPage && <button onClick={() => router.back()} className="btn-secondary">뒤로</button>}
              <button onClick={() => setReloadKey((k) => k + 1)} className="btn-primary">다시 시도</button>
            </div>
          }
        />
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className={stateBox}>
        <EmptyState
          title="일정을 찾을 수 없어요"
          description="삭제됐거나 볼 수 있는 권한이 없는 일정이에요"
          action={isPage ? <button onClick={() => router.back()} className="btn-secondary">뒤로</button> : undefined}
        />
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
      toast.error(getApiErrorMessage(error));
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
  const multiDay = isMultiDaySchedule(schedule);

  const groupLabel = schedule.groupId ? (scheduleGroup ? scheduleGroup.name : '모임 일정') : '개인 일정';
  const ribbonColor = schedule.groupId ? getThemeColors(scheduleGroup?.colorTheme).hex : 'var(--line-strong)';
  const participants = schedule.participants ?? [];
  const taggedMemos = schedule.taggedMemos ?? [];

  return (
    <div className={`flex flex-col bg-surface overflow-hidden ${isPage ? 'h-full' : 'w-full max-h-full rounded-t-2xl md:rounded-2xl'}`}>
      {/* 머리: 모임 띠 + '모임 · 일정', 주아 제목, 작성자·시각 */}
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-5 py-4 md:px-6">
        <div className="flex min-w-0 items-start gap-2">
          {isPage && (
            <button
              onClick={() => router.back()}
              className="btn-icon -ml-2 mt-0.5 shrink-0"
              title="뒤로가기"
            >
              <ChevronLeft size={18} strokeWidth={1.5} />
            </button>
          )}
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[13px] text-ink-3">
              <Ribbon color={ribbonColor} className="h-3.5" />
              <span className="truncate">{groupLabel} · 일정</span>
            </p>
            <h1 className="mt-1 font-display text-2xl leading-8 text-ink break-words">
              {schedule.title}
            </h1>
            <div className="mt-2 flex items-center gap-2 text-[13px] text-ink-2">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-raised text-[11px] text-ink-2">
                {initialOf(schedule.authorNickname)}
              </span>
              <span className="truncate">{schedule.authorNickname}</span>
              <span className="stamp">{formatStamp(schedule.createdAt, tf)}</span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {session?.user?.id === schedule.authorId && (
            <>
              <button
                onClick={() => onEdit ? onEdit(schedule) : setIsEditModalOpen(true)}
                className="btn-icon"
                title="일정 수정"
              >
                <Pencil size={16} strokeWidth={1.5} />
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="btn-icon hover:text-negative"
                title="삭제하기"
              >
                {isDeleting ? <Loader2 size={16} strokeWidth={1.5} className="animate-spin" /> : <Trash2 size={16} strokeWidth={1.5} />}
              </button>
            </>
          )}
          {!isPage && onClose && (
            <button onClick={onClose} className="btn-icon" aria-label="닫기">
              <X size={18} strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>

      {/* 본문: 아이콘 + 글자 행 */}
      <div className={`min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-6 ${isPage ? 'pb-24 lg:pb-6' : ''}`}>
        <div className={`space-y-5 ${isPage ? 'max-w-[720px]' : ''}`}>
          {/* 시간 */}
          <InfoRow icon={multiDay ? Calendar : Clock} label={multiDay ? '기간' : '시간'}>
            {multiDay ? (
              <p className="text-sm text-ink tabular-nums">{formatScheduleRange(schedule, tf)}</p>
            ) : (
              <p className="text-sm text-ink">
                {format(startTime, 'M월 d일 EEEE', { locale: ko })}
                <span className="ml-2 tabular-nums text-ink-2">
                  {format(startTime, tf, { locale: ko })} – {format(endTime, tf, { locale: ko })}
                </span>
              </p>
            )}
          </InfoRow>

          {/* 장소 */}
          {schedule.location && (
            <InfoRow icon={MapPin} label="장소">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <p className="text-sm font-medium text-ink break-words">{schedule.location}</p>
                    {isLoadingLocation && <Loader2 size={14} strokeWidth={1.5} className="shrink-0 animate-spin text-ink-3" />}
                    {locationDetail?.placeUrl && (
                      <a
                        href={locationDetail.placeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-icon size-7 shrink-0"
                        title="카카오맵에서 보기"
                      >
                        <ExternalLink size={14} strokeWidth={1.5} />
                      </a>
                    )}
                  </div>
                  {locationDetail && (
                    <>
                      <p className="mt-0.5 text-[13px] text-ink-3">{locationDetail.address}</p>
                      {locationDetail.category && <span className="chip mt-2">{locationDetail.category}</span>}
                    </>
                  )}
                </div>
                {locationDetail?.imageUrl && (
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-raised md:size-20">
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
              </div>
            </InfoRow>
          )}

          {/* 참여자 */}
          {participants.length > 0 && (
            <InfoRow icon={Users} label="참여자">
              <p className="mb-2 text-[13px] text-ink-3">참여자 {participants.length}명</p>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {participants.map((p) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <div className="relative flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-raised">
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
                        <span className="text-[11px] text-ink-2">{initialOf(p.nickname)}</span>
                      )}
                    </div>
                    <span className="text-sm text-ink">{p.nickname}</span>
                  </div>
                ))}
              </div>
            </InfoRow>
          )}

          {/* 연결된 메모 */}
          {taggedMemos.length > 0 && (
            <InfoRow icon={FileText} label="연결된 메모">
              <p className="mb-1 text-[13px] text-ink-3">연결된 메모</p>
              <div className="-mx-2">
                {taggedMemos.map((memo) => (
                  <div
                    key={memo.id}
                    onClick={() => handleMemoClick(memo.id)}
                    className="flex h-10 cursor-pointer items-center gap-2 rounded-lg px-2 transition-colors hover:bg-raised"
                  >
                    <span className="min-w-0 flex-1 truncate font-display text-[15px] text-ink">{memo.title}</span>
                    <ChevronRight size={16} strokeWidth={1.5} className="shrink-0 text-ink-3" />
                  </div>
                ))}
              </div>
            </InfoRow>
          )}

          {/* 설명 */}
          <InfoRow icon={AlignLeft} label="설명">
            {schedule.description ? (
              <p className="text-sm leading-relaxed text-ink-2 whitespace-pre-wrap break-words">{schedule.description}</p>
            ) : (
              <p className="text-sm text-ink-3">설명이 없어요</p>
            )}
          </InfoRow>
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

/** 아이콘 + 글자 행. 라벨은 화면 읽기 프로그램용 */
function InfoRow({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[16px_minmax(0,1fr)] gap-x-3">
      <Icon size={16} strokeWidth={1.5} className="mt-0.5 text-ink-3" aria-hidden />
      <div className="min-w-0">
        <span className="sr-only">{label}</span>
        {children}
      </div>
    </div>
  );
}