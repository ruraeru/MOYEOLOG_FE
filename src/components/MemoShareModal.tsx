'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Search, RefreshCw } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { friendApi, type FriendResponse } from '@/lib/friend-api';
import { memoApi, type MemoSharedUser } from '@/lib/memo-api';
import { groupApi, type GroupResponse } from '@/lib/group-api';
import { GroupAvatar } from './groups/GroupIdentity';
import { getApiErrorMessage } from '@/lib/axios';
import ImageWithFallback from './ImageWithFallback';
import { useAlert } from '@/hooks/useAlert';
import { initialOf } from '@/lib/utils';
import { Modal } from './ui';

interface MemoShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  memoId: string;
  memoTitle: string;
  /** 이미 공유한 사람 (MemoResponse.sharedWith) */
  sharedWith?: MemoSharedUser[];
  /** 모임에서 쓴 메모면 그 모임 ID. 모임 메모는 다른 모임에 공유하지 않는다 */
  groupId?: string;
  /** 이 개인 메모를 공유한 모임 (MemoResponse.sharedGroupIds) */
  sharedGroupIds?: string[];
  /** 공유·공유 해제 뒤 메모를 다시 불러오게 알린다 */
  onChanged?: () => void;
}

export default function MemoShareModal({ isOpen, onClose, memoId, memoTitle, sharedWith = [], groupId, sharedGroupIds = [], onChanged }: MemoShareModalProps) {
  const { data: session } = useSession();
  const { toast } = useAlert();
  const [friends, setFriends] = useState<FriendResponse[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [unsharingId, setUnsharingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  /** 새로 공유할 친구에게 '수정 가능'으로 공유할지 (기본 읽기 전용) */
  const [canEdit, setCanEdit] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [groups, setGroups] = useState<GroupResponse[]>([]);
  const [groupBusyId, setGroupBusyId] = useState<string | null>(null);
  /** 공유 해제는 두 번 눌러야 한다: 첫 번째 누름은 '해제할까요?' 로 바꾸기만 (friend:id / group:id) */
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!confirmKey) return;
    const t = setTimeout(() => setConfirmKey(null), 4000);
    return () => clearTimeout(t);
  }, [confirmKey]);

  // 마우스로 쓰는 화면에서는 열자마자 친구 검색칸에 포커스 (터치 기기는 키보드가 올라오지 않게 두지 않는다)
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;
    if (!window.matchMedia('(pointer: fine)').matches) return;
    const t = setTimeout(() => searchRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [isOpen]);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  useEffect(() => {
    if (isOpen && session) {
      setLoading(true);
      setLoadError(null);
      setSelectedFriendIds([]);
      setCanEdit(false);
      setConfirmKey(null);
      // 개인 메모만 모임에 공유할 수 있다. 모임 목록을 못 불러오면 모임 공유 칸만 숨긴다.
      if (!groupId) {
        groupApi.getAll(session).then(setGroups).catch(() => setGroups([]));
      }
      friendApi.getFriends(session)
        .then(setFriends)
        .catch((e) => {
          console.error(e);
          setLoadError(getApiErrorMessage(e));
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, session, reloadKey, groupId]);

  const sharedIds = new Set(sharedWith.map(u => u.id));

  const handleUnshare = async (user: MemoSharedUser) => {
    const key = `friend:${user.id}`;
    if (confirmKey !== key) { setConfirmKey(key); return; }
    setConfirmKey(null);
    setUnsharingId(user.id);
    try {
      await memoApi.unshare(memoId, user.id, session);
      toast.success(`${user.nickname}님과 공유를 그만뒀어요`);
      onChanged?.();
    } catch (error) {
      console.error('Failed to unshare memo:', error);
      toast.error(getApiErrorMessage(error, '공유를 해제하지 못했어요'));
      onChanged?.();
    } finally {
      setUnsharingId(null);
    }
  };

  /** 이미 공유한 친구의 권한 바꾸기: 같은 친구에게 다시 공유하면 서버가 권한만 바꾼다 */
  const handleChangePermission = async (user: MemoSharedUser, next: boolean) => {
    setUpdatingId(user.id);
    try {
      await memoApi.share(memoId, [user.id], next, session);
      toast.success(next ? `${user.nickname}님이 고칠 수 있게 했어요` : `${user.nickname}님은 읽기만 할 수 있어요`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, '권한을 바꾸지 못했어요'));
    } finally {
      setUpdatingId(null);
      onChanged?.();
    }
  };

  const handleGroupShare = async (group: GroupResponse, shared: boolean) => {
    if (shared) {
      const key = `group:${group.id}`;
      if (confirmKey !== key) { setConfirmKey(key); return; }
      setConfirmKey(null);
    }
    setGroupBusyId(group.id);
    try {
      if (shared) {
        await memoApi.unshareFromGroup(memoId, group.id, session);
        toast.success(`${group.name} 모임과 공유를 그만뒀어요`);
      } else {
        await memoApi.shareToGroup(memoId, group.id, session);
        toast.success(`${group.name} 모임에 공유했어요`);
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, shared ? '공유를 해제하지 못했어요' : '공유하지 못했어요'));
    } finally {
      setGroupBusyId(null);
      onChanged?.();
    }
  };

  const toggleFriend = (id: string) => {
    setSelectedFriendIds(prev => 
      prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id]
    );
  };

  const handleShare = async () => {
    if (selectedFriendIds.length === 0) return;
    
    setIsSharing(true);
    try {
      await memoApi.share(memoId, selectedFriendIds, canEdit, session);
      toast.success('메모를 공유했어요');
      setSelectedFriendIds([]);
      onChanged?.();
      onClose();
    } catch (error) {
      console.error('Failed to share memo:', error);
      toast.error(getApiErrorMessage(error, '공유하지 못했어요'));
    } finally {
      setIsSharing(false);
    }
  };

  const q = searchQuery.trim().toLowerCase();
  // 이미 공유한 친구는 위 '공유 중' 목록에서 관리하고, 아래에는 아직 공유하지 않은 친구만 보여 준다.
  const filteredFriends = friends.filter(f =>
    !sharedIds.has(f.userId) && (
      !q ||
      f.nickname.toLowerCase().includes(q) ||
      (f.customId || '').toLowerCase().includes(q) ||
      (f.email || '').toLowerCase().includes(q)
    )
  );

  // 검색은 친구와 모임 둘 다 거른다
  const filteredGroups = groups.filter(g => !q || g.name.toLowerCase().includes(q));

  const avatar = (name: string, image: string | null | undefined, size: string, text: string) => (
    <div className={`relative ${size} rounded-full overflow-hidden bg-raised shrink-0`}>
      {image ? (
        <ImageWithFallback
          src={String(image).startsWith('/uploads/') ? `${apiUrl}${image}` : image}
          alt={name}
          fill
          containerClassName="w-full h-full"
          className="object-cover"
          unoptimized
        />
      ) : (
        <div className={`w-full h-full bg-raised flex items-center justify-center text-ink-2 font-medium ${text}`}>
          {initialOf(name)}
        </div>
      )}
    </div>
  );

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="sm"
      title="메모 공유"
      subtitle={<span className="line-clamp-1">{memoTitle}</span>}
      bodyClassName="px-3! py-3! md:px-3!"
      footer={
        <>
          {/* 새로 고른 친구에게만 적용된다. 고를 친구가 없으면 숨긴다 */}
          {filteredFriends.length > 0 && (
            <label className={`mr-auto inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-[13px] md:min-h-9 ${selectedFriendIds.length === 0 ? 'text-ink-3' : 'text-ink-2'}`}>
              <input type="checkbox" checked={canEdit} disabled={selectedFriendIds.length === 0} onChange={(e) => setCanEdit(e.target.checked)} className="size-4 accent-accent" />
              고른 친구 수정 허용
            </label>
          )}
          <button type="button" onClick={onClose} className={`btn-secondary max-md:h-11 ${filteredFriends.length > 0 ? '' : 'ml-auto'}`}>
            {selectedFriendIds.length > 0 ? '취소' : '닫기'}
          </button>
          {(filteredFriends.length > 0 || selectedFriendIds.length > 0) && (
          <button
            onClick={handleShare}
            disabled={isSharing || selectedFriendIds.length === 0}
            className="btn-primary max-md:h-11"
          >
            {isSharing && <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />}
            {isSharing ? '공유 중…' : selectedFriendIds.length > 0 ? `${selectedFriendIds.length}명과 공유` : '친구를 골라 주세요'}
          </button>
          )}
        </>
      }
    >
      <div className="relative px-2 pb-3">
        <Search size={16} strokeWidth={1.5} className="pointer-events-none absolute left-5 top-[18px] -translate-y-1/2 text-ink-3" />
        <input
          ref={searchRef}
          type="text"
          placeholder="친구·모임 검색"
          aria-label="친구·모임 검색"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="form-input h-9 pl-9"
        />
      </div>

      {sharedWith.length > 0 && (
        <div className="mb-2">
          <p className="px-2 pb-1 pt-2 text-xs font-medium text-ink-3">
            공유 중 <span className="stamp">{sharedWith.length}</span>
          </p>
          <ul>
            {sharedWith.map(user => (
              <li key={user.id} className="flex min-h-16 items-center justify-between gap-3 px-2 py-1">
                <div className="flex min-w-0 items-center gap-3">
                  {avatar(user.nickname, user.profileImage, 'size-10', 'text-sm')}
                  {/* 이름 아래 줄에 권한을 두어 좁은 화면에서도 이름이 덜 잘린다 */}
                  <div className="min-w-0">
                    <p className="font-display text-[15px] text-ink truncate">{user.nickname}</p>
                    <label className="-ml-1 inline-flex min-h-8 cursor-pointer items-center gap-1.5 px-1 text-xs text-ink-2 max-md:min-h-11">
                      <input
                        type="checkbox"
                        checked={!!user.canEdit}
                        disabled={updatingId === user.id}
                        onChange={(e) => handleChangePermission(user, e.target.checked)}
                        className="size-4 accent-accent"
                      />
                      수정 가능
                    </label>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleUnshare(user)}
                  disabled={unsharingId === user.id}
                  className={`btn-sm shrink-0 max-md:h-11 ${confirmKey === `friend:${user.id}` ? 'btn-danger' : 'btn-secondary'}`}
                >
                  {unsharingId === user.id && <Loader2 size={12} strokeWidth={1.5} className="animate-spin" />}
                  {confirmKey === `friend:${user.id}` ? '해제할까요?' : '공유 해제'}
                </button>
              </li>
            ))}
          </ul>
          {/* 고를 친구가 없으면 제목 없이 아래 한 줄 안내만 */}
          {(filteredFriends.length > 0 || loading || loadError) && (
            <p className="px-2 pb-1 pt-4 text-xs font-medium text-ink-3">다른 친구에게 공유</p>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10">
          <Loader2 size={16} strokeWidth={1.5} className="animate-spin text-ink-3" />
          <p className="text-sm text-ink-3">친구 목록을 불러오고 있어요</p>
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <p className="font-display text-lg text-ink">친구 목록을 불러오지 못했어요</p>
          <p className="text-sm text-ink-3">{loadError}</p>
          <button type="button" onClick={() => setReloadKey(k => k + 1)} className="btn-secondary mt-3">
            <RefreshCw size={16} strokeWidth={1.5} />
            다시 시도
          </button>
        </div>
      ) : filteredFriends.length > 0 ? (
        <ul>
          {filteredFriends.map(friend => {
            const selected = selectedFriendIds.includes(friend.userId);
            return (
              <li
                key={friend.userId}
                role="checkbox"
                aria-checked={selected}
                tabIndex={0}
                onClick={() => toggleFriend(friend.userId)}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleFriend(friend.userId); }
                }}
                className={`flex h-14 outline-none focus-visible:ring-2 focus-visible:ring-accent items-center justify-between gap-3 px-2 rounded-[10px] cursor-pointer transition-colors duration-150 ease-out ${selected ? 'bg-accent-soft' : 'hover:bg-raised'}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {avatar(friend.nickname, friend.profileImage, 'size-10', 'text-sm')}
                  <div className="min-w-0">
                    <p className={`font-display text-[15px] truncate ${selected ? 'text-accent' : 'text-ink'}`}>{friend.nickname}</p>
                    <p className="text-xs text-ink-3 truncate">{friend.email || (friend.customId ? `@${friend.customId}` : '')}</p>
                  </div>
                </div>
                <div className={`size-5 shrink-0 rounded-full border flex items-center justify-center transition-colors duration-150 ease-out ${selected ? 'bg-accent border-accent text-white' : 'border-line-strong bg-surface'}`}>
                  {selected && <Check size={12} strokeWidth={2} />}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={`text-center text-sm text-ink-3 ${sharedWith.length > 0 && !q ? 'pb-2 pt-4' : 'py-10'}`}>
          {q ? '검색되는 친구가 없어요' : friends.length === 0 ? '아직 친구가 없어요' : '모든 친구와 공유하고 있어요'}
        </p>
      )}

      {!groupId && groups.length > 0 && (!q || filteredGroups.length > 0) && (
        <div className="mt-2 border-t border-line pt-2">
          <p className="px-2 pb-1 pt-2 text-xs font-medium text-ink-3">모임에 공유</p>
          {/* 친구 공유와 달리 버튼을 누르면 바로 공유된다 (아래 취소로 되돌려지지 않는다) */}
          <p className="px-2 pb-1 text-xs text-ink-3">누르면 바로 공유돼요. 모임 멤버는 읽기만 할 수 있어요</p>
          <ul>
            {filteredGroups.map(group => {
              const shared = sharedGroupIds.includes(group.id);
              const confirming = confirmKey === `group:${group.id}`;
              return (
                <li key={group.id} className="flex h-14 items-center justify-between gap-3 px-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <GroupAvatar name={group.name} src={group.profileImage} theme={group.colorTheme} size="sm" />
                    <p className="truncate font-display text-[15px] text-ink">{group.name}</p>
                    {shared && (
                      <span className="chip shrink-0 gap-1">
                        <Check size={12} strokeWidth={2} aria-hidden />
                        공유 중
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleGroupShare(group, shared)}
                    disabled={groupBusyId === group.id}
                    className={`btn-sm shrink-0 max-md:h-11 ${confirming ? 'btn-danger' : 'btn-secondary'}`}
                  >
                    {groupBusyId === group.id && <Loader2 size={12} strokeWidth={1.5} className="animate-spin" />}
                    {confirming ? '해제할까요?' : shared ? '공유 해제' : '공유'}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Modal>
  );
}
