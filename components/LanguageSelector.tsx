"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Globe, Check, ChevronDown } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { LOCALE_INFO, type Locale } from "@/lib/i18n";

export default function LanguageSelector() {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuStyle, setMenuStyle] = useState({ top: 0, left: 0, width: 208 });
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const current = LOCALE_INFO.find((l) => l.code === locale)!;

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateMenuPosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const menuWidth = 208;
    const left = Math.min(
      Math.max(8, rect.right - menuWidth),
      window.innerWidth - menuWidth - 8
    );

    setMenuStyle({
      top: rect.bottom + 8,
      left,
      width: menuWidth,
    });
  }, []);

  const toggleMenu = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();

      if (open) {
        setOpen(false);
        return;
      }

      updateMenuPosition();
      setOpen(true);
    },
    [open, updateMenuPosition]
  );

  const handleSelect = useCallback(
    (code: Locale) => {
      setLocale(code);
      setOpen(false);
    },
    [setLocale]
  );

  // Close on outside click — only while open, use 'click' to avoid mousedown race
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current?.contains(target) ||
        buttonRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    const handleScroll = () => updateMenuPosition();

    // Defer listener so the opening click doesn't immediately close
    const timer = window.setTimeout(() => {
      document.addEventListener("click", handleClickOutside, true);
    }, 0);

    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("click", handleClickOutside, true);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open, updateMenuPosition]);

  const dropdown =
    open && mounted
      ? createPortal(
          <div
            ref={containerRef}
            role="listbox"
            aria-label="Select language"
            className="fixed z-[9999] overflow-hidden rounded-xl border border-white/15 bg-navy-light shadow-glass backdrop-blur-2xl"
            style={{
              top: menuStyle.top,
              left: menuStyle.left,
              width: menuStyle.width,
            }}
          >
            <div className="max-h-72 overflow-y-auto py-1">
              {LOCALE_INFO.map((info) => (
                <button
                  key={info.code}
                  type="button"
                  role="option"
                  aria-selected={locale === info.code}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(info.code);
                  }}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-white/10 ${
                    locale === info.code
                      ? "bg-glow-purple/15 text-white"
                      : "text-white/70"
                  }`}
                >
                  <span className="text-base leading-none">{info.flag}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{info.nativeName}</div>
                    <div className="truncate text-[10px] text-white/40">{info.label}</div>
                  </div>
                  {locale === info.code && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-glow-emerald" />
                  )}
                </button>
              ))}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div className="relative shrink-0">
        <button
          ref={buttonRef}
          type="button"
          onClick={toggleMenu}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 text-sm text-white/70 backdrop-blur-sm transition-all duration-300 hover:border-white/20 hover:bg-white/10 hover:text-white sm:gap-2 sm:px-3"
          aria-label="Select language"
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          <Globe className="h-4 w-4 shrink-0 text-glow-purple" />
          <span className="hidden text-xs font-medium sm:inline">{current.nativeName}</span>
          <span className="text-xs font-medium sm:hidden">{current.code.toUpperCase()}</span>
          <ChevronDown
            className={`h-3 w-3 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </button>
      </div>
      {dropdown}
    </>
  );
}
