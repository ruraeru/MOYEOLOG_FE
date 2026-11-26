'use client';

import { useAlertStore } from '@/hooks/useAlert';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useEffect, useSyncExternalStore } from 'react';

const emptySubscribe = () => () => {};

export default function AlertContainer() {
  const { toasts, removeToast, modal, closeModal } = useAlertStore();
  // Hydration safety: 서버 렌더링과 첫 하이드레이션에서는 그리지 않습니다.
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  // 확인 창은 Esc 로 닫는다(취소와 같다). 다른 키 처리보다 먼저 받아 아래 화면까지 가지 않게 한다.
  useEffect(() => {
    if (!modal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.isComposing) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      closeModal(false);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [modal, closeModal]);

  if (!mounted) return null;

  // Destructive word detection for modal (e.g. '삭제', '내보내기')
  const isDestructive = modal?.message
    ? modal.message.includes('삭제') || modal.message.includes('내보내기') || modal.message.includes('거절')
    : false;

  return (
    <>
      {/* Toast List Container */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 items-center pointer-events-none w-full max-w-sm px-4">
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
          <div role={modal.type === 'confirm' ? 'alertdialog' : 'dialog'} aria-modal="true" aria-label={modal.title || undefined} className="w-full max-w-[400px] rounded-2xl bg-surface animate-scale-in">
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
                  onClick={() => closeModal(false)}
                  className="btn-secondary max-sm:h-11"
                >
                  {modal.cancelText || '취소'}
                </button>
              )}

              <button
                onClick={() => closeModal(true)}
                className={`${isDestructive ? 'btn-danger' : 'btn-primary'} max-sm:h-11`}
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
