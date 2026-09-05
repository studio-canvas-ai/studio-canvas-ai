"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import type { StudioStoreCounts } from "@/lib/studioStore/persistKeys";
import type { StudioStoreItemSummary, StudioStoreSummary } from "@/lib/studioStore/summarize";
import type { StudioStoreSnapshotMeta } from "@/lib/studioStore/snapshots";

type InspectUser = {
  id: string;
  email: string | null;
  name: string | null;
  supabaseUserId: string;
  appUserId: string | null;
};

type InspectResponse = {
  ok?: boolean;
  error?: string;
  user?: InspectUser;
  current?: StudioStoreSummary;
  snapshots?: StudioStoreSnapshotMeta[];
  supabaseRows?: number;
  r2Keys?: string[];
  hasRestorableBackup?: boolean;
  source?: "snapshot" | "current_cloud";
  snapshotId?: string | null;
};

function formatWhen(isoOrMs: string | number, locale: string) {
  try {
    const d = typeof isoOrMs === "number" ? new Date(isoOrMs) : new Date(isoOrMs);
    return d.toLocaleString(locale === "kr" ? "ko-KR" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(isoOrMs);
  }
}

function formatCountLine(
  template: string,
  counts: StudioStoreCounts
): string {
  return template
    .replace("{recent}", String(counts.recentShared + counts.recentPhoto))
    .replace("{upload}", String(counts.uploadVault))
    .replace("{trained}", String(counts.trainedVault));
}

function ItemList({
  title,
  items,
  locale,
}: {
  title: string;
  items: StudioStoreItemSummary[];
  locale: string;
}) {
  return (
    <div>
      <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-white/45">
        {title} ({items.length})
      </h4>
      {items.length === 0 ? (
        <p className="text-xs text-white/35">0</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.id} className="truncate text-xs text-white/75">
              {item.label}
              <span className="ml-2 text-white/35">
                {item.savedAt ? formatWhen(item.savedAt, locale) : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminStudioStorePanel() {
  const { t, locale } = useI18n();
  const a = t.admin;
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [data, setData] = useState<InspectResponse | null>(null);

  const inspect = useCallback(async (q: string) => {
    setQuery(q);
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(
        `/api/admin/studio-store?q=${encodeURIComponent(q.trim())}`,
        { cache: "no-store", credentials: "same-origin" }
      );
      const json = (await res.json().catch(() => ({}))) as InspectResponse;
      if (!res.ok || !json.ok) {
        throw new Error(
          json.error === "user_not_found"
            ? a.storeUserNotFound
            : json.error || a.storeInspectError
        );
      }
      setData(json);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : a.storeInspectError);
    } finally {
      setLoading(false);
    }
  }, [a.storeInspectError, a.storeUserNotFound]);

  useEffect(() => {
    const onInspect = (ev: Event) => {
      const detail = (ev as CustomEvent<string>).detail;
      if (typeof detail === "string" && detail.trim()) {
        setQuery(detail.trim());
        void inspect(detail.trim());
        document
          .getElementById("admin-studio-store")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    window.addEventListener("sca:admin-inspect-store", onInspect);
    return () => window.removeEventListener("sca:admin-inspect-store", onInspect);
  }, [inspect]);

  const restore = useCallback(
    async (snapshotId?: string) => {
      const q = data?.user?.email || data?.user?.id || query.trim();
      if (!q) return;
      if (!window.confirm(a.storeRestoreConfirm)) return;
      setRestoring(true);
      setError(null);
      setNotice(null);
      try {
        const res = await fetch("/api/admin/studio-store", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q, snapshotId }),
        });
        const json = (await res.json().catch(() => ({}))) as InspectResponse;
        if (!res.ok || !json.ok) {
          throw new Error(
            json.error === "no_backup" || json.error === "snapshot_empty"
              ? a.storeNoBackup
              : json.error || a.storeRestoreError
          );
        }
        setNotice(a.storeRestoreOk);
        await inspect(q);
      } catch (err) {
        setError(err instanceof Error ? err.message : a.storeRestoreError);
      } finally {
        setRestoring(false);
      }
    },
    [a, data, inspect, query]
  );

  const current = data?.current;

  return (
    <div id="admin-studio-store">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-white">{a.storeTitle}</h2>
        <p className="mt-1 text-sm text-white/50">{a.storeSubtitle}</p>
      </div>

      <form
        className="mb-6 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) void inspect(query);
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={a.storeQueryPlaceholder}
          className="min-w-[240px] flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/80 transition hover:bg-white/10 disabled:opacity-40"
        >
          {loading ? a.storeInspecting : a.storeInspect}
        </button>
      </form>

      {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}
      {notice ? <p className="mb-4 text-sm text-glow-emerald">{notice}</p> : null}

      {data?.user && current ? (
        <div className="glass-card space-y-5 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white">
                {data.user.email || data.user.id}
              </p>
              <p className="mt-1 font-mono text-[11px] text-white/40">
                {data.user.name ? `${data.user.name} · ` : ""}
                app {data.user.id}
                {data.user.appUserId && data.user.appUserId !== data.user.id
                  ? ` · ${data.user.appUserId}`
                  : ""}
              </p>
              <p className="mt-2 text-xs tabular-nums text-white/55">
                {formatCountLine(a.storeCountLine, current.counts)}
              </p>
              <p className="mt-1 text-[11px] text-white/35">
                Supabase {data.supabaseRows ?? 0} · R2 {(data.r2Keys ?? []).length}
              </p>
            </div>
            <button
              type="button"
              disabled={restoring || !data.hasRestorableBackup}
              onClick={() => void restore()}
              className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100 transition hover:bg-emerald-400/20 disabled:opacity-40"
            >
              {restoring ? a.storeRestoring : a.storeRestoreLatest}
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <ItemList
              title={a.storeRecentShared}
              items={current.recentShared}
              locale={locale}
            />
            <ItemList
              title={a.storeRecentPhoto}
              items={current.recentPhoto}
              locale={locale}
            />
            <ItemList
              title={a.storeUploadVault}
              items={current.uploadVault}
              locale={locale}
            />
            <ItemList
              title={a.storeTrainedVault}
              items={current.trainedVault}
              locale={locale}
            />
          </div>

          <div>
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-white/45">
              {a.storeSnapshots}
            </h4>
            {!data.snapshots?.length ? (
              <p className="text-xs text-white/35">{a.storeNoSnapshots}</p>
            ) : (
              <ul className="space-y-2">
                {data.snapshots.map((snap) => (
                  <li
                    key={snap.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-2"
                  >
                    <div>
                      <p className="text-xs text-white/80">
                        {formatWhen(snap.createdAt, locale)} · {snap.reason}
                      </p>
                      <p className="text-xs tabular-nums text-white/55">
                        {formatCountLine(a.storeCountLine, snap.counts)}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={restoring}
                      onClick={() => void restore(snap.id)}
                      className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-white/70 hover:bg-white/10 disabled:opacity-40"
                    >
                      {a.storeRestoreThis}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
