import { create } from 'zustand';

export interface ToastItem {
  id: string;
  msg: string;
  ok: boolean;
}

interface UIStore {
  activeMaterialId: string | null;
  setActiveMaterialId: (id: string | null) => void;
  freeTopic: string;
  setFreeTopic: (topic: string) => void;
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  toasts: ToastItem[];
  addToast: (msg: string, ok?: boolean) => void;
  removeToast: (id: string) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  activeMaterialId: null,
  setActiveMaterialId: (id) => set({ activeMaterialId: id }),
  freeTopic: '',
  setFreeTopic: (topic) => set({ freeTopic: topic }),
  theme: (localStorage.getItem('studyai-theme') as any) || 'system',
  setTheme: (theme) => {
    localStorage.setItem('studyai-theme', theme);
    const root = document.documentElement;
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.setAttribute('data-theme', 'light');
      root.classList.remove('dark');
    } else {
      root.removeAttribute('data-theme');
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
    set({ theme });
  },
  toasts: [],
  addToast: (msg, ok = true) => {
    const id = Math.random().toString(36).slice(2);
    set((state) => ({ toasts: [...state.toasts, { id, msg, ok }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 3500);
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

