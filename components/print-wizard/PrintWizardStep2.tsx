"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import Step2Layout from "@/components/print-wizard/Step2Layout";
import PreviewCanvas from "@/components/print-wizard/PreviewCanvas";
import SpecSettingsPanel from "@/components/print-wizard/SpecSettingsPanel";
import SmartInputForm from "@/components/print-wizard/SmartInputForm";
import { generatePrintBackgroundDataUrl } from "@/lib/printWizardBg";
import {
  PRINT_STUDIO_PATH,
  readPrintWizardSession,
  savePrintWizardSession,
} from "@/lib/printWizardSession";
import {
  BG_PRESETS,
  formatById,
  defaultPrintWizardState,
  type BgPresetId,
  type PrintFormatId,
  type PrintUseId,
  type PrintPageCount,
  type PrintWizardState,
  type SmartInputFieldId,
} from "@/lib/printWizardTypes";

/**
 * Step 2 orchestrator — owns wizard state; panes stay presentational.
 */
export default function PrintWizardStep2() {
  const { t } = useI18n();
  const router = useRouter();
  const [state, setState] = useState<PrintWizardState>(defaultPrintWizardState);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const saved = readPrintWizardSession();
    if (saved) setState(saved);
  }, []);

  const patch = useCallback((partial: Partial<PrintWizardState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const onFormatChange = (formatId: PrintFormatId) => {
    patch({ formatId });
  };

  const onUseChange = (useId: PrintUseId) => {
    patch({ useId });
  };

  const onPageCountChange = (pageCount: PrintPageCount) => {
    patch({ pageCount });
  };

  const onBgKeywordChange = (bgKeyword: string) => {
    patch({ bgKeyword, bgPresetId: null });
  };

  const onBgPresetPick = (id: BgPresetId) => {
    const preset = BG_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    patch({ bgPresetId: id, bgKeyword: preset.keyword });
  };

  const onPromptPresetPick = (id: string, prompt: string) => {
    patch({ selectedPromptPresetId: id, mainPrompt: prompt });
  };

  const onMainPromptChange = (mainPrompt: string) => {
    patch({ mainPrompt, selectedPromptPresetId: null });
  };

  const onGenerateBackground = async () => {
    if (!state.bgKeyword.trim() || generating) return;
    setGenerating(true);
    try {
      const aspect = formatById(state.formatId).aspect;
      const url = await generatePrintBackgroundDataUrl(state.bgKeyword, aspect);
      patch({ backgroundUrl: url });
    } catch {
      /* keep previous background */
    } finally {
      setGenerating(false);
    }
  };

  const onInputChange = (id: SmartInputFieldId, value: string) => {
    setState((prev) => ({
      ...prev,
      inputs: { ...prev.inputs, [id]: value },
    }));
  };

  const onSubmit = () => {
    if (submitting) return;
    setSubmitting(true);
    setState((current) => {
      savePrintWizardSession(current);
      return current;
    });
    router.push(PRINT_STUDIO_PATH);
  };

  return (
    <Step2Layout
      title={t.hero.ctaPrintSmartForm}
      subtitle={t.hero.printWizardStep2}
      preview={
        <PreviewCanvas
          formatId={state.formatId}
          useId={state.useId}
          backgroundUrl={state.backgroundUrl}
          generating={generating}
          titlePreview={state.inputs.title}
          subtitlePreview={state.inputs.subtitle}
        />
      }
      specs={
        <SpecSettingsPanel
          formatId={state.formatId}
          useId={state.useId}
          pageCount={state.pageCount}
          bgKeyword={state.bgKeyword}
          bgPresetId={state.bgPresetId}
          selectedPromptPresetId={state.selectedPromptPresetId}
          mainPrompt={state.mainPrompt}
          generating={generating}
          submitting={submitting}
          onFormatChange={onFormatChange}
          onUseChange={onUseChange}
          onPageCountChange={onPageCountChange}
          onBgKeywordChange={onBgKeywordChange}
          onBgPresetPick={onBgPresetPick}
          onGenerateBackground={() => void onGenerateBackground()}
          onPromptPresetPick={onPromptPresetPick}
          onMainPromptChange={onMainPromptChange}
          onSubmit={onSubmit}
        />
      }
      form={
        <SmartInputForm
          values={state.inputs}
          submitting={submitting}
          onChange={onInputChange}
          onSubmit={onSubmit}
        />
      }
    />
  );
}
