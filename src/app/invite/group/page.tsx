'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { groupApi, GroupApiError, type GroupPreviewResponse } from '@/lib/group-api';
import { getFileUrl } from '@/lib/utils';
import { Loader2, Users, CheckCircle2, AlertCircle, Ticket } from 'lucide-react';
import ImageWithFallback from '@/components/ImageWithFallback';
import { useAlert } from '@/hooks/useAlert';

type ViewState =
  | { kind: 'loading' }
  | { kind: 'enter'; message?: string }
  | { kind: 'preview'; preview: GroupPreviewResponse }
  | { kind: 'already'; groupId?: string; name?: string }
  | { kind: 'joined'; groupId?: string; name?: string }
  | { kind: 'error'; message: string; canRetry: boolean };

const BAD_CODE_MESSAGE = '초대 코드가 맞지 않거나 만료됐어요.';

function normalizeCode(input: string) {
  return input.trim().replace(/\s+/g, '').toUpperCase();
}

/** 코드가 바뀌면(다른 코드 입력) 화면 상태를 새로 시작한다 */
function GroupInviteKeyed() {
  const searchParams = useSearchParams();
  const code = searchParams.get('code');
  return <GroupInviteContent key={code || ''} code={code} />;
}

function GroupInviteContent({ code }: { code: string | null }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useAlert();
  const hasCode = !!code && !!normalizeCode(code);

  const [fetchedView, setView] = useState<ViewState>({ kind: 'loading' });
  // 코드 없이 들어오면 바로 코드 입력 화면
  const view: ViewState = hasCode ? fetchedView : (fetchedView.kind === 'loading' ? { kind: 'enter' } : fetchedView);
  const [joining, setJoining] = useState(false);
  const [codeInput, setCodeInput] = useState('');

  /** 미리보기 조회. 상태는 응답을 받은 뒤에만 바꾼다(로딩 표시는 호출하는 쪽에서). */
  const fetchPreview = useCallback(async (inviteCode: string) => {
    try {
      const preview = await groupApi.preview(inviteCode, session);
      if (preview.alreadyMember) {
        setView({ kind: 'already', groupId: preview.id, name: preview.name });
      } else {
        setView({ kind: 'preview', preview });
      }
    } catch (err) {
      const e = err as GroupApiError;
      if (e.status === 404 || e.status === 400) {
        setView({ kind: 'enter', message: e.message || BAD_CODE_MESSAGE });
      } else {
        setView({ kind: 'error', message: e.message || '초대 코드를 확인하지 못했어요.', canRetry: true });
      }
    }
  }, [session]);

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      toast.warning('로그인이 필요해요');
      const target = code ? `/invite/group?code=${encodeURIComponent(code)}` : '/invite/group';
      router.push(`/?callbackUrl=${encodeURIComponent(target)}`);
      return;
    }

    if (!code || !hasCode) return;

    fetchPreview(normalizeCode(code));
    // 세션 객체가 갱신될 때마다 다시 부르지 않도록 사용자 ID 기준으로만 반응한다
  }, [code, status, session?.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleJoin = async () => {
    if (view.kind !== 'preview' || view.preview.blocked || joining || !code) return;
    const { preview } = view;
    setJoining(true);
    try {
      const result = await groupApi.joinByCode(normalizeCode(code), session);
      const groupId = result.groupId || preview.id;
      setView({ kind: 'joined', groupId, name: preview.name });
      setTimeout(() => {
        router.push(groupId ? `/groups/${groupId}` : '/groups');
      }, 1200);
    } catch (err) {
      const e = err as GroupApiError;
      if (e.status === 409) {
        // 다른 탭에서 먼저 가입한 경우 등
        setView({ kind: 'already', groupId: e.groupId || preview.id, name: preview.name });
      } else if (e.status === 404) {
        setView({ kind: 'enter', message: e.message || BAD_CODE_MESSAGE });
      } else {
        setView({ kind: 'error', message: e.message || '모임에 참여하지 못했어요.', canRetry: e.status !== 403 });
      }
    } finally {
      setJoining(false);
    }
  };

  const loadPreview = (inviteCode: string) => {
    setView({ kind: 'loading' });
    fetchPreview(inviteCode);
  };

  const handleSubmitCode = (e: React.FormEvent) => {
    e.preventDefault();
    const next = normalizeCode(codeInput);
    if (!next) return;
    if (next === (code ? normalizeCode(code) : '')) {
      loadPreview(next);
    } else {
      router.replace(`/invite/group?code=${encodeURIComponent(next)}`);
    }
  };

  const goGroup = (groupId?: string) => router.push(groupId ? `/groups/${groupId}` : '/groups');

  let icon = <Loader2 size={18} strokeWidth={1.5} className="text-ink-3 animate-spin" />;
  if (view.kind === 'joined' || view.kind === 'already') icon = <CheckCircle2 size={18} strokeWidth={1.5} className="text-positive" />;
  if (view.kind === 'error') icon = <AlertCircle size={18} strokeWidth={1.5} className="text-negative" />;
  if (view.kind === 'enter') icon = <Ticket size={18} strokeWidth={1.5} className="text-ink-3" />;

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4 pb-24">
      <div className="card w-full max-w-sm p-6 text-center space-y-5">
        {view.kind === 'preview' ? (
          <GroupPreviewCard preview={view.preview} />
        ) : (
          <div className="size-10 rounded-full bg-raised flex items-center justify-center mx-auto">{icon}</div>
        )}

        {view.kind === 'loading' && (
          <div className="space-y-1">
            <h1 className="text-lg font-semibold text-ink">모임 초대를 확인하고 있어요</h1>
            <p className="text-sm text-ink-2">잠시만 기다려 주세요</p>
          </div>
        )}

        {view.kind === 'preview' && view.preview.blocked && (
          <>
            <div className="space-y-1">
              <h1 className="text-lg font-semibold text-ink">이 모임에 다시 들어갈 수 없어요</h1>
              <p className="text-sm text-ink-2">모임에서 내보내져 초대 코드로는 참여할 수 없어요. 방장이 직접 초대하면 다시 참여할 수 있어요.</p>
            </div>
            <button onClick={() => router.push('/groups')} className="btn-primary w-full">모임 목록으로</button>
          </>
        )}

        {view.kind === 'preview' && !view.preview.blocked && (
          <>
            <p className="text-sm text-ink-2">
              참여하면 모임 멤버에게 내 닉네임과 프로필 사진이 보여요.
            </p>
            <div className="flex flex-col gap-2">
              <button onClick={handleJoin} disabled={joining} className="btn-primary w-full">
                {joining && <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />}
                {joining ? '참여하는 중…' : '참여하기'}
              </button>
              <button onClick={() => router.push('/groups')} disabled={joining} className="btn-secondary w-full">
                참여하지 않기
              </button>
            </div>
          </>
        )}

        {view.kind === 'joined' && (
          <>
            <div className="space-y-1">
              <h1 className="text-lg font-semibold text-ink">모임에 참여했어요</h1>
              <p className="text-sm text-ink-2">{view.name ? `'${view.name}' 모임으로 이동해요` : '곧 모임으로 이동해요'}</p>
            </div>
            <button onClick={() => goGroup(view.groupId)} className="btn-primary w-full">모임으로 가기</button>
          </>
        )}

        {view.kind === 'already' && (
          <>
            <div className="space-y-1">
              <h1 className="text-lg font-semibold text-ink">이미 참여한 모임이에요</h1>
              {view.name && <p className="text-sm text-ink-2 break-words">{view.name}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={() => goGroup(view.groupId)} className="btn-primary w-full">모임으로 가기</button>
              <button onClick={() => router.push('/groups')} className="btn-secondary w-full">모임 목록으로</button>
            </div>
          </>
        )}

        {view.kind === 'error' && (
          <>
            <div className="space-y-1">
              <h1 className="text-lg font-semibold text-ink">모임에 참여할 수 없어요</h1>
              <p className="text-sm text-negative">{view.message}</p>
            </div>
            <div className="flex flex-col gap-2">
              {view.canRetry && code && (
                <button onClick={() => loadPreview(normalizeCode(code))} className="btn-primary w-full">다시 시도</button>
              )}
              <button onClick={() => router.push('/groups')} className={view.canRetry && code ? 'btn-secondary w-full' : 'btn-primary w-full'}>
                모임 목록으로
              </button>
            </div>
          </>
        )}

        {view.kind === 'enter' && (
          <form onSubmit={handleSubmitCode} className="space-y-4">
            <div className="space-y-1">
              <h1 className="text-lg font-semibold text-ink">초대 코드로 참여</h1>
              <p className={`text-sm ${view.message ? 'text-negative' : 'text-ink-2'}`}>
                {view.message || '모임에서 받은 초대 코드를 입력해 주세요'}
              </p>
            </div>
            <input
              type="text"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="예: AB12CD"
              aria-label="초대 코드"
              autoComplete="off"
              autoCapitalize="characters"
              autoFocus
              className="form-input text-center font-mono tracking-wide"
            />
            <div className="flex flex-col gap-2">
              <button type="submit" disabled={!normalizeCode(codeInput)} className="btn-primary w-full">확인</button>
              <button type="button" onClick={() => router.push('/groups')} className="btn-secondary w-full">모임 목록으로</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function GroupPreviewCard({ preview }: { preview: GroupPreviewResponse }) {
  const profile = getFileUrl(preview.profileImage);
  return (
    <div className="space-y-3">
      <div className="size-16 rounded-2xl bg-raised mx-auto overflow-hidden relative flex items-center justify-center">
        {profile ? (
          <ImageWithFallback src={profile} alt={preview.name} fill containerClassName="w-full h-full" className="object-cover" unoptimized />
        ) : (
          <span className="text-2xl font-semibold text-ink-2">{[...preview.name][0]}</span>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-xs text-ink-3">모임 초대</p>
        <h1 className="text-lg font-semibold text-ink break-words">{preview.name}</h1>
        {preview.description && (
          <p className="text-sm text-ink-2 line-clamp-3 break-words">{preview.description}</p>
        )}
      </div>
      <div className="flex items-center justify-center gap-3 text-xs text-ink-2">
        <span className="flex items-center gap-1 tabular-nums">
          <Users size={14} strokeWidth={1.5} className="text-ink-3" />
          멤버 {preview.memberCount}명
        </span>
        <span className="w-px h-3 bg-line" />
        <span className="truncate">방장 {preview.ownerNickname}</span>
      </div>
    </div>
  );
}

export default function GroupInvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <Loader2 size={18} strokeWidth={1.5} className="text-ink-3 animate-spin" />
      </div>
    }>
      <GroupInviteKeyed />
    </Suspense>
  );
}
