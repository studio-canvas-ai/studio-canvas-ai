import PhotoStudioPageClient from "./PhotoStudioPageClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "화보 뚝딱생성기 스튜디오 | Studio Canvas AI",
  robots: { index: false, follow: false },
};

export default function PhotoStudioPage() {
  return <PhotoStudioPageClient />;
}
