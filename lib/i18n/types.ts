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
    support: string;
    myGallery: string;
    login: string;
    trial: string;
    menu: string;
    topup: string;
  };
  hero: {
    badge: string;
    title: string;
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
    subject: string;
    subjectMale: string;
    subjectFemale: string;
    subjectObject: string;
    gender: string;
    age: string;
    vibe: string;
    genderFemale: string;
    genderMale: string;
    age10s: string;
    age20s: string;
    age30s: string;
    age40s: string;
    age50s: string;
    age60s: string;
    age70s: string;
    age80s: string;
    ageHint: string;
    vibeElegant: string;
    vibeBold: string;
    vibeNatural: string;
    vibeMysterious: string;
    uploadTitle: string;
    uploadHint: string;
    uploadFormatHint: string;
    uploadIdentityHint: string;
    uploadCount: string;
    uploadProcessing: string;
    uploadErrorUnsupported: string;
    uploadErrorTooLarge: string;
    uploadErrorConvert: string;
    styleSelectHint: string;
    prev: string;
    next: string;
    startTraining: string;
    trainingProgress: string;
    promptLabel: string;
    promptPreviewLabel: string;
    promptPlaceholder: string;
    creditBadge: string;
    generatePortrait: string;
    downloadPortrait: string;
    deletePortrait: string;
    deletePortraitConfirm: string;
    deleteConfirmYes: string;
    deleteConfirmNo: string;
    resultReady: string;
    aspectRatioLabel: string;
    aspect916: string;
    aspect169: string;
    aspect11: string;
    aspectA4: string;
    exportOriginal: string;
    exportIdPhoto: string;
    exportPrintPng: string;
    exportPrintPdf: string;
    retouchLabel: string;
    retouchPlaceholder: string;
    retouchApply: string;
    retouchFreeLeft: string;
    retouchCostHint: string;
    retouchSuccess: string;
    retouchThrottle: string;
    retouchDailyLimit: string;
    regenerate: string;
    draftA: string;
    draftB: string;
    focusDraft: string;
    bgModeLabel: string;
    bgAuto: string;
    bgTags: string;
    bgCustom: string;
    bgCustomPlaceholder: string;
    bgTagsLabels: {
      studio: string;
      city: string;
      nature: string;
      luxury: string;
      neon: string;
      hanok: string;
    };
    poseHintLabel: string;
    loadProfile: string;
    uploadTitlePerson: string;
    uploadTitleObject: string;
    loadSavedPhotos: string;
    loadSavedPhotosEmpty: string;
    resultDownloadHiRes: string;
    resultShare: string;
    resultRegenerateCredit: string;
    regenerateWithCredit: string;
    regenerateNeedCredit: string;
    draftSelected: string;
    savedToGallery: string;
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
  thumbnail: {
    title: string;
    freeBadge: string;
    textLabel: string;
    textPlaceholder: string;
    selectionHint: string;
    positionLabel: string;
    posTop: string;
    posCenter: string;
    posBottom: string;
    colorLabel: string;
    colors: {
      yellow: string;
      white: string;
      red: string;
      neonLime: string;
      deepBlue: string;
      purplePink: string;
      blackGold: string;
      orange: string;
    };
    fontLabel: string;
    fonts: {
      variety: string;
      clean: string;
      vlog: string;
      neon: string;
      impact: string;
    };
    sizeLabel: string;
    alignLabel: string;
    alignLeft: string;
    alignCenter: string;
    alignRight: string;
    layersLabel: string;
    addLine: string;
    lineN: string;
    symbolsLabel: string;
    safeZone: string;
    depthFront: string;
    depthBehind: string;
    aiSuggest: string;
    aiSuggestions: string[];
    saveAlbum: string;
    share: string;
    shareText: string;
    printPng: string;
    printPdf: string;
    creditNote: string;
    dragHint: string;
    youtubePreview: string;
    timestampSafe: string;
    ctrScore: string;
    ctrTips: Record<string, string>;
    abGenerate: string;
    stickers: string;
    kakaoShare: string;
    deletePortrait: string;
    deletePortraitConfirm: string;
  };
  support: {
    title: string;
    subtitle: string;
    email: string;
    subject: string;
    body: string;
    submit: string;
    success: string;
    another: string;
  };
  profiles: {
    title: string;
    slots: string;
    createHint: string;
    namePlaceholder: string;
    uploadPhotos: string;
    uploading: string;
    save: string;
    nameRequired: string;
    photoRequired: string;
    slotFull: string;
    uploadError: string;
  };
  returnUser: {
    badge: string;
    title: string;
    desc: string;
    dataKept: string;
    resubscribe: string;
    manageProfiles: string;
  };
  admin: {
    title: string;
    subtitle: string;
    empty: string;
    status: string;
    note: string;
    save: string;
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
    continueWithKakao: string;
    continueWithGoogle: string;
    continueWithNaver: string;
    orEmail: string;
    socialHint: string;
  };
  credits: {
    emptyTitle: string;
    emptyDesc: string;
    topup: string;
    upgrade: string;
    topupTitle: string;
    topupDesc: string;
    packLabel: string;
    subscriberBadge: string;
    topupNote: string;
    charge: string;
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
    payWithToss: string;
    amountKrw: string;
    secureCheckout: string;
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
      cultureEast: string;
      cultureWest: string;
      urban: string;
      studio: string;
    };
    packs: {
      "luxury-lifestyle": { name: string; description: string; tags: string[] };
      "cinematic-poster": { name: string; description: string; tags: string[] };
      "business-executive": { name: string; description: string; tags: string[] };
      "cultural-elegance": { name: string; description: string; tags: string[] };
      "classic-western": { name: string; description: string; tags: string[] };
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
    myGalleryTitle: string;
    myGallerySubtitle: string;
    tabWorks: string;
    tabModels: string;
    worksEmpty: string;
    worksDownload: string;
    worksShare: string;
    worksReedit: string;
    worksDelete: string;
    worksDeleteConfirm: string;
    retentionActiveBanner: string;
    expiryBadge: string;
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
    addonTitle: string;
    addonSubtitle: string;
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
    businessHeading: string;
    ceo: string;
    businessNumber: string;
    mailOrder: string;
    address: string;
    contact: string;
    hosting: string;
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
