import { AlertCircle, CheckCircle2, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  ok: boolean;
  text: string;
}

export function ToastBanner({
  toast,
  onDismiss,
}: {
  toast: ToastMessage | null;
  onDismiss: () => void;
}) {
  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex max-w-md items-start gap-3 rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-950 shadow-lg dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-50"
    >
      {toast.ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-neutral-950 dark:text-neutral-50" />
      ) : (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-neutral-950 dark:text-neutral-50" />
      )}
      <p className="flex-1 leading-snug">{toast.text}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="rounded p-1 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-50"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
