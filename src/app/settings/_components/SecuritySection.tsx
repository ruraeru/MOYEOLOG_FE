'use client';

import { useEffect, useState } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, isValid, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CheckCircle2, Laptop, Loader2, LogOut } from 'lucide-react';
import { userApi, type LoginSession, type UserResponse } from '@/lib/user-api';
import { getApiErrorMessage, getApiErrorStatus } from '@/lib/axios';
import { useAlertStore } from '@/hooks/useAlert';
import { InlineError, LoadError, SettingsGroup, SettingsRow, Toggle, usePref } from './ui';

const WITHDRAW_PHRASE = '탈퇴할게요';

/** 카카오 연결·재로그인 뒤 돌아올 주소. 성공 표시(linked=kakao)·실패 표시(linkError)는 서버가 붙인다(ea-report/fe-auth.md). */
const SECURITY_SETTINGS_PATH = '/settings?menu=security';

type Notice = { type: 'success' | 'error'; text: string };
type OpenForm = 'email' | 'password' | 'kakao' | null;

/** 카카오 연결 결과 쿼리(linked, linkError)를 읽는다. 이 화면은 클라이언트에서만 그려진다. */
function readLinkResult(): Notice | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get('linked') === 'kakao') {
    return { type: 'success', text: '카카오 계정을 연결했어요. 이제 카카오로도 로그인할 수 있어요.' };
  }
  const linkError = params.get('linkError');
  if (linkError === 'KakaoInUse') {
    return {
      type: 'error',
      text: '이미 다른 계정에 연결된 카카오 계정이에요. 그 계정에서 연결을 해제한 뒤 다시 시도해 주세요.',
    };
  }
  if (linkError) return { type: 'error', text: '카카오 계정을 연결하지 못했어요. 잠시 후 다시 시도해 주세요.' };
  return null;
}

/** 백엔드 규칙과 같다: 8자 이상, UTF-8 72바이트 이하(BCrypt 한도). */
function passwordProblem(password: string): string | null {
  if ([...password].length < 8) return '비밀번호는 8자 이상이어야 해요.';
  if (new TextEncoder().encode(password).length > 72) return '비밀번호가 너무 길어요. 영문 기준 72자 이하로 줄여 주세요.';
  return null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatStamp(value: string | null | undefined, timeFormat: string) {
  if (!value) return null;
  const date = parseISO(value);
  if (!isValid(date)) return null;
  return format(date, `M.d EEE ${timeFormat}`, { locale: ko });
}

export default function SecuritySection({ user }: { user: UserResponse }) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const { confirm, alert } = useAlertStore();
  const hour12 = usePref('hour12');
  const timeFormat = hour12 === 'true' ? 'a h:mm' : 'HH:mm';

  const [loginNotice, setLoginNotice] = useState<Notice | null>(readLinkResult);
  const [openForm, setOpenForm] = useState<OpenForm>(null);
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  // 비밀번호 없는 계정이 로그인 방법을 바꾸려면 최근 10분 안에 카카오로 로그인했어야 한다(백엔드 403)
  const [needsKakaoReauth, setNeedsKakaoReauth] = useState(false);

  const [emailError, setEmailError] = useState<string | null>(null);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawText, setWithdrawText] = useState('');
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  // 연결 결과 쿼리는 한 번만 알린다(새로고침해도 다시 뜨지 않게 주소에서 뺀다).
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('linked') && !url.searchParams.has('linkError')) return;
    url.searchParams.delete('linked');
    url.searchParams.delete('linkError');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }, []);

  // ── 로그인 방법 ──
  const hasPassword = !!user.hasPassword;
  const kakaoLinked = !!user.kakaoLinked;
  const emailVerified = !!user.email && !!user.emailVerified;
  const canSetPassword = hasPassword || emailVerified;
  const unlinkBlockedReason = !hasPassword
    ? '비밀번호를 설정해야 카카오 연결을 해제할 수 있어요'
    : !emailVerified
      ? '이메일을 인증해야 카카오 연결을 해제할 수 있어요'
      : null;

  const openLoginForm = (form: OpenForm) => {
    setOpenForm(form);
    setFormError(null);
    setNeedsKakaoReauth(false);
    setLoginNotice(null);
    setNewEmail(form === 'email' && user.email && !user.emailVerified ? user.email : '');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const resetFormError = () => {
    setFormError(null);
    setNeedsKakaoReauth(false);
  };

  const handleLoginFormError = (err: unknown, fallback: string) => {
    setFormError(getApiErrorMessage(err, fallback));
    setNeedsKakaoReauth(!hasPassword && getApiErrorStatus(err) === 403);
  };

  const emailChangeMutation = useMutation({
    mutationFn: (email: string) =>
      userApi.requestEmailChange(hasPassword ? { email, currentPassword } : { email }, session),
    onMutate: resetFormError,
    onSuccess: (_, email) => {
      setOpenForm(null);
      setLoginNotice({
        type: 'success',
        text: `${email} 주소로 인증 메일을 보냈어요. 메일의 링크를 눌러야 반영돼요. 메일이 안 보이면 스팸함도 확인해 주세요.`,
      });
    },
    onError: (err) => handleLoginFormError(err, '인증 메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요.'),
  });

  const passwordMutation = useMutation({
    mutationFn: () =>
      userApi.updatePassword(
        hasPassword ? { currentPassword, newPassword } : { newPassword },
        session
      ),
    onMutate: resetFormError,
    onSuccess: async () => {
      setOpenForm(null);
      if (hasPassword) {
        // 비밀번호를 바꾸면 백엔드가 모든 기기의 로그인을 끊는다
        await alert('비밀번호를 바꿨어요. 모든 기기에서 로그아웃했으니 새 비밀번호로 다시 로그인해 주세요.', '비밀번호 변경');
        await signOut({ callbackUrl: '/' });
        return;
      }
      setLoginNotice({
        type: 'success',
        text: '비밀번호를 설정했어요. 이제 이메일과 비밀번호로도 로그인할 수 있어요.',
      });
      queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
    },
    onError: (err) => handleLoginFormError(err, '비밀번호를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.'),
  });

  const linkKakaoMutation = useMutation({
    mutationFn: async () => {
      await userApi.startKakaoLink();
      // 카카오 로그인 화면으로 넘어간다. 결과는 돌아온 주소의 쿼리로 알린다.
      await signIn('kakao', { callbackUrl: SECURITY_SETTINGS_PATH });
    },
    onMutate: () => setLoginNotice(null),
    onError: (err) =>
      setLoginNotice({ type: 'error', text: getApiErrorMessage(err, '카카오 연결을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.') }),
  });

  const unlinkKakaoMutation = useMutation({
    mutationFn: () => userApi.unlinkKakao(currentPassword, session),
    onMutate: () => setFormError(null),
    onSuccess: (updated) => {
      setOpenForm(null);
      queryClient.setQueryData(['user', 'me'], updated);
      setLoginNotice({ type: 'success', text: '카카오 연결을 해제했어요. 이제 이메일과 비밀번호로 로그인해 주세요.' });
    },
    onError: (err) => setFormError(getApiErrorMessage(err, '카카오 연결을 해제하지 못했어요. 잠시 후 다시 시도해 주세요.')),
  });

  const handleUnlinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (unlinkKakaoMutation.isPending) return;
    if (!currentPassword) {
      setFormError('지금 비밀번호를 입력해 주세요.');
      return;
    }
    unlinkKakaoMutation.mutate();
  };

  /** 로그인 방법을 바꾸기 전에 본인 확인용으로 받는 지금 비밀번호 */
  const currentPasswordField = (
    <div className="space-y-2">
      <label htmlFor="security-current-password" className="block text-sm text-ink">
        지금 비밀번호
      </label>
      <input
        id="security-current-password"
        type="password"
        autoComplete="current-password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        className="form-input"
      />
    </div>
  );

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailChangeMutation.isPending) return;
    const email = newEmail.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) {
      setFormError('이메일 주소를 다시 확인해 주세요.');
      return;
    }
    if (email === user.email?.toLowerCase() && user.emailVerified) {
      setFormError('지금 쓰고 있는 이메일이에요.');
      return;
    }
    if (hasPassword && !currentPassword) {
      setFormError('지금 비밀번호를 입력해 주세요.');
      return;
    }
    emailChangeMutation.mutate(email);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordMutation.isPending) return;
    if (hasPassword && !currentPassword) {
      setFormError('지금 비밀번호를 입력해 주세요.');
      return;
    }
    const problem = passwordProblem(newPassword);
    if (problem) {
      setFormError(problem);
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError('새 비밀번호가 서로 달라요. 다시 확인해 주세요.');
      return;
    }
    passwordMutation.mutate();
  };

  // link-intent 없이 부르므로 일반 로그인(sync)으로 같은 계정의 새 세션을 받는다
  const kakaoReauthButton = (
    <button
      type="button"
      onClick={() => signIn('kakao', { callbackUrl: SECURITY_SETTINGS_PATH })}
      className="btn-secondary w-full"
    >
      카카오로 다시 로그인
    </button>
  );

  const formButtons = (pending: boolean, submitLabel: string) => (
    <div className="flex justify-end gap-2">
      <button type="button" onClick={() => setOpenForm(null)} className="btn-secondary">
        취소
      </button>
      <button type="submit" disabled={pending} className="btn-primary">
        {pending && <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />}
        {submitLabel}
      </button>
    </div>
  );

  // ── 이메일 공개 ──
  const emailMutation = useMutation({
    mutationFn: (emailVisible: boolean) => userApi.updateMe({ emailVisible }, null, session),
    onMutate: () => setEmailError(null),
    onSuccess: (updated) => queryClient.setQueryData(['user', 'me'], updated),
    onError: (err) => setEmailError(getApiErrorMessage(err, '이메일 공개 설정을 저장하지 못했어요.')),
  });

  // ── 로그인 세션 ──
  const sessionsQuery = useQuery({
    queryKey: ['user', 'sessions'],
    queryFn: () => userApi.getSessions(),
    enabled: !!session?.user?.accessToken,
  });

  const logoutAllMutation = useMutation({
    mutationFn: () => userApi.logoutAllSessions(session),
    onMutate: () => setSessionsError(null),
    onSuccess: () => signOut({ callbackUrl: '/' }),
    onError: (err) => setSessionsError(getApiErrorMessage(err, '모든 기기에서 로그아웃하지 못했어요.')),
  });

  const handleLogoutAll = async () => {
    const ok = await confirm(
      '이 기기를 포함해 로그인된 모든 기기에서 로그아웃해요. 다시 쓰려면 다시 로그인해야 해요.',
      '모든 기기에서 로그아웃',
      '로그아웃'
    );
    if (ok) logoutAllMutation.mutate();
  };

  // ── 회원 탈퇴 ──
  const withdrawMutation = useMutation({
    mutationFn: () => userApi.deleteMe(session),
    onMutate: () => setWithdrawError(null),
    onSuccess: () => signOut({ callbackUrl: '/' }),
    onError: (err) => setWithdrawError(getApiErrorMessage(err, '탈퇴하지 못했어요. 잠시 후 다시 시도해 주세요.')),
  });

  const sessions: LoginSession[] = sessionsQuery.data ?? [];

  return (
    <div className="space-y-10">
      <div className="space-y-3">
        <SettingsGroup title="로그인 방법" description="한 계정에 이메일 로그인과 카카오 로그인을 함께 붙일 수 있어요.">
          <SettingsRow
            label="이메일"
            description={
              user.email ? (
                <>
                  <span className="break-all">{user.email}</span>
                  <span className="block">
                    {user.emailVerified ? (
                      <span className="text-positive">인증됨</span>
                    ) : (
                      '인증 전이에요. 인증해야 비밀번호를 설정할 수 있어요'
                    )}
                  </span>
                </>
              ) : (
                '등록된 이메일이 없어요. 등록하고 인증하면 비밀번호를 설정할 수 있어요'
              )
            }
          >
            {openForm !== 'email' && (
              <button type="button" onClick={() => openLoginForm('email')} className="btn-secondary">
                {!user.email ? '등록' : user.emailVerified ? '변경' : '인증'}
              </button>
            )}
          </SettingsRow>
          {openForm === 'email' && (
            <form className="space-y-3 px-5 py-4 lg:px-6" onSubmit={handleEmailSubmit} noValidate>
              <label htmlFor="security-new-email" className="block text-sm text-ink">
                {user.emailVerified ? '새 이메일' : '인증할 이메일'}
              </label>
              <input
                id="security-new-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="name@example.com"
                className="form-input"
              />
              <p className="text-[13px] text-ink-3">
                이 주소로 인증 메일을 보내요. 메일의 링크를 누르기 전까지는 지금 이메일이 그대로예요.
              </p>
              {hasPassword && currentPasswordField}
              {formError && <InlineError message={formError} />}
              {needsKakaoReauth && kakaoReauthButton}
              {formButtons(emailChangeMutation.isPending, '인증 메일 보내기')}
            </form>
          )}

          <SettingsRow
            label="비밀번호"
            description={
              hasPassword
                ? '이메일과 비밀번호로 로그인할 수 있어요'
                : canSetPassword
                  ? '비밀번호를 설정하면 이메일로도 로그인할 수 있어요'
                  : '이메일을 먼저 인증해야 비밀번호를 설정할 수 있어요'
            }
          >
            {openForm !== 'password' && (
              <button
                type="button"
                onClick={() => openLoginForm('password')}
                disabled={!canSetPassword}
                className="btn-secondary"
              >
                {hasPassword ? '변경' : '설정'}
              </button>
            )}
          </SettingsRow>
          {openForm === 'password' && (
            <form className="space-y-3 px-5 py-4 lg:px-6" onSubmit={handlePasswordSubmit} noValidate>
              {/* 비밀번호 관리자가 계정을 알아보도록 */}
              <input type="email" autoComplete="username" value={user.email ?? ''} readOnly hidden />
              {hasPassword && currentPasswordField}
              <div className="space-y-2">
                <label htmlFor="security-new-password" className="block text-sm text-ink">
                  새 비밀번호
                </label>
                <input
                  id="security-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="form-input"
                />
                <p className="text-[13px] text-ink-3">
                  8자 이상으로 입력해 주세요{hasPassword ? '. 바꾸면 모든 기기에서 로그아웃돼요' : ''}
                </p>
              </div>
              <div className="space-y-2">
                <label htmlFor="security-confirm-password" className="block text-sm text-ink">
                  새 비밀번호 확인
                </label>
                <input
                  id="security-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="form-input"
                />
              </div>
              {formError && <InlineError message={formError} />}
              {needsKakaoReauth && kakaoReauthButton}
              {formButtons(passwordMutation.isPending, hasPassword ? '비밀번호 바꾸기' : '비밀번호 설정')}
            </form>
          )}

          <SettingsRow
            label="카카오"
            description={
              kakaoLinked
                ? unlinkBlockedReason
                  ? `카카오로 로그인할 수 있어요. ${unlinkBlockedReason}`
                  : '카카오로 로그인할 수 있어요'
                : '연결하면 카카오로도 로그인할 수 있어요'
            }
          >
            {kakaoLinked ? (
              openForm !== 'kakao' && (
                <button
                  type="button"
                  onClick={() => openLoginForm('kakao')}
                  disabled={!!unlinkBlockedReason}
                  className="btn-secondary"
                >
                  연결 해제
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={() => linkKakaoMutation.mutate()}
                disabled={linkKakaoMutation.isPending}
                className="btn-secondary"
              >
                {linkKakaoMutation.isPending && <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />}
                연결
              </button>
            )}
          </SettingsRow>
          {openForm === 'kakao' && (
            <form className="space-y-3 px-5 py-4 lg:px-6" onSubmit={handleUnlinkSubmit} noValidate>
              <input type="email" autoComplete="username" value={user.email ?? ''} readOnly hidden />
              <p className="text-sm leading-relaxed text-ink-2">
                해제하면 카카오로는 이 계정에 로그인할 수 없어요. 해제한 뒤 카카오로 시작하면 빈 새 계정이 만들어져요. 다음부터는 이메일(<span className="break-all">{user.email}</span>)과
                비밀번호로 로그인해 주세요. 본인 확인을 위해 지금 비밀번호를 입력해 주세요.
              </p>
              {currentPasswordField}
              {formError && <InlineError message={formError} />}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setOpenForm(null)} className="btn-secondary">
                  취소
                </button>
                <button type="submit" disabled={unlinkKakaoMutation.isPending} className="btn-danger">
                  {unlinkKakaoMutation.isPending && <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />}
                  연결 해제
                </button>
              </div>
            </form>
          )}
        </SettingsGroup>
        {loginNotice?.type === 'error' && <InlineError message={loginNotice.text} />}
        {loginNotice?.type === 'success' && (
          <p role="status" className="flex items-start gap-1.5 px-1 text-sm text-ink-2">
            <CheckCircle2 size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-positive" aria-hidden />
            {loginNotice.text}
          </p>
        )}
      </div>

      <SettingsGroup title="이메일 공개">
        <SettingsRow
          label="친구에게 이메일 보여 주기"
          htmlFor="security-email-visible"
          description={
            user.email ? (
              <>
                <span className="break-all">{user.email}</span>
                <span className="block">켜면 친구 목록에서 친구가 내 이메일을 볼 수 있어요</span>
              </>
            ) : (
              '등록된 이메일이 없어 보여 줄 이메일이 없어요'
            )
          }
        >
          <Toggle
            id="security-email-visible"
            label="친구에게 이메일 보여 주기"
            checked={!!user.emailVisible}
            disabled={!user.email || emailMutation.isPending}
            onChange={(next) => emailMutation.mutate(next)}
          />
        </SettingsRow>
      </SettingsGroup>
      {emailError && <InlineError message={emailError} />}

      <div className="space-y-3">
        <SettingsGroup title="로그인된 기기" description="이 계정으로 로그인한 기기예요. 모르는 기기가 있으면 모든 기기에서 로그아웃해 주세요.">
          {sessionsQuery.isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 size={20} strokeWidth={1.5} className="animate-spin text-ink-3" />
            </div>
          ) : sessionsQuery.isError ? (
            <LoadError
              message={getApiErrorMessage(sessionsQuery.error, '로그인된 기기를 불러오지 못했어요.')}
              onRetry={() => sessionsQuery.refetch()}
            />
          ) : sessions.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-3 lg:px-6">로그인된 기기 정보가 없어요</p>
          ) : (
            sessions.map((item, index) => {
              const created = formatStamp(item.createdAt, timeFormat);
              const lastUsed = formatStamp(item.lastUsedAt, timeFormat);
              return (
                <div key={String(item.id)} className="flex min-h-16 items-center gap-3 px-5 py-3 lg:px-6">
                  <Laptop size={18} strokeWidth={1.5} className="shrink-0 text-ink-3" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium text-ink">
                      {item.current ? '지금 이 기기' : `다른 기기 ${index + 1}`}
                    </p>
                    <p className="mt-0.5 flex flex-wrap gap-x-3">
                      {created && <span className="stamp">로그인 {created}</span>}
                      {lastUsed && <span className="stamp">최근 사용 {lastUsed}</span>}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div className="flex flex-wrap justify-end gap-2 px-5 py-3 lg:px-6">
            <button type="button" onClick={() => signOut({ callbackUrl: '/' })} className="btn-secondary">
              <LogOut size={16} strokeWidth={1.5} />이 기기에서 로그아웃
            </button>
            <button
              type="button"
              onClick={handleLogoutAll}
              disabled={logoutAllMutation.isPending}
              className="btn-danger"
            >
              {logoutAllMutation.isPending && <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />}
              모든 기기에서 로그아웃
            </button>
          </div>
        </SettingsGroup>
        {sessionsError && <InlineError message={sessionsError} />}
      </div>

      <SettingsGroup title="회원 탈퇴">
        <div className="space-y-4 px-5 py-4 lg:px-6">
          <p className="text-sm leading-relaxed text-ink-2">
            탈퇴하면 내가 쓴 메모·일정·토픽·댓글, 친구 관계, 공유, 알림과 메시지가 모두 지워지고 되돌릴 수 없어요.
            내가 방장인 모임은 가장 오래된 멤버에게 넘어가고, 혼자인 모임은 삭제돼요.
          </p>
          {!withdrawOpen ? (
            <div className="flex justify-end">
              <button type="button" onClick={() => setWithdrawOpen(true)} className="btn-danger">
                탈퇴하기
              </button>
            </div>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (withdrawText.trim() !== WITHDRAW_PHRASE || withdrawMutation.isPending) return;
                withdrawMutation.mutate();
              }}
            >
              <label htmlFor="withdraw-confirm" className="block text-sm text-ink">
                계속하려면 <span className="font-medium">{WITHDRAW_PHRASE}</span> 를 입력해 주세요
              </label>
              <input
                id="withdraw-confirm"
                value={withdrawText}
                onChange={(e) => setWithdrawText(e.target.value)}
                autoComplete="off"
                placeholder={WITHDRAW_PHRASE}
                className="form-input"
              />
              {withdrawError && <InlineError message={withdrawError} />}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setWithdrawOpen(false);
                    setWithdrawText('');
                    setWithdrawError(null);
                  }}
                  className="btn-secondary"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={withdrawText.trim() !== WITHDRAW_PHRASE || withdrawMutation.isPending}
                  className="btn-danger"
                >
                  {withdrawMutation.isPending && <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />}
                  회원 탈퇴
                </button>
              </div>
            </form>
          )}
        </div>
      </SettingsGroup>
    </div>
  );
}
