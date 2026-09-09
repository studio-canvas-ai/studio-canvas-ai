"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type PartnerStatsPayload = {
  partner: {
    id: string;
    code: string;
    email: string | null;
    channelName: string | null;
    channelUrl: string | null;
    active: boolean;
  };
  referralLink: string;
  signupCount: number;
  paidConversionCount: number;
  totalAmountKrw: number;
  totalAmountUsd: number;
  commissionKrw: number;
  commissionUsd: number;
  recentCommissions: Array<{
    orderId: string;
    appUserId: string;
    planId: string | null;
    billingInterval: string | null;
    amountKrw: number;
    amountUsd: number;
    commissionKrw: number;
    commissionUsd: number;
    createdAt: string;
  }>;
};

function moneyKrw(n: number) {
  return `₩${Math.round(n).toLocaleString("ko-KR")}`;
}

function moneyUsd(n: number) {
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function PartnerDashboardClient({ token }: { token: string }) {
  const [stats, setStats] = useState<PartnerStatsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/partner/${encodeURIComponent(token)}/stats`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = (await res.json()) as {
        ok?: boolean;
        stats?: PartnerStatsPayload;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.stats) {
        throw new Error(data.error || "load_failed");
      }
      setStats(data.stats);
      setError(null);
    } catch (err) {
      setStats(null);
      setError(err instanceof Error ? err.message : "load_failed");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const cards = useMemo(() => {
    if (!stats) return [];
    return [
      { label: "누적 가입자", value: String(stats.signupCount) },
      { label: "유료 구독 전환", value: String(stats.paidConversionCount) },
      {
        label: "구독료 총액",
        value: `${moneyKrw(stats.totalAmountKrw)} / ${moneyUsd(stats.totalAmountUsd)}`,
      },
      {
        label: "정산 금액 (10%)",
        value: `${moneyKrw(stats.commissionKrw)} / ${moneyUsd(stats.commissionUsd)}`,
      },
    ];
  }, [stats]);

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300/80">
          Partner Admin
        </p>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">
          파트너 실적 대시보드
        </h1>
        <p className="text-sm text-white/55">
          본인 슬롯({stats?.partner.code ?? "…"})에 귀속된 유입·구독·정산만
          표시됩니다.
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-white/50">불러오는 중…</p>
      ) : error ? (
        <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          접근할 수 없습니다 ({error}). 관리자에게 받은 전용 링크를 확인해
          주세요.
        </div>
      ) : stats ? (
        <>
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-sm font-semibold text-white">전용 레퍼럴 링크</h2>
            <p className="mt-1 text-xs text-white/45">
              채널 설명란·고정 댓글에 이 링크를 사용하세요. 가입·유료 구독이 이
              슬롯으로 집계됩니다.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="block flex-1 truncate rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-emerald-200">
                {stats.referralLink}
              </code>
              <button
                type="button"
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10"
                onClick={() => {
                  void navigator.clipboard.writeText(stats.referralLink).then(() => {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1500);
                  });
                }}
              >
                {copied ? "복사됨" : "링크 복사"}
              </button>
            </div>
            {(stats.partner.channelName || stats.partner.email) && (
              <p className="mt-3 text-xs text-white/45">
                {stats.partner.channelName ? `채널: ${stats.partner.channelName}` : null}
                {stats.partner.channelName && stats.partner.email ? " · " : null}
                {stats.partner.email ? `이메일: ${stats.partner.email}` : null}
              </p>
            )}
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            {cards.map((c) => (
              <div
                key={c.label}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4"
              >
                <p className="text-[11px] font-medium uppercase tracking-wide text-white/45">
                  {c.label}
                </p>
                <p className="mt-2 text-lg font-semibold tabular-nums text-white">
                  {c.value}
                </p>
              </div>
            ))}
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-white">최근 정산 내역</h2>
              <button
                type="button"
                onClick={() => void load()}
                className="text-xs text-white/50 underline-offset-2 hover:text-white/80 hover:underline"
              >
                새로고침
              </button>
            </div>
            {stats.recentCommissions.length === 0 ? (
              <p className="text-sm text-white/45">
                아직 유료 구독 정산이 없습니다.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs text-white/80">
                  <thead className="border-b border-white/10 text-white/45">
                    <tr>
                      <th className="px-2 py-2 font-medium">일시</th>
                      <th className="px-2 py-2 font-medium">플랜</th>
                      <th className="px-2 py-2 font-medium">구독료</th>
                      <th className="px-2 py-2 font-medium">정산(10%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentCommissions.map((row) => (
                      <tr
                        key={row.orderId}
                        className="border-b border-white/5 last:border-0"
                      >
                        <td className="whitespace-nowrap px-2 py-2 tabular-nums">
                          {new Date(row.createdAt).toLocaleString("ko-KR")}
                        </td>
                        <td className="px-2 py-2">
                          {row.planId || "—"}
                          {row.billingInterval ? ` / ${row.billingInterval}` : ""}
                        </td>
                        <td className="px-2 py-2 tabular-nums">
                          {moneyKrw(row.amountKrw)}
                          <span className="text-white/35">
                            {" "}
                            / {moneyUsd(row.amountUsd)}
                          </span>
                        </td>
                        <td className="px-2 py-2 tabular-nums text-emerald-300">
                          {moneyKrw(row.commissionKrw)}
                          <span className="text-emerald-300/50">
                            {" "}
                            / {moneyUsd(row.commissionUsd)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
