"use client";

import type { DecoCategoryId } from "@/lib/printWizardDecoCatalog";

type DecoShapeSvgProps = {
  category: DecoCategoryId;
  variant: number;
  className?: string;
};

const STROKE = "currentColor";
const FILL = "currentColor";
const LINE_STROKE = {
  stroke: STROKE,
  vectorEffect: "nonScalingStroke" as const,
};

function DividerShape({ variant }: { variant: number }) {
  switch (variant) {
    case 0:
      return <line x1="4" y1="50" x2="96" y2="50" {...LINE_STROKE} strokeWidth="3" />;
    case 1:
      return (
        <line
          x1="4"
          y1="50"
          x2="96"
          y2="50"
          {...LINE_STROKE}
          strokeWidth="2.5"
          strokeDasharray="6 5"
        />
      );
    case 2:
      return (
        <line
          x1="4"
          y1="50"
          x2="96"
          y2="50"
          {...LINE_STROKE}
          strokeWidth="2.5"
          strokeDasharray="2 6"
        />
      );
    case 3:
      return (
        <>
          <line x1="4" y1="46" x2="96" y2="46" {...LINE_STROKE} strokeWidth="1.8" />
          <line x1="4" y1="54" x2="96" y2="54" {...LINE_STROKE} strokeWidth="1.8" />
        </>
      );
    case 4:
      return (
        <>
          <defs>
            <linearGradient id="deco-fade" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
              <stop offset="50%" stopColor="currentColor" stopOpacity="1" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect x="4" y="46" width="92" height="8" fill="url(#deco-fade)" />
        </>
      );
    case 5:
      return (
        <>
          <line x1="4" y1="50" x2="82" y2="50" {...LINE_STROKE} strokeWidth="2.5" />
          <polygon points="82,50 96,50 88,42 88,58" fill={FILL} />
        </>
      );
    case 6:
      return (
        <>
          <line x1="18" y1="50" x2="96" y2="50" {...LINE_STROKE} strokeWidth="2.5" />
          <polygon points="18,50 4,50 12,42 12,58" fill={FILL} />
        </>
      );
    case 7:
      return (
        <>
          <line x1="18" y1="50" x2="82" y2="50" {...LINE_STROKE} strokeWidth="2.5" />
          <polygon points="18,50 4,50 12,42 12,58" fill={FILL} />
          <polygon points="82,50 96,50 88,42 88,58" fill={FILL} />
        </>
      );
    case 8:
      return (
        <path
          d="M8 50 L20 38 L32 50 L44 38 L56 50 L68 38 L80 50 L92 38"
          fill="none"
          {...LINE_STROKE}
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
      );
    case 9:
      return (
        <path
          d="M4 50 Q16 30 28 50 T52 50 T76 50 T96 50"
          fill="none"
          {...LINE_STROKE}
          strokeWidth="2.5"
        />
      );
    case 10:
      return (
        <path
          d="M4 50 L14 38 L24 50 L34 38 L44 50 L54 38 L64 50 L74 38 L84 50 L96 38"
          fill="none"
          {...LINE_STROKE}
          strokeWidth="2"
          strokeLinejoin="miter"
        />
      );
    case 11:
      return (
        <path
          d="M8 50 L16 42 L24 50 L32 42 L40 50 L48 42 L56 50 L64 42 L72 50 L80 42 L88 50 L96 42"
          fill="none"
          {...LINE_STROKE}
          strokeWidth="2"
        />
      );
    case 12:
      return (
        <>
          {[12, 28, 44, 60, 76, 92].map((cx) => (
            <circle key={cx} cx={cx} cy="50" r="3.5" fill={FILL} />
          ))}
        </>
      );
    case 13:
      return (
        <path
          d="M4 50 C12 34 20 66 28 50 S44 34 52 50 S68 66 76 50 S88 34 96 50"
          fill="none"
          {...LINE_STROKE}
          strokeWidth="2"
        />
      );
    case 14:
      return (
        <>
          <path d="M8 38 V62 M8 50 H18" {...LINE_STROKE} strokeWidth="2.5" fill="none" />
          <line x1="22" y1="50" x2="78" y2="50" {...LINE_STROKE} strokeWidth="2.5" />
          <path d="M82 38 V62 M82 50 H92" {...LINE_STROKE} strokeWidth="2.5" fill="none" />
        </>
      );
    case 15:
      return <line x1="50" y1="4" x2="50" y2="96" {...LINE_STROKE} strokeWidth="2" />;
    case 16:
      return <line x1="50" y1="4" x2="50" y2="96" {...LINE_STROKE} strokeWidth="3.5" />;
    case 17:
      return <line x1="50" y1="4" x2="50" y2="96" {...LINE_STROKE} strokeWidth="6" />;
    case 18:
      return (
        <line
          x1="50"
          y1="4"
          x2="50"
          y2="96"
          {...LINE_STROKE}
          strokeWidth="3"
          strokeDasharray="5 5"
        />
      );
    case 19:
      return (
        <line
          x1="50"
          y1="4"
          x2="50"
          y2="96"
          {...LINE_STROKE}
          strokeWidth="3"
          strokeDasharray="2 7"
        />
      );
    case 20:
      return (
        <>
          <line x1="44" y1="4" x2="44" y2="96" {...LINE_STROKE} strokeWidth="2" />
          <line x1="56" y1="4" x2="56" y2="96" {...LINE_STROKE} strokeWidth="2" />
        </>
      );
    default:
      return <line x1="50" y1="4" x2="50" y2="96" {...LINE_STROKE} strokeWidth="3" />;
  }
}

function FrameShape({ variant }: { variant: number }) {
  switch (variant) {
    case 0:
      return (
        <rect
          x="8"
          y="10"
          width="84"
          height="80"
          fill="none"
          stroke={STROKE}
          strokeWidth="2.5"
        />
      );
    case 1:
      return (
        <rect
          x="8"
          y="10"
          width="84"
          height="80"
          rx="10"
          fill="none"
          stroke={STROKE}
          strokeWidth="2.5"
        />
      );
    case 2:
      return (
        <>
          <rect x="8" y="10" width="84" height="80" fill="none" stroke={STROKE} strokeWidth="2" />
          <rect x="14" y="16" width="72" height="68" fill="none" stroke={STROKE} strokeWidth="1.5" />
        </>
      );
    case 3:
      return (
        <rect
          x="8"
          y="10"
          width="84"
          height="80"
          fill="none"
          stroke={STROKE}
          strokeWidth="2"
          strokeDasharray="7 5"
        />
      );
    case 4:
      return (
        <>
          <path d="M8 26 V10 H24" stroke={STROKE} strokeWidth="2.5" fill="none" />
          <path d="M76 10 H92 V26" stroke={STROKE} strokeWidth="2.5" fill="none" />
          <path d="M92 74 V90 H76" stroke={STROKE} strokeWidth="2.5" fill="none" />
          <path d="M24 90 H8 V74" stroke={STROKE} strokeWidth="2.5" fill="none" />
        </>
      );
    case 5:
      return (
        <>
          <rect x="12" y="14" width="76" height="72" fill="none" stroke={STROKE} strokeWidth="1.5" />
          <path d="M12 14 L22 24 M88 14 L78 24 M88 86 L78 76 M12 86 L22 76" stroke={STROKE} strokeWidth="2" />
        </>
      );
    case 6:
      return (
        <>
          <rect x="14" y="10" width="72" height="80" fill="none" stroke={STROKE} strokeWidth="2" />
          <rect x="10" y="74" width="80" height="16" fill={FILL} opacity="0.15" stroke={STROKE} strokeWidth="1.5" />
        </>
      );
    case 7:
      return (
        <path
          d="M10 22 H90 V86 H10 V22 Z M10 22 Q10 10 22 10 H78 Q90 10 90 22"
          fill="none"
          stroke={STROKE}
          strokeWidth="2"
        />
      );
    case 8:
      return (
        <path
          d="M18 18 H72 Q82 18 82 28 V58 Q82 68 72 68 H38 L24 82 L28 68 H18 Q8 68 8 58 V28 Q8 18 18 18 Z"
          fill="none"
          stroke={STROKE}
          strokeWidth="2"
          strokeLinejoin="round"
        />
      );
    case 9:
      return (
        <path
          d="M12 58 Q12 38 24 32 Q36 18 50 22 Q64 18 76 32 Q88 38 88 58 Q88 78 68 82 H32 Q12 78 12 58 Z"
          fill="none"
          stroke={STROKE}
          strokeWidth="2"
        />
      );
    case 10:
      return (
        <polygon
          points="50,12 86,30 86,70 50,88 14,70 14,30"
          fill="none"
          stroke={STROKE}
          strokeWidth="2.5"
        />
      );
    case 11:
      return <circle cx="50" cy="50" r="38" fill="none" stroke={STROKE} strokeWidth="2.5" />;
    case 12:
      return (
        <ellipse cx="50" cy="50" rx="42" ry="34" fill="none" stroke={STROKE} strokeWidth="2.5" />
      );
    case 13:
      return (
        <>
          <rect x="10" y="12" width="80" height="76" fill="none" stroke={STROKE} strokeWidth="1.5" strokeDasharray="3 3" />
          {[20, 40, 60, 80].map((y) => (
            <circle key={y} cx="16" cy={y} r="2" fill={FILL} />
          ))}
        </>
      );
    default:
      return (
        <>
          <rect x="8" y="18" width="84" height="64" fill="none" stroke={STROKE} strokeWidth="2" />
          {[18, 34, 50, 66, 82].map((x) => (
            <rect key={x} x={x - 4} y="12" width="8" height="8" fill={FILL} opacity="0.35" />
          ))}
        </>
      );
  }
}

function BadgeShape({ variant }: { variant: number }) {
  switch (variant) {
    case 0:
      return <rect x="10" y="68" width="80" height="8" rx="2" fill={FILL} />;
    case 1:
      return (
        <path
          d="M10 38 H90 L82 58 H18 Z M18 58 V72 H82 V58"
          fill={FILL}
          opacity="0.85"
          stroke={STROKE}
          strokeWidth="1.5"
        />
      );
    case 2:
      return <rect x="12" y="38" width="76" height="24" rx="12" fill={FILL} opacity="0.9" />;
    case 3:
      return (
        <polygon
          points="50,10 58,36 86,36 64,52 72,78 50,62 28,78 36,52 14,36 42,36"
          fill={FILL}
          opacity="0.85"
        />
      );
    case 4:
      return (
        <>
          <circle cx="50" cy="50" r="32" fill="none" stroke={STROKE} strokeWidth="2.5" />
          <circle cx="50" cy="50" r="24" fill="none" stroke={STROKE} strokeWidth="1.5" />
        </>
      );
    case 5:
      return (
        <path
          d="M18 30 H72 L82 50 L72 70 H18 V30 Z M72 30 L82 38 V62 L72 70"
          fill={FILL}
          opacity="0.8"
          stroke={STROKE}
          strokeWidth="1.5"
        />
      );
    case 6:
      return (
        <path d="M72 12 H92 V42 L82 52 L72 42 Z" fill={FILL} opacity="0.9" stroke={STROKE} strokeWidth="1.5" />
      );
    case 7:
      return (
        <path
          d="M8 52 Q20 32 36 52 T68 52 T92 52 V72 H8 Z"
          fill={FILL}
          opacity="0.85"
          stroke={STROKE}
          strokeWidth="1.5"
        />
      );
    case 8:
      return (
        <path
          d="M50 12 L78 28 V58 Q78 78 50 88 Q22 78 22 58 V28 Z"
          fill={FILL}
          opacity="0.75"
          stroke={STROKE}
          strokeWidth="2"
        />
      );
    case 9:
      return (
        <path d="M10 50 H70 L90 50 L78 38 V62 Z" fill={FILL} opacity="0.85" stroke={STROKE} strokeWidth="1.5" />
      );
    case 10:
      return (
        <>
          <path d="M12 42 H88 L78 58 H22 Z" fill={FILL} opacity="0.8" />
          <path d="M18 58 H82 L72 72 H28 Z" fill={FILL} opacity="0.55" />
        </>
      );
    case 11:
      return (
        <>
          <path d="M20 28 V72" stroke={STROKE} strokeWidth="3" />
          <path d="M80 28 V72" stroke={STROKE} strokeWidth="3" />
          <line x1="20" y1="50" x2="80" y2="50" stroke={STROKE} strokeWidth="2" />
        </>
      );
    case 12:
      return <rect x="14" y="40" width="72" height="20" rx="3" fill={FILL} opacity="0.35" stroke={STROKE} strokeWidth="1.5" />;
    case 13:
      return (
        <>
          <circle cx="50" cy="46" r="28" fill={FILL} opacity="0.2" stroke={STROKE} strokeWidth="2" />
          <path d="M50 74 L44 88 H56 Z" fill={FILL} opacity="0.85" />
        </>
      );
    default:
      return (
        <path d="M62 18 H88 V72 H62 Q50 62 50 50 Q50 38 62 28 Z" fill={FILL} opacity="0.85" stroke={STROKE} strokeWidth="1.5" />
      );
  }
}

function TraditionalShape({ variant }: { variant: number }) {
  switch (variant) {
    case 0:
      return (
        <>
          {[20, 40, 60, 80].map((x) => (
            <line key={`v${x}`} x1={x} y1="12" x2={x} y2="88" stroke={STROKE} strokeWidth="1.2" opacity="0.7" />
          ))}
          {[20, 40, 60, 80].map((y) => (
            <line key={`h${y}`} x1="12" y1={y} x2="88" y2={y} stroke={STROKE} strokeWidth="1.2" opacity="0.7" />
          ))}
        </>
      );
    case 1:
      return (
        <>
          <circle cx="50" cy="50" r="36" fill="#2563EB" opacity="0.85" />
          <path d="M50 14 A36 36 0 0 1 50 86 A18 18 0 0 1 50 50 A18 18 0 0 0 50 14" fill="#DC2626" opacity="0.9" />
          <circle cx="50" cy="32" r="5" fill="#111" opacity="0.5" />
          <circle cx="50" cy="68" r="5" fill="#111" opacity="0.5" />
        </>
      );
    case 2:
      return (
        <>
          <circle cx="50" cy="32" r="6" fill={FILL} />
          {[0, 72, 144, 216, 288].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            const x2 = 50 + Math.cos(rad) * 28;
            const y2 = 32 + Math.sin(rad) * 18;
            return (
              <ellipse
                key={deg}
                cx={(50 + x2) / 2}
                cy={(32 + y2) / 2}
                rx="8"
                ry="5"
                fill="none"
                stroke={STROKE}
                strokeWidth="1.5"
                transform={`rotate(${deg} ${(50 + x2) / 2} ${(32 + y2) / 2})`}
              />
            );
          })}
          <path d="M50 38 Q46 70 50 88" stroke={STROKE} strokeWidth="2.5" fill="none" />
        </>
      );
    case 3:
      return (
        <path
          d="M16 62 Q28 48 40 58 Q52 68 64 52 Q76 36 88 48 Q82 72 64 76 Q46 80 28 74 Q12 68 16 62 Z"
          fill="none"
          stroke={STROKE}
          strokeWidth="2"
        />
      );
    case 4:
      return (
        <path
          d="M50 14 C62 28 62 42 50 50 C38 42 38 28 50 14 M50 50 C62 58 62 72 50 86 C38 72 38 58 50 50"
          fill="none"
          stroke={STROKE}
          strokeWidth="2.5"
        />
      );
    case 5:
      return (
        <>
          <rect x="14" y="14" width="72" height="72" fill={FILL} opacity="0.08" stroke={STROKE} strokeWidth="2" />
          {[22, 38, 54, 70].map((y) => (
            <line key={y} x1="18" y1={y} x2="82" y2={y} stroke={STROKE} strokeWidth="0.8" opacity="0.35" />
          ))}
        </>
      );
    case 6:
      return (
        <>
          <rect x="18" y="18" width="64" height="64" fill="none" stroke={STROKE} strokeWidth="2" />
          <line x1="18" y1="34" x2="82" y2="34" stroke={STROKE} strokeWidth="1.5" />
          <line x1="18" y1="50" x2="82" y2="50" stroke={STROKE} strokeWidth="1.5" />
          <line x1="18" y1="66" x2="82" y2="66" stroke={STROKE} strokeWidth="1.5" />
          <line x1="34" y1="18" x2="34" y2="82" stroke={STROKE} strokeWidth="1.5" />
          <line x1="66" y1="18" x2="66" y2="82" stroke={STROKE} strokeWidth="1.5" />
        </>
      );
    case 7:
      return (
        <path
          d="M8 56 Q20 40 32 56 T56 56 T80 56 T96 56"
          fill="none"
          stroke={STROKE}
          strokeWidth="2.5"
        />
      );
    case 8:
      return (
        <circle
          cx="50"
          cy="50"
          r="34"
          fill="none"
          stroke={STROKE}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray="180 240"
        />
      );
    case 9:
      return (
        <>
          <line x1="28" y1="88" x2="28" y2="24" stroke={STROKE} strokeWidth="3" />
          <line x1="44" y1="88" x2="44" y2="32" stroke={STROKE} strokeWidth="2.5" />
          <line x1="60" y1="88" x2="60" y2="28" stroke={STROKE} strokeWidth="3" />
          <path d="M22 30 Q28 18 34 30" fill="none" stroke={STROKE} strokeWidth="1.5" />
          <path d="M54 22 Q60 10 66 22" fill="none" stroke={STROKE} strokeWidth="1.5" />
        </>
      );
    case 10:
      return (
        <>
          <rect x="16" y="16" width="68" height="68" fill="none" stroke={STROKE} strokeWidth="2" />
          <path d="M16 16 L28 28 M84 16 L72 28 M84 84 L72 72 M16 84 L28 72" stroke={STROKE} strokeWidth="1.5" />
        </>
      );
    case 11:
      return (
        <path
          d="M50 12 Q78 30 72 58 Q66 86 50 88 Q34 86 28 58 Q22 30 50 12"
          fill="none"
          stroke={STROKE}
          strokeWidth="2"
        />
      );
    case 12:
      return (
        <path
          d="M50 88 Q22 60 22 42 Q22 18 50 12 Q78 18 78 42 Q78 60 50 88"
          fill="none"
          stroke={STROKE}
          strokeWidth="2.5"
        />
      );
    case 13:
      return (
        <>
          <path d="M50 18 L62 38 H38 Z" fill="none" stroke={STROKE} strokeWidth="2" />
          <path d="M50 82 L38 62 H62 Z" fill="none" stroke={STROKE} strokeWidth="2" />
          <line x1="38" y1="50" x2="62" y2="50" stroke={STROKE} strokeWidth="2" />
          <line x1="50" y1="38" x2="50" y2="62" stroke={STROKE} strokeWidth="2" />
        </>
      );
    default:
      return (
        <>
          <path d="M50 18 L46 28 M54 28 L50 18" stroke={STROKE} strokeWidth="2" />
          <path d="M50 28 Q38 42 34 58" stroke={STROKE} strokeWidth="2" fill="none" />
          <path d="M50 28 Q62 42 66 58" stroke={STROKE} strokeWidth="2" fill="none" />
          <path d="M34 58 Q42 72 50 82 Q58 72 66 58" stroke={STROKE} strokeWidth="2" fill="none" />
        </>
      );
  }
}

function starPoints(cx: number, cy: number, outer: number, inner: number, points: number): string {
  const coords: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / 2) * -1 + (i * Math.PI) / points;
    coords.push(`${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`);
  }
  return coords.join(" ");
}

function GeometryShape({ variant }: { variant: number }) {
  switch (variant) {
    case 0:
      return <circle cx="50" cy="50" r="36" fill={FILL} opacity="0.85" />;
    case 1:
      return <circle cx="50" cy="50" r="36" fill="none" stroke={STROKE} strokeWidth="3" />;
    case 2:
      return <polygon points="50,14 88,78 12,78" fill={FILL} opacity="0.8" stroke={STROKE} strokeWidth="1.5" />;
    case 3:
      return (
        <rect
          x="22"
          y="22"
          width="56"
          height="56"
          transform="rotate(45 50 50)"
          fill={FILL}
          opacity="0.75"
          stroke={STROKE}
          strokeWidth="1.5"
        />
      );
    case 4:
      return (
        <polygon
          points="50,12 88,38 74,88 26,88 12,38"
          fill={FILL}
          opacity="0.75"
          stroke={STROKE}
          strokeWidth="1.5"
        />
      );
    case 5:
      return (
        <polygon
          points="50,12 86,30 86,70 50,88 14,70 14,30"
          fill={FILL}
          opacity="0.75"
          stroke={STROKE}
          strokeWidth="1.5"
        />
      );
    case 6:
      return <polygon points={starPoints(50, 50, 38, 16, 5)} fill={FILL} opacity="0.85" />;
    case 7:
      return <polygon points={starPoints(50, 50, 38, 18, 4)} fill={FILL} opacity="0.85" />;
    case 8:
      return (
        <>
          <line x1="50" y1="16" x2="50" y2="84" stroke={STROKE} strokeWidth="4" />
          <line x1="16" y1="50" x2="84" y2="50" stroke={STROKE} strokeWidth="4" />
        </>
      );
    case 9:
      return (
        <>
          <line x1="20" y1="20" x2="80" y2="80" stroke={STROKE} strokeWidth="4" />
          <line x1="80" y1="20" x2="20" y2="80" stroke={STROKE} strokeWidth="4" />
        </>
      );
    case 10:
      return (
        <path
          d="M50 24 C62 24 72 34 72 46 C72 62 50 84 50 84 C50 84 28 62 28 46 C28 34 38 24 50 24 Z"
          fill={FILL}
          opacity="0.85"
        />
      );
    case 11:
      return <path d="M12 68 A38 38 0 0 1 88 68 Z" fill={FILL} opacity="0.85" stroke={STROKE} strokeWidth="1.5" />;
    case 12:
      return <path d="M12 88 A76 76 0 0 1 12 12 Z" fill={FILL} opacity="0.75" stroke={STROKE} strokeWidth="1.5" />;
    case 13:
      return (
        <>
          <circle cx="50" cy="50" r="36" fill="none" stroke={STROKE} strokeWidth="6" />
          <circle cx="50" cy="50" r="22" fill="none" stroke={STROKE} strokeWidth="6" />
        </>
      );
    default:
      return (
        <polygon points="24,28 78,22 88,72 18,78" fill={FILL} opacity="0.75" stroke={STROKE} strokeWidth="1.5" />
      );
  }
}

function PromoShape({ variant }: { variant: number }) {
  const kind = variant % 10;
  switch (kind) {
    case 0:
      return (
        <>
          <circle cx="50" cy="50" r="36" fill={FILL} opacity="0.2" stroke={STROKE} strokeWidth="2.5" />
          <circle cx="50" cy="50" r="26" fill="none" stroke={STROKE} strokeWidth="1.5" strokeDasharray="4 3" />
        </>
      );
    case 1:
      return <ellipse cx="50" cy="50" rx="40" ry="22" fill={FILL} opacity="0.85" />;
    case 2:
      return (
        <path d="M8 42 H72 L88 50 L72 58 H8 Z" fill={FILL} opacity="0.9" stroke={STROKE} strokeWidth="1.2" />
      );
    case 3:
      return (
        <path d="M62 8 L92 8 L92 38 L78 28 L62 38 Z" fill={FILL} opacity="0.9" stroke={STROKE} strokeWidth="1.2" />
      );
    case 4:
      return <rect x="18" y="28" width="64" height="44" rx="6" fill={FILL} opacity="0.85" stroke={STROKE} strokeWidth="1.5" />;
    case 5:
      return (
        <>
          <circle cx="50" cy="50" r="34" fill={FILL} opacity="0.25" stroke={STROKE} strokeWidth="2" />
          <text x="50" y="56" textAnchor="middle" fontSize="18" fontWeight="700" fill={STROKE}>
            1+1
          </text>
        </>
      );
    case 6:
      return (
        <polygon
          points="50,8 58,32 84,32 64,48 72,74 50,58 28,74 36,48 16,32 42,32"
          fill={FILL}
          opacity="0.85"
          stroke={STROKE}
          strokeWidth="1.2"
        />
      );
    case 7:
      return (
        <>
          <circle cx="50" cy="50" r="34" fill={FILL} opacity="0.2" stroke={STROKE} strokeWidth="2" />
          <circle cx="50" cy="50" r="18" fill="none" stroke={STROKE} strokeWidth="2.5" />
          <line x1="50" y1="50" x2="50" y2="36" stroke={STROKE} strokeWidth="2.5" />
          <line x1="50" y1="50" x2="62" y2="50" stroke={STROKE} strokeWidth="2" />
        </>
      );
    case 8:
      return (
        <path d="M12 30 H70 L88 50 L70 70 H12 Z" fill={FILL} opacity="0.85" stroke={STROKE} strokeWidth="1.5" />
      );
    default:
      return <rect x="10" y="38" width="80" height="24" rx="4" fill={FILL} opacity="0.85" />;
  }
}

function FestivalShape({ variant }: { variant: number }) {
  const kind = variant % 10;
  switch (kind) {
    case 0:
      return (
        <>
          {[0, 45, 90, 135].map((deg) => (
            <line
              key={deg}
              x1="50"
              y1="50"
              x2={50 + Math.cos((deg * Math.PI) / 180) * 38}
              y2={50 + Math.sin((deg * Math.PI) / 180) * 38}
              stroke={STROKE}
              strokeWidth="2"
            />
          ))}
          <circle cx="50" cy="50" r="8" fill={FILL} />
        </>
      );
    case 1:
      return (
        <>
          {[20, 40, 60, 80].map((x) => (
            <circle key={x} cx={x} cy={30 + ((x * 3) % 20)} r="3" fill={FILL} opacity="0.8" />
          ))}
          {[25, 45, 65, 85].map((x) => (
            <circle key={`b${x}`} cx={x} cy={55 + ((x * 5) % 18)} r="2.5" fill={FILL} opacity="0.6" />
          ))}
        </>
      );
    case 2:
      return (
        <>
          <circle cx="50" cy="50" r="34" fill="none" stroke={STROKE} strokeWidth="2.5" />
          <path d="M28 50 Q38 30 50 50 Q62 70 72 50" fill="none" stroke={STROKE} strokeWidth="2" />
        </>
      );
    case 3:
      return (
        <>
          {[16, 34, 52, 70].map((x) => (
            <path key={x} d={`M${x} 28 L${x + 8} 40 L${x} 52 L${x + 8} 64`} fill="none" stroke={STROKE} strokeWidth="2" />
          ))}
        </>
      );
    case 4:
      return (
        <>
          <ellipse cx="50" cy="78" rx="28" ry="8" fill={FILL} opacity="0.25" />
          <path d="M35 78 L50 18 L65 78 Z" fill={FILL} opacity="0.35" stroke={STROKE} strokeWidth="1.5" />
        </>
      );
    case 5:
      return (
        <>
          <rect x="18" y="30" width="64" height="40" rx="4" fill={FILL} opacity="0.15" stroke={STROKE} strokeWidth="2" />
          <path d="M18 30 H10 V70 H18" fill="none" stroke={STROKE} strokeWidth="2" />
          <path d="M82 30 H90 V70 H82" fill="none" stroke={STROKE} strokeWidth="2" />
        </>
      );
    case 6:
      return (
        <>
          {[22, 34, 46, 58, 70].map((y) => (
            <line key={y} x1="20" y1={y} x2="80" y2={y} stroke={STROKE} strokeWidth="1.5" strokeDasharray="2 3" />
          ))}
          <rect x="16" y="16" width="68" height="68" fill="none" stroke={STROKE} strokeWidth="2" rx="4" />
        </>
      );
    case 7:
      return (
        <path d="M12 40 H70 V30 L92 50 L70 70 V60 H12 Z" fill={FILL} opacity="0.85" stroke={STROKE} strokeWidth="1.5" />
      );
    case 8:
      return (
        <>
          <circle cx="50" cy="42" r="22" fill={FILL} opacity="0.25" stroke={STROKE} strokeWidth="2" />
          <rect x="42" y="62" width="16" height="22" fill={FILL} opacity="0.7" />
        </>
      );
    default:
      return (
        <rect x="14" y="20" width="72" height="60" rx="8" fill="none" stroke={STROKE} strokeWidth="2.5" strokeDasharray="6 4" />
      );
  }
}

function InfoShape({ variant }: { variant: number }) {
  const kind = variant % 10;
  switch (kind) {
    case 0:
      return (
        <>
          <circle cx="50" cy="50" r="34" fill={FILL} opacity="0.15" stroke={STROKE} strokeWidth="2.5" />
          <path d="M34 52 L46 64 L68 36" fill="none" stroke={STROKE} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 1:
      return (
        <polygon points="50,12 88,82 12,82" fill={FILL} opacity="0.2" stroke={STROKE} strokeWidth="2.5" />
      );
    case 2:
      return (
        <>
          <circle cx="50" cy="50" r="34" fill={FILL} opacity="0.15" stroke={STROKE} strokeWidth="2.5" />
          <circle cx="50" cy="34" r="4" fill={FILL} />
          <rect x="46" y="44" width="8" height="28" rx="2" fill={FILL} />
        </>
      );
    case 3:
      return (
        <>
          <circle cx="50" cy="50" r="34" fill={FILL} opacity="0.15" stroke={STROKE} strokeWidth="2.5" />
          <circle cx="50" cy="68" r="4" fill={FILL} />
          <path d="M42 34 Q50 22 58 34 Q58 46 50 50" fill="none" stroke={STROKE} strokeWidth="3.5" strokeLinecap="round" />
        </>
      );
    case 4:
    case 5:
    case 6:
    case 7:
    case 8: {
      const n = kind - 3;
      return (
        <>
          <circle cx="50" cy="50" r="34" fill={FILL} opacity="0.2" stroke={STROKE} strokeWidth="2.5" />
          <text x="50" y="58" textAnchor="middle" fontSize="28" fontWeight="800" fill={STROKE}>
            {n}
          </text>
        </>
      );
    }
    default:
      return (
        <>
          <rect x="22" y="58" width="12" height="24" fill={FILL} opacity="0.7" />
          <rect x="44" y="42" width="12" height="40" fill={FILL} opacity="0.7" />
          <rect x="66" y="28" width="12" height="54" fill={FILL} opacity="0.7" />
        </>
      );
  }
}

function ModernShape({ variant }: { variant: number }) {
  const kind = variant % 14;
  switch (kind) {
    case 0:
      return <line x1="4" y1="50" x2="96" y2="50" {...LINE_STROKE} strokeWidth="1.5" />;
    case 1:
      return <line x1="4" y1="50" x2="96" y2="50" {...LINE_STROKE} strokeWidth="3" />;
    case 2:
      return <line x1="4" y1="50" x2="96" y2="50" {...LINE_STROKE} strokeWidth="5" />;
    case 3:
      return <line x1="4" y1="50" x2="96" y2="50" {...LINE_STROKE} strokeWidth="2" strokeDasharray="3 4" />;
    case 4:
      return <line x1="4" y1="50" x2="96" y2="50" {...LINE_STROKE} strokeWidth="2.5" strokeDasharray="1 7" strokeLinecap="round" />;
    case 5:
      return <line x1="4" y1="50" x2="96" y2="50" {...LINE_STROKE} strokeWidth="2.5" strokeDasharray="10 4 2 4" />;
    case 6:
      return (
        <>
          <line x1="4" y1="46" x2="96" y2="46" {...LINE_STROKE} strokeWidth="1.2" />
          <line x1="4" y1="54" x2="96" y2="54" {...LINE_STROKE} strokeWidth="1.2" />
        </>
      );
    case 7:
      return (
        <>
          <line x1="4" y1="44" x2="96" y2="44" {...LINE_STROKE} strokeWidth="1" />
          <line x1="4" y1="50" x2="96" y2="50" {...LINE_STROKE} strokeWidth="2" />
          <line x1="4" y1="56" x2="96" y2="56" {...LINE_STROKE} strokeWidth="1" />
        </>
      );
    case 8:
      return (
        <>
          <line x1="4" y1="50" x2="44" y2="50" {...LINE_STROKE} strokeWidth="2" />
          <circle cx="50" cy="50" r="4" fill={FILL} />
          <line x1="56" y1="50" x2="96" y2="50" {...LINE_STROKE} strokeWidth="2" />
        </>
      );
    case 9:
      return (
        <>
          <line x1="4" y1="50" x2="42" y2="50" {...LINE_STROKE} strokeWidth="2" />
          <polygon points="50,42 58,50 50,58 42,50" fill={FILL} />
          <line x1="58" y1="50" x2="96" y2="50" {...LINE_STROKE} strokeWidth="2" />
        </>
      );
    case 10:
      return (
        <>
          <line x1="50" y1="8" x2="50" y2="92" {...LINE_STROKE} strokeWidth="2" />
          <line x1="8" y1="50" x2="92" y2="50" {...LINE_STROKE} strokeWidth="2" />
        </>
      );
    case 11:
      return (
        <>
          <path d="M20 20 H80 V36" fill="none" stroke={STROKE} strokeWidth="2.5" />
          <path d="M20 80 H80 V64" fill="none" stroke={STROKE} strokeWidth="2.5" />
        </>
      );
    case 12:
      return <line x1="16" y1="70" x2="84" y2="30" {...LINE_STROKE} strokeWidth="2.5" />;
    default:
      return (
        <>
          <circle cx="30" cy="50" r="3.5" fill={FILL} />
          <circle cx="50" cy="50" r="3.5" fill={FILL} />
          <circle cx="70" cy="50" r="3.5" fill={FILL} />
        </>
      );
  }
}

function ShapeBody({ category, variant }: { category: DecoCategoryId; variant: number }) {
  switch (category) {
    case "dividers":
      return <DividerShape variant={variant} />;
    case "frames":
      return <FrameShape variant={variant} />;
    case "badges":
      return <BadgeShape variant={variant} />;
    case "traditional":
      return <TraditionalShape variant={variant} />;
    case "geometry":
      return <GeometryShape variant={variant} />;
    case "promo":
      return <PromoShape variant={variant} />;
    case "festival":
      return <FestivalShape variant={variant} />;
    case "info":
      return <InfoShape variant={variant} />;
    case "modern":
      return <ModernShape variant={variant} />;
    default:
      return null;
  }
}

export default function DecoShapeSvg({ category, variant, className }: DecoShapeSvgProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={className ?? "h-full w-full text-black/85"}
      aria-hidden
    >
      <ShapeBody category={category} variant={variant} />
    </svg>
  );
}

export function DecoCatalogThumb({
  category,
  variant,
}: {
  category: DecoCategoryId;
  variant: number;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      className="h-8 w-8 shrink-0 text-black/80"
      aria-hidden
    >
      <ShapeBody category={category} variant={variant} />
    </svg>
  );
}
