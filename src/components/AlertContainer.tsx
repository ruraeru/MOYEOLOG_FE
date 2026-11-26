'use client';

import { useAlertStore } from '@/hooks/useAlert';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useEffect, useRef, useSyncExternalStore } from 'react';

const emptySubscribe = () => () => {};

export default function AlertContainer() {
  const { toasts, removeToast, modal, closeModal } = useAlertStore();
  // Hydration safety: 서버 렌더링과 첫 하이드레이션에서는 그리지 않습니다.
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // 확인 창: 열리면 창 안 버튼으로 포커스, Tab 은 창 안에 가두고, 닫히면 이전 포커스로 돌린다
  useEffect(() => {
    if (!modal) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLButtonElement>('[data-autofocus]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      // Esc 는 아래 effect 가 처리한다
      if (e.key === 'Tab' && dialogRef.current) {
        // 포커스를 창 안 버튼에만 가둔다
        const buttons = Array.from(dialogRef.current.querySelectorAll<HTMLButtonElement>('button'));
        if (buttons.length === 0) return;
        const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = e.shiftKey ? (i <= 0 ? buttons.length - 1 : i - 1) : (i + 1) % buttons.length;
        e.preventDefault();
        e.stopImmediatePropagation(); // 뒤에 열린 Modal 의 포커스 가두기가 가져가지 않게
        buttons[next].focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      if (prevFocus && prevFocus.isConnected) prevFocus.focus({ preventScroll: true });
    };
  }, [modal, closeModal]);

  // 확인 창이 떠 있으면 Esc 는 확인 창만 닫는다(confirm 은 취소, alert 는 확인). 캡처 단계에서 먼저 받아 뒤의 모달(일정 상세 등)이 닫히지 않게 한다.
  useEffect(() => {
    if (!modal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.isComposing) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      closeModal(modal.type !== 'confirm');
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [modal, closeModal]);

  if (!mounted) return null;

  // 되돌릴 수 없는 동작이면 확인 버튼을 위험색으로: 부르는 쪽이 danger 를 주거나, 본문·확인 버튼 글자로 판단
  const destructiveWords = ['삭제', '내보내기', '내보낼', '나가기', '거절', '지울', '지우기'];
  const isDestructive = modal
    ? !!modal.danger || destructiveWords.some((w) => modal.message?.includes(w) || modal.confirmText?.includes(w))
    : false;

  return (
    <>
      {/* Toast List Container */}
      <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] lg:bottom-auto lg:top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 items-center pointer-events-none w-full max-w-sm px-4">
        {toasts.map((toast) => {
          let icon = null;

          switch (toast.type) {
            case 'success':
              icon = <CheckCircle2 size={18} strokeWidth={1.5} className="text-positive shrink-0" />;
              break;
            case 'error':
              icon = <AlertCircle size={18} strokeWidth={1.5} className="text-negative shrink-0" />;
              break;
            case 'warning':
              icon = <AlertTriangle size={18} strokeWidth={1.5} className="text-ink-2 shrink-0" />;
              break;
            case 'info':
            default:
              icon = <Info size={18} strokeWidth={1.5} className="text-ink-3 shrink-0" />;
              break;
          }

          return (
            <div
              key={toast.id}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-line bg-surface text-ink shadow-float pointer-events-auto animate-slide-down w-full"
            >
              {icon}
              <span className="text-sm flex-1 leading-snug">{toast.message}</span>
              <button
                onClick={() => removeToast(toast.id)}
                aria-label="닫기"
                className="btn-icon size-7 shrink-0"
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>
          );
        })}
      </div>

      {/* 확인 창: 다른 창과 같은 모양 (바탕 black/40, r16, 왼쪽 정렬, 버튼 오른쪽) */}
      {modal && (
        <div
          className="fixed inset-0 bg-black/40 z-[9998] flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(modal.type !== 'confirm'); }}
        >
          <div
            ref={dialogRef}
            role={modal.type === 'confirm' ? 'alertdialog' : 'dialog'}
            aria-modal="true"
            aria-labelledby={modal.title ? 'alert-modal-title' : undefined}
            aria-label={modal.title ? undefined : modal.message}
            aria-describedby={modal.title ? 'alert-modal-message' : undefined}
            className="w-full max-w-[400px] rounded-2xl bg-surface animate-scale-in"
          >
            <div className="px-6 pt-6 pb-5">
              {modal.title && (
                <h3 id="alert-modal-title" className="font-display text-xl leading-7 text-ink mb-2">
                  {modal.title}
                </h3>
              )}
              <p id="alert-modal-message" className={`whitespace-pre-wrap leading-relaxed ${modal.title ? 'text-sm text-ink-2' : 'text-[15px] text-ink'}`}>
                {modal.message}
              </p>
            </div>

            <div className="flex justify-end gap-2 border-t border-line px-6 py-3">
              {modal.type === 'confirm' && (
                <button
                  onClick={() => closeModal(false)}
                  // 위험한 동작은 잘못 Enter 를 눌러도 취소되게 취소에 포커스
                  data-autofocus={isDestructive ? '' : undefined}
                  className="btn-secondary relative max-lg:h-11 max-lg:px-5 after:absolute after:inset-x-0 after:-inset-y-1"
                >
                  {modal.cancelText || '취소'}
                </button>
              )}

              {/* 창이 뜨면 확인 버튼에 포커스(Enter = 확인, 위 effect 의 data-autofocus). 삭제처럼 되돌릴 수 없는 확인은 취소 버튼에 둔다 */}
              <button
                onClick={() => closeModal(true)}
                data-autofocus={isDestructive && modal.type === 'confirm' ? undefined : ''}
                className={`${isDestructive ? 'btn-danger' : 'btn-primary'} relative max-lg:h-11 max-lg:px-5 after:absolute after:inset-x-0 after:-inset-y-1`}
              >
                {modal.confirmText || '확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
