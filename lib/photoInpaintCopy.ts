/**
 * Photo lookbook (화보 뚝딱생성기) — UI copy for two-tier prompts.
 */

export type PhotoInpaintUiCopy = {
  title: string;
  generate: string;
  generating: string;
  placeholder: string;
  hint: string;
  needFace: string;
  needScene: string;
  bgTitle: string;
  bgPlaceholder: string;
  bgGenerate: string;
  bgGenerating: string;
  subjectTitle: string;
  subjectPlaceholder: string;
  subjectGenerate: string;
  subjectGenerating: string;
  needBgFirst: string;
  needSubjectPrompt: string;
  needBgPrompt: string;
};

const KR: PhotoInpaintUiCopy = {
  title: "AI 인물/상황 변형 (Inpainting)",
  generate: "인물·상황 변형하기",
  generating: "인물·상황 변형 중…",
  placeholder:
    "예: 한강에서 카누를 타는 모습, 모자를 쓴 프로필, 한복을 입은 포즈 — 배경은 유지되고 인물만 바뀝니다",
  hint: "",
  needFace:
    "학습사진 저장소에 얼굴이 없거나 캔버스에 인물 레이어가 없습니다. 먼저 학습사진을 장착해 주세요.",
  needScene:
    "변형할 장면이 없습니다. AI로 장면을 만들거나 배경이 있는 캔버스에서 다시 시도해 주세요.",
  bgTitle: "AI 배경 생성",
  bgPlaceholder: "수정해서 적어주세요",
  bgGenerate: "배경 생성하기",
  bgGenerating: "배경 생성 중…",
  subjectTitle: "AI 인물 수정",
  subjectPlaceholder:
    "예: 두 손을 들고 있다, 옷을 양장으로 바꾼다 — 배경은 고정되고 인물만 바뀝니다",
  subjectGenerate: "인물 수정 실행",
  subjectGenerating: "인물 수정 중…",
  needBgFirst: "먼저 상단에서 배경을 생성해 주세요.",
  needSubjectPrompt: "인물 수정 내용을 입력해 주세요.",
  needBgPrompt: "배경 장소·분위기를 입력해 주세요.",
};

const EN: PhotoInpaintUiCopy = {
  title: "AI Subject / Scene Transform (Inpainting)",
  generate: "Transform subject & scene",
  generating: "Transforming subject…",
  placeholder:
    "e.g. paddling a canoe on the Han River, wearing a hat — background stays locked; only the person changes",
  hint: "",
  needFace:
    "No trained face or subject layer found. Equip a trained photo first.",
  needScene:
    "No scene to edit. Generate or load a canvas scene first.",
  bgTitle: "AI Background",
  bgPlaceholder: "Edit and write here",
  bgGenerate: "Generate background",
  bgGenerating: "Generating background…",
  subjectTitle: "AI Subject edit",
  subjectPlaceholder:
    "e.g. raise both hands, change to a suit — background stays locked; only the person changes",
  subjectGenerate: "Run subject edit",
  subjectGenerating: "Editing subject…",
  needBgFirst: "Generate a background in the top box first.",
  needSubjectPrompt: "Enter a subject edit prompt.",
  needBgPrompt: "Enter a background place / mood prompt.",
};

export function photoInpaintUi(locale: string): PhotoInpaintUiCopy {
  return locale === "kr" ? KR : EN;
}
