import { useState, useCallback, useRef, useEffect } from 'react';

export interface KakaoPlace {
  place_name: string;
  address_name: string;
  road_address_name?: string;
  category_name: string;
  category_group_name?: string;
  id: string;
  distance?: string;
  y: string;
  x: string;
}

export interface Recommendation {
  id: string | number;
  name: string;
  category: string;
  distance: string;
  desc: string;
  image: string;
  tags: string[];
  y: string;
  x: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function usePlaceSearch() {
  const [searchResults, setSearchResults] = useState<KakaoPlace[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isRecommending, setIsRecommending] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMounted = useRef(true);
  const recommendRequest = useRef(0);

  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  const searchPlaces = useCallback((keyword: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!keyword.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const kakao = (window as any).kakao;
    if (!kakao?.maps?.load) return;

    setIsSearching(true);

    searchTimeoutRef.current = setTimeout(() => {
      // SDK 를 autoload=false 로 불러와 load() 뒤에야 services 가 생긴다(이미 됐으면 바로 부른다)
      kakao.maps.load(() => {
        const ps = new kakao.maps.services.Places();
        ps.keywordSearch(keyword, (data: KakaoPlace[], status: string) => {
          if (!isMounted.current) return;
          if (status === kakao.maps.services.Status.OK) {
            setSearchResults(data);
          } else {
            setSearchResults([]);
          }
          setIsSearching(false);
        });
      });
    }, 300);
  }, []);

  const fetchRecommendations = useCallback(async (lat: number, lng: number, categories: string[] = ['FD6', 'CE7']) => {
    const kakao = (window as any).kakao;
    if (!kakao?.maps?.load) return;

    const request = ++recommendRequest.current;
    setIsRecommending(true);
    await new Promise<void>((resolve) => kakao.maps.load(resolve));
    const ps = new kakao.maps.services.Places();

    const fetchImage = async (name: string) => {
      const defaultImage = 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400&h=300&fit=crop';
      try {
        const res = await fetch(`/api/search-image?query=${encodeURIComponent(name)}`);
        const json = await res.json();
        if (json.imageUrl) {
          // 프록시 서버를 경유하여 403 에러 우회 (Referer 문제 해결)
          return `${window.location.origin}/api/proxy-image?url=${encodeURIComponent(json.imageUrl)}`;
        }
        return defaultImage;
      } catch {
        return defaultImage;
      }
    };

    const byCategory = (code: string) =>
      new Promise<any[]>((resolve) => {
        ps.categorySearch(
          code,
          (data: any[], status: string) => resolve(status === kakao.maps.services.Status.OK ? data : []),
          { location: new kakao.maps.LatLng(lat, lng), radius: 1000 }
        );
      });

    // 앞선 종류부터 3곳씩, 모두 5곳까지 채운다.
    const places: any[] = [];
    for (const code of categories) {
      if (places.length >= 5) break;
      places.push(...(await byCategory(code)).slice(0, Math.min(3, 5 - places.length)));
    }
    const results: Recommendation[] = await Promise.all(
      places.map(async (place) => ({
        id: place.id,
        name: place.place_name,
        category: place.category_group_name?.split('>').pop()?.trim() || '장소',
        distance: place.distance ? `${place.distance}m` : '',
        desc: place.address_name,
        image: await fetchImage(place.place_name),
        y: place.y,
        x: place.x,
        tags: [place.category_group_name?.split('>')[0]?.trim() || '추천']
      }))
    );
    // 그 사이 다른 장소·날씨로 다시 요청했으면 버린다.
    if (!isMounted.current || request !== recommendRequest.current) return;
    setRecommendations(results);
    setIsRecommending(false);
  }, []);

  const clearSearchResults = useCallback(() => {
    setSearchResults([]);
  }, []);

  return { searchResults, isSearching, recommendations, isRecommending, searchPlaces, fetchRecommendations, clearSearchResults };
}
