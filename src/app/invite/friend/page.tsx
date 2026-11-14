'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { friendApi } from '@/lib/friend-api';
import { Loader2, UserPlus, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAlert } from '@/hooks/useAlert';

function FriendInviteContent() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useAlert();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const code = searchParams.get('code');
  // 세션 객체가 갱신되어 effect가 다시 실행되더라도 초대 요청은 한 번만 보냅니다.
  const processedRef = useRef(false);

  useEffect(() => {
    if (status === 'loading') return;
    
    if (status === 'unauthenticated') {
      toast.warning('로그인이 필요해요');
      const target = code ? `/invite/friend?code=${encodeURIComponent(code)}` : '/invite/friend';
      router.push(`/?callbackUrl=${encodeURIComponent(target)}`);
      return;
    }

    if (!code) {
      setError('초대 코드가 유효하지 않아요');
      setLoading(false);
      return;
    }

    if (processedRef.current) return;
    processedRef.current = true;

    const processInvite = async () => {
      try {
        await friendApi.sendRequest(code, session);
        setSuccess(true);
        setTimeout(() => {
          router.push('/friends');
        }, 2000);
      } catch (err) {
        const message = err instanceof Error ? err.message : '친구 신청을 보내지 못했어요';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    processInvite();
  }, [code, session, status, router]);

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
      <div className="card w-full max-w-sm p-6 text-center space-y-5">
        <div className="size-10 rounded-full bg-raised flex items-center justify-center mx-auto">
          {loading ? (
            <Loader2 size={18} strokeWidth={1.5} className="text-ink-3 animate-spin" />
          ) : success ? (
            <CheckCircle2 size={18} strokeWidth={1.5} className="text-positive" />
          ) : error ? (
            <AlertCircle size={18} strokeWidth={1.5} className="text-negative" />
          ) : (
            <UserPlus size={18} strokeWidth={1.5} className="text-ink-3" />
          )}
        </div>

        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-ink">
            {loading ? '친구 초대를 확인하고 있어요' : success ? '친구 신청을 보냈어요' : '친구 초대'}
          </h1>
          <p className={`text-sm ${error ? 'text-negative' : 'text-ink-2'}`}>
            {error || (loading
              ? '잠시만 기다려주세요'
              : success
                ? '곧 친구 목록으로 이동해요'
                : '친구 초대를 확인하지 못했어요')}
          </p>
        </div>

        {!loading && (success || error) && (
          <div className="flex flex-col gap-2">
            <button onClick={() => router.push(error ? '/home' : '/friends')} className="btn-primary w-full">
              {error ? '홈으로' : '친구 목록으로'}
            </button>
            <button onClick={() => router.push(error ? '/friends' : '/home')} className="btn-secondary w-full">
              {error ? '친구 목록으로' : '홈으로'}
            </button>
          </div>
        )}
      </div>
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
