'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Loader2, Search, X } from 'lucide-react';
import { midpointApi, type MidpointPlace, type MidpointResponse } from '@/lib/midpoint-api';
import { getApiErrorMessage } from '@/lib/axios';
import { usePlaceSearch } from '@/hooks/usePlaceSearch';
import { useAlert } from '@/hooks/useAlert';
import { usePlaceWeather } from '@/hooks/useWeather';
import { recommendFor, weatherAt } from '@/lib/weather';
import { WeatherLine } from './Weather';
import ImageWithFallback from './ImageWithFallback';

/** 가운데 좌표 근처에서 찾은 지하철역. 같은 역의 여러 노선은 한 줄로 묶는다 */
interface Station {
  id: string;
  name: string;
  lines: string[];
  distance: number;
  latitude: number;
  longitude: number;
}

const STATION_LIMIT = 5;

/**
 * 일정의 중간 지점 찾기.
 * 각자 출발지를 적으면 서버가 가운데 좌표를 주고, 여기서 Kakao 지도 SDK 로 그 근처 지하철역을 찾아 보여 준다.
 * 일정을 만든 사람은 역 하나를 골라 일정 장소로 정한다.
 * 장소가 정해지면 그 역 근처의 추천 장소를 일정 시작 시각의 날씨에 맞춰 아래에 보여 준다.
 * 대상이 한 명뿐인 일정(혼자인 모임, 참여자가 나뿐인 일정)에서는 아무것도 그리지 않는다.
 * 그래서 바깥 행(아이콘)까지 같이 숨길 수 있게 wrap 으로 감싸서 그린다.
 */
export default function MidpointSection({
  scheduleId,
  startTime,
  place,
  onLocationChange,
  onDepartureChange,
  wrap = (content) => content,
}: {
  scheduleId: string;
  /** 일정 시작 시각('yyyy-MM-ddTHH:mm:ss'). 그 시각의 날씨로 추천 순서를 정한다 */
  startTime: string;
  /** 지금 일정에 적힌 장소 (좌표가 있을 때만 추천에 쓴다) */
  place?: { name?: string | null; latitude?: number | null; longitude?: number | null };
  onLocationChange?: (place: MidpointPlace) => void;
  /** 내 출발지를 적거나 지웠을 때 (일정 목록의 '출발지 미입력' 표시를 다시 불러오게) */
  onDepartureChange?: () => void;
  wrap?: (content: ReactNode) => ReactNode;
}) {
  const { data: session } = useSession();
  const { confirm, toast } = useAlert();
  const queryClient = useQueryClient();
  const queryKey = ['midpoint', scheduleId];

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => midpointApi.get(scheduleId, session!),
    enabled: !!session,
    refetchInterval: 15000,
  });

  const [editing, setEditing] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [busy, setBusy] = useState(false);
  const { searchResults, isSearching, recommendations, isRecommending, searchPlaces, fetchRecommendations, clearSearchResults } = usePlaceSearch();

  const stations = useStations(data?.center ?? null);

  // 추천의 기준점: 정해진 장소가 추천 목록의 역이면 그 역, 아니면 일정에 저장된 좌표.
  // 추천 장소를 일정 장소로 정한 직후에는 목록이 바뀌지 않게 방금까지의 기준 역(anchor)을 그대로 둔다.
  const [anchor, setAnchor] = useState<MidpointPlace | null>(null);
  const confirmedName = data?.location?.trim() || '';
  const confirmedStation = confirmedName ? stations.items.find((s) => s.name === confirmedName) : undefined;
  const savedPlace = confirmedName && place?.name === confirmedName ? place : undefined;
  const baseName = anchor?.name ?? confirmedName;
  const chosenLat = anchor?.latitude ?? confirmedStation?.latitude ?? savedPlace?.latitude ?? null;
  const chosenLng = anchor?.longitude ?? confirmedStation?.longitude ?? savedPlace?.longitude ?? null;
  const hasChosen = !!data?.center && chosenLat != null && chosenLng != null;

  // 역이 아닌 곳(추천 장소 등)으로 장소가 정해졌으면 지하철역 목록은 접어 둔다. 사용자가 누르면 그 선택을 따른다.
  const [stationsToggle, setStationsToggle] = useState<boolean | null>(null);
  const stationsOpen = stationsToggle ?? !(confirmedName && !confirmedStation);

  // 일정 시작 시각의 그 역 날씨. 예보 범위(10일) 밖이거나 못 받으면 null → 기본 순서로 추천한다
  const { data: forecast, isLoading: isWeatherLoading } = usePlaceWeather(hasChosen ? chosenLat : null, hasChosen ? chosenLng : null);
  const weather = forecast ? weatherAt(forecast, startTime) : null;
  const recommend = recommendFor(weather);
  const categoryKey = recommend.categories.join(',');

  useEffect(() => {
    if (!hasChosen || isWeatherLoading || chosenLat == null || chosenLng == null) return;
    fetchRecommendations(chosenLat, chosenLng, categoryKey.split(','));
  }, [hasChosen, chosenLat, chosenLng, isWeatherLoading, categoryKey, fetchRecommendations]);

  const apply = (next: MidpointResponse) => queryClient.setQueryData(queryKey, next);

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    try {
      await task();
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const saveDeparture = (place: MidpointPlace) =>
    run(async () => {
      apply(await midpointApi.saveDeparture(scheduleId, place, session));
      setEditing(false);
      setKeyword('');
      clearSearchResults();
      onDepartureChange?.();
    });

  const removeDeparture = () =>
    run(async () => {
      apply(await midpointApi.removeDeparture(scheduleId, session));
      onDepartureChange?.();
    });

  const askOthers = () =>
    run(async () => {
      const sent = await midpointApi.requestDepartures(scheduleId, session);
      if (sent > 0) toast.success(`${sent}명에게 출발지를 물어봤어요`);
      else toast.info('모두 출발지를 적었어요');
    });

  const confirmStation = async (station: Station) => {
    if (!(await confirm(`일정 장소를 ${station.name}(으)로 정할까요?`))) return;
    await run(async () => {
      const place = { name: station.name, latitude: station.latitude, longitude: station.longitude };
      apply(await midpointApi.confirm(scheduleId, place, session));
      setAnchor(null);
      onLocationChange?.(place);
      toast.success('일정 장소를 정했어요');
    });
  };

  /** 추천 장소를 일정 장소로 정한다. 추천 목록은 지금 기준 역 그대로 둔다 */
  const confirmRecommendation = async (rec: { name: string; y: string; x: string }) => {
    if (chosenLat == null || chosenLng == null) return;
    if (!(await confirm(`일정 장소를 ${rec.name}(으)로 정할까요?`))) return;
    const base = { name: baseName, latitude: chosenLat, longitude: chosenLng };
    await run(async () => {
      const picked = { name: rec.name.slice(0, 255), latitude: Number(rec.y), longitude: Number(rec.x) };
      apply(await midpointApi.confirm(scheduleId, picked, session));
      setAnchor(base);
      setStationsToggle(null);
      onLocationChange?.(picked);
      toast.success('일정 장소를 정했어요');
    });
  };

  // 대상 수를 알기 전에는 그리지 않는다 (한 명뿐인 일정에서 행이 잠깐 보였다 사라지지 않게)
  if (isLoading) return null;
  if (error || !data) {
    return wrap(<p className="text-sm text-ink-3">중간 지점을 불러오지 못했어요. {error ? getApiErrorMessage(error) : ''}</p>);
  }
  // 만날 사람이 나뿐이면 중간 지점을 찾을 일이 없다
  if (data.expectedCount <= 1) return null;

  const showForm = editing || !data.myDeparture;
  const waiting = data.expectedCount - data.enteredCount;

  return wrap(
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-ink-3">
          중간 지점 · 출발지 <span className="stamp">{data.enteredCount}/{data.expectedCount}</span>명
        </p>
        {data.canConfirm && waiting > 0 && (
          <button type="button" onClick={askOthers} disabled={busy} className="btn-ghost btn-sm">
            출발지 물어보기
          </button>
        )}
      </div>

      {/* 적은 사람들: 다른 사람의 출발지는 이름만 보인다 */}
      {data.departures.length > 0 && (
        <ul className="mt-2 space-y-1">
          {data.departures.map((d) => (
            <li key={d.userId} className="flex items-center gap-2 text-sm">
              <span className="shrink-0 text-ink-2">{d.mine ? '나' : d.nickname}</span>
              <span className="min-w-0 flex-1 truncate text-ink">{d.name}</span>
              {d.mine && !editing && (
                <span className="flex shrink-0 items-center gap-1">
                  <button type="button" onClick={() => setEditing(true)} disabled={busy} className="btn-ghost btn-sm">
                    바꾸기
                  </button>
                  <button type="button" onClick={removeDeparture} disabled={busy} className="btn-ghost btn-sm">
                    지우기
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* 내 출발지 적기 */}
      {showForm && (
        <div className="mt-3">
          <div className="relative">
            <Search size={16} strokeWidth={1.5} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
            <input
              type="text"
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                searchPlaces(e.target.value);
              }}
              placeholder="내 출발지 검색 (역, 동네, 건물)"
              aria-label="내 출발지 검색"
              className="form-input w-full pl-9 pr-9"
            />
            {editing && (
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setKeyword('');
                  clearSearchResults();
                }}
                className="btn-icon absolute right-1 top-1/2 size-7 -translate-y-1/2"
                aria-label="출발지 바꾸기 취소"
              >
                <X size={14} strokeWidth={1.5} />
              </button>
            )}
          </div>

          {data.lastDeparture && !keyword && data.lastDeparture.name !== data.myDeparture?.name && (
            <button
              type="button"
              onClick={() => saveDeparture(data.lastDeparture!)}
              disabled={busy}
              className="btn-secondary btn-sm mt-2 max-w-full"
            >
              <span className="truncate">지난번 출발지 쓰기: {data.lastDeparture.name}</span>
            </button>
          )}

          {keyword.trim() && (
            <div className="mt-2 overflow-hidden rounded-lg border border-line">
              {isSearching ? (
                <p className="flex items-center gap-2 px-3 py-2.5 text-[13px] text-ink-3">
                  <Loader2 size={14} strokeWidth={1.5} className="animate-spin" /> 찾는 중
                </p>
              ) : searchResults.length === 0 ? (
                <p className="px-3 py-2.5 text-[13px] text-ink-3">찾은 장소가 없어요</p>
              ) : (
                <ul className="max-h-56 overflow-y-auto">
                  {searchResults.slice(0, 8).map((place) => (
                    <li key={place.id}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          saveDeparture({
                            name: place.place_name.slice(0, 100),
                            latitude: Number(place.y),
                            longitude: Number(place.x),
                          })
                        }
                        className="block w-full px-3 py-2 text-left transition-colors hover:bg-raised"
                      >
                        <span className="block truncate text-sm text-ink">{place.place_name}</span>
                        <span className="block truncate text-[13px] text-ink-3">
                          {place.road_address_name || place.address_name}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* 가운데 근처 지하철역 */}
      {!data.center ? (
        <p className="mt-3 text-[13px] text-ink-3">두 명 이상 출발지를 적으면 가운데에 있는 지하철역을 추천해요</p>
      ) : stations.loading ? (
        <p className="mt-3 flex items-center gap-2 text-[13px] text-ink-3">
          <Loader2 size={14} strokeWidth={1.5} className="animate-spin" /> 가운데 지하철역을 찾는 중
        </p>
      ) : stations.items.length === 0 ? (
        <p className="mt-3 text-[13px] text-ink-3">가운데 근처에서 지하철역을 찾지 못했어요</p>
      ) : (
        <div className="mt-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] text-ink-3">
              가운데에서 가까운 지하철역{!stationsOpen && <> <span className="stamp">{stations.items.length}</span>곳</>}
            </p>
            {(!stationsOpen || stationsToggle !== null || (confirmedName && !confirmedStation)) && (
              <button
                type="button"
                onClick={() => setStationsToggle(!stationsOpen)}
                aria-expanded={stationsOpen}
                className="btn-ghost btn-sm"
              >
                {stationsOpen ? '접기' : '펼치기'}
              </button>
            )}
          </div>
          {stationsOpen && (
          <>
          <ul className="mt-1 divide-y divide-line rounded-lg border border-line">
            {stations.items.map((station, index) => (
              <li key={station.id} className="flex items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm text-ink">
                    <span className="truncate font-display text-[15px]">{station.name}</span>
                    {index === 0 && <span className="chip shrink-0">가장 가까움</span>}
                  </p>
                  <p className="truncate text-[13px] text-ink-3">
                    {station.lines.join(' · ')}
                    {station.lines.length > 0 && ' · '}
                    가운데에서 <span className="stamp">{formatDistance(station.distance)}</span>
                  </p>
                </div>
                <a
                  href={`https://map.kakao.com/link/map/${station.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-icon size-7 shrink-0"
                  title="카카오맵에서 보기"
                >
                  <ExternalLink size={14} strokeWidth={1.5} />
                </a>
                {data.canConfirm && (
                  <button
                    type="button"
                    onClick={() => confirmStation(station)}
                    disabled={busy || data.location === station.name}
                    className="btn-secondary btn-sm shrink-0"
                  >
                    {data.location === station.name ? '정한 장소' : '여기로 정하기'}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {!data.canConfirm && <p className="mt-1.5 text-[13px] text-ink-3">장소는 일정을 만든 사람이 정해요</p>}
          </>
          )}
        </div>
      )}

      {/* 정해진 역 근처 추천 장소 (날씨 기반) */}
      {hasChosen && (isRecommending || recommendations.length > 0) && (
        <div className="mt-4">
          <p className="text-[13px] text-ink-3">
            <span className="text-ink-2">{baseName} 근처 추천 장소</span>
            {recommend.reason && <span className="ml-2">{recommend.reason}</span>}
          </p>
          {weather && <WeatherLine weather={weather} className="mt-1 text-[13px] text-ink-2" />}
          {isRecommending ? (
            <p className="mt-2 flex items-center gap-2 text-[13px] text-ink-3">
              <Loader2 size={14} strokeWidth={1.5} className="animate-spin" /> 추천 장소를 찾는 중
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
              {recommendations.map((rec, index) => (
                <li key={`${rec.id}-${index}`} className="flex items-center gap-3 px-3 py-2">
                  <span className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-raised">
                    <ImageWithFallback src={rec.image} alt="" fill containerClassName="w-full h-full" className="object-cover" unoptimized />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-[15px] text-ink">{rec.name}</span>
                    <span className="block truncate text-[13px] text-ink-3">
                      {rec.category}
                      {rec.distance && <> · 역에서 <span className="stamp">{rec.distance}</span></>}
                    </span>
                  </span>
                  <a
                    href={`https://map.kakao.com/link/map/${rec.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-icon size-7 shrink-0"
                    title="카카오맵에서 보기"
                  >
                    <ExternalLink size={14} strokeWidth={1.5} />
                  </a>
                  {data.canConfirm && (
                    <button
                      type="button"
                      onClick={() => confirmRecommendation(rec)}
                      disabled={busy || data.location === rec.name}
                      className="btn-secondary btn-sm shrink-0"
                    >
                      {data.location === rec.name ? '정한 장소' : '여기로 정하기'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function formatDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${Math.round(meters)}m`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** 가운데 좌표에서 가까운 지하철역을 Kakao 지도 SDK(카테고리 SW8)로 찾는다. 5km 안에 없으면 20km 까지 넓힌다. */
function useStations(center: { latitude: number; longitude: number } | null) {
  const [state, setState] = useState<{ key: string; items: Station[]; loading: boolean }>({ key: '', items: [], loading: false });
  const key = center ? `${center.latitude.toFixed(5)},${center.longitude.toFixed(5)}` : '';

  useEffect(() => {
    if (!center) return;
    const kakao = (window as any).kakao;
    if (!kakao?.maps?.load) {
      setState({ key, items: [], loading: false });
      return;
    }
    let cancelled = false;
    setState((prev) => ({ key, items: prev.key === key ? prev.items : [], loading: true }));

    kakao.maps.load(() => {
      const places = new kakao.maps.services.Places();
      const location = new kakao.maps.LatLng(center.latitude, center.longitude);
      const search = (radius: number, onEmpty?: () => void) => {
        places.categorySearch(
          'SW8',
          (result: any[], status: string) => {
            if (cancelled) return;
            if (status === kakao.maps.services.Status.OK && result.length > 0) {
              setState({ key, items: groupStations(result), loading: false });
            } else if (onEmpty) {
              onEmpty();
            } else {
              setState({ key, items: [], loading: false });
            }
          },
          { location, radius, sort: kakao.maps.services.SortBy.DISTANCE },
        );
      };
      search(5000, () => search(20000));
    });

    return () => {
      cancelled = true;
    };
    // 좌표 값이 같으면 다시 찾지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return center && state.key === key ? state : { key, items: [], loading: !!center };
}

/** "합정역 2호선", "합정역 6호선" → 합정역 (2호선 · 6호선). 가까운 순서를 지킨다. */
function groupStations(result: any[]): Station[] {
  const byName = new Map<string, Station>();
  for (const place of result) {
    const full = String(place.place_name ?? '').trim();
    if (!full) continue;
    const space = full.indexOf(' ');
    const name = space > 0 ? full.slice(0, space) : full;
    const line = space > 0 ? full.slice(space + 1).trim() : '';
    const found = byName.get(name);
    if (found) {
      if (line && !found.lines.includes(line)) found.lines.push(line);
    } else {
      byName.set(name, {
        id: String(place.id),
        name,
        lines: line ? [line] : [],
        distance: Number(place.distance) || 0,
        latitude: Number(place.y),
        longitude: Number(place.x),
      });
    }
  }
  return [...byName.values()].slice(0, STATION_LIMIT);
}
