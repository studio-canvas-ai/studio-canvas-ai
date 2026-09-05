"use client";

/**
 * Decorative vector shapes for Magic Layout (ribbon, frame, pill, stamp, line…).
 */

import type { PrintDecoShapeType } from "@/lib/printWizardTypes";

export type DecoVectorShapeProps = {
  shapeType: PrintDecoShapeType;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
  className?: string;
};

export default function DecoVectorShape({
  shapeType,
  fill = "rgba(255,255,255,0.92)",
  stroke = "#1f2937",
  strokeWidth = 2,
  cornerRadius = 8,
  className,
}: DecoVectorShapeProps) {
  const sw = Math.max(0.5, strokeWidth);

  if (shapeType === "line") {
    return (
      <svg
        viewBox="0 0 100 12"
        preserveAspectRatio="none"
        className={className}
        aria-hidden
      >
        <line
          x1="2"
          y1="6"
          x2="98"
          y2="6"
          stroke={stroke || fill}
          strokeWidth={sw}
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (shapeType === "frame") {
    return (
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className={className}
        aria-hidden
      >
        <rect
          x="3"
          y="3"
          width="94"
          height="94"
          fill="none"
          stroke={stroke}
          strokeWidth={sw}
          rx={Math.min(12, cornerRadius)}
        />
        <rect
          x="8"
          y="8"
          width="84"
          height="84"
          fill="none"
          stroke={stroke}
          strokeWidth={Math.max(0.8, sw * 0.55)}
          strokeDasharray="4 3"
          rx={Math.min(8, cornerRadius * 0.7)}
          opacity={0.85}
        />
      </svg>
    );
  }

  if (shapeType === "circle" || shapeType === "stamp") {
    return (
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        className={className}
        aria-hidden
      >
        <circle
          cx="50"
          cy="50"
          r="44"
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
        />
        {shapeType === "stamp" ? (
          <circle
            cx="50"
            cy="50"
            r="36"
            fill="none"
            stroke={stroke}
            strokeWidth={Math.max(0.8, sw * 0.6)}
            strokeDasharray="3 2"
            opacity={0.9}
          />
        ) : null}
      </svg>
    );
  }

  if (shapeType === "ribbon") {
    return (
      <svg
        viewBox="0 0 120 40"
        preserveAspectRatio="none"
        className={className}
        aria-hidden
      >
        <path
          d="M4 6 H102 L114 20 L102 34 H4 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth={sw * 0.6}
        />
        <path d="M102 6 L114 20 L102 34" fill="none" stroke={stroke} strokeWidth={sw * 0.5} opacity={0.5} />
      </svg>
    );
  }

  // pill | rect (default)
  const isPill = shapeType === "pill";
  const rx = isPill ? 50 : Math.min(24, Math.max(0, cornerRadius));
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={className}
      aria-hidden
    >
      <rect
        x="2"
        y="2"
        width="96"
        height="96"
        rx={rx}
        ry={rx}
        fill={fill}
        stroke={stroke}
        strokeWidth={sw}
      />
    </svg>
  );
}
