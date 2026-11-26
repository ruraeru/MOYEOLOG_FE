'use client';

import { useCallback, useEffect, useState, Suspense, type ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import axios from 'axios';
import { friendApi, type UserProfileResponse } from '@/lib/friend-api';
import { getApiErrorMessage } from '@/lib/axios';
import { Loader2, AlertCircle, RotateCw } from 'lucide-react';
import UserProfileCard from '@/app/profile/UserProfileCard';
import { EmptyState } from '@/components/ui';

function FriendInviteContent({ inviterName }: { inviterName: string | null }) {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const code = (searchParams.get('code') || '').trim();

  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ invalid: boolean; message: string } | null>(null);

  const target = code ? `/invite/friend?code=${encodeURIComponent(code)}` : '/invite/friend';

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

  // 로그인 전: 바로 로그인 화면으로 넘기지 않고 누가 초대했는지 먼저 보여 줘요.
  // 가입 화면에도 돌아올 주소를 넘겨, 가입·인증 뒤 로그인하면 이 화면으로 돌아와요.
  if (status === 'unauthenticated') {
    const back = encodeURIComponent(target);
    return (
      <Shell>
        <div className="space-y-1 pb-1">
          <p className="text-[13px] font-medium text-ink-3">친구 초대</p>
          <p className="font-display text-2xl leading-8 text-ink [overflow-wrap:anywhere]">
            {inviterName ? `${inviterName}님이 모여로그 친구로 초대했어요` : '모여로그 친구 초대'}
          </p>
        </div>
        <div className="card p-5 sm:p-6 space-y-4">
          <p className="text-sm text-ink-2">
            로그인하거나 가입하면 친구 신청을 보내고 일정과 메모를 함께 쓸 수 있어요
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Link href={`/?callbackUrl=${back}`} className="btn-primary sm:flex-1">로그인</Link>
            <Link href={`/signup?callbackUrl=${back}`} className="btn-secondary sm:flex-1">가입하기</Link>
          </div>
        </div>
      </Shell>
    );
  }

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
        <div className="card">
          <EmptyState
            icon={AlertCircle}
            title="친구 초대를 열 수 없어요"
            description={error?.message || '초대 정보를 불러오지 못했어요.'}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {error && !error.invalid && (
                  <button onClick={() => fetchInviter()} className="btn-primary">
                    <RotateCw size={16} strokeWidth={1.5} />
                    다시 시도
                  </button>
                )}
                <Link href="/friends" className="btn-secondary">친구 목록으로</Link>
              </div>
            }
          />
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="space-y-1 pb-1">
        <p className="text-[13px] font-medium text-ink-3">친구 초대</p>
        <p className="font-display text-2xl leading-8 text-ink [overflow-wrap:anywhere]">
          {profile.friendStatus === 'SELF'
            ? '내 친구 초대 링크'
            : profile.friendStatus === 'FRIEND'
              ? `${profile.nickname}님과 이미 친구예요`
              : profile.friendStatus === 'PENDING_SENT'
                ? `${profile.nickname}님에게 친구 신청을 보냈어요`
                : `${profile.nickname}님이 친구가 되고 싶어 해요`}
        </p>
      </div>
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
      <div className="w-full max-w-md space-y-4">{children}</div>
    </div>
  );
}

export default function FriendInvitePage({ inviterName = null }: { inviterName?: string | null }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <Loader2 size={18} strokeWidth={1.5} className="text-ink-3 animate-spin" />
      </div>
    }>
      <FriendInviteContent inviterName={inviterName} />
    </Suspense>
  );
}
