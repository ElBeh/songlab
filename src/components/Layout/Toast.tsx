import { useToastStore, type ToastType } from '../../stores/useToastStore';
import { X } from 'lucide-react';
import { ICON_SIZE } from '../../utils/iconSizes';

const TOAST_STYLES: Record<ToastType, { bg: string; border: string; text: string }> = {
  success: { bg: 'bg-emerald-950', border: 'border-emerald-700', text: 'text-emerald-200' },
  error: { bg: 'bg-red-950', border: 'border-red-700', text: 'text-red-200' },
  info: { bg: 'bg-slate-800', border: 'border-slate-600', text: 'text-slate-200' },
};

export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className='fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none'>
      {toasts.map((toast) => {
        const style = TOAST_STYLES[toast.type];
        return (
          <div
            key={toast.id}
            className={`${style.bg} ${style.border} ${style.text}
                        border rounded-lg px-4 py-2.5 font-mono text-sm
                        shadow-lg pointer-events-auto animate-slide-in
                        flex items-center gap-3 max-w-sm`}
          >
            <span className='flex-1'>{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className='text-slate-500 hover:text-slate-300 transition-colors text-xs'
            >
              <X size={ICON_SIZE.ACTION} />
            </button>
          </div>
        );
      })}
    </div>
  );
}