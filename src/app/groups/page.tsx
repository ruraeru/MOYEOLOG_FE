'use client';

import React, { useState, useCallback } from 'react';
import { Plus, Users, Inbox, LayoutGrid, ArrowLeft, Loader2, MessageSquare, FileText, ChevronRight, RefreshCw, Calendar, Ticket, MapPin } from 'lucide-react';
import { useGroupModal } from './GroupModalContext';
import { groupApi, type GroupActivityResponse } from '@/lib/group-api';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { format, parseISO, isValid } from 'date-fns';
import { useTimeFormat } from '@/lib/schedule-utils';
import { ko } from 'date-fns/locale';
import { stripMarkdown, getFileUrl } from '@/lib/utils';
import { getApiErrorMessage } from '@/lib/axios';
import ImageWithFallback from '@/components/ImageWithFallback';
import { ErrorState } from '@/components/groups/GroupUI';

/** 초대 코드 입력값 정리: 공백 제거, 링크를 붙여 넣으면 code 파라미터만 꺼낸다 */
function normalizeInviteCode(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/[?&]code=([^&#\s]+)/);
  const code = match ? decodeURIComponent(match[1]) : trimmed;
  return code.replace(/\s+/g, '').toUpperCase();
}

export default function GroupsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { openCreateModal } = useGroupModal();
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [activities, setActivities] = useState<GroupActivityResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [isCodeOpen, setIsCodeOpen] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);

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

  const handleSubmitCode = (e: React.FormEvent) => {
    e.preventDefault();
    const code = normalizeInviteCode(codeInput);
    if (!code) {
      setCodeError('초대 코드를 입력해 주세요.');
      return;
    }
    if (!/^[A-Z0-9]{4,32}$/.test(code)) {
      setCodeError('초대 코드는 영문과 숫자로만 이뤄져 있어요.');
      return;
    }
    // 확인 화면에서 모임 정보를 보여 주고 '참여하기'를 눌러야 가입된다
    router.push(`/invite/group?code=${encodeURIComponent(code)}`);
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
      <div className="flex-1 flex flex-col overflow-hidden bg-canvas">
        <header className="px-4 md:px-8 py-4 md:py-5 shrink-0 flex items-center justify-between gap-3 border-b border-line bg-surface sticky top-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setIsBrowsing(false)}
              className="btn-ghost size-9 !px-0 shrink-0"
              aria-label="뒤로"
            >
              <ArrowLeft size={18} strokeWidth={1.5} />
            </button>
            <div className="min-w-0">
              <h2 className="text-xl md:text-2xl font-semibold text-ink">둘러보기</h2>
              <p className="text-sm text-ink-2">모임별 최근 활동</p>
            </div>
          </div>
          <button
            onClick={fetchActivities}
            disabled={loading}
            className="btn-ghost size-9 !px-0 shrink-0"
            aria-label="새로고침"
          >
            {loading ? <Loader2 size={18} strokeWidth={1.5} className="animate-spin" /> : <RefreshCw size={18} strokeWidth={1.5} />}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto no-scrollbar p-4 md:p-8 pb-24">
          <div className="max-w-3xl mx-auto space-y-3">
            {loading ? (
              <div className="py-24 flex flex-col items-center justify-center gap-3">
                <Loader2 size={18} strokeWidth={1.5} className="animate-spin text-ink-3" />
                <p className="text-sm text-ink-3">활동 내역을 불러오는 중이에요</p>
              </div>
            ) : activityError ? (
              <ErrorState message={activityError} onRetry={fetchActivities} />
            ) : activities.length > 0 ? (
              activities.map((activity, idx) => (
                <ActivityCard
                  key={`${activity.type}-${activity.id}-${idx}`}
                  activity={activity}
                  onClick={() => handleActivityClick(activity)}
                />
              ))
            ) : (
              <div className="py-24 flex flex-col items-center justify-center text-center">
                <div className="size-10 rounded-full bg-raised flex items-center justify-center mb-3">
                  <Inbox size={18} strokeWidth={1.5} className="text-ink-3" />
                </div>
                <p className="text-sm font-medium text-ink">최근 활동이 없어요</p>
                <p className="text-sm text-ink-3 mt-1">참여 중인 모임에서 소식이 생기면 여기에 모여요</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar bg-canvas">
      <div className="min-h-full flex flex-col items-center justify-center p-4 md:p-8 pb-24 text-center gap-8">
        <div className="size-16 bg-raised rounded-2xl flex items-center justify-center text-ink-3">
          <Users size={18} strokeWidth={1.5} />
        </div>

        <div className="space-y-2 max-w-sm">
          <h2 className="text-2xl font-semibold text-ink">모임을 선택해 주세요</h2>
          <p className="text-sm text-ink-2 leading-relaxed">
            <span className="hidden md:inline">사이드바에서</span><span className="md:hidden">위에서</span> 모임을 고르거나,<br />
            새 모임을 만들어 친구들을 초대해 보세요.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 w-full max-w-2xl">
          <LandingCard
            icon={<Plus size={18} strokeWidth={1.5} />}
            label="새 모임 만들기"
            description="우리만의 공간 만들기"
            onClick={openCreateModal}
          />
          <LandingCard
            icon={<Ticket size={18} strokeWidth={1.5} />}
            label="초대 코드로 참여"
            description="받은 코드나 링크 넣기"
            onClick={() => { setIsCodeOpen(true); setCodeError(null); }}
            active={isCodeOpen}
          />
          <LandingCard
            icon={<LayoutGrid size={18} strokeWidth={1.5} />}
            label="둘러보기"
            description="최근 활동 보기"
            onClick={handleStartBrowsing}
          />
        </div>

        {isCodeOpen && (
          <form onSubmit={handleSubmitCode} className="card w-full max-w-2xl p-5 text-left space-y-3">
            <label htmlFor="invite-code" className="text-sm font-medium text-ink block">초대 코드</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="invite-code"
                type="text"
                value={codeInput}
                onChange={(e) => { setCodeInput(e.target.value); setCodeError(null); }}
                placeholder="예: AB12CD 또는 초대 링크"
                autoComplete="off"
                autoCapitalize="characters"
                autoFocus
                className="form-input flex-1 font-mono"
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setIsCodeOpen(false)} className="btn-secondary flex-1 sm:flex-none">취소</button>
                <button type="submit" className="btn-primary flex-1 sm:flex-none">확인</button>
              </div>
            </div>
            {codeError ? (
              <p className="text-sm text-negative">{codeError}</p>
            ) : (
              <p className="text-xs text-ink-3">다음 화면에서 어떤 모임인지 확인한 뒤 참여할 수 있어요.</p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

function LandingCard({ icon, label, description, onClick, active }: { icon: React.ReactNode, label: string, description: string, onClick?: () => void, active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`card p-4 sm:p-5 text-left hover:bg-raised transition-colors duration-150 ease-out cursor-pointer active:scale-[0.98] ${active ? 'bg-raised' : ''}`}
    >
      <div className="text-ink-3 mb-3 sm:mb-4">
        {icon}
      </div>
      <h4 className="font-medium text-ink text-sm mb-1">{label}</h4>
      <p className="text-xs text-ink-3">{description}</p>
    </button>
  );
}

const COMMENT_TITLE_PREFIXES = ['토픽에 댓글이 달렸습니다:', '토픽에 댓글이 달렸어요:'];

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

function ActivityCard({ activity, onClick }: { activity: GroupActivityResponse, onClick: () => void }) {
  const tf = useTimeFormat();
  // 카드에는 보는 사람이 아니라 실제 작성자를 보여 준다
  const userName = activity.authorNickname || '알 수 없음';
  const userImage = getFileUrl(activity.authorProfileImage);

  const typeConfig = {
    MEMO: { label: '메모', icon: <FileText size={16} strokeWidth={1.5} /> },
    TOPIC: { label: '토픽', icon: <MessageSquare size={16} strokeWidth={1.5} /> },
    SCHEDULE: { label: '일정', icon: <Calendar size={16} strokeWidth={1.5} /> },
    COMMENT: { label: '댓글', icon: <MessageSquare size={16} strokeWidth={1.5} /> },
  };

  const config = typeConfig[activity.type] || typeConfig.MEMO;

  let title = activity.title;
  if (activity.type === 'COMMENT') {
    const prefix = COMMENT_TITLE_PREFIXES.find(p => title.startsWith(p));
    if (prefix) title = title.slice(prefix.length).trim();
  }

  const schedule = activity.type === 'SCHEDULE' ? parseScheduleSnippet(activity.contentSnippet || '', tf) : null;

  return (
    <div
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick(); }}
      role="button"
      tabIndex={0}
      className="card p-4 md:p-5 transition-colors duration-150 ease-out cursor-pointer group flex flex-col gap-2 hover:bg-raised"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-ink-3 shrink-0">{config.icon}</span>
          <span className="text-xs text-ink-2 shrink-0">{config.label}</span>
          <span className="rounded-md bg-raised px-2 py-0.5 text-xs text-ink-2 flex items-center gap-1 min-w-0">
            <Users size={12} strokeWidth={1.5} className="shrink-0" />
            <span className="truncate">{activity.groupName}</span>
          </span>
        </div>
        <span className="stamp shrink-0">{format(parseISO(activity.createdAt), `M.d EEE ${tf}`, { locale: ko })}</span>
      </div>

      <h3 className="font-medium text-ink text-base truncate">
        {activity.type === 'COMMENT' && <span className="text-ink-3 font-normal">댓글 · </span>}
        {title}
      </h3>

      {schedule ? (
        <p className="text-sm text-ink-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          {schedule.when && <span className="stamp">{schedule.when}</span>}
          {schedule.location && (
            <span className="flex items-center gap-1 min-w-0">
              <MapPin size={12} strokeWidth={1.5} className="text-ink-3 shrink-0" />
              <span className="truncate">{schedule.location}</span>
            </span>
          )}
          {!schedule.when && !schedule.location && stripMarkdown(activity.contentSnippet || '')}
        </p>
      ) : (
        <p className="text-sm text-ink-2 line-clamp-1">
          {stripMarkdown(activity.contentSnippet || '')}
        </p>
      )}
      <div className="pt-3 flex items-center gap-2 border-t border-line mt-1">
        <div className="size-6 rounded-full relative shrink-0 overflow-hidden">
          {userImage ? (
            <ImageWithFallback
              src={userImage}
              alt={userName}
              fill
              containerClassName="w-full h-full"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="w-full h-full bg-raised flex items-center justify-center text-xs text-ink-2">{[...userName][0]}</div>
          )}
        </div>
        <span className="text-xs text-ink-2 truncate">{userName}</span>
        <ChevronRight size={16} strokeWidth={1.5} className="text-ink-3 ml-auto shrink-0" />
      </div>
    </div>
  );
}
