'use client';

import { useAlertStore } from '@/hooks/useAlert';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useEffect, useRef, useSyncExternalStore } from 'react';

const emptySubscribe = () => () => {};

export default function AlertContainer() {
  const { toasts, removeToast, modal, closeModal } = useAlertStore();
  // Hydration safety: 서버 렌더링과 첫 하이드레이션에서는 그리지 않습니다.
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const okRef = useRef<HTMLButtonElement>(null);

  // 확인 창: 열리면 취소(알림 창은 확인)에 포커스, Esc 는 취소, 닫히면 연 요소로 포커스를 돌려준다
  useEffect(() => {
    if (!modal) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    (cancelRef.current ?? okRef.current)?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        closeModal(false);
      } else if (e.key === 'Tab') {
        // 버튼 두 개 사이에서만 돈다
        const els = [cancelRef.current, okRef.current].filter((el): el is HTMLButtonElement => !!el);
        if (els.length === 0) return;
        e.preventDefault();
        e.stopImmediatePropagation(); // 뒤에 열린 Modal 의 포커스 가두기가 가져가지 않게
        const i = els.indexOf(document.activeElement as HTMLButtonElement);
        els[(i + (e.shiftKey ? -1 : 1) + els.length) % els.length].focus();
      }
    };
    // 캡처 단계: 뒤에 열린 Modal 의 Esc 처리보다 먼저 받아 확인 창만 닫는다
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, [modal, closeModal]);

  if (!mounted) return null;

  // 되돌릴 수 없는 동작: 부르는 쪽이 danger 를 주거나, 문구에 '삭제'·'내보내기'·'거절' 이 있으면 빨간 버튼
  const isDestructive =
    !!modal?.danger ||
    (modal?.message ? modal.message.includes('삭제') || modal.message.includes('내보내기') || modal.message.includes('거절') : false);

  return (
    <>
      {/* Toast List Container */}
      {/* 모바일은 아래(하단 탭 위)에 띄운다: 위에 두면 아래에서 올라온 창의 머리(제목·닫기)를 가린다 */}
      <div className="fixed top-4 max-md:top-auto max-md:bottom-[calc(env(safe-area-inset-bottom)+5rem)] left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 items-center pointer-events-none w-full max-w-sm px-4">
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
        <div className="fixed inset-0 bg-black/40 z-[9998] flex items-center justify-center p-4">
          <div
            role={modal.type === 'confirm' ? 'alertdialog' : 'dialog'}
            aria-modal="true"
            aria-label={modal.title || modal.message}
            className="w-full max-w-[400px] rounded-2xl bg-surface animate-scale-in"
          >
            <div className="px-6 pt-6 pb-5">
              {modal.title && (
                <h3 className="font-display text-xl leading-7 text-ink mb-2">
                  {modal.title}
                </h3>
              )}
              <p className={`whitespace-pre-wrap leading-relaxed ${modal.title ? 'text-sm text-ink-2' : 'text-[15px] text-ink'}`}>
                {modal.message}
              </p>
            </div>

            <div className="flex justify-end gap-2 border-t border-line px-6 py-3">
              {modal.type === 'confirm' && (
                <button
                  ref={cancelRef}
                  onClick={() => closeModal(false)}
                  className="btn-secondary"
                >
                  {modal.cancelText || '취소'}
                </button>
              )}

              <button
                ref={okRef}
                onClick={() => closeModal(true)}
                className={isDestructive ? 'btn-danger' : 'btn-primary'}
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
