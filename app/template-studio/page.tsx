import AiTemplateStudio from "@/components/AiTemplateStudio";

export const metadata = {
  title: "AI 템플릿 스튜디오 | Studio Canvas AI",
  description:
    "원클릭으로 비율·AI 배경·문구·스티커를 한 화면에서 편집하는 전문 템플릿 스튜디오",
};

export default function TemplateStudioPage() {
  return <AiTemplateStudio recentNamespace="screen_007" />;
}
