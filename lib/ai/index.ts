/**
 * Shared AI core barrel — Template Studio + Print Agent import from here.
 */

export {
  runStudioCoreEngine,
  resolveStudioMode,
  studioModeProfile,
  type CoreEngineInput,
  type CoreEngineResult,
  type StudioCoreMode,
  type StudioModeProfile,
} from "@/lib/ai/coreEngine";

export {
  runEditPipeline,
  type EditPipelineInput,
  type EditPipelineResult,
  type EditPipelineError,
  type EditAction,
  type CanvasPlane,
} from "@/lib/ai/editPipeline";

export {
  ALL_EDIT_INTENTS,
  GEMINI_INTENT_TOKENS,
  coerceIntent,
  intentToKind,
  isEditIntent,
  type AiEditIntent,
  type CommandKind,
  type GeminiIntentJson,
} from "@/lib/ai/editIntents";

export {
  jobsForIntent,
  jobRequiresSubject,
  type EditJobDescriptor,
  type EditJobKind,
  type EditJobResult,
  type EditJobContext,
} from "@/lib/ai/editJobs";

export { CommandRouter, IntentRouter } from "@/lib/ai/intentRouter";

export {
  smartInputsToTextLayers,
  smartInputsToOverlayPreview,
  hasFormOverlayCopy,
  type FormOverlayPreview,
  type FormToDesignLayerSpec,
} from "@/lib/ai/formToDesign";

export {
  applyVisualOnlyPolicy,
  NO_TEXT_BURN_IN_CLAUSE,
} from "@/lib/ai/layerPolicy";

export {
  resolveIdentityLock,
  applyIdentityLockPrompt,
  DEFAULT_IDENTITY_LOCK,
  WARDROBE_IDENTITY_LOCK,
} from "@/lib/ai/identityLock";

export {
  IMAGE_STYLE_PRESETS,
  MOOD_STYLE_PRESETS,
  normalizeVisualStyleSelection,
  buildVisualStyleModifiers,
  applyVisualStyleModifiers,
  visualStyleSelectionLabel,
  emptyVisualStyleSelection,
  type VisualStyleSelection,
  type VisualStylePreset,
} from "@/lib/ai/visualStylePresets";

export {
  exportPrintReadyAssets,
  PRINT_READY_DPI,
  type PrintReadyExportInput,
  type PrintReadyExportResult,
  type PrintReadyStoredAsset,
} from "@/lib/ai/printReadyExport";
