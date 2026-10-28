import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'warning' | 'info' | 'critical';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (title: string, message?: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback(
    (title: string, message?: string, type: ToastType = 'info', duration: number = 3800) => {
      const id = Math.random().toString(36).slice(2, 9);
      const newToast: ToastMessage = { id, type, title, message, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
      }
    },
    []
  );

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container (top right, non-intrusive) */}
      <div className="fixed top-16 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((t) => {
          const typeClasses = {
            success: 'bg-[#111A2E] border-[#22C55E]/50 text-[#E6EDF7]',
            warning: 'bg-[#111A2E] border-[#F59E0B]/50 text-[#E6EDF7]',
            critical: 'bg-[#111A2E] border-[#EF4444]/60 text-[#E6EDF7]',
            info: 'bg-[#111A2E] border-[#38BDF8]/40 text-[#E6EDF7]',
          };

          const icon =
            t.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#22C55E] shrink-0" />
            ) : t.type === 'warning' ? (
              <AlertTriangle className="w-4 h-4 text-[#F59E0B] shrink-0" />
            ) : t.type === 'critical' ? (
              <AlertTriangle className="w-4 h-4 text-[#EF4444] shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-[#38BDF8] shrink-0" />
            );

          return (
            <div
              key={t.id}
              className={`pointer-events-auto p-3 rounded-lg border shadow-xl flex items-start gap-2.5 transition-all duration-200 animate-in fade-in slide-in-from-top-2 ${typeClasses[t.type]}`}
            >
              {icon}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-mono font-bold leading-tight">{t.title}</div>
                {t.message && (
                  <div className="text-[11px] text-[#9FB0CC] font-sans mt-0.5 leading-snug">
                    {t.message}
                  </div>
                )}
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="text-[#6B7C99] hover:text-[#E6EDF7] p-0.5 transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      showToast: (title: string, message?: string) => console.log(`[Toast] ${title}: ${message}`),
    };
  }
  return ctx;
}
