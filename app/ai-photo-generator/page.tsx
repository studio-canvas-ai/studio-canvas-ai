import PhotoWizardPageClient from "./PhotoWizardPageClient";

export const metadata = {
  title: "셀카화보뚝딱만들기 | Studio Canvas AI",
  description:
    "셀카만으로 화보를 빠르게 만드는 화보 뚝딱생성기. AI 배경과 스타일로 프로필 화보를 완성하세요.",
  robots: { index: false, follow: false },
};

export default function AiPhotoGeneratorPage() {
  return <PhotoWizardPageClient />;
}
