"use client";

import { Trash2 } from "lucide-react";
import type { FoldLine, PrintBlueprint } from "@/lib/printWizardBlueprint";

type PrintBlueprintOverlayProps = {
  blueprint: PrintBlueprint;
  foldGuidesHidden?: boolean;
  onHideFoldGuides?: () => void;
  removeFoldLabel?: string;
};

function foldControlPosition(fold: FoldLine): { left: string; top: string } {
  if (fold.axis === "y") {
    return {
      left: `${fold.position * 100}%`,
      top: "3%",
    };
  }
  return {
    left: "3%",
    top: `${fold.position * 100}%`,
  };
}

/** Cut / safe guides (always) + optional fold lines with delete control. */
export default function PrintBlueprintOverlay({
  blueprint,
  foldGuidesHidden = false,
  onHideFoldGuides,
  removeFoldLabel = "Remove fold guides",
}: PrintBlueprintOverlayProps) {
  const bleedX = (blueprint.bleedMm / blueprint.widthMm) * 100;
  const bleedY = (blueprint.bleedMm / blueprint.heightMm) * 100;
  const safeX = (blueprint.safeMarginMm / blueprint.widthMm) * 100;
  const safeY = (blueprint.safeMarginMm / blueprint.heightMm) * 100;

  const showFolds = !foldGuidesHidden && blueprint.foldLines.length > 0;
  const primaryFold = blueprint.foldLines[0];

  return (
    <div className="pointer-events-none absolute inset-0 z-[3]">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        {/* Bleed zone (outside trim) */}
        <rect x="0" y="0" width="100" height={bleedY} fill="rgba(239,68,68,0.1)" />
        <rect
          x="0"
          y={100 - bleedY}
          width="100"
          height={bleedY}
          fill="rgba(239,68,68,0.1)"
        />
        <rect x="0" y="0" width={bleedX} height="100" fill="rgba(239,68,68,0.1)" />
        <rect
          x={100 - bleedX}
          y="0"
          width={bleedX}
          height="100"
          fill="rgba(239,68,68,0.1)"
        />

        {/* Cut line (trim) — always */}
        <rect
          x="0.15"
          y="0.15"
          width="99.7"
          height="99.7"
          fill="none"
          stroke="rgba(226,232,240,0.85)"
          strokeWidth="0.35"
        />

        {/* Safety margin — always */}
        <rect
          x={safeX}
          y={safeY}
          width={100 - safeX * 2}
          height={100 - safeY * 2}
          fill="none"
          stroke="rgba(74,222,128,0.75)"
          strokeWidth="0.35"
          strokeDasharray="1.2 0.8"
        />

        {/* Fold lines — conditional */}
        {showFolds
          ? blueprint.foldLines.map((fold, index) =>
              fold.axis === "y" ? (
                <line
                  key={`fold-${index}`}
                  x1={fold.position * 100}
                  y1="0"
                  x2={fold.position * 100}
                  y2="100"
                  stroke="rgba(248,113,113,0.95)"
                  strokeWidth="0.45"
                  strokeDasharray="1.5 1"
                />
              ) : (
                <line
                  key={`fold-${index}`}
                  x1="0"
                  y1={fold.position * 100}
                  x2="100"
                  y2={fold.position * 100}
                  stroke="rgba(248,113,113,0.95)"
                  strokeWidth="0.45"
                  strokeDasharray="1.5 1"
                />
              )
            )
          : null}
      </svg>

      {showFolds && primaryFold && onHideFoldGuides ? (
        <button
          type="button"
          title={removeFoldLabel}
          aria-label={removeFoldLabel}
          onClick={(e) => {
            e.stopPropagation();
            onHideFoldGuides?.();
          }}
          className="pointer-events-auto absolute z-[4] flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-rose-400/50 bg-[#1a1020]/90 text-rose-300 shadow-md transition hover:border-rose-300 hover:bg-rose-950/90 hover:text-rose-100"
          style={foldControlPosition(primaryFold)}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
