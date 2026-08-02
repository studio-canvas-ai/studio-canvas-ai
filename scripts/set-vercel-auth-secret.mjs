/**
 * Generate a strong AUTH_SECRET and register it on Vercel
 * for production, preview, and development environments.
 *
 * Usage (from repo root):
 *   node scripts/set-vercel-auth-secret.mjs
 *
 * Dry run (print secret + commands only):
 *   DRY_RUN=1 node scripts/set-vercel-auth-secret.mjs
 *
 * Requires: logged-in Vercel CLI (`npx vercel login`) and linked project.
 */
import { randomBytes } from "crypto";
import { spawnSync } from "child_process";

const secret = randomBytes(48).toString("base64url");
const environments = ["production", "preview", "development"];

console.log("");
console.log("Generated AUTH_SECRET (store securely; shown once here):");
console.log(secret);
console.log("");

if (process.env.DRY_RUN === "1") {
  console.log("DRY_RUN=1 — skipping vercel env add.");
  console.log("Manual examples:");
  console.log(`  npx vercel env add AUTH_SECRET production`);
  console.log(`  # then paste: ${secret}`);
  console.log(`  # PowerShell pipe:`);
  console.log(
    `  "${secret}" | npx vercel env add AUTH_SECRET production --force`
  );
  process.exit(0);
}

for (const env of environments) {
  console.log(`Adding AUTH_SECRET → ${env} …`);
  const result = spawnSync(
    "npx",
    ["vercel", "env", "add", "AUTH_SECRET", env, "--force"],
    {
      input: `${secret}\n`,
      encoding: "utf8",
      shell: true,
      stdio: ["pipe", "inherit", "inherit"],
    }
  );
  if (result.status !== 0) {
    console.error(`Failed for ${env} (exit ${result.status}).`);
    console.error("You can add it manually:");
    console.error(`  npx vercel env add AUTH_SECRET ${env}`);
    console.error(`  # paste: ${secret}`);
    process.exit(result.status ?? 1);
  }
}

console.log("");
console.log("Done. Redeploy production so the new secret is applied:");
console.log("  npx vercel --prod --yes");
console.log("");
