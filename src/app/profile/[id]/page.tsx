'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import axios from 'axios';
import { Loader2, AlertCircle, RotateCw, UserX } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { friendApi, type UserProfileResponse } from '@/lib/friend-api';
import { getApiErrorMessage } from '@/lib/axios';
import UserProfileCard from '../UserProfileCard';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** useParams 값은 % 인코딩된 채로 올 수 있어요. 한 번만 풀고, 풀 수 없으면 그대로 둡니다. */
function decodeParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default function ProfileIdPage() {
  const router = useRouter();
  const params = useParams();
  const rawId = typeof params.id === 'string' ? params.id : '';
  const id = decodeParam(rawId);
  // 사용자 ID 는 UUID 예요. 형식이 다르면 API 를 부르지 않고 바로 '찾을 수 없음'을 보여 줍니다.
  const validId = UUID_PATTERN.test(id);
  const { data: session, status } = useSession();
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ notFound: boolean; message: string } | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      // rawId 는 이미 주소 형식(인코딩된 상태)이라 다시 인코딩하지 않아요.
      router.replace(`/?callbackUrl=${encodeURIComponent(`/profile/${rawId}`)}`);
    }
  }, [status, router, rawId]);

  const fetchProfile = useCallback(async (silent = false) => {
    if (!session) return;
    if (!validId) {
      setProfile(null);
      setError({ notFound: true, message: '사용자를 찾을 수 없어요.' });
      setLoading(false);
      return;
    }
    try {
      if (!silent) setLoading(true);
      const data = await friendApi.getUserProfile(id, session);
      setProfile(data);
      setError(null);
    } catch (err) {
      const code = axios.isAxiosError(err) ? err.response?.status : undefined;
      // 형식이 맞지 않는 ID 는 서버가 400 을 줄 수 있어요. 둘 다 '없는 사용자'로 보여 줍니다.
      const notFound = code === 404 || code === 400;
      setProfile(null);
      setError({
        notFound,
        message: notFound ? '사용자를 찾을 수 없어요.' : getApiErrorMessage(err, '프로필을 불러오지 못했어요.'),
      });
    } finally {
      if (!silent) setLoading(false);
    }
  }, [session, id, validId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return (
    <div className="h-screen flex flex-col bg-canvas text-ink overflow-hidden">
      <Navbar />
      <main className="flex-1 overflow-y-auto no-scrollbar p-4 sm:p-8">
        <div className="max-w-lg mx-auto">
          {loading || status !== 'authenticated' ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 size={18} strokeWidth={1.5} className="animate-spin text-ink-3" />
              <p className="text-sm text-ink-3">프로필을 불러오는 중…</p>
            </div>
          ) : error ? (
            <div className="card flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="size-10 rounded-full bg-raised flex items-center justify-center mb-3">
                {error.notFound ? (
                  <UserX size={18} strokeWidth={1.5} className="text-ink-3" />
                ) : (
                  <AlertCircle size={18} strokeWidth={1.5} className="text-negative" />
                )}
              </div>
              <h1 className="text-sm font-medium text-ink">{error.notFound ? '사용자를 찾을 수 없어요' : '프로필을 불러오지 못했어요'}</h1>
              <p className="text-sm text-ink-3 mt-1 mb-5">
                {error.notFound ? '탈퇴했거나 주소가 잘못됐을 수 있어요.' : error.message}
              </p>
              <div className="flex gap-2">
                {!error.notFound && (
                  <button onClick={() => fetchProfile()} className="btn-secondary">
                    <RotateCw size={16} strokeWidth={1.5} />
                    다시 시도
                  </button>
                )}
                <Link href="/friends" className="btn-secondary">친구 목록으로</Link>
              </div>
            </div>
          ) : profile ? (
            <UserProfileCard profile={profile} onChanged={() => fetchProfile(true)} />
          ) : null}
        </div>
      </main>
    </div>
  );
}
