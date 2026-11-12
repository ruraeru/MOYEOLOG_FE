'use client';

import { useAlertStore } from '@/hooks/useAlert';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function AlertContainer() {
  const { toasts, removeToast, modal, closeModal } = useAlertStore();
  const [mounted, setMounted] = useState(false);

  // Hydration safety
  useEffect(() => {
    setMounted(true);
  }, []);

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
                className="btn-ghost size-7 !h-7 !px-0 cursor-pointer"
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Alert/Confirm Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-[9998] flex items-center justify-center p-4">
          {/* Modal Box */}
          <div className="bg-surface rounded-2xl p-6 max-w-sm w-full shadow-float border border-line animate-scale-in">
            {/* Title / Icon */}
            <div className="flex flex-col items-center text-center gap-3 mb-6">
              <div className="size-10 rounded-full bg-raised flex items-center justify-center">
                {isDestructive ? (
                  <AlertTriangle size={18} strokeWidth={1.5} className="text-negative" />
                ) : modal.type === 'confirm' ? (
                  <Info size={18} strokeWidth={1.5} className="text-ink-3" />
                ) : (
                  <CheckCircle2 size={18} strokeWidth={1.5} className="text-ink-3" />
                )}
              </div>

              {modal.title && (
                <h3 className="text-lg font-semibold text-ink">
                  {modal.title}
                </h3>
              )}

              <p className="text-sm text-ink-2 whitespace-pre-wrap leading-relaxed">
                {modal.message}
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-2">
              {modal.type === 'confirm' && (
                <button
                  onClick={() => closeModal(false)}
                  className="btn-secondary flex-1 cursor-pointer"
                >
                  {modal.cancelText || '취소'}
                </button>
              )}

              <button
                onClick={() => closeModal(true)}
                className={`flex-1 cursor-pointer ${
                  isDestructive
                    ? 'btn-primary !bg-negative hover:!bg-negative/90'
                    : 'btn-primary'
                }`}
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
