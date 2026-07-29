"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  PromotionBatch,
  PromotionCode,
  PromotionCreditOption,
  PromotionHistoryEntry,
} from "@/lib/db/types";
const PROMOTION_CREDIT_OPTIONS: PromotionCreditOption[] = [10, 20, 50, 100];

type AdminData = {
  codes: Omit<PromotionCode, "codeHash">[];
  batches: PromotionBatch[];
  history: PromotionHistoryEntry[];
};

export default function PromotionAdminDashboard() {
  const [creditAmount, setCreditAmount] = useState<PromotionCreditOption>(10);
  const [quantity, setQuantity] = useState(10);
  const [data, setData] = useState<AdminData>({ codes: [], batches: [], history: [] });
  const [generated, setGenerated] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/admin/promotions", { cache: "no-store" });
    if (!response.ok) throw new Error("관리자 데이터 조회 실패");
    setData((await response.json()) as AdminData);
  }, []);

  useEffect(() => {
    void refresh().catch((err) =>
      setError(err instanceof Error ? err.message : "조회 실패")
    );
    const timer = window.setInterval(() => void refresh().catch(() => undefined), 5_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const activeCount = useMemo(
    () =>
      data.codes.filter(
        (code) =>
          !code.isExpired && code.expiresAt > Date.now() && code.remainingCredits > 0
      ).length,
    [data.codes]
  );

  const create = async () => {
    setBusy(true);
    setError(null);
    setGenerated([]);
    try {
      const response = await fetch("/api/admin/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creditAmount, quantity }),
      });
      const result = (await response.json()) as { codes?: string[]; error?: string };
      if (!response.ok || !result.codes) {
        throw new Error(result.error || "코드 생성 실패");
      }
      setGenerated(result.codes);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "코드 생성 실패");
    } finally {
      setBusy(false);
    }
  };

  const downloadCsv = () => {
    if (!generated.length) return;
    const blob = new Blob(
      [`code,credits\n${generated.map((code) => `${code},${creditAmount}`).join("\n")}`],
      { type: "text/csv;charset=utf-8" }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `studio-canvas-promo-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ["전체 발행", data.codes.length],
          ["사용 가능", activeCount],
          [
            "잔여 크레딧",
            data.codes.reduce((sum, code) => sum + code.remainingCredits, 0),
          ],
        ].map(([label, value]) => (
          <div key={label} className="glass-card p-5">
            <p className="text-xs text-white/45">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
          </div>
        ))}
      </section>

      <section className="glass-card p-5 sm:p-6">
        <h2 className="text-lg font-semibold">대량 프로모션 코드 생성</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="space-y-2 text-sm text-white/60">
            <span>크레딧</span>
            <select
              value={creditAmount}
              onChange={(event) =>
                setCreditAmount(Number(event.target.value) as PromotionCreditOption)
              }
              className="w-full rounded-xl border border-white/10 bg-navy px-3 py-2.5"
            >
              {PROMOTION_CREDIT_OPTIONS.map((amount) => (
                <option key={amount} value={amount}>
                  {amount}C
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm text-white/60">
            <span>수량 (최대 500)</span>
            <input
              type="number"
              min={1}
              max={500}
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
              className="w-full rounded-xl border border-white/10 bg-navy px-3 py-2.5"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void create()}
            className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50"
          >
            {busy ? "생성 중…" : "일괄 생성"}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

        {generated.length > 0 && (
          <div className="mt-6 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-emerald-200">
                생성 완료 — 원문 코드는 지금만 표시됩니다.
              </p>
              <button
                type="button"
                onClick={downloadCsv}
                className="text-xs text-emerald-200 underline"
              >
                CSV 다운로드
              </button>
            </div>
            <textarea
              readOnly
              rows={Math.min(10, generated.length + 1)}
              value={generated.join("\n")}
              className="mt-3 w-full rounded-lg border border-white/10 bg-black/20 p-3 font-mono text-xs text-white/75"
            />
          </div>
        )}
      </section>

      <section className="glass-card overflow-hidden">
        <div className="border-b border-white/[0.06] p-5">
          <h2 className="font-semibold">코드별 잔액</h2>
          <p className="mt-1 text-xs text-white/40">5초마다 자동 갱신됩니다.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="bg-white/[0.03] text-white/45">
              <tr>
                <th className="px-4 py-3">코드</th>
                <th className="px-4 py-3">발행</th>
                <th className="px-4 py-3">잔액</th>
                <th className="px-4 py-3">사용</th>
                <th className="px-4 py-3">만료일</th>
                <th className="px-4 py-3">상태</th>
              </tr>
            </thead>
            <tbody>
              {data.codes.map((code) => (
                <tr key={code.id} className="border-t border-white/[0.05] text-white/65">
                  <td className="px-4 py-3 font-mono">••••-{code.codeSuffix}</td>
                  <td className="px-4 py-3">{code.initialCredits}C</td>
                  <td className="px-4 py-3 font-medium text-white">
                    {code.remainingCredits}C
                  </td>
                  <td className="px-4 py-3">{code.useCount}회</td>
                  <td className="px-4 py-3">
                    {new Date(code.expiresAt).toLocaleDateString("ko-KR")}
                  </td>
                  <td className="px-4 py-3">
                    {code.isExpired || code.remainingCredits <= 0 ? "만료" : "활성"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="glass-card p-5">
        <h2 className="font-semibold">최근 사용 이력</h2>
        <div className="mt-4 max-h-80 space-y-2 overflow-y-auto">
          {data.history.slice(0, 100).map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/[0.025] px-3 py-2 text-xs"
            >
              <span className="text-white/60">
                {item.type} · {item.promotionId}
              </span>
              <span className="text-white/45">
                {item.delta > 0 ? "+" : ""}
                {item.delta}C → {item.balanceAfter}C ·{" "}
                {new Date(item.createdAt).toLocaleString("ko-KR")}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
