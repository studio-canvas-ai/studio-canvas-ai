"use client";

type AuthBridgeLoadingProps = {
  message: string;
  errorText?: string | null;
  errorTitle?: string;
  redirectingLabel?: string;
  continueLabel?: string;
  onContinue?: () => void;
};

/**
 * Full-viewport auth bridge shell — dark theme ambient glow + neon spinner.
 */
export default function AuthBridgeLoading({
  message,
  errorText,
  errorTitle,
  redirectingLabel,
  continueLabel,
  onContinue,
}: AuthBridgeLoadingProps) {
  const isError = Boolean(errorText);

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[#0d0e12]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-[28%] left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.28)_0%,transparent_68%)] blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[18%] bottom-[22%] h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.16)_0%,transparent_70%)] blur-2xl"
      />

      <div className="sca-bridge-fade relative z-10 flex max-w-md flex-col items-center gap-6 text-center">
        {!isError ? (
          <div className="relative h-14 w-14" aria-hidden>
            <div className="absolute inset-0 rounded-full border border-white/10" />
            <div
              className="sca-bridge-spinner absolute inset-0 rounded-full border-2 border-transparent border-t-[#8b5cf6] border-r-[#10b981] shadow-[0_0_18px_rgba(139,92,246,0.55),0_0_36px_rgba(16,185,129,0.18)]"
            />
            <div className="sca-bridge-spinner-rev absolute inset-[5px] rounded-full border border-transparent border-b-[#a78bfa]/60" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="h-2 w-2 rounded-full bg-gradient-to-br from-[#8b5cf6] to-[#10b981] shadow-[0_0_12px_rgba(139,92,246,0.8)]" />
            </div>
          </div>
        ) : (
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full border border-red-400/30 bg-red-500/10"
            aria-hidden
          >
            <span className="text-xl text-red-300">!</span>
          </div>
        )}

        {isError ? (
          <>
            <p className="text-sm font-semibold tracking-wide text-red-300">
              {errorTitle}
            </p>
            <p
              id="sca-bridge-status"
              className="max-w-md break-words text-sm leading-relaxed text-red-200/80"
            >
              {errorText}
            </p>
            <p className="text-xs text-white/45">{redirectingLabel}</p>
            {onContinue ? (
              <button
                type="button"
                className="mt-1 rounded-xl border border-red-400/35 bg-red-500/10 px-4 py-2 text-xs font-medium text-red-200 transition hover:bg-red-500/20"
                onClick={onContinue}
              >
                {continueLabel}
              </button>
            ) : null}
          </>
        ) : (
          <p
            id="sca-bridge-status"
            className="text-[15px] font-medium tracking-wide text-white/85"
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
