'use client';

import React, { useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Plus, ArrowLeft, Loader2, RefreshCw, MapPin, Link as LinkIcon, History, Users, Inbox } from 'lucide-react';
import { useGroupModal } from './GroupModalContext';
import { groupApi, type GroupActivityResponse, type GroupResponse } from '@/lib/group-api';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { format, parseISO, isValid } from 'date-fns';
import { useTimeFormat } from '@/lib/schedule-utils';
import { ko } from 'date-fns/locale';
import { stripMarkdown, getThemeColors } from '@/lib/utils';
import { getApiErrorMessage } from '@/lib/axios';
import { PageHeader, Ribbon, EmptyState } from '@/components/ui';
import { ErrorState, Avatar, AvatarStack } from '@/components/groups/GroupUI';
import { InviteCodeModal } from '@/components/groups/InviteCodeModal';

export default function GroupsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { openCreateModal, groups, groupsLoading, groupsError, refreshGroups } = useGroupModal();
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [activities, setActivities] = useState<GroupActivityResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [isCodeOpen, setIsCodeOpen] = useState(false);

  const colorByGroup = useMemo(() => {
    const map = new Map<string, string>();
    groups.forEach(g => map.set(g.id, getThemeColors(g.colorTheme).hex));
    return map;
  }, [groups]);

  const fetchActivities = useCallback(async () => {
    if (!session) return;
    try {
      setLoading(true);
      setActivityError(null);
      const data = await groupApi.getActivities(session);
      setActivities(data);
    } catch (error) {
      console.error('Failed to fetch activities:', error);
      setActivityError(getApiErrorMessage(error, '최근 활동을 불러오지 못했어요.'));
    } finally {
      setLoading(false);
    }
  }, [session]);

  const handleStartBrowsing = () => {
    setIsBrowsing(true);
    fetchActivities();
  };

  const handleActivityClick = (activity: GroupActivityResponse) => {
    switch (activity.type) {
      case 'MEMO':
        router.push(`/memo/${activity.id}`);
        break;
      case 'TOPIC':
      case 'COMMENT':
        // 댓글 활동의 id 는 토픽 ID
        router.push(`/groups/${activity.groupId}?topic=${encodeURIComponent(activity.id)}`);
        break;
      case 'SCHEDULE':
        router.push(`/schedule/${activity.id}`);
        break;
      default:
        router.push(`/groups/${activity.groupId}`);
    }
  };

  if (isBrowsing) {
    return (
      <div className="flex-1 overflow-y-auto no-scrollbar bg-canvas">
        <div className="mx-auto max-w-3xl px-4 pt-6 pb-24 md:px-8 lg:pt-8">
          <div className="flex items-start gap-2">
            <button
              onClick={() => setIsBrowsing(false)}
              className="btn-icon mt-0.5 shrink-0 lg:mt-1"
              aria-label="뒤로"
            >
              <ArrowLeft size={18} strokeWidth={1.5} />
            </button>
            <PageHeader
              className="flex-1"
              title="최근 활동"
              description="참여 중인 모임의 새 메모·토픽·일정"
              actions={
                <button
                  onClick={fetchActivities}
                  disabled={loading}
                  className="btn-icon"
                  aria-label="새로고침"
                >
                  {loading ? <Loader2 size={16} strokeWidth={1.5} className="animate-spin" /> : <RefreshCw size={16} strokeWidth={1.5} />}
                </button>
              }
            />
          </div>

          <div className="mt-6 space-y-3">
            {loading && activities.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-24 text-sm text-ink-3">
                <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
                활동 내역을 불러오는 중이에요
              </div>
            ) : activityError ? (
              <ErrorState message={activityError} onRetry={fetchActivities} />
            ) : activities.length > 0 ? (
              activities.map((activity, idx) => (
                <ActivityCard
                  key={`${activity.type}-${activity.id}-${idx}`}
                  activity={activity}
                  color={colorByGroup.get(activity.groupId)}
                  onClick={() => handleActivityClick(activity)}
                />
              ))
            ) : (
              <EmptyState
                icon={Inbox}
                title="최근 활동이 없어요"
                description="참여 중인 모임에서 소식이 생기면 여기에 모여요"
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar bg-canvas">
      <div className="mx-auto max-w-6xl px-4 pt-6 pb-24 md:px-8 lg:pt-8">
        <PageHeader
          title="내 모임"
          count={groupsLoading || groupsError ? undefined : `${groups.length}개`}
          actions={
            <>
              <button type="button" onClick={handleStartBrowsing} className="btn-ghost">
                <History size={16} strokeWidth={1.5} /> 최근 활동
              </button>
              <button type="button" onClick={() => setIsCodeOpen(true)} className="btn-secondary">
                <LinkIcon size={16} strokeWidth={1.5} /> 초대 코드
              </button>
              <button type="button" onClick={openCreateModal} className="btn-primary">
                <Plus size={16} strokeWidth={1.5} /> 모임 만들기
              </button>
            </>
          }
        />

        <div className="mt-6">
          {groupsLoading ? (
            <div className="flex items-center justify-center gap-2 py-24 text-sm text-ink-3">
              <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
              모임을 불러오는 중이에요
            </div>
          ) : groupsError ? (
            <ErrorState message="모임 목록을 불러오지 못했어요" onRetry={() => refreshGroups()} />
          ) : groups.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 xl:grid-cols-3">
              {groups.map(group => <GroupCard key={group.id} group={group} />)}
            </div>
          ) : (
            <EmptyState
              icon={Users}
              title="아직 모임이 없어요"
              description="모임을 만들거나 받은 초대 코드로 참여해 보세요"
            />
          )}
        </div>
      </div>

      <InviteCodeModal open={isCodeOpen} onClose={() => setIsCodeOpen(false)} />
    </div>
  );
}

/** 모임 카드: 띠 + 주아 이름 + 설명 + 겹친 얼굴 + 인원·방장 */
function GroupCard({ group }: { group: GroupResponse }) {
  const color = getThemeColors(group.colorTheme).hex;
  return (
    <Link
      href={`/groups/${group.id}`}
      className="card flex min-h-[148px] flex-col gap-3 p-5 transition-colors duration-150 hover:bg-raised"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <Ribbon color={color} />
        <h2 className="truncate font-display text-lg leading-7 text-ink">{group.name}</h2>
      </div>
      <p className="line-clamp-2 text-sm leading-relaxed text-ink-2">
        {group.description || <span className="text-ink-3">모임 설명이 없어요</span>}
      </p>
      <div className="mt-auto flex items-center justify-between gap-3">
        <AvatarStack people={group.members} max={4} size="size-7" />
        <span className="truncate text-xs text-ink-3">
          <span className="tabular-nums">{group.memberCount}명</span> · 방장 {group.createdByNickname}
        </span>
      </div>
    </Link>
  );
}

const COMMENT_TITLE_PREFIXES = ['토픽에 댓글이 달렸습니다:', '토픽에 댓글이 달렸어요:'];
const TYPE_LABEL: Record<GroupActivityResponse['type'], string> = {
  MEMO: '메모',
  TOPIC: '토픽',
  SCHEDULE: '일정',
  COMMENT: '댓글',
};

/** 일정 활동 요약: '일정 시간: 2026-12-12 10:00 @ 장소' 형식을 .stamp 날짜와 장소로 나눈다 */
function parseScheduleSnippet(snippet: string, tf: string): { when: string | null; location: string | null } {
  const dateMatch = snippet.match(/(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  let when: string | null = null;
  if (dateMatch) {
    const d = parseISO(`${dateMatch[1]}T${dateMatch[2]}:00`);
    if (isValid(d)) when = format(d, `M.d EEE ${tf}`, { locale: ko });
  }
  const at = snippet.indexOf('@');
  const location = at >= 0 ? snippet.slice(at + 1).trim() : '';
  return { when, location: location || null };
}

function ActivityCard({ activity, color, onClick }: { activity: GroupActivityResponse, color?: string, onClick: () => void }) {
  const tf = useTimeFormat();
  // 카드에는 보는 사람이 아니라 실제 작성자를 보여 준다
  const userName = activity.authorNickname || '알 수 없음';

  let title = activity.title;
  if (activity.type === 'COMMENT') {
    const prefix = COMMENT_TITLE_PREFIXES.find(p => title.startsWith(p));
    if (prefix) title = title.slice(prefix.length).trim();
  }

  const schedule = activity.type === 'SCHEDULE' ? parseScheduleSnippet(activity.contentSnippet || '', tf) : null;
  const snippet = stripMarkdown(activity.contentSnippet || '');

  return (
    <div
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick(); }}
      role="button"
      tabIndex={0}
      className="card flex cursor-pointer flex-col gap-2 px-4 py-4 transition-colors duration-150 hover:bg-raised md:px-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-xs text-ink-3">
          {color && <Ribbon color={color} className="h-3.5" />}
          <span className="truncate">{activity.groupName}</span>
          <span aria-hidden>·</span>
          <span className="shrink-0">{TYPE_LABEL[activity.type] ?? '메모'}</span>
        </div>
        <span className="stamp shrink-0">{format(parseISO(activity.createdAt), `M.d EEE ${tf}`, { locale: ko })}</span>
      </div>

      <h3 className="truncate font-display text-[17px] leading-6 text-ink">{title}</h3>

      {schedule ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
          {schedule.when && <span className="stamp">{schedule.when}</span>}
          {schedule.location && (
            <span className="flex min-w-0 items-center gap-1">
              <MapPin size={14} strokeWidth={1.5} className="shrink-0 text-ink-3" />
              <span className="truncate">{schedule.location}</span>
            </span>
          )}
          {!schedule.when && !schedule.location && snippet}
        </p>
      ) : snippet ? (
        <p className="line-clamp-1 text-sm text-ink-2">{snippet}</p>
      ) : null}

      <div className="flex items-center gap-2">
        <Avatar name={userName} src={activity.authorProfileImage} size="size-5" />
        <span className="truncate text-xs text-ink-2">{userName}</span>
      </div>
    </div>
  );
}
