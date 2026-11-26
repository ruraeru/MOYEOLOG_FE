'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { MessageCircle, UserPlus, Check, Settings, Link2 } from 'lucide-react';
import ImageWithFallback from '@/components/ImageWithFallback';
import { friendApi, resolveImageUrl, type UserProfileResponse } from '@/lib/friend-api';
import { getApiErrorMessage } from '@/lib/axios';
import { refreshUnreadCounts } from '@/lib/notification-api';
import { useAlert } from '@/hooks/useAlert';
import { initialOf } from '@/lib/utils';

interface UserProfileCardProps {
  profile: UserProfileResponse;
  /** 친구 상태가 바뀐 뒤 프로필을 다시 불러옵니다. */
  onChanged: () => void;
  /** 초대 링크 화면이면 문구를 초대 기준으로 바꿉니다. */
  variant?: 'page' | 'invite';
}

const STATUS_TEXT: Record<UserProfileResponse['friendStatus'], string> = {
  NONE: '',
  PENDING_SENT: '친구 신청을 보냈어요. 상대가 수락하면 친구가 돼요.',
  PENDING_RECEIVED: '나에게 친구 신청을 보냈어요',
  FRIEND: '친구예요',
  SELF: '내 프로필이에요',
};

export default function UserProfileCard({ profile, onChanged, variant = 'page' }: UserProfileCardProps) {
  const { data: session } = useSession();
  const { toast, confirm } = useAlert();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const run = async (action: () => Promise<void>, success: string, failure: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      toast.success(success);
      refreshUnreadCounts();
    } catch (error) {
      toast.error(getApiErrorMessage(error, failure));
    } finally {
      setBusy(false);
      onChanged();
    }
  };

  /** 받은·보낸 요청 목록에서 이 사람과의 요청 ID 를 찾습니다. */
  const findRequestId = async (kind: 'received' | 'sent') => {
    const list = kind === 'received' ? await friendApi.getRequests(session) : await friendApi.getSentRequests(session);
    const found = list.find((r) => r.userId === profile.id);
    if (!found) throw new Error('이미 처리된 친구 요청이에요.');
    return found.id;
  };

  const sendRequest = () =>
    run(() => friendApi.sendRequest(profile.customId, session), '친구 신청을 보냈어요', '친구 신청을 보내지 못했어요.');

  // 친구 목록의 '요청 취소'와 같게 한 번 묻습니다.
  const cancelRequest = async () => {
    if (!(await confirm(`${profile.nickname}님에게 보낸 친구 요청을 취소할까요?`, undefined, '요청 취소', '닫기'))) return;
    run(
      async () => friendApi.deleteFriendship(await findRequestId('sent'), session),
      '친구 신청을 취소했어요',
      '친구 신청을 취소하지 못했어요.',
    );
  };

  const acceptRequest = () =>
    run(
      async () => friendApi.acceptRequest(await findRequestId('received'), session),
      '친구 요청을 수락했어요',
      '요청을 수락하지 못했어요.',
    );

  const rejectRequest = async () => {
    if (!(await confirm(`${profile.nickname}님의 친구 요청을 거절할까요?`, undefined, '거절', '닫기'))) return;
    run(
      async () => friendApi.deleteFriendship(await findRequestId('received'), session),
      '친구 요청을 거절했어요',
      '요청을 거절하지 못했어요.',
    );
  };

  /** 내 초대 링크 화면: 링크를 복사(모바일은 공유 시트)합니다. */
  const shareInviteLink = async () => {
    const link = `${window.location.origin}/invite/friend?code=${encodeURIComponent(profile.customId)}`;
    if (typeof navigator.share === 'function' && window.matchMedia('(pointer: coarse)').matches) {
      try {
        await navigator.share({ title: '모여로그 친구 초대', url: link });
      } catch {
        // 사용자가 공유 창을 닫은 경우
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('링크를 복사하지 못했어요. 주소창의 주소를 복사해 주세요.');
    }
  };

  const image = resolveImageUrl(profile.profileImage);
  const statusText =
    variant === 'invite' && profile.friendStatus === 'NONE'
      ? '친구 신청을 보내면 상대가 수락한 뒤 친구가 돼요'
      : variant === 'invite' && profile.friendStatus === 'SELF'
        ? '내 친구 초대 링크예요. 친구에게 보내 주세요.'
        : STATUS_TEXT[profile.friendStatus];

  return (
    <div className="card p-5 sm:p-6 space-y-5">
      <div className="flex items-center gap-4">
        <div className="relative size-16 shrink-0 rounded-full bg-raised flex items-center justify-center overflow-hidden">
          {image ? (
            <ImageWithFallback
              src={image}
              alt={profile.nickname}
              fill
              sizes="64px"
              containerClassName="w-full h-full"
              className="object-cover"
              unoptimized
            />
          ) : (
            <span className="text-xl text-ink-2">{initialOf(profile.nickname)}</span>
          )}
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-2xl leading-8 text-ink [overflow-wrap:anywhere]">{profile.nickname}</h1>
          <p className="text-[13px] text-ink-3 truncate">@{profile.customId}</p>
        </div>
      </div>

      {profile.bio ? (
        <p className="text-sm text-ink-2 leading-relaxed whitespace-pre-wrap break-words">{profile.bio}</p>
      ) : variant === 'page' ? (
        <p className="text-sm text-ink-3">자기소개가 없어요</p>
      ) : null}

      {profile.mutualGroups?.length > 0 && (
        <div className="space-y-2 border-t border-line pt-4">
          <p className="text-xs font-medium text-ink-3">
            {profile.friendStatus === 'SELF' ? '내 모임' : '함께 있는 모임'} <span className="tabular-nums">{profile.mutualGroups.length}</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {profile.mutualGroups.map((g) => (
              <Link
                key={g.id}
                href={`/groups/${g.id}`}
                className="chip h-7 px-2.5 hover:bg-line hover:text-ink transition-colors max-w-full truncate"
              >
                {g.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {statusText && <p className="text-[13px] text-ink-2">{statusText}</p>}

      <div className="flex flex-col sm:flex-row gap-2">
        {profile.friendStatus === 'NONE' && (
          <button onClick={sendRequest} disabled={busy} className="btn-primary sm:flex-1">
            <UserPlus size={16} strokeWidth={1.5} />
            친구 신청
          </button>
        )}
        {profile.friendStatus === 'PENDING_SENT' && (
          <button onClick={cancelRequest} disabled={busy} className="btn-secondary sm:flex-1">
            친구 신청 취소
          </button>
        )}
        {profile.friendStatus === 'PENDING_RECEIVED' && (
          <>
            <button onClick={acceptRequest} disabled={busy} className="btn-primary sm:flex-1">
              <Check size={16} strokeWidth={1.5} />
              수락
            </button>
            <button onClick={rejectRequest} disabled={busy} className="btn-secondary sm:flex-1">
              거절
            </button>
          </>
        )}
        {profile.friendStatus === 'FRIEND' && (
          <Link href={`/messages/${profile.id}`} className="btn-primary sm:flex-1">
            <MessageCircle size={16} strokeWidth={1.5} />
            메시지 보내기
          </Link>
        )}
        {profile.friendStatus === 'SELF' && variant === 'invite' && (
          <button onClick={shareInviteLink} className="btn-primary sm:flex-1">
            {copied ? <Check size={16} strokeWidth={1.5} /> : <Link2 size={16} strokeWidth={1.5} />}
            {copied ? '복사했어요' : '초대 링크 복사'}
          </button>
        )}
        {profile.friendStatus === 'SELF' && variant === 'page' && (
          <Link href="/settings" className="btn-secondary sm:flex-1">
            <Settings size={16} strokeWidth={1.5} />
            프로필 관리
          </Link>
        )}
      </div>
    </div>
  );
}
