import React from 'react';
import { useUIStore } from '../../store/useUIStore';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useUIStore();

  return (
    <div
      id="toastbox"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none p-2"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`card px-4 py-2.5 text-sm shadow-xl flex items-center justify-between gap-3 pointer-events-auto transition-all transform translate-y-0 opacity-100 ${
            t.ok ? 'text-foreground' : 'text-red-500 border-red-300 dark:border-red-800'
          }`}
          role="status"
        >
          <div className="flex items-center gap-2">
            {t.ok ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            )}
            <span className="font-medium">{t.msg}</span>
          </div>
          <button
            onClick={() => removeToast(t.id)}
            className="text-muted hover:text-foreground p-1 rounded-md"
            aria-label="Close toast"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};

