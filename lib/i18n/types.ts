export const LOCALES = ["en", "kr", "es", "zh", "ja", "fr", "de", "it", "vi", "hi"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_COOKIE = "studio-canvas-locale";

export interface LocaleInfo {
  code: Locale;
  label: string;
  nativeName: string;
  flag: string;
}

export const LOCALE_INFO: LocaleInfo[] = [
  { code: "en", label: "English", nativeName: "English", flag: "🇺🇸" },
  { code: "kr", label: "Korean", nativeName: "한국어", flag: "🇰🇷" },
  { code: "es", label: "Spanish", nativeName: "Español", flag: "🇪🇸" },
  { code: "zh", label: "Chinese", nativeName: "中文", flag: "🇨🇳" },
  { code: "ja", label: "Japanese", nativeName: "日本語", flag: "🇯🇵" },
  { code: "fr", label: "French", nativeName: "Français", flag: "🇫🇷" },
  { code: "de", label: "German", nativeName: "Deutsch", flag: "🇩🇪" },
  { code: "it", label: "Italian", nativeName: "Italiano", flag: "🇮🇹" },
  { code: "vi", label: "Vietnamese", nativeName: "Tiếng Việt", flag: "🇻🇳" },
  { code: "hi", label: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳" },
];

export interface Translations {
  meta: { title: string; description: string };
  nav: {
    home: string;
    creator: string;
    styles: string;
    gallery: string;
    pricing: string;
    login: string;
    trial: string;
    menu: string;
  };
  hero: {
    badge: string;
    titleLine1: string;
    titleLine2: string;
    titleLine3: string;
    description: string;
    ctaStart: string;
    ctaExplore: string;
    statPortraits: string;
    statStyles: string;
    statRating: string;
    before: string;
    after: string;
    renderComplete: string;
    styleLabel: string;
    styleCinematic: string;
  };
  creator: {
    eyebrow: string;
    title: string;
    subtitle: string;
    step1Title: string;
    step1Desc: string;
    step2Title: string;
    step2Desc: string;
    step3Title: string;
    step3Desc: string;
    step4Title: string;
    step4Desc: string;
    gender: string;
    age: string;
    vibe: string;
    genderFemale: string;
    genderMale: string;
    genderNeutral: string;
    age20s: string;
    age30s: string;
    age40s: string;
    vibeElegant: string;
    vibeBold: string;
    vibeNatural: string;
    vibeMysterious: string;
    uploadTitle: string;
    uploadHint: string;
    uploadCount: string;
    styleSelectHint: string;
    prev: string;
    next: string;
    startTraining: string;
    trainingProgress: string;
    promptLabel: string;
    promptPlaceholder: string;
    creditBadge: string;
    generatePortrait: string;
    downloadPortrait: string;
    resultReady: string;
    aspectRatioLabel: string;
    aspect916: string;
    aspect169: string;
    aspect11: string;
    exportOriginal: string;
    exportIdPhoto: string;
    validationMissingFields: string;
    validationUploadMin: string;
    validationStyleMin: string;
    styles: {
      editorial: string;
      cinematic: string;
      corporate: string;
      artistic: string;
      vintage: string;
      fantasy: string;
    };
  };
  auth: {
    title: string;
    subtitle: string;
    email: string;
    password: string;
    signup: string;
    login: string;
    freeCredits: string;
    skipToGenerate: string;
  };
  credits: {
    emptyTitle: string;
    emptyDesc: string;
    topup: string;
    upgrade: string;
  };
  payment: {
    title: string;
    subtitle: string;
    cardName: string;
    cardNumber: string;
    expiry: string;
    cvc: string;
    creditsIncluded: string;
    payNow: string;
    processing: string;
    simulated: string;
  };
  styles: {
    eyebrow: string;
    title: string;
    subtitle: string;
    viewAll: string;
    categories: {
      all: string;
      lifestyle: string;
      cinematic: string;
      business: string;
      culture: string;
      urban: string;
      studio: string;
    };
    packs: {
      "luxury-lifestyle": { name: string; description: string; tags: string[] };
      "cinematic-poster": { name: string; description: string; tags: string[] };
      "business-executive": { name: string; description: string; tags: string[] };
      "cultural-elegance": { name: string; description: string; tags: string[] };
      "neon-urban": { name: string; description: string; tags: string[] };
      "soft-studio": { name: string; description: string; tags: string[] };
    };
  };
  gallery: {
    eyebrow: string;
    title: string;
    subtitle: string;
    portfolio: string;
    works: string;
    analyzing: string;
    generating: string;
    refining: string;
    complete: string;
    idleHint1: string;
    idleHint2: string;
    ready4k: string;
    downloadPortrait: string;
    items: {
      g1: { title: string; style: string };
      g2: { title: string; style: string };
      g3: { title: string; style: string };
      g4: { title: string; style: string };
      g5: { title: string; style: string };
      g6: { title: string; style: string };
    };
  };
  pricing: {
    eyebrow: string;
    title: string;
    subtitle: string;
    perMonth: string;
    mostPopular: string;
    getStarted: string;
    selectPlan: string;
    disclaimer: string;
    commercialNotice: string;
    plans: {
      starter: { name: string; description: string; features: string[] };
      standard: { name: string; description: string; features: string[] };
      pro: { name: string; description: string; features: string[] };
    };
  };
  footer: {
    tagline1: string;
    tagline2: string;
    madeWith: string;
    copyright: string;
    product: string;
    company: string;
    legal: string;
    links: {
      features: string;
      stylePacks: string;
      pricing: string;
      api: string;
      about: string;
      blog: string;
      careers: string;
      contact: string;
      terms: string;
      privacy: string;
      cookies: string;
    };
  };
}
