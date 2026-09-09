/**
 * Lucide vector icon resolution for Screen-26 Magic Layout.
 * No fixed emoji palette — any kebab-case Lucide name from the full library.
 */

/** Common Gemini / synonym aliases → Lucide kebab-case keys. */
const LUCIDE_ALIASES: Record<string, string> = {
  pin: "map-pin",
  location: "map-pin",
  "map pin": "map-pin",
  marker: "map-pin",
  calendar: "calendar-days",
  date: "calendar-days",
  gift: "gift",
  trophy: "trophy",
  phone: "phone-call",
  call: "phone-call",
  mail: "mail",
  email: "mail",
  time: "clock",
  food: "utensils",
  restaurant: "utensils",
  leaf: "leaf",
  autumn: "leaf",
  fall: "leaf",
  tree: "tree-pine",
  pine: "tree-pine",
  mountain: "mountain",
  music: "music",
  ticket: "ticket",
  mic: "mic",
  microphone: "mic",
  sparkles: "sparkles",
  party: "party-popper",
  "party-popper": "party-popper",
  drama: "drama",
  landmark: "landmark",
  scroll: "scroll",
  feather: "feather",
  gem: "gem",
  crown: "crown",
  globe: "globe",
  share: "share-2",
  check: "check-circle",
  shopping: "shopping-bag",
  bag: "shopping-bag",
  apple: "apple",
  tag: "tag",
  percent: "badge-percent",
  package: "package",
  camera: "camera",
  star: "star",
  heart: "heart",
  home: "home",
  building: "building-2",
  sun: "sun",
  moon: "moon",
  wind: "wind",
  compass: "compass",
  utensils: "utensils",
  coffee: "coffee",
  users: "users",
  user: "user",
  book: "book-open",
  palette: "palette",
  car: "car",
  bus: "bus",
  train: "train-front",
  plane: "plane",
  walk: "footprints",
  flower: "flower-2",
  fire: "flame",
  info: "info",
  warning: "triangle-alert",
  megaphone: "megaphone",
  medal: "medal",
  cart: "shopping-cart",
  pen: "pen-line",
};

export function normalizeLucideIconName(raw: string | undefined | null): string {
  const s = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  if (!s) return "";
  if (LUCIDE_ALIASES[s]) return LUCIDE_ALIASES[s]!;
  // Strip Lucide "Icon" suffix if model returns PascalCase-ish kebab
  if (s.endsWith("-icon")) return s.slice(0, -5);
  return s;
}

/** Reject smartphone emoji / pictographs — vectors only. */
export function isEmojiGlyph(value: string): boolean {
  return /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u.test(value);
}

export function pascalCaseLucideName(kebab: string): string {
  return kebab
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}
