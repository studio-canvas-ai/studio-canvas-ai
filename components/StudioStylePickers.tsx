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
import {
  EMOJI_MORE_CATALOG,
  STICKER_BADGE_IDS,
  STICKER_BADGES,
  TEXT_BOX_BG_COLORS,
  type StickerBadgeId,
} from "@/lib/thumbnailStyles";

const MENU_Z = 9999;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function useFixedBelowMenu(
  open: boolean,
  triggerRef: React.RefObject<HTMLElement | null>,
  minWidth: number
) {
  const [style, setStyle] = useState<CSSProperties>({});

  const update = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const maxW = Math.max(160, window.innerWidth - 16);
    const width = clamp(Math.max(r.width, minWidth), 160, maxW);
    const left = clamp(r.left, 8, window.innerWidth - width - 8);
    const top = r.bottom + 6;
    const maxHeight = Math.max(120, window.innerHeight - top - 12);
    setStyle({
      position: "fixed",
      top,
      left,
      width,
      maxHeight,
      zIndex: MENU_Z,
    });
  }, [minWidth, triggerRef]);

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

export type StudioPickerTone = "dark" | "light";

export function PortalMenu({
  open,
  onClose,
  triggerRef,
  style,
  className,
  children,
  tone = "dark",
}: {
  open: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  style: CSSProperties;
  className?: string;
  children: ReactNode;
  tone?: StudioPickerTone;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  const isLight = tone === "light";

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (triggerRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open, onClose, triggerRef]);

  if (!open || !isMounted) return null;

  return createPortal(
    <div
      ref={menuRef}
      role="listbox"
      className={`rounded-xl ${
        isLight
          ? "border border-slate-200 bg-white shadow-lg"
          : "border border-white/15 bg-[#12151e] shadow-2xl shadow-black/60 ring-1 ring-black/40"
      } ${className ?? ""}`}
      style={style}
    >
      {children}
    </div>,
    document.body
  );
}

export function EmojiMoreDropdown({
  label,
  onPick,
  tone = "dark",
}: {
  label: string;
  onPick: (symbol: string) => void;
  tone?: StudioPickerTone;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const menuStyle = useFixedBelowMenu(open, triggerRef, 272);
  const isLight = tone === "light";

  return (
    <div className="relative inline-flex shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-9 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold transition ${
          isLight
            ? "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
            : "border-white/10 bg-black/40 text-white/85 hover:border-white/25 hover:bg-white/5"
        }`}
      >
        {label}
        <ChevronDown
          className={`h-3.5 w-3.5 transition ${
            open ? "rotate-180" : ""
          } ${isLight ? "text-slate-500" : "text-white/80"}`}
          aria-hidden
        />
      </button>
      <PortalMenu
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
        style={menuStyle}
        tone={tone}
        className="overflow-y-auto overscroll-contain p-2"
      >
        <div className="grid grid-cols-8 gap-0.5">
          {EMOJI_MORE_CATALOG.map((item, i) => (
            <button
              key={`${item.char}-${i}`}
              type="button"
              role="option"
              aria-label={item.char}
              title={item.char}
              className={`font-emoji flex aspect-square items-center justify-center rounded-md text-base transition ${
                isLight
                  ? "text-slate-800 hover:bg-slate-100"
                  : "text-white/90 hover:bg-white/10"
              }`}
              onClick={() => {
                onPick(item.char);
                setOpen(false);
              }}
            >
              {item.char}
            </button>
          ))}
        </div>
      </PortalMenu>
    </div>
  );
}

export function StickerMoreDropdown({
  label,
  selectedId,
  onPick,
  tone = "dark",
}: {
  label: string;
  selectedId?: StickerBadgeId | null;
  onPick: (id: StickerBadgeId) => void;
  tone?: StudioPickerTone;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const menuStyle = useFixedBelowMenu(open, triggerRef, 288);
  const selected = selectedId ? STICKER_BADGES[selectedId] : null;
  const isLight = tone === "light";

  return (
    <div className="relative z-10 w-full min-w-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-9 w-full items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition ${
          isLight
            ? "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
            : "border-white/10 bg-black/40 text-white/85 hover:border-white/25 hover:bg-white/5"
        }`}
      >
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        {selected ? (
          <span
            className="font-emoji max-w-[5.5rem] shrink-0 truncate rounded-full px-1.5 py-0.5 text-[9px] font-extrabold"
            style={{
              backgroundColor: selected.fill,
              color: selected.textColor,
              border: `1px solid ${selected.stroke}`,
            }}
          >
            {selected.label}
          </span>
        ) : null}
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition ${
            open ? "rotate-180" : ""
          } ${isLight ? "text-slate-500" : "text-white/80"}`}
          aria-hidden
        />
      </button>
      <PortalMenu
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
        style={menuStyle}
        tone={tone}
        className="overflow-y-auto overscroll-contain p-2"
      >
        <div className="flex flex-wrap gap-1.5">
          {STICKER_BADGE_IDS.map((id) => {
            const badge = STICKER_BADGES[id];
            const isOn = selectedId === id;
            return (
              <button
                key={id}
                type="button"
                role="option"
                aria-selected={isOn}
                onClick={() => {
                  onPick(id);
                  setOpen(false);
                }}
                className={`font-emoji rounded-full border px-3 py-1.5 text-[11px] font-extrabold tracking-wide ${
                  isOn ? "ring-2 ring-white/70" : ""
                }`}
                style={{
                  borderColor: badge.stroke,
                  backgroundColor: badge.fill,
                  color: badge.textColor,
                  boxShadow: isOn
                    ? `0 0 14px ${badge.glow}`
                    : "0 0 10px rgba(0,0,0,0.25)",
                }}
              >
                {badge.emoji ? (
                  <span className="font-emoji mr-1" aria-hidden>
                    {badge.emoji}
                  </span>
                ) : null}
                {badge.label}
              </button>
            );
          })}
        </div>
      </PortalMenu>
    </div>
  );
}

export function BgColorDropdown({
  label,
  value,
  onChange,
  tone = "dark",
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  tone?: StudioPickerTone;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const menuStyle = useFixedBelowMenu(open, triggerRef, 320);
  const current = value || "#000000";
  const needsOutline =
    current.toLowerCase() === "#ffffff" || current.toLowerCase() === "#000000";
  const isLight = tone === "light";

  return (
    <div className="relative w-full min-w-0">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-9 w-full items-center gap-2 rounded-lg border px-2.5 text-left text-[11px] font-medium outline-none transition ${
          isLight
            ? "border-slate-200 bg-white text-slate-800 hover:bg-slate-50 focus:border-indigo-400/50"
            : "border-white/10 bg-black/40 text-white/85 hover:border-white/25 focus:border-purple-400/40"
        }`}
      >
        <span
          className={`h-5 w-5 shrink-0 rounded-md ring-1 ${
            isLight ? "ring-slate-200" : "ring-white/20"
          }`}
          style={{
            backgroundColor: current,
            border: needsOutline ? "1px solid #555555" : undefined,
          }}
        />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition ${
            open ? "rotate-180" : ""
          } ${isLight ? "text-slate-500" : "text-white/80"}`}
          aria-hidden
        />
      </button>
      <PortalMenu
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
        style={menuStyle}
        tone={tone}
        className="overflow-x-auto overflow-y-hidden overscroll-contain p-2"
      >
        <div className="flex w-max flex-nowrap items-center gap-1.5">
          {TEXT_BOX_BG_COLORS.map((c) => {
            const selected = current.toLowerCase() === c.hex.toLowerCase();
            const outline =
              c.hex.toLowerCase() === "#ffffff" ||
              c.hex.toLowerCase() === "#000000";
            return (
              <button
                key={c.hex}
                type="button"
                role="option"
                aria-label={c.hex}
                title={c.hex}
                onClick={() => {
                  onChange(c.hex);
                  setOpen(false);
                }}
                className={`h-7 w-7 shrink-0 rounded-md ring-1 transition ${
                  selected
                    ? isLight
                      ? "scale-110 ring-2 ring-slate-800"
                      : "scale-110 ring-2 ring-white"
                    : isLight
                      ? "ring-slate-200 hover:ring-slate-400"
                      : "ring-white/20 hover:ring-white/50"
                }`}
                style={{
                  backgroundColor: c.hex,
                  border: outline ? "1px solid #555555" : undefined,
                }}
              />
            );
          })}
        </div>
      </PortalMenu>
    </div>
  );
}
