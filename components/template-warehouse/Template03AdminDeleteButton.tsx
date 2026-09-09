"use client";

import { Loader2, Trash2 } from "lucide-react";

export type Template03AdminDeleteButtonProps = {
  templateId: string;
  templateTitle: string;
  deleting?: boolean;
  onDelete: (templateId: string) => void;
};

/** Template 03 — admin-only instant delete (no confirm). */
export default function Template03AdminDeleteButton({
  templateId,
  templateTitle,
  deleting = false,
  onDelete,
}: Template03AdminDeleteButtonProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onDelete(templateId);
      }}
      disabled={deleting}
      className="absolute inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/20 bg-black/60 text-white shadow-md backdrop-blur-sm transition hover:scale-105 hover:border-rose-400/70 hover:bg-rose-500 hover:text-white disabled:opacity-50"
      style={{ top: 8, right: 8, zIndex: 10 }}
      aria-label={`${templateTitle} 삭제`}
      title="템플릿 삭제"
    >
      {deleting ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : (
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
      )}
    </button>
  );
}
