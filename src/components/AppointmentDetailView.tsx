'use client';

import {
  X, Calendar, Clock, MapPin, Trash2, Loader2, FileText,
  ChevronRight, ExternalLink, AlignLeft,
  Pencil, ChevronLeft, Users, TrainFront, type LucideIcon
} from 'lucide-react';
import { EmptyState, Ribbon } from './ui';
import { GroupAvatar } from './groups/GroupIdentity';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { type ScheduleResponse, scheduleApi } from '@/lib/schedule-api';
import { useSession } from 'next-auth/react';
import { useState, useEffect, useCallback, isValidElement } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { groupApi } from '@/lib/group-api';
import { getApiErrorMessage } from '@/lib/axios';
import { getThemeColors, initialOf } from '@/lib/utils';
import { formatScheduleRange, formatStamp, isMultiDaySchedule, useTimeFormat } from '@/lib/schedule-utils';
import ImageWithFallback from './ImageWithFallback';
import AppointmentModal from './AppointmentModal';
import MidpointSection from './MidpointSection';
import { useAlert } from '@/hooks/useAlert';
import { usePlaceWeather } from '@/hooks/useWeather';
import { weatherAt, weatherText } from '@/lib/weather';
import { WeatherIcon } from './Weather';
import { loadKakaoServices } from '@/lib/kakao';

interface LocationDetail {
  address: string;
  category: string;
  imageUrl?: string;
  placeUrl?: string;
  lat?: number;
  lng?: number;
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
      let cancelled = false;
      const fetchLocationInfo = async () => {
        setIsLoadingLocation(true);
        // SDK 는 autoload=false 라 load() 를 거쳐야 services 가 생긴다(바로 연 페이지·모달에서 주소가 빠지던 문제)
        const kakao = await loadKakaoServices();
        if (cancelled) return;
        if (kakao) {
          const ps = new kakao.maps.services.Places();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ps.keywordSearch(schedule.location, async (data: any, status: any) => {
            if (cancelled) return;
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
              if (cancelled) return;

              setLocationDetail({
                address: place.road_address_name || place.address_name,
                category: place.category_group_name || place.category_name,
                placeUrl: `https://map.kakao.com/link/map/${place.id}`,
                imageUrl: imageUrl,
                lat: parseFloat(place.y),
                lng: parseFloat(place.x)
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
      return () => {
        cancelled = true;
      };
    } else {
      setLocationDetail(null);
    }
  }, [schedule?.location]);

  // 일정 시작 시각의 약속 장소 날씨. 좌표가 저장되지 않은 예전 일정은 장소 검색 결과의 좌표를 쓴다.
  const { data: forecast } = usePlaceWeather(
    schedule?.latitude ?? locationDetail?.lat,
    schedule?.longitude ?? locationDetail?.lng
  );
  const weather = forecast && schedule ? weatherAt(forecast, schedule.startTime) : null;

  // 바로 연 페이지(새 탭·알림·공유 링크)는 앱 안의 이전 화면이 없으니 일정 목록으로 간다
  const goBack = () => {
    const fromApp = window.history.length > 1 && document.referrer.startsWith(window.location.origin);
    if (fromApp) router.back();
    else router.push('/schedule');
  };

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
              {isPage && <button onClick={goBack} className="btn-secondary">뒤로</button>}
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
          description="주소가 잘못됐거나 삭제된 일정이에요."
          action={isPage ? <Link href="/schedule" className="btn-secondary">일정 목록으로</Link> : undefined}
        />
      </div>
    );
  }

  const handleDelete = async () => {
    if (!(await confirm('이 일정을 삭제할까요?', undefined, '삭제', '취소'))) return;

    setIsDeleting(true);
    try {
      await scheduleApi.delete(schedule.id, session);
      toast.success('일정을 삭제했어요.');
      onSuccess?.();
      if (isPage) {
        goBack();
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
  // 끝난 일정은 중간 지점을 읽기 전용으로 (달력의 '출발지 미입력' 표시도 끝난 일정은 뺀다)
  const ended = endTime.getTime() < Date.now();

  const groupLabel = schedule.groupId ? (scheduleGroup ? scheduleGroup.name : '모임 일정') : '개인 일정';
  const ribbonColor = schedule.groupId ? getThemeColors(scheduleGroup?.colorTheme).hex : 'var(--line-strong)';
  const participants = schedule.participants ?? [];
  const taggedMemos = schedule.taggedMemos ?? [];

  return (
    <div className={`flex flex-col bg-surface overflow-hidden ${isPage ? 'h-full' : 'w-full max-h-full rounded-t-2xl md:rounded-2xl'}`}>
      {/* 머리: 모임 띠 + '모임 · 일정', 주아 제목, 작성자·시각 */}
      <div className="shrink-0 border-b border-line px-5 py-4 md:px-6">
      {/* 페이지에서는 머리도 본문과 같은 720px 폭에 맞춰 수정·삭제가 본문 오른쪽 끝에 붙게 */}
      <div className={`flex items-start justify-between gap-3 ${isPage ? 'max-w-[720px]' : ''}`}>
        <div className="flex min-w-0 items-start gap-2">
          {isPage && (
            <button
              onClick={goBack}
              className="btn-icon relative -ml-2 mt-0.5 shrink-0 after:absolute after:-inset-1.5"
              title="뒤로가기"
              aria-label="뒤로가기"
            >
              <ChevronLeft size={18} strokeWidth={1.5} />
            </button>
          )}
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[13px] text-ink-3">
              {scheduleGroup ? (
                <GroupAvatar name={scheduleGroup.name} src={scheduleGroup.profileImage} theme={scheduleGroup.colorTheme} size="xs" />
              ) : (
                <Ribbon color={ribbonColor} className="h-3.5" />
              )}
              {/* '개인 일정 · 일정' 처럼 '일정' 이 겹치지 않게: 모임 이름일 때만 ' · 일정' 을 붙인다 */}
              <span className="truncate">{scheduleGroup ? `${groupLabel} · 일정` : groupLabel}</span>
            </p>
            <h1 className="mt-1 font-display text-2xl leading-8 text-ink break-keep break-words">
              {schedule.title}
            </h1>
            <div className="mt-2 flex items-center gap-2 text-[13px] text-ink-2">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-raised text-[11px] text-ink-2">
                {initialOf(schedule.authorNickname)}
              </span>
              <span className="truncate">{schedule.authorNickname}</span>
              <span className="shrink-0 whitespace-nowrap text-ink-3">작성 <span className="stamp">{formatStamp(schedule.createdAt, tf)}</span></span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {session?.user?.id === schedule.authorId && (
            <>
              <button
                onClick={() => onEdit ? onEdit(schedule) : setIsEditModalOpen(true)}
                className="btn-icon relative after:absolute after:-inset-1.5"
                title="일정 수정"
                aria-label="일정 수정"
              >
                <Pencil size={16} strokeWidth={1.5} />
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="btn-icon relative hover:text-negative after:absolute after:-inset-1.5"
                title="삭제하기"
                aria-label="삭제하기"
              >
                {isDeleting ? <Loader2 size={16} strokeWidth={1.5} className="animate-spin" /> : <Trash2 size={16} strokeWidth={1.5} />}
              </button>
            </>
          )}
          {!isPage && onClose && (
            <button onClick={onClose} className="btn-icon relative after:absolute after:-inset-1.5" aria-label="닫기">
              <X size={18} strokeWidth={1.5} />
            </button>
          )}
        </div>
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
                    <p className="text-sm font-medium text-ink break-keep break-words">{schedule.location}</p>
                    {isLoadingLocation && <Loader2 size={14} strokeWidth={1.5} className="shrink-0 animate-spin text-ink-3" />}
                    {locationDetail?.placeUrl && (
                      <a
                        href={locationDetail.placeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-icon relative shrink-0 after:absolute after:-inset-1.5"
                        title="카카오맵에서 보기"
                        aria-label="카카오맵에서 보기"
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

          {/* 날씨: 약속 장소의 예보(10일 안) */}
          {/* 행 아이콘 자리에 날씨 아이콘 하나만 둔다 */}
          {weather && (
            <InfoRow icon={<WeatherIcon weather={weather} className="mt-0.5" />} label="날씨">
              <p className="text-sm text-ink tabular-nums">{weatherText(weather)}</p>
              <p className="mt-0.5 text-[13px] text-ink-3">일정 시작 시각 기준 · 기상청 예보</p>
            </InfoRow>
          )}

          {/* 참여자 */}
          {participants.length > 0 && (
            <InfoRow icon={Users} label="참여자">
              <p className="mb-2 text-[13px] text-ink-3">참여자 {participants.length}명 · 만든 사람까지 {participants.length + 1}명</p>
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

          {/* 중간 지점: 여럿이 만나는 일정에서만. 대상이 한 명뿐이면 MidpointSection 이 행째로 숨긴다 */}
          {(schedule.groupId || participants.length > 0) && (
            <MidpointSection
              scheduleId={schedule.id}
              startTime={schedule.startTime}
              place={{ name: schedule.location, latitude: schedule.latitude, longitude: schedule.longitude }}
              onLocationChange={(place) => {
                setSchedule((prev) => (prev ? { ...prev, location: place.name, latitude: place.latitude, longitude: place.longitude } : prev));
                onSuccess?.();
              }}
              onDepartureChange={() => onSuccess?.()}
              readOnly={ended}
              audience={schedule.groupId ? '모임 멤버' : '만든 사람과 참여자'}
              wrap={(content) => <InfoRow icon={TrainFront} label="중간 지점">{content}</InfoRow>}
            />
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
function InfoRow({ icon: Icon, label, children }: { icon: LucideIcon | React.ReactElement; label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[16px_minmax(0,1fr)] gap-x-3">
      {isValidElement(Icon) ? Icon : <Icon size={16} strokeWidth={1.5} className="mt-0.5 text-ink-3" aria-hidden />}
      <div className="min-w-0">
        <span className="sr-only">{label}</span>
        {children}
      </div>
    </div>
  );
}