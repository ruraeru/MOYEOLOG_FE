import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

export interface ModalOptions {
  title?: string;
  message: string;
  type: 'alert' | 'confirm';
  confirmText?: string;
  cancelText?: string;
  resolve?: (value: boolean) => void;
}

interface AlertStore {
  toasts: ToastItem[];
  modal: ModalOptions | null;
  addToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
  alert: (message: string, title?: string, confirmText?: string) => Promise<boolean>;
  confirm: (message: string, title?: string, confirmText?: string, cancelText?: string) => Promise<boolean>;
  closeModal: (value: boolean) => void;
}

export const useAlertStore = create<AlertStore>((set, get) => ({
  toasts: [],
  modal: null,

  addToast: (message, type = 'info', duration = 3000) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }],
    }));

    setTimeout(() => {
      get().removeToast(id);
    }, duration);
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  alert: (message, title, confirmText = '확인') => {
    return new Promise<boolean>((resolve) => {
      set({
        modal: {
          message,
          title,
          type: 'alert',
          confirmText,
          resolve: () => {
            resolve(true);
          },
        },
      });
    });
  },

  confirm: (message, title, confirmText = '확인', cancelText = '취소') => {
    return new Promise<boolean>((resolve) => {
      set({
        modal: {
          message,
          title,
          type: 'confirm',
          confirmText,
          cancelText,
          resolve,
        },
      });
    });
  },

  closeModal: (value) => {
    const { modal } = get();
    if (modal?.resolve) {
      modal.resolve(value);
    }
    set({ modal: null });
  },
}));

// 토스트 함수는 스토어 상태와 무관하므로 모듈에서 한 번만 만들어 참조를 고정합니다.
// (매 렌더 새 객체를 돌려주면 effect 의존성에 넣었을 때 무한 렌더가 생깁니다.)
const toast = {
  success: (msg: string, dur?: number) => useAlertStore.getState().addToast(msg, 'success', dur),
  error: (msg: string, dur?: number) => useAlertStore.getState().addToast(msg, 'error', dur),
  warning: (msg: string, dur?: number) => useAlertStore.getState().addToast(msg, 'warning', dur),
  info: (msg: string, dur?: number) => useAlertStore.getState().addToast(msg, 'info', dur),
} as const;

const alertFn: AlertStore['alert'] = (...args) => useAlertStore.getState().alert(...args);
const confirmFn: AlertStore['confirm'] = (...args) => useAlertStore.getState().confirm(...args);
const api = { alert: alertFn, confirm: confirmFn, toast } as const;

/**
 * 알림·확인 창·토스트를 띄우는 훅. 돌려주는 객체와 함수는 항상 같은 참조라 effect 의존성에 넣어도 안전하고,
 * 토스트가 바뀌어도 이 훅을 쓰는 컴포넌트는 다시 그려지지 않습니다.
 */
export const useAlert = () => api;
