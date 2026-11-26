'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { groupApi, GroupApiError, type GroupPreviewResponse } from '@/lib/group-api';
import { GroupAvatar, GroupCover } from '@/components/groups/GroupIdentity';
import { Loader2, LogIn, Users } from 'lucide-react';
import { normalizeInviteCode } from '@/components/groups/InviteCodeModal';
import type { LinkPreview } from '@/lib/link-preview';

type ViewState =
  | { kind: 'loading' }
  | { kind: 'enter'; message?: string }
  | { kind: 'preview'; preview: GroupPreviewResponse }
  | { kind: 'already'; groupId?: string; name?: string }
  | { kind: 'joined'; groupId?: string; name?: string }
  | { kind: 'error'; message: string; canRetry: boolean };

const BAD_CODE_MESSAGE = '초대 코드가 맞지 않거나 만료됐어요';

/** 코드 정리. 초대 링크 전체를 붙여 넣어도(대문자로 바뀐 링크 포함) code 값만 꺼낸다(InviteCodeModal 과 같은 규칙) */
function normalizeCode(input: string) {
  return normalizeInviteCode(input.replace(/([?&])code=/i, '$1code='));
}

/** 코드가 바뀌면(다른 코드 입력) 화면 상태를 새로 시작한다 */
function GroupInviteKeyed({ linkPreview }: { linkPreview: LinkPreview | null }) {
  const searchParams = useSearchParams();
  const code = searchParams.get('code');
  return <GroupInviteContent key={code || ''} code={code} linkPreview={linkPreview} />;
}

function GroupInviteContent({ code, linkPreview }: { code: string | null; linkPreview: LinkPreview | null }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const hasCode = !!code && !!normalizeCode(code);

  const [fetchedView, setView] = useState<ViewState>({ kind: 'loading' });
  // 코드 없이 들어오면 바로 코드 입력 화면
  const view: ViewState = hasCode ? fetchedView : (fetchedView.kind === 'loading' ? { kind: 'enter' } : fetchedView);
  const [joining, setJoining] = useState(false);
  // 링크로 받은 코드가 틀렸을 때도 무엇을 넣었는지 보이고 고칠 수 있게 미리 채운다
  const [codeInput, setCodeInput] = useState(() => (code ? normalizeCode(code) : ''));

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
        setView({ kind: 'error', message: e.message || '초대 코드를 확인하지 못했어요', canRetry: true });
      }
    }
  }, [session]);

  useEffect(() => {
    if (status === 'loading') return;

    // 비로그인: 바로 로그인 화면으로 보내지 않고, 어떤 모임 초대인지 먼저 보여 준다(아래 'login' 화면)
    if (status === 'unauthenticated') return;

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
        setView({ kind: 'error', message: e.message || '모임에 참여하지 못했어요', canRetry: e.status !== 403 });
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

  const goLogin = () => {
    const target = code ? `/invite/group?code=${encodeURIComponent(normalizeCode(code))}` : '/invite/group';
    router.push(`/?callbackUrl=${encodeURIComponent(target)}`);
  };

  if (status === 'unauthenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas p-4 pb-24">
        <div className="card w-full max-w-[420px] p-6">
          <p className="text-xs text-ink-3">모임 초대</p>
          {linkPreview ? (
            <>
              <h1 className="mt-1 break-words break-keep font-display text-xl leading-7 text-ink">{linkPreview.name}</h1>
              {linkPreview.description && (
                <p className="mt-1 line-clamp-3 break-words break-keep text-sm text-ink-2">{linkPreview.description}</p>
              )}
              {(linkPreview.memberCount != null || linkPreview.ownerNickname) && (
                <div className="mt-4 flex items-center gap-3 border-t border-line pt-4 text-[13px] text-ink-2">
                  {linkPreview.memberCount != null && (
                    <span className="flex items-center gap-1.5 tabular-nums">
                      <Users size={16} strokeWidth={1.5} className="text-ink-3" />
                      멤버 {linkPreview.memberCount}명
                    </span>
                  )}
                  {linkPreview.memberCount != null && linkPreview.ownerNickname && <span aria-hidden className="h-3 w-px bg-line-strong" />}
                  {linkPreview.ownerNickname && <span className="truncate">방장 {linkPreview.ownerNickname}</span>}
                </div>
              )}
            </>
          ) : (
            <h1 className="mt-1 font-display text-xl leading-7 text-ink">모여로그 모임에 초대받았어요</h1>
          )}
          <p className="mt-5 text-[13px] text-ink-3">로그인하면 모임 정보를 확인하고 참여할 수 있어요</p>
          <div className="mt-5 flex justify-end">
            <button onClick={goLogin} className="btn-primary max-md:h-11 max-md:flex-1">
              <LogIn size={16} strokeWidth={1.5} />
              로그인하고 참여하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-4 pb-24">
      <div className="card w-full max-w-[420px] p-6">
        {view.kind === 'loading' && (
          <div className="flex items-center gap-3">
            <Loader2 size={16} strokeWidth={1.5} className="shrink-0 animate-spin text-ink-3" />
            <div>
              <h1 className="font-display text-lg text-ink">모임 초대를 확인하고 있어요</h1>
              <p className="mt-0.5 text-sm text-ink-3">잠시만 기다려 주세요</p>
            </div>
          </div>
        )}

        {view.kind === 'preview' && <GroupPreviewCard preview={view.preview} />}

        {view.kind === 'preview' && view.preview.blocked && (
          <>
            <div className="mt-5 rounded-[10px] bg-raised px-4 py-3">
              <p className="text-sm font-medium text-ink">이 모임에 다시 들어갈 수 없어요</p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-2">모임에서 내보내져 초대 코드로는 참여할 수 없어요. 방장이 직접 초대하면 다시 참여할 수 있어요.</p>
            </div>
            <div className="mt-5 flex justify-end">
              <button onClick={() => router.push('/groups')} className="btn-primary">모임 목록으로</button>
            </div>
          </>
        )}

        {view.kind === 'preview' && !view.preview.blocked && (
          <>
            <p className="mt-5 text-[13px] text-ink-3">
              참여하면 모임 멤버에게 내 닉네임과 프로필 사진이 보여요
            </p>
            {/* 모바일은 버튼을 폭 가득·44px 로 */}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => router.push('/groups')} disabled={joining} className="btn-secondary max-md:h-11 max-md:flex-1">
                참여하지 않기
              </button>
              <button onClick={handleJoin} disabled={joining} className="btn-primary max-md:h-11 max-md:flex-1">
                {joining && <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />}
                {joining ? '참여하는 중' : '참여하기'}
              </button>
            </div>
          </>
        )}

        {view.kind === 'joined' && (
          <>
            <h1 className="font-display text-xl text-ink">모임에 참여했어요</h1>
            <p className="mt-1 text-sm text-ink-2">{view.name ? `'${view.name}' 모임으로 이동해요` : '곧 모임으로 이동해요'}</p>
            <div className="mt-5 flex justify-end">
              <button onClick={() => goGroup(view.groupId)} className="btn-primary">모임으로 가기</button>
            </div>
          </>
        )}

        {view.kind === 'already' && (
          <>
            <h1 className="font-display text-xl text-ink">이미 참여한 모임이에요</h1>
            {view.name && <p className="mt-1 break-words text-sm text-ink-2">{view.name}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => router.push('/groups')} className="btn-secondary">모임 목록으로</button>
              <button onClick={() => goGroup(view.groupId)} className="btn-primary">모임으로 가기</button>
            </div>
          </>
        )}

        {view.kind === 'error' && (
          <>
            <h1 className="font-display text-xl text-ink">모임에 참여할 수 없어요</h1>
            <p className="mt-1 text-sm text-negative">{view.message}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => router.push('/groups')} className={view.canRetry && code ? 'btn-secondary' : 'btn-primary'}>
                모임 목록으로
              </button>
              {view.canRetry && code && (
                <button onClick={() => loadPreview(normalizeCode(code))} className="btn-primary">다시 시도</button>
              )}
            </div>
          </>
        )}

        {view.kind === 'enter' && (
          <form onSubmit={handleSubmitCode}>
            <h1 className="font-display text-xl text-ink">초대 코드로 참여</h1>
            <p className={`mt-1 text-sm ${view.message ? 'text-negative' : 'text-ink-2'}`}>
              {view.message || '모임에서 받은 초대 코드를 입력해 주세요'}
            </p>
            <input
              type="text"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="예: AB12CD 또는 초대 링크"
              aria-label="초대 코드"
              autoComplete="off"
              autoCapitalize="characters"
              autoFocus
              className="form-input mt-4 h-10 text-center text-base font-medium tabular-nums tracking-wide"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => router.push('/groups')} className="btn-secondary max-md:h-11 max-md:flex-1">모임 목록으로</button>
              <button type="submit" disabled={!normalizeCode(codeInput)} className="btn-primary max-md:h-11 max-md:flex-1">확인</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function GroupPreviewCard({ preview }: { preview: GroupPreviewResponse }) {
  // backgroundImage 는 미리보기 응답에 새로 붙은 필드. 이전 서버면 없으니 optional 로 읽는다
  const cover = (preview as GroupPreviewResponse & { backgroundImage?: string | null }).backgroundImage;
  return (
    <div>
      <GroupCover src={cover} theme={preview.colorTheme} className="-mx-6 -mt-6 h-24 rounded-t-xl" />
      <GroupAvatar
        name={preview.name}
        src={preview.profileImage}
        theme={preview.colorTheme}
        size="lg"
        className="-mt-7 shadow-[0_0_0_3px_var(--surface)]"
      />
      <p className="mt-3 text-xs text-ink-3">모임 초대</p>
      <h1 className="mt-1 break-words break-keep font-display text-xl leading-7 text-ink">{preview.name}</h1>
      {preview.description && (
        <p className="mt-1 line-clamp-3 break-words break-keep text-sm text-ink-2">{preview.description}</p>
      )}
      <div className="mt-4 flex items-center gap-3 border-t border-line pt-4 text-[13px] text-ink-2">
        <span className="flex items-center gap-1.5 tabular-nums">
          <Users size={16} strokeWidth={1.5} className="text-ink-3" />
          멤버 {preview.memberCount}명
        </span>
        <span aria-hidden className="h-3 w-px bg-line-strong" />
        <span className="truncate">방장 {preview.ownerNickname}</span>
      </div>
    </div>
  );
}

export default function GroupInvitePage({ linkPreview = null }: { linkPreview?: LinkPreview | null }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <Loader2 size={18} strokeWidth={1.5} className="text-ink-3 animate-spin" />
      </div>
    }>
      <GroupInviteKeyed linkPreview={linkPreview} />
    </Suspense>
  );
}
