/**
 * Admin-only “AI 1분 인쇄물 뚝딱 생성기” entry.
 * Keep this module client-safe (no Node APIs).
 */

export const PRINT_SMART_FORM_PATH = "/print-smart-form";
/** Step 3 — wide multi studio (wired from Step 2 CTA). */
export const PRINT_SMART_FORM_STUDIO_PATH = "/print-smart-form/studio";

/** Signed-in accounts that may see / open the print smart-form tool. */
export const PRINT_SMART_FORM_ADMIN_EMAILS = [
  "studiocanvas.cs@gmail.com",
  "scd77777@naver.com",
  "scd777@naver.com",
] as const;

export function isPrintSmartFormAdminEmail(
  email: string | null | undefined
): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return (PRINT_SMART_FORM_ADMIN_EMAILS as readonly string[]).includes(
    normalized
  );
}
