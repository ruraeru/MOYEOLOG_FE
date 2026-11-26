import { useState, useEffect, useCallback } from 'react';
import { DEFAULT_LOCATION, KAKAO_MAP_CONFIG } from '@/lib/constants';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function useKakaoMap(containerRef: React.RefObject<HTMLDivElement | null>, isOpen: boolean) {
  const [map, setMap] = useState<any>(null);
  const [marker, setMarker] = useState<any>(null);
  const [isMapLoading, setIsMapLoading] = useState(false);

  const setupMap = useCallback((lat: number, lng: number) => {
    const kakao = (window as any).kakao;
    if (!kakao?.maps?.load) return;

    kakao.maps.load(() => {
      if (!containerRef.current) return;

      try {
        const coords = new kakao.maps.LatLng(lat, lng);
        const options = { center: coords, level: KAKAO_MAP_CONFIG.DEFAULT_LEVEL };
        const newMap = new kakao.maps.Map(containerRef.current, options);
        // 핀은 장소를 고른 뒤에만 보인다(updatePosition). 처음에는 현재 위치·기본 위치를 보여 줄 뿐이다.
        const newMarker = new kakao.maps.Marker({ position: coords });

        setMap(newMap);
        setMarker(newMarker);
        
        setTimeout(() => newMap.relayout(), 300);
      } catch (err) {
        console.error('[Map] Error creating map:', err);
      } finally {
        setIsMapLoading(false);
      }
    });
  }, [containerRef]);

  const initMap = useCallback(async () => {
    setIsMapLoading(true);

    if (!navigator.geolocation) {
      setupMap(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => setupMap(pos.coords.latitude, pos.coords.longitude),
      () => setupMap(DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  }, [setupMap]);

  useEffect(() => {
    if (!isOpen) return;

    let retryCount = 0;
    const checkAndInit = () => {
      const kakao = (window as any).kakao;
      if (!kakao) {
         console.error('Kakao Map Script not found. This usually means Kakao API rejected the key or domain.');
      }
      if (containerRef.current && kakao?.maps) {
        initMap();
      } else if (retryCount < KAKAO_MAP_CONFIG.MAX_RETRIES) {
        retryCount++;
        setTimeout(checkAndInit, KAKAO_MAP_CONFIG.RETRY_INTERVAL);
      } else {
        setIsMapLoading(false);
      }
    };

    checkAndInit();
    return () => {
      setMap(null);
      setMarker(null);
    };
  }, [isOpen, initMap, containerRef]);

  const updatePosition = useCallback((lat: number, lng: number) => {
    if (!map || !marker) return;
    const kakao = (window as any).kakao;
    const coords = new kakao.maps.LatLng(lat, lng);
    map.setCenter(coords);
    marker.setPosition(coords);
    marker.setMap(map);
  }, [map, marker]);

  /** 장소가 없을 때 핀을 숨긴다. */
  const hideMarker = useCallback(() => {
    marker?.setMap(null);
  }, [marker]);

  return { map, marker, isMapLoading, updatePosition, hideMarker, setupMap };
}
