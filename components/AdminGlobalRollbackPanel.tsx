"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { GLOBAL_ROLLBACK_CONFIRM } from "@/lib/studioStore/rollbackConfirm";

function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminGlobalRollbackPanel() {
  const { t, locale } = useI18n();
  const a = t.admin;
  const [when, setWhen] = useState(() => toDatetimeLocalValue(new Date()));
  const [confirmText, setConfirmText] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    restored: number;
    failed: number;
    targetTimestamp: string;
  } | null>(null);

  const confirmOk = confirmText.trim() === GLOBAL_ROLLBACK_CONFIRM;

  const resultLine = useMemo(() => {
    if (!result) return null;
    return a.globalRollbackDone.replace("{count}", String(result.restored));
  }, [a.globalRollbackDone, result]);

  async function runRollback() {
    setError(null);
    setResult(null);
    if (!when) {
      setError(a.globalRollbackInvalidTime);
      return;
    }
    if (!confirmOk) {
      setError(a.globalRollbackTypeHint);
      return;
    }
    if (!window.confirm(a.globalRollbackConfirm)) return;

    const local = new Date(when);
    if (Number.isNaN(local.getTime())) {
      setError(a.globalRollbackInvalidTime);
      return;
    }

    setRunning(true);
    try {
      const res = await fetch("/api/admin/global-rollback", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetTimestamp: local.toISOString(),
          confirm: GLOBAL_ROLLBACK_CONFIRM,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        restored?: number;
        failed?: number;
        targetTimestamp?: string;
        error?: string;
      };
      if (!res.ok || json.ok === false) {
        throw new Error(
          json.error === "invalid_timestamp"
            ? a.globalRollbackInvalidTime
            : json.error || a.globalRollbackError
        );
      }
      setResult({
        restored: json.restored ?? 0,
        failed: json.failed ?? 0,
        targetTimestamp: json.targetTimestamp || local.toISOString(),
      });
      setConfirmText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : a.globalRollbackError);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div id="admin-global-rollback" className="border-t border-white/10 pt-12">
      <h2 className="text-xl font-semibold text-white">{a.globalRollbackTitle}</h2>
      <p className="mt-1 text-sm text-white/50">{a.globalRollbackSubtitle}</p>
      <p className="mt-2 text-xs text-red-300/80">{a.globalRollbackWarn}</p>

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <label className="block text-xs text-white/45">
          {a.globalRollbackTime}
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="mt-1 block rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
          />
        </label>
        <label className="block text-xs text-white/45">
          {a.globalRollbackTypeHint}
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={GLOBAL_ROLLBACK_CONFIRM}
            autoComplete="off"
            className="mt-1 block min-w-[180px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm outline-none"
          />
        </label>
        <button
          type="button"
          disabled={running || !confirmOk}
          onClick={() => void runRollback()}
          className="rounded-lg border border-red-400/40 bg-red-500/15 px-3 py-2 text-xs text-red-100 transition hover:bg-red-500/25 disabled:opacity-40"
        >
          {running ? a.globalRollbackRunning : a.globalRollbackButton}
        </button>
      </div>

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
      {resultLine ? (
        <p className="mt-4 text-sm text-glow-emerald">
          {resultLine}
          {result && result.failed > 0
            ? ` · ${a.globalRollbackFailed.replace("{count}", String(result.failed))}`
            : ""}
          {result?.targetTimestamp ? (
            <span className="mt-1 block text-xs text-white/40">
              {new Date(result.targetTimestamp).toLocaleString(
                locale === "kr" ? "ko-KR" : "en-US"
              )}
            </span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
