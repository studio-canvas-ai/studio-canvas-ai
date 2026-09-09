"use client";

/**
 * Dynamic Lucide SVG renderer — full library via dynamicIconImports (1000+).
 * Falls back through alias chain; never renders smartphone emoji.
 */

import { useEffect, useState, type ComponentType } from "react";
import dynamicIconImports from "lucide-react/dynamicIconImports";
import type { LucideProps } from "lucide-react";
import {
  normalizeLucideIconName,
  isEmojiGlyph,
} from "@/lib/printWizardLucide";

type LucideIconComponent = ComponentType<LucideProps>;

type DynamicImportKey = keyof typeof dynamicIconImports;

const cache = new Map<string, LucideIconComponent | null>();

export async function loadLucideIcon(
  rawName: string
): Promise<LucideIconComponent | null> {
  const key = normalizeLucideIconName(rawName);
  if (!key || isEmojiGlyph(rawName)) return null;
  if (cache.has(key)) return cache.get(key) ?? null;

  const tryKeys = [key];
  // Mild fallbacks only when the exact name is missing — not a fixed palette.
  if (!tryKeys.includes("sparkles")) tryKeys.push("sparkles");

  for (const candidate of tryKeys) {
    const loader = dynamicIconImports[candidate as DynamicImportKey];
    if (!loader) continue;
    try {
      const mod = await loader();
      const Comp = (mod as { default?: LucideIconComponent }).default;
      if (Comp) {
        cache.set(key, Comp);
        return Comp;
      }
    } catch {
      /* try next */
    }
  }
  cache.set(key, null);
  return null;
}

export type LucideVectorIconProps = {
  name: string;
  color?: string;
  className?: string;
  strokeWidth?: number;
};

export default function LucideVectorIcon({
  name,
  color = "currentColor",
  className,
  strokeWidth = 2,
}: LucideVectorIconProps) {
  const [Icon, setIcon] = useState<LucideIconComponent | null>(
    () => cache.get(normalizeLucideIconName(name)) ?? null
  );

  useEffect(() => {
    let cancelled = false;
    const cached = cache.get(normalizeLucideIconName(name));
    if (cached !== undefined) {
      setIcon(cached);
      return;
    }
    void loadLucideIcon(name).then((Comp) => {
      if (!cancelled) setIcon(Comp);
    });
    return () => {
      cancelled = true;
    };
  }, [name]);

  if (!Icon) {
    return (
      <span
        className={`inline-block h-full w-full rounded-sm bg-current/10 ${className || ""}`}
        aria-hidden
      />
    );
  }

  return (
    <Icon
      className={className}
      color={color}
      strokeWidth={strokeWidth}
      absoluteStrokeWidth
      style={{ width: "100%", height: "100%" }}
    />
  );
}

/** Prefetch Lucide component (shared with overlay). */
export async function prefetchLucideIcon(name: string): Promise<boolean> {
  const Comp = await loadLucideIcon(name);
  return Boolean(Comp);
}
