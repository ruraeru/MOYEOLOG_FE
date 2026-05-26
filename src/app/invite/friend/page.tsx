'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { friendApi } from '@/lib/friend-api';
import { Loader2, UserPlus, CheckCircle2, AlertCircle } from 'lucide-react';

function FriendInviteContent() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const code = searchParams.get('code');

  useEffect(() => {
    if (status === 'loading') return;
    
    if (status === 'unauthenticated') {
      alert('로그인이 필요한 서비스입니다.');
      router.push(`/?callbackUrl=/invite/friend?code=${code}`);
      return;
    }

    if (!code) {
      setError('초대 코드가 유효하지 않습니다.');
      setLoading(false);
      return;
    }

    const processInvite = async () => {
      try {
        await friendApi.sendRequest(code, session);
        setSuccess(true);
        setTimeout(() => {
          router.push('/friends');
        }, 2000);
      } catch (err) {
        const message = err instanceof Error ? err.message : '친구 신청에 실패했습니다.';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    processInvite();
  }, [code, session, status, router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-10 text-center space-y-6">
        <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
          {loading ? (
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
          ) : success ? (
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          ) : (
            <UserPlus className="w-10 h-10 text-indigo-600" />
          )}
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            {loading ? '친구 초대 처리 중…' : success ? '친구 신청 완료!' : '친구 초대'}
          </h1>
          <p className="text-sm text-gray-500 font-medium">
            {loading 
              ? '잠시만 기다려주세요. 정보를 확인 중입니다.' 
              : success 
                ? '친구 신청을 보냈습니다. 곧 친구 목록으로 이동합니다.' 
                : error || '친구 초대를 수락하시겠습니까?'}
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 text-rose-600 p-4 rounded-2xl flex items-center gap-3 text-sm font-bold border border-rose-100 animate-shake">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}

        {!loading && error && (
          <button
            onClick={() => router.push('/home')}
            className="w-full py-4 bg-gray-900 text-white rounded-2xl text-sm font-black hover:bg-gray-800 transition-all shadow-lg active:scale-95"
          >
            홈으로 돌아가기
          </button>
        )}
      </div>
    </div>
  );
}

export default function FriendInvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    }>
      <FriendInviteContent />
    </Suspense>
  );
}
