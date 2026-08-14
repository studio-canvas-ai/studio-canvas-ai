"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

const MENU_Z = 260;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function useFixedBelowMenu(
  open: boolean,
  triggerRef: React.RefObject<HTMLElement | null>,
  minWidth: number,
  maxWidth = 420
) {
  const [style, setStyle] = useState<CSSProperties>({});

  const update = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const maxW = Math.min(maxWidth, Math.max(180, window.innerWidth - 16));
    const width = clamp(Math.max(r.width, minWidth), 180, maxW);
    let left = r.left;
    if (left + width > window.innerWidth - 8) {
      left = window.innerWidth - width - 8;
    }
    left = Math.max(8, left);
    const top = r.bottom + 8;
    const maxHeight = Math.max(140, window.innerHeight - top - 12);
    setStyle({
      position: "fixed",
      top,
      left,
      width,
      maxHeight,
      zIndex: MENU_Z,
    });
  }, [maxWidth, minWidth, triggerRef]);

  useLayoutEffect(() => {
    if (!open) return;
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, update]);

  return style;
}

type ControlBarDropdownProps = {
  icon?: ReactNode;
  label: string;
  value?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menuMinWidth?: number;
  menuMaxWidth?: number;
  children: ReactNode;
  className?: string;
  /** Stretch trigger to full column width (center panel). */
  fullWidth?: boolean;
  /** Two-char chip: label only, equal flex share in a row. */
  compact?: boolean;
};

/**
 * Dark-studio trigger + fixed portal panel for stowed options.
 */
export default function ControlBarDropdown({
  icon,
  label,
  value,
  open,
  onOpenChange,
  menuMinWidth = 240,
  menuMaxWidth = 420,
  children,
  className = "",
  fullWidth = false,
  compact = false,
}: ControlBarDropdownProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuStyle = useFixedBelowMenu(
    open,
    triggerRef,
    menuMinWidth,
    menuMaxWidth
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (triggerRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open, onOpenChange]);

  return (
    <div
      className={`relative min-w-0 ${
        compact ? "flex-1" : fullWidth ? "w-full" : ""
      } ${className}`}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={value ? `${label} ${value}` : label}
        onClick={() => onOpenChange(!open)}
        className={`inline-flex items-center text-left font-semibold transition ${
          compact
            ? "h-9 w-full justify-center gap-0.5 rounded-lg px-1.5 text-[13px]"
            : `h-11 gap-2 rounded-xl px-3 text-[13px] font-medium ${
                fullWidth ? "w-full" : "max-w-full"
              }`
        } ${
          open
            ? "border border-slate-600 bg-slate-800/80 text-slate-100 shadow-[0_0_0_1px_rgba(148,163,184,0.12)]"
            : "border border-slate-800 bg-[#0E1420] text-slate-200 hover:border-slate-700 hover:bg-slate-800/40"
        }`}
      >
        {!compact && icon ? (
          <span className="shrink-0 text-[15px] leading-none" aria-hidden>
            {icon}
          </span>
        ) : null}
        {compact ? (
          <span className="whitespace-nowrap text-slate-100">{label}</span>
        ) : (
          <span className="min-w-0 flex-1 truncate">
            <span className="text-slate-400">{label}</span>
            {value ? (
              <>
                <span className="mx-1 text-slate-600">·</span>
                <span className="font-semibold text-slate-100">{value}</span>
              </>
            ) : null}
          </span>
        )}
        <ChevronDown
          className={`shrink-0 text-slate-500 transition ${
            compact ? "h-3 w-3" : "h-3.5 w-3.5"
          } ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              className="overflow-hidden rounded-2xl border border-slate-700/80 bg-[#121824] shadow-[0_16px_48px_rgba(0,0,0,0.55)] ring-1 ring-black/40"
              style={menuStyle}
            >
              <div className="max-h-[inherit] overflow-y-auto overscroll-contain p-1.5">
                {children}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

export function ControlMenuItem({
  active,
  title,
  description,
  onClick,
}: {
  active?: boolean;
  title: string;
  description?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onClick={onClick}
      className={`w-full rounded-xl px-3 py-2.5 text-left transition ${
        active
          ? "bg-indigo-500/20 text-slate-50 ring-1 ring-indigo-400/35"
          : "text-slate-200 hover:bg-slate-800/80"
      }`}
    >
      <span className="block text-[13px] font-semibold [word-break:keep-all]">
        {title}
      </span>
      {description ? (
        <span
          className={`mt-0.5 line-clamp-2 block text-[11px] leading-snug ${
            active ? "text-slate-300" : "text-slate-500"
          }`}
        >
          {description}
        </span>
      ) : null}
    </button>
  );
}
