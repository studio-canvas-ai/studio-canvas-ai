"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";

export type ToastTone = "success" | "error" | "info";

type Toast = {
  id: number;
  message: string;
  tone: ToastTone;
};

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
};

type PendingConfirm = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

type FeedbackContextValue = {
  /** Replaces window.alert — non-blocking glass toast. */
  showToast: (message: string, tone?: ToastTone) => void;
  /** Replaces window.confirm — returns a promise resolved by the modal. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

const TOAST_DURATION_MS = 3600;

const TOAST_STYLES: Record<ToastTone, { icon: typeof Info; className: string }> = {
  success: {
    icon: CheckCircle2,
    className: "border-emerald-400/40 bg-emerald-950/70 text-emerald-100",
  },
  error: {
    icon: XCircle,
    className: "border-red-400/40 bg-red-950/70 text-red-100",
  },
  info: {
    icon: Info,
    className: "border-white/25 bg-navy-light/80 text-zinc-100",
  },
};

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const nextId = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (message: string, tone: ToastTone = "info") => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, message, tone }]);
      const timer = setTimeout(() => dismissToast(id), TOAST_DURATION_MS);
      timers.current.set(id, timer);
    },
    [dismissToast]
  );

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setPending({ ...options, resolve });
      }),
    []
  );

  const settle = useCallback(
    (value: boolean) => {
      setPending((current) => {
        current?.resolve(value);
        return null;
      });
    },
    []
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((timer) => clearTimeout(timer));
      map.clear();
    };
  }, []);

  useEffect(() => {
    if (!pending) return;
    confirmButtonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") settle(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, settle]);

  const value = useMemo<FeedbackContextValue>(
    () => ({ showToast, confirm }),
    [showToast, confirm]
  );

  const danger = pending?.tone === "danger";

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-5 left-1/2 z-[200] flex w-[min(92vw,26rem)] -translate-x-1/2 flex-col gap-2"
      >
        {toasts.map((toast) => {
          const style = TOAST_STYLES[toast.tone];
          const Icon = style.icon;
          return (
            <div
              key={toast.id}
              role="status"
              className={`pointer-events-auto flex items-start gap-2.5 rounded-xl border px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl ${style.className}`}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p className="min-w-0 flex-1 text-sm leading-snug break-words">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="rounded-md p-0.5 text-current opacity-70 transition hover:opacity-100"
                aria-label={t.common.close}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {pending && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label={t.common.cancel}
            onClick={() => settle(false)}
            className="absolute inset-0 bg-navy/80 backdrop-blur-sm"
          />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="glass-card relative z-10 w-full max-w-sm p-6"
          >
            <div className="flex items-start gap-3">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  danger ? "bg-red-500/15 text-red-200" : "bg-glow-purple/15 text-glow-purple"
                }`}
              >
                <AlertTriangle className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                {pending.title && (
                  <h2 id="confirm-title" className="text-base font-semibold text-white">
                    {pending.title}
                  </h2>
                )}
                <p
                  id={pending.title ? undefined : "confirm-title"}
                  className="mt-1 text-sm leading-relaxed whitespace-pre-line text-zinc-200"
                >
                  {pending.message}
                </p>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => settle(false)}
                className="btn-secondary flex-1 py-2.5 text-sm"
              >
                {pending.cancelLabel ?? t.common.cancel}
              </button>
              <button
                ref={confirmButtonRef}
                type="button"
                onClick={() => settle(true)}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition ${
                  danger
                    ? "border border-red-400/40 bg-red-500/25 hover:bg-red-500/40"
                    : "btn-primary"
                }`}
              >
                {pending.confirmLabel ?? t.common.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackContextValue {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback must be used within FeedbackProvider");
  return ctx;
}
