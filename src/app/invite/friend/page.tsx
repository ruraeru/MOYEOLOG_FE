'use client';

import { useCallback, useEffect, useState, Suspense, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import axios from 'axios';
import { friendApi, type UserProfileResponse } from '@/lib/friend-api';
import { getApiErrorMessage } from '@/lib/axios';
import { Loader2, AlertCircle, RotateCw } from 'lucide-react';
import UserProfileCard from '@/app/profile/UserProfileCard';

function FriendInviteContent() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = (searchParams.get('code') || '').trim();

  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ invalid: boolean; message: string } | null>(null);

  useEffect(() => {
    if (status !== 'unauthenticated') return;
    const target = code ? `/invite/friend?code=${encodeURIComponent(code)}` : '/invite/friend';
    router.replace(`/?callbackUrl=${encodeURIComponent(target)}`);
  }, [status, code, router]);

  // 링크를 연 것만으로는 아무것도 보내지 않아요. 누가 초대했는지 보여 주고 '친구 신청'을 눌러야 보냅니다.
  const fetchInviter = useCallback(async (silent = false) => {
    if (!session) return;
    if (!code) {
      setError({ invalid: true, message: '초대 링크가 올바르지 않아요.' });
      setLoading(false);
      return;
    }
    try {
      if (!silent) setLoading(true);
      const data = await friendApi.getUserByCustomId(code, session);
      setProfile(data);
      setError(null);
    } catch (err) {
      const statusCode = axios.isAxiosError(err) ? err.response?.status : undefined;
      const invalid = statusCode === 404 || statusCode === 400;
      setProfile(null);
      setError({
        invalid,
        message: invalid
          ? '초대한 사용자를 찾을 수 없어요. 링크를 다시 확인해 주세요.'
          : getApiErrorMessage(err, '초대 정보를 불러오지 못했어요.'),
      });
    } finally {
      if (!silent) setLoading(false);
    }
  }, [session, code]);

  useEffect(() => {
    fetchInviter();
  }, [fetchInviter]);

  if (loading || status !== 'authenticated') {
    return (
      <Shell>
        <div className="card p-6 flex flex-col items-center gap-3 text-center">
          <Loader2 size={18} strokeWidth={1.5} className="text-ink-3 animate-spin" />
          <p className="text-sm text-ink-2">친구 초대를 확인하고 있어요</p>
        </div>
      </Shell>
    );
  }

  if (error || !profile) {
    return (
      <Shell>
        <div className="card p-6 text-center space-y-5">
          <div className="size-10 rounded-full bg-raised flex items-center justify-center mx-auto">
            <AlertCircle size={18} strokeWidth={1.5} className="text-negative" />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-semibold text-ink">친구 초대</h1>
            <p className="text-sm text-negative">{error?.message || '초대 정보를 불러오지 못했어요.'}</p>
          </div>
          <div className="flex flex-col gap-2">
            {error && !error.invalid && (
              <button onClick={() => fetchInviter()} className="btn-primary w-full">
                <RotateCw size={16} strokeWidth={1.5} />
                다시 시도
              </button>
            )}
            <Link href="/friends" className="btn-secondary w-full">친구 목록으로</Link>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="text-sm text-ink-2 text-center">
        {profile.friendStatus === 'SELF' ? '내 친구 초대 링크' : `${profile.nickname}님이 친구가 되고 싶어 해요`}
      </p>
      <UserProfileCard profile={profile} variant="invite" onChanged={() => fetchInviter(true)} />
      <div className="flex gap-2">
        <Link href="/friends" className="btn-ghost flex-1">친구 목록으로</Link>
        <Link href="/home" className="btn-ghost flex-1">홈으로</Link>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-sm space-y-3">{children}</div>
    </div>
  );
}

export default function FriendInvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <Loader2 size={18} strokeWidth={1.5} className="text-ink-3 animate-spin" />
      </div>
    }>
      <FriendInviteContent />
    </Suspense>
  );
}
