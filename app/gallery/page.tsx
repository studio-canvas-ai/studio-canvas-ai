import { redirect } from "next/navigation";

/** Legacy /gallery → personal works only live under 내 갤러리. */
export default function GalleryPage() {
  redirect("/gallery/my");
}
