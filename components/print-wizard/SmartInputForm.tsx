"use client";

import { Sparkles } from "lucide-react";
import {
  SMART_INPUT_FIELDS,
  type SmartInputFieldId,
  type SmartInputValues,
} from "@/lib/printWizardTypes";
import SmartFormField from "@/components/print-wizard/fields/SmartFormField";

export type SmartInputFormProps = {
  values: SmartInputValues;
  submitting?: boolean;
  onChange: (id: SmartInputFieldId, value: string) => void;
  onSubmit: () => void;
};

/**
 * Right panel — structured detail fields + generate CTA only.
 * Main prompt lives in SpecSettingsPanel (center).
 */
export default function SmartInputForm({
  values,
  submitting = false,
  onChange,
  onSubmit,
}: SmartInputFormProps) {
  return (
    <section className="flex h-full min-h-0 flex-col gap-2.5 rounded-2xl border border-slate-800 bg-[#121824] p-3 shadow-[0_8px_32px_rgba(0,0,0,0.35)] sm:p-4">
      <header className="shrink-0 px-0.5 pt-0.5">
        <h2 className="text-[15px] font-semibold text-slate-100 sm:text-base">
          상세 콘텐츠 데이터
        </h2>
      </header>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain rounded-xl border border-slate-800 bg-[#0E1420]/80 p-2.5 sm:p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SMART_INPUT_FIELDS.filter((f) => f.kind !== "textarea").map(
            (field) => (
              <SmartFormField
                key={field.id}
                field={field}
                value={values[field.id]}
                onChange={(v) => onChange(field.id, v)}
              />
            )
          )}
        </div>
        {SMART_INPUT_FIELDS.filter((f) => f.kind === "textarea").map(
          (field) => (
            <SmartFormField
              key={field.id}
              field={field}
              value={values[field.id]}
              onChange={(v) => onChange(field.id, v)}
            />
          )
        )}
      </div>

      <button
        type="button"
        disabled={submitting}
        onClick={onSubmit}
        className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-3 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(99,102,241,0.28)] transition hover:bg-indigo-400 disabled:opacity-45"
      >
        <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
        <span className="[word-break:keep-all]">AI 초안 뚝딱 생성하기</span>
      </button>
    </section>
  );
}
