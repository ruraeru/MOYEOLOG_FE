'use client';

import { useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, isValid, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Laptop, Loader2, LogOut } from 'lucide-react';
import { userApi, type LoginSession, type UserResponse } from '@/lib/user-api';
import { getApiErrorMessage } from '@/lib/axios';
import { useAlertStore } from '@/hooks/useAlert';
import { InlineError, LoadError, SettingsGroup, SettingsRow, Toggle, usePref } from './ui';

const WITHDRAW_PHRASE = '탈퇴할게요';

function formatStamp(value: string | null | undefined, timeFormat: string) {
  if (!value) return null;
  const date = parseISO(value);
  if (!isValid(date)) return null;
  return format(date, `M.d EEE ${timeFormat}`, { locale: ko });
}

export default function SecuritySection({ user }: { user: UserResponse }) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const { confirm } = useAlertStore();
  const hour12 = usePref('hour12');
  const timeFormat = hour12 === 'true' ? 'a h:mm' : 'HH:mm';

  const [emailError, setEmailError] = useState<string | null>(null);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawText, setWithdrawText] = useState('');
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

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
      '이 기기를 포함해 로그인된 모든 기기에서 로그아웃해요. 다시 쓰려면 카카오로 다시 로그인해야 해요.',
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
      <SettingsGroup title="이메일">
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
              '카카오 계정에서 받은 이메일이 없어 보여 줄 이메일이 없어요'
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
