"use client";

import { Crown, ArrowUpRight, X } from "lucide-react";
import Link from "next/link";

export type PremiumSubscribeModalProps = {
  open: boolean;
  onClose: () => void;
  message?: string;
};

/**
 * Shown when a free-tier user tries download / share / secure project I/O.
 */
export default function PremiumSubscribeModal({
  open,
  onClose,
  message = "프리미엄 구독 회원 전용 기능입니다",
}: PremiumSubscribeModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-white/15 bg-[#12161f] p-6 shadow-2xl sm:p-8">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 rounded-lg p-1.5 text-white/40 transition hover:bg-white/5 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-500/10 text-amber-200">
          <Crown className="h-6 w-6" />
        </div>
        <h2 className="mb-2 text-xl font-semibold text-white">{message}</h2>
        <p className="mb-6 text-sm leading-relaxed text-white/50">
          일반·고화질 다운로드, 공유, 수정파일(.sca) 저장/불러오기는 유료 구독
          회원에게 제공됩니다. 요금제에서 플랜을 선택해 주세요.
        </p>

        <div className="flex flex-col gap-3">
          <Link
            href="/pricing"
            onClick={onClose}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:brightness-110"
          >
            <ArrowUpRight className="h-4 w-4 shrink-0" />
            요금제 보러 가기
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex w-full items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/10"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
