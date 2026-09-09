export type PrintSmartFormAccess = "allow" | "deny" | "unknown";

/** Public tool — no admin gate. */
export async function resolvePrintSmartFormAccess(): Promise<PrintSmartFormAccess> {
  return "allow";
}
