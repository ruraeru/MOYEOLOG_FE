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
      <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 items-center pointer-events-none w-full max-w-sm px-4">
        {toasts.map((toast) => {
          let bgClass = '';
          let icon = null;

          switch (toast.type) {
            case 'success':
              bgClass = 'bg-emerald-50/95 border-emerald-100/80 text-emerald-800 dark:bg-emerald-950/95 dark:border-emerald-900/40 dark:text-emerald-200';
              icon = <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />;
              break;
            case 'error':
              bgClass = 'bg-rose-50/95 border-rose-100/80 text-rose-800 dark:bg-rose-950/95 dark:border-rose-900/40 dark:text-rose-200';
              icon = <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />;
              break;
            case 'warning':
              bgClass = 'bg-amber-50/95 border-amber-100/80 text-amber-800 dark:bg-amber-950/95 dark:border-amber-900/40 dark:text-amber-200';
              icon = <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />;
              break;
            case 'info':
            default:
              bgClass = 'bg-indigo-50/95 border-indigo-100/80 text-indigo-800 dark:bg-indigo-950/95 dark:border-indigo-900/40 dark:text-indigo-200';
              icon = <Info className="w-5 h-5 text-indigo-500 shrink-0" />;
              break;
          }

          return (
            <div
              key={toast.id}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border shadow-lg backdrop-blur-sm pointer-events-auto transition-all duration-300 transform translate-y-0 opacity-100 animate-slide-down w-full ${bgClass}`}
            >
              {icon}
              <span className="text-sm font-semibold flex-1 leading-snug">{toast.message}</span>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-0.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Alert/Confirm Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-xs z-[9998] flex items-center justify-center p-4">
          {/* Modal Box */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-gray-100 dark:border-zinc-800/80 transform scale-100 opacity-100 animate-scale-in transition-all">
            {/* Title / Icon */}
            <div className="flex flex-col items-center text-center gap-3 mb-5">
              <div className={`p-3.5 rounded-2xl ${isDestructive ? 'bg-rose-50 text-rose-500 dark:bg-rose-950/30' : 'bg-indigo-50 text-indigo-500 dark:bg-indigo-950/30'}`}>
                {isDestructive ? (
                  <AlertTriangle className="w-6 h-6" />
                ) : modal.type === 'confirm' ? (
                  <Info className="w-6 h-6" />
                ) : (
                  <CheckCircle2 className="w-6 h-6" />
                )}
              </div>
              
              {modal.title && (
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {modal.title}
                </h3>
              )}
              
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 whitespace-pre-wrap leading-relaxed">
                {modal.message}
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-2.5">
              {modal.type === 'confirm' && (
                <button
                  onClick={() => closeModal(false)}
                  className="px-4 py-3 bg-gray-50 dark:bg-zinc-850 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-gray-400 rounded-2xl text-sm font-bold transition-all active:scale-95 flex-1 cursor-pointer"
                >
                  {modal.cancelText || '취소'}
                </button>
              )}
              
              <button
                onClick={() => closeModal(true)}
                className={`px-6 py-3 text-white rounded-2xl text-sm font-bold shadow-sm transition-all active:scale-95 flex-1 cursor-pointer ${
                  isDestructive
                    ? 'bg-rose-500 hover:bg-rose-600 focus:ring-4 focus:ring-rose-100 dark:focus:ring-rose-950/50'
                    : 'bg-indigo-400 hover:bg-indigo-500 focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-950/50'
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
