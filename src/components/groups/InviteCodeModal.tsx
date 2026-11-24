'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui';

/** 초대 코드 입력값 정리: 공백 제거, 링크를 붙여 넣으면 code 파라미터만 꺼낸다 */
export function normalizeInviteCode(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/[?&]code=([^&#\s]+)/);
  const code = match ? decodeURIComponent(match[1]) : trimmed;
  return code.replace(/\s+/g, '').toUpperCase();
}

/** 초대 코드 입력 창. 확인 화면(/invite/group)에서 모임 정보를 보고 '참여하기'를 눌러야 가입된다 */
export function InviteCodeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);

  const handleClose = () => {
    setCodeError(null);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = normalizeInviteCode(codeInput);
    if (!code) {
      setCodeError('초대 코드를 입력해 주세요');
      return;
    }
    if (!/^[A-Z0-9]{4,32}$/.test(code)) {
      setCodeError('초대 코드는 영문과 숫자로만 이뤄져 있어요');
      return;
    }
    onClose();
    router.push(`/invite/group?code=${encodeURIComponent(code)}`);
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      size="sm"
      title="초대 코드 입력"
      subtitle="받은 코드나 초대 링크를 넣어 주세요"
      footer={
        <>
          <button type="button" onClick={handleClose} className="btn-secondary">취소</button>
          <button type="submit" form="invite-code-form" className="btn-primary">확인</button>
        </>
      }
    >
      <form id="invite-code-form" onSubmit={handleSubmit} className="space-y-2">
        <label htmlFor="invite-code" className="block text-[13px] font-medium text-ink-2">초대 코드</label>
        <input
          id="invite-code"
          type="text"
          value={codeInput}
          onChange={(e) => { setCodeInput(e.target.value); setCodeError(null); }}
          placeholder="예: AB12CD 또는 초대 링크"
          autoComplete="off"
          autoCapitalize="characters"
          autoFocus
          className="form-input tabular-nums tracking-wide"
        />
        {codeError ? (
          <p className="text-[13px] text-negative">{codeError}</p>
        ) : (
          <p className="text-xs text-ink-3">다음 화면에서 어떤 모임인지 확인한 뒤 참여할 수 있어요</p>
        )}
      </form>
    </Modal>
  );
}
