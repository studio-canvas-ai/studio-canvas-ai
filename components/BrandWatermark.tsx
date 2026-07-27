"use client";

export default function BrandWatermark({ visible = true }: { visible?: boolean }) {
  if (!visible) return null;
  return (
    <div
      className="pointer-events-none absolute right-3 bottom-3 z-20 select-none rounded-md bg-black/25 px-2 py-1 text-[10px] font-medium tracking-wide text-white/55 backdrop-blur-[2px] sm:text-xs"
      aria-hidden
    >
      Studio Canvas AI
    </div>
  );
}
