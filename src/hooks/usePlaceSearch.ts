import { useState, useCallback } from 'react';

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
  rating: string;
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

  const searchPlaces = useCallback((keyword: string) => {
    if (!keyword.trim()) {
      setSearchResults([]);
      return;
    }

    const kakao = (window as any).kakao;
    if (!kakao?.maps?.services) return;

    setIsSearching(true);
    const ps = new kakao.maps.services.Places();
    ps.keywordSearch(keyword, (data: KakaoPlace[], status: string) => {
      if (status === kakao.maps.services.Status.OK) {
        setSearchResults(data);
      } else {
        setSearchResults([]);
      }
      setIsSearching(false);
    });
  }, []);

  const fetchRecommendations = useCallback(async (lat: number, lng: number) => {
    const kakao = (window as any).kakao;
    if (!kakao?.maps?.services) return;

    setIsRecommending(true);
    const ps = new kakao.maps.services.Places();

    const fetchImage = async (name: string) => {
      const defaultImage = 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400&h=300&fit=crop';
      try {
        const res = await fetch(`/api/search-image?query=${encodeURIComponent(name)}`);
        const json = await res.json();
        if (json.imageUrl) {
          // 프록시 서버를 경유하여 403 에러 우회 (Referer 문제 해결)
          return `/api/proxy-image?url=${encodeURIComponent(json.imageUrl)}`;
        }
        return defaultImage;
      } catch {
        return defaultImage;
      }
    };

    const processResults = async (data: any[]) => {
      return await Promise.all(
        data.slice(0, 5).map(async (place) => ({
          id: place.id,
          name: place.place_name,
          category: place.category_group_name?.split('>').pop()?.trim() || '장소',
          rating: (4.0 + Math.random() * 1.0).toFixed(1),
          distance: place.distance ? `${place.distance}m` : '',
          desc: place.address_name,
          image: await fetchImage(place.place_name),
          y: place.y,
          x: place.x,
          tags: [place.category_group_name?.split('>')[0]?.trim() || '추천']
        }))
      );
    };

    ps.categorySearch('FD6', async (data: any, status: any) => {
      if (status === kakao.maps.services.Status.OK) {
        setRecommendations(await processResults(data));
        setIsRecommending(false);
      } else {
        ps.categorySearch('CE7', async (cafeData: any, cafeStatus: any) => {
          if (cafeStatus === kakao.maps.services.Status.OK) {
            setRecommendations(await processResults(cafeData));
          } else {
            setRecommendations([]);
          }
          setIsRecommending(false);
        }, { location: new kakao.maps.LatLng(lat, lng), radius: 1000 });
      }
    }, { location: new kakao.maps.LatLng(lat, lng), radius: 1000 });
  }, []);

  const clearSearchResults = useCallback(() => {
    setSearchResults([]);
  }, []);

  return { searchResults, isSearching, recommendations, isRecommending, searchPlaces, fetchRecommendations, clearSearchResults };
}
