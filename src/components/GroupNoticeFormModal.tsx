'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { format } from 'date-fns';
import { Loader2, Plus, X } from 'lucide-react';
import { groupNoticeApi, type NoticeCreateInput, type NoticeDetail } from '@/lib/group-notice-api';
import { getApiErrorMessage } from '@/lib/axios';
import { useAlert, useAlertStore } from '@/hooks/useAlert';
import { codePointLength, hasVisibleText } from '@/lib/markdown';
import { toLocalDateTimeString } from '@/lib/utils';
import RichEditor from './RichEditor';
import { Modal } from './ui';

const TITLE_MAX = 100;
const OPTION_MAX = 100;
const OPTIONS_MIN = 2;
const OPTIONS_MAX = 10;

/**
 * 공지 쓰기·수정 창(방장만 연다). notice 가 있으면 수정이고, 투표는 새 글일 때만 붙인다.
 * 다른 창(공지 상세) 위에 뜰 수 있어 z-[120] 이고 Esc 를 먼저 받는다.
 */
export default function GroupNoticeFormModal({
  groupId,
  open,
  onClose,
  notice,
  onSaved,
}: {
  groupId: string;
  open: boolean;
  onClose: () => void;
  /** 있으면 수정 */
  notice?: NoticeDetail | null;
  onSaved: (notice: NoticeDetail) => void;
}) {
  const { data: session } = useSession();
  const { toast } = useAlert();
  const editing = !!notice;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [initial, setInitial] = useState({ title: '', content: '' });
  const [pollOn, setPollOn] = useState(false);
  const [options, setOptions] = useState<string[]>(['', '']);
  const [multiple, setMultiple] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [closesDate, setClosesDate] = useState('');
  const [closesTime, setClosesTime] = useState('23:59');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 창이 열릴 때만 채운다(열려 있는 동안 상세가 조용히 다시 불려도 쓰던 글을 덮지 않게)
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      const start = { title: notice?.title ?? '', content: notice?.content ?? '' };
      setTitle(start.title);
      setContent(start.content);
      setInitial(start);
      setPollOn(false);
      setOptions(['', '']);
      setMultiple(false);
      setAnonymous(false);
      setClosesDate('');
      setClosesTime('23:59');
      setError(null);
    }
  }

  const pollTouched = pollOn && (options.some((o) => o.trim()) || multiple || anonymous || !!closesDate);
  const dirty = title !== initial.title || content !== initial.content || pollTouched;

  const handleClose = async () => {
    if (saving) return;
    if (dirty && !(await useAlertStore.getState().confirm('작성 중인 내용이 사라져요. 닫을까요?', undefined, '닫기', '계속 쓰기'))) {
      return;
    }
    onClose();
  };

  // Esc: 상세 창 위에 열려 있을 수 있어 캡처 단계에서 먼저 받고 아래 창으로 넘기지 않는다
  const handleCloseRef = useRef(handleClose);
  useEffect(() => {
    handleCloseRef.current = handleClose;
  });
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.isComposing) return;
      if (useAlertStore.getState().modal) return;
      e.preventDefault();
      e.stopPropagation();
      handleCloseRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);

  const closesAt = pollOn && closesDate ? `${closesDate}T${closesTime || '23:59'}:00` : null;

  const findProblem = (): string | null => {
    if (!hasVisibleText(title)) return '제목을 적어 주세요';
    if (codePointLength(title.trim()) > TITLE_MAX) return `제목은 ${TITLE_MAX}자까지 쓸 수 있어요`;
    if (!editing && pollOn) {
      const trimmed = options.map((o) => o.trim());
      if (trimmed.some((o) => !hasVisibleText(o))) return '빈 선택지를 채우거나 지워 주세요';
      if (trimmed.some((o) => codePointLength(o) > OPTION_MAX)) return `선택지는 ${OPTION_MAX}자까지 쓸 수 있어요`;
      if (new Set(trimmed).size !== trimmed.length) return '같은 선택지가 두 번 있어요';
      if (closesAt && closesAt <= toLocalDateTimeString(new Date())) return '마감 시각은 지금 이후로 골라 주세요';
    }
    return null;
  };

  const submit = async () => {
    if (saving) return;
    const problem = findProblem();
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let saved: NoticeDetail;
      if (notice) {
        saved = await groupNoticeApi.update(groupId, notice.id, { title: title.trim(), content }, session);
        toast.success('공지를 고쳤어요');
      } else {
        const input: NoticeCreateInput = { title: title.trim(), content };
        if (pollOn) input.poll = { options: options.map((o) => o.trim()), multiple, anonymous, closesAt };
        saved = await groupNoticeApi.create(groupId, input, session);
        toast.success('공지를 올렸어요');
      }
      onSaved(saved);
      onClose();
    } catch (e) {
      setError(getApiErrorMessage(e, '공지를 저장하지 못했어요'));
    } finally {
      setSaving(false);
    }
  };

  const setOption = (i: number, value: string) => setOptions((prev) => prev.map((o, j) => (j === i ? value : o)));

  return (
    <Modal
      open={open}
      onClose={handleClose}
      closeOnEsc={false}
      zIndex="z-[120]"
      size="lg"
      title={editing ? '공지 수정' : '공지 쓰기'}
      subtitle={editing ? undefined : '올리면 모임 멤버 모두에게 알림이 가요'}
      footer={
        <>
          <button type="button" onClick={handleClose} disabled={saving} className="btn-ghost">취소</button>
          <button type="button" onClick={submit} disabled={saving} className="btn-primary">
            {saving && <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />}
            {editing ? '저장' : '올리기'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <label className="block space-y-1.5">
          <span className="text-[13px] font-medium text-ink-2">제목</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={TITLE_MAX}
            placeholder="무엇을 알릴까요"
            className="form-input h-10 font-display text-base"
            autoFocus
          />
        </label>

        <div className="space-y-1.5">
          <span className="text-[13px] font-medium text-ink-2">내용</span>
          <RichEditor
            value={content}
            onChange={setContent}
            placeholder="멤버들에게 알릴 내용을 써 주세요"
            className="h-[260px] md:h-[320px]"
          />
        </div>

        {editing ? (
          notice?.poll && <p className="text-xs text-ink-3">붙인 투표는 고칠 수 없어요</p>
        ) : (
          <section className="rounded-xl border border-line p-4">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={pollOn}
                onChange={(e) => setPollOn(e.target.checked)}
                className="size-4 accent-accent"
              />
              <span className="font-display text-base text-ink">투표 붙이기</span>
            </label>

            {pollOn && (
              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <span className="block text-[13px] text-ink-2">
                    선택지 <span className="stamp text-ink-3">{options.length}/{OPTIONS_MAX}</span>
                  </span>
                  {options.map((o, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        value={o}
                        onChange={(e) => setOption(i, e.target.value)}
                        maxLength={OPTION_MAX}
                        placeholder={`선택지 ${i + 1}`}
                        aria-label={`선택지 ${i + 1}`}
                        className="form-input min-w-0 flex-1"
                      />
                      {options.length > OPTIONS_MIN && (
                        <button
                          type="button"
                          onClick={() => setOptions((prev) => prev.filter((_, j) => j !== i))}
                          aria-label={`선택지 ${i + 1} 지우기`}
                          className="btn-icon shrink-0"
                        >
                          <X size={16} strokeWidth={1.5} />
                        </button>
                      )}
                    </div>
                  ))}
                  {options.length < OPTIONS_MAX && (
                    <button type="button" onClick={() => setOptions((prev) => [...prev, ''])} className="btn-ghost btn-sm">
                      <Plus size={14} strokeWidth={1.5} /> 선택지 추가
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                    <input type="checkbox" checked={multiple} onChange={(e) => setMultiple(e.target.checked)} className="size-4 accent-accent" />
                    여러 개 고르기
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
                    <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="size-4 accent-accent" />
                    익명 투표
                  </label>
                </div>
                {anonymous && <p className="-mt-2 text-xs text-ink-3">누가 무엇을 골랐는지 방장에게도 보이지 않고 인원만 보여요</p>}

                <div>
                  <span className="mb-1.5 block text-[13px] text-ink-2">마감 (선택)</span>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      aria-label="마감 날짜"
                      value={closesDate}
                      min={format(new Date(), 'yyyy-MM-dd')}
                      onChange={(e) => setClosesDate(e.target.value)}
                      className="form-input px-2 tabular-nums md:px-3"
                    />
                    <input
                      type="time"
                      aria-label="마감 시각"
                      value={closesTime}
                      disabled={!closesDate}
                      onChange={(e) => setClosesTime(e.target.value)}
                      className="form-input px-2 tabular-nums md:px-3"
                    />
                  </div>
                  <p className="mt-1.5 flex items-center gap-2 text-xs text-ink-3">
                    {closesDate ? '이 시각이 지나면 저절로 닫혀요' : '비워 두면 방장이 직접 마감해요'}
                    {closesDate && (
                      <button type="button" onClick={() => setClosesDate('')} className="underline underline-offset-2">
                        마감 없애기
                      </button>
                    )}
                  </p>
                </div>
              </div>
            )}
          </section>
        )}

        {error && (
          <p role="alert" className="rounded-[10px] bg-negative-soft px-3 py-2.5 text-sm text-negative">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
