'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { groupApi } from '@/lib/group-api';
import { Loader2, Users, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAlert } from '@/hooks/useAlert';

function GroupInviteContent() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useAlert();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const code = searchParams.get('code');

  useEffect(() => {
    if (status === 'loading') return;
    
    if (status === 'unauthenticated') {
      toast.warning('로그인이 필요한 서비스입니다.');
      router.push(`/?callbackUrl=/invite/group?code=${code}`);
      return;
    }

    if (!code) {
      setError('초대 코드가 유효하지 않습니다.');
      setLoading(false);
      return;
    }

    const processInvite = async () => {
      try {
        await groupApi.joinByCode(code, session);
        setSuccess(true);
        setTimeout(() => {
          router.push('/groups');
        }, 2000);
      } catch (err) {
        const message = err instanceof Error ? err.message : '그룹 가입에 실패했습니다.';
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
            <Users className="w-10 h-10 text-indigo-600" />
          )}
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            {loading ? '그룹 초대 처리 중…' : success ? '그룹 가입 완료!' : '그룹 초대'}
          </h1>
          <p className="text-sm text-gray-500 font-medium">
            {loading 
              ? '잠시만 기다려주세요. 정보를 확인 중입니다.' 
              : success 
                ? '성공적으로 그룹 멤버가 되었습니다. 곧 그룹 목록으로 이동합니다.' 
                : error || '새로운 그룹의 초대가 도착했습니다.'}
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

export default function GroupInvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    }>
      <GroupInviteContent />
    </Suspense>
  );
}
