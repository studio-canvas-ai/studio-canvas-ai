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

const MENU_Z = 1200;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function useFixedBelowMenu(
  open: boolean,
  triggerRef: React.RefObject<HTMLElement | null>,
  minWidth: number,
  maxWidth = 420,
  anchorSelector?: string
) {
  const [style, setStyle] = useState<CSSProperties>({});

  const update = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const anchor = anchorSelector
      ? (el.closest(anchorSelector) as HTMLElement | null)
      : null;
    const r = (anchor ?? el).getBoundingClientRect();
  const pad = 8;
    const maxW = Math.min(maxWidth, Math.max(180, window.innerWidth - pad * 2));
    const preferAnchor = Boolean(anchor);
    const width = preferAnchor
      ? clamp(r.width, 180, maxW)
      : clamp(Math.max(r.width, minWidth), 180, maxW);
    let left = r.left;
    if (left + width > window.innerWidth - pad) {
      left = window.innerWidth - width - pad;
    }
    left = Math.max(pad, left);
    const triggerBottom = el.getBoundingClientRect().bottom;
    const top = triggerBottom + 8;
    const maxHeight = Math.max(140, window.innerHeight - top - 12);
    setStyle({
      position: "fixed",
      top,
      left,
      width,
      maxHeight,
      zIndex: MENU_Z,
    });
  }, [anchorSelector, maxWidth, minWidth, triggerRef]);

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
  /** CSS selector — size the menu to this ancestor (e.g. the spec row). */
  menuAnchorSelector?: string;
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
  menuAnchorSelector,
  children,
  className = "",
  fullWidth = false,
  compact = false,
}: ControlBarDropdownProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  const menuStyle = useFixedBelowMenu(
    open,
    triggerRef,
    menuMinWidth,
    menuMaxWidth,
    menuAnchorSelector
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

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
            ? "border border-sky-400 bg-sky-50 text-slate-900 shadow-sm ring-1 ring-sky-400/30"
            : "border border-slate-200 bg-white text-slate-800 shadow-sm hover:border-slate-300 hover:bg-slate-50"
        }`}
      >
        {!compact && icon ? (
          <span className="shrink-0 text-[15px] leading-none" aria-hidden>
            {icon}
          </span>
        ) : null}
        {compact ? (
          <span className="whitespace-nowrap text-slate-800">{label}</span>
        ) : (
          <span className="min-w-0 flex-1 truncate">
            <span className="text-slate-500">{label}</span>
            {value ? (
              <>
                <span className="mx-1 text-slate-300">·</span>
                <span className="font-semibold text-slate-900">{value}</span>
              </>
            ) : null}
          </span>
        )}
        <ChevronDown
          className={`shrink-0 text-slate-400 transition ${
            compact ? "h-3 w-3" : "h-3.5 w-3.5"
          } ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && isMounted
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg ring-1 ring-slate-900/5"
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
  hint,
  description,
  oneLine,
  onClick,
}: {
  active?: boolean;
  title: string;
  hint?: string;
  description?: string;
  /** Keep title + hint on a single packed row. */
  oneLine?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onClick={onClick}
      className={`w-full rounded-lg px-2 py-2 text-left transition ${
        active
          ? "bg-indigo-50 text-slate-900 ring-1 ring-indigo-300"
          : "text-slate-800 hover:bg-slate-50"
      }`}
    >
      {oneLine ? (
        <span className="inline-flex max-w-full min-w-0 items-baseline gap-1.5 overflow-hidden whitespace-nowrap">
          <span className="shrink-0 text-[17px] font-bold leading-none tracking-tight text-slate-900">
            {title}
          </span>
          {hint ? (
            <span className="min-w-0 truncate text-[14px] font-medium leading-none text-blue-700">
              ({hint})
            </span>
          ) : null}
        </span>
      ) : (
        <span className="block text-[12px] font-semibold leading-snug text-slate-900 [word-break:keep-all]">
          {title}
        </span>
      )}
      {description ? (
        <span
          className={`mt-0.5 line-clamp-2 block text-[11px] leading-snug ${
            active ? "text-slate-600" : "text-slate-500"
          }`}
        >
          {description}
        </span>
      ) : null}
    </button>
  );
}
