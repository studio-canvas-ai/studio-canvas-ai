"use client";

import type { SMART_INPUT_FIELDS } from "@/lib/printWizardTypes";

type FieldDef = (typeof SMART_INPUT_FIELDS)[number];

type Props = {
  field: FieldDef;
  value: string;
  onChange: (value: string) => void;
};

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-[#0B0F19] px-2.5 py-1.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-slate-500 focus:ring-2 focus:ring-indigo-500/20";

function fieldRows(field: FieldDef): number {
  if (field.kind === "textarea" && "rows" in field && typeof field.rows === "number") {
    return Math.min(field.rows, 3);
  }
  return 3;
}

export default function SmartFormField({ field, value, onChange }: Props) {
  return (
    <label className="flex flex-col gap-1">
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
        <span aria-hidden>{field.emoji}</span>
        {field.label}
      </span>
      {field.kind === "textarea" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={fieldRows(field)}
          className={`${inputClass} min-h-[4rem] resize-none leading-relaxed`}
        />
      ) : (
        <input
          type={field.kind === "date" ? "date" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={inputClass}
        />
      )}
    </label>
  );
}
