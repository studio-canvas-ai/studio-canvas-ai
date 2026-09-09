"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PARTNER_COMMISSION_RATE } from "@/lib/partners/constants";

type PartnerRow = {
  partner: {
    id: string;
    code: string;
    accessToken: string;
    email: string | null;
    channelName: string | null;
    channelUrl: string | null;
    notes: string | null;
    active: boolean;
  };
  referralLink: string;
  signupCount: number;
  paidConversionCount: number;
  totalAmountKrw: number;
  totalAmountUsd: number;
  commissionKrw: number;
  commissionUsd: number;
};

function moneyKrw(n: number) {
  return `₩${Math.round(n).toLocaleString("ko-KR")}`;
}

export default function AdminPartnersClient() {
  const [rows, setRows] = useState<PartnerRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<
    Record<
      string,
      {
        email: string;
        channelName: string;
        channelUrl: string;
        notes: string;
        active: boolean;
      }
    >
  >({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/partners", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = (await res.json()) as {
        ok?: boolean;
        partners?: PartnerRow[];
        error?: string;
      };
      if (!res.ok || !data.ok || !Array.isArray(data.partners)) {
        throw new Error(data.error || "load_failed");
      }
      setRows(data.partners);
      const next: typeof drafts = {};
      for (const r of data.partners) {
        next[r.partner.id] = {
          email: r.partner.email || "",
          channelName: r.partner.channelName || "",
          channelUrl: r.partner.channelUrl || "",
          notes: r.partner.notes || "",
          active: r.partner.active,
        };
      }
      setDrafts(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "load_failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (id: string, rotateAccessToken = false) => {
    const draft = drafts[id];
    if (!draft) return;
    setSavingId(id);
    try {
      const res = await fetch("/api/admin/partners", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          email: draft.email || null,
          channelName: draft.channelName || null,
          channelUrl: draft.channelUrl || null,
          notes: draft.notes || null,
          active: draft.active,
          rotateAccessToken,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "save_failed");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "save_failed");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-white/50">
            고정 슬롯 10개 · 정산율 {(PARTNER_COMMISSION_RATE * 100).toFixed(0)}% ·
            이메일/채널 매핑 전에도 링크·토큰은 즉시 사용 가능
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-white/50">불러오는 중…</p>
      ) : error ? (
        <p className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {error}
          <span className="mt-1 block text-xs text-rose-100/70">
            Supabase에 `partner_slots` 마이그레이션이 적용됐는지 확인하세요.
          </span>
        </p>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => {
            const d = drafts[row.partner.id] || {
              email: "",
              channelName: "",
              channelUrl: "",
              notes: "",
              active: true,
            };
            const dashboardPath = `/partner/${row.partner.accessToken}`;
            return (
              <article
                key={row.partner.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-white">
                      {row.partner.id}
                      {!d.active ? (
                        <span className="ml-2 text-xs font-normal text-rose-300">
                          (비활성)
                        </span>
                      ) : !d.email && !d.channelName ? (
                        <span className="ml-2 text-xs font-normal text-amber-200/80">
                          (미배정)
                        </span>
                      ) : null}
                    </h3>
                    <p className="mt-1 text-xs text-white/45">
                      가입 {row.signupCount} · 유료전환 {row.paidConversionCount} ·
                      정산 {moneyKrw(row.commissionKrw)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={dashboardPath}
                      target="_blank"
                      className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-100 hover:bg-emerald-500/20"
                    >
                      파트너 뷰 열기
                    </Link>
                    <button
                      type="button"
                      disabled={savingId === row.partner.id}
                      onClick={() => void save(row.partner.id, false)}
                      className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 disabled:opacity-40"
                    >
                      저장
                    </button>
                    <button
                      type="button"
                      disabled={savingId === row.partner.id}
                      onClick={() => {
                        if (
                          window.confirm(
                            "액세스 토큰을 재발급하면 기존 파트너 대시보드 URL이 무효화됩니다. 계속할까요?"
                          )
                        ) {
                          void save(row.partner.id, true);
                        }
                      }}
                      className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/60 hover:bg-white/10 disabled:opacity-40"
                    >
                      토큰 재발급
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <label className="block text-xs text-white/50">
                    이메일
                    <input
                      value={d.email}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [row.partner.id]: { ...d, email: e.target.value },
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                      placeholder="partner@example.com"
                    />
                  </label>
                  <label className="block text-xs text-white/50">
                    채널명
                    <input
                      value={d.channelName}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [row.partner.id]: {
                            ...d,
                            channelName: e.target.value,
                          },
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                      placeholder="유튜브 채널명"
                    />
                  </label>
                  <label className="block text-xs text-white/50">
                    채널 URL
                    <input
                      value={d.channelUrl}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [row.partner.id]: {
                            ...d,
                            channelUrl: e.target.value,
                          },
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                      placeholder="https://youtube.com/@..."
                    />
                  </label>
                  <label className="block text-xs text-white/50">
                    메모
                    <input
                      value={d.notes}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [row.partner.id]: { ...d, notes: e.target.value },
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                      placeholder="계약/연락 메모"
                    />
                  </label>
                </div>

                <label className="mt-3 flex items-center gap-2 text-xs text-white/60">
                  <input
                    type="checkbox"
                    checked={d.active}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [row.partner.id]: { ...d, active: e.target.checked },
                      }))
                    }
                  />
                  활성 (비활성 시 신규 귀속·정산 중단)
                </label>

                <div className="mt-3 space-y-1 text-[11px] text-white/45">
                  <p>
                    레퍼럴:{" "}
                    <code className="text-emerald-200/90">{row.referralLink}</code>
                  </p>
                  <p>
                    파트너 어드민:{" "}
                    <code className="break-all text-white/70">{dashboardPath}</code>
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
