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

// Shortcut hooks or utility wrapper
export const useAlert = () => {
  const store = useAlertStore();

  const toast = {
    success: (msg: string, dur?: number) => store.addToast(msg, 'success', dur),
    error: (msg: string, dur?: number) => store.addToast(msg, 'error', dur),
    warning: (msg: string, dur?: number) => store.addToast(msg, 'warning', dur),
    info: (msg: string, dur?: number) => store.addToast(msg, 'info', dur),
  };

  return {
    alert: store.alert,
    confirm: store.confirm,
    toast,
  };
};
