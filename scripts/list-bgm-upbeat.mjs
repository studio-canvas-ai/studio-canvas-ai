import { readFileSync, existsSync } from "fs";
import { createR2Client, getR2Config, listR2Keys } from "../lib/r2";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const cfg = getR2Config();
if (!cfg) {
  console.log("NO_R2_CONFIG");
  process.exit(0);
}

const client = createR2Client(cfg);
const keys = await listR2Keys(client, cfg.bucketName, "bgm/upbeat/");
console.log("COUNT", keys.length);
for (const key of keys.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
  console.log(key);
}
