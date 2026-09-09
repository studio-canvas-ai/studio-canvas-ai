import { GET as recoverGet } from "@/app/api/studio-store/route";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Dedicated recovery endpoint — same as GET /api/studio-store. */
export async function GET(req: Request) {
  return recoverGet(req);
}
