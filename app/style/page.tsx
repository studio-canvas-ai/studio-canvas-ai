import { redirect } from "next/navigation";

/** Alias for /styles — keeps nav/docs that use singular /style working. */
export default function StyleAliasPage() {
  redirect("/styles");
}
