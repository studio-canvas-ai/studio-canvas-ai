import type { Translations } from "../types";
import en from "./en";

const de: Translations = {
  ...en,
  auth: {
    ...en.auth,
    googlePrimary: "🌐 In 1 Sekunde mit Google starten",
    mockLoginHint: "Lokal wird test@gmail.com ohne Google-Fenster verwendet.",
    orEmail: "oder mit E-Mail starten",
  },
  promotion: {
    ...en.promotion,
    title: "Code eingeben",
    description: "Gib einen Aktionscode ein, um die übrigen Credits zu laden.",
    currentCredits: "Aktuelle Code-Credits",
    loadCredits: "Credits laden",
    checking: "Wird geprüft…",
    invalid: "Ungültiger Aktionscode.",
    expired: "Dieser Code ist abgelaufen oder hat keine Credits mehr.",
    activationFailed: "Code konnte nicht aktiviert werden.",
  },
  pricing: {
    ...en.pricing,
    title: "Abonnementpläne",
    subtitle: "Wähle den passenden Plan und erlebe ein Premium-KI-Studio",
    annualBilling: "🔥 Jährliche Zahlung (bis zu 30 % Rabatt)",
    monthlyBilling: "💳 Monatliche Zahlung",
    annualSubscription: "Jahresabonnement",
    monthlySubscription: "Monatsabonnement",
    annualRecommended: "🔥 Besonders empfohlen",
    monthlyPopular: "✨ Beliebt",
    generationBenefit: "{period} {credits} KI-Porträts und Thumbnails ({credits} Credits)",
    photoBenefit: "{count} registrierbare Gesichts- oder Objektfotos",
    fhdBenefit: "FHD-Qualität (1080p)",
    fourKBenefit: "4K-Ultraqualität",
    fastBenefit: "Schnelle Generierung",
    commercialBenefit: "Kommerzielle Nutzung erlaubt",
    permanentBenefit: "Unbegrenzte dauerhafte Speicherung",
    watermarkBenefit: "Wasserzeichen vollständig entfernt",
    annualPrepaid: "${total} einmal jährlich",
    upgradeNotice: "Beim Upgrade zahlst du nur die anteilige Differenz, behältst alle Credits und der Zyklus startet am Zahlungstag neu.",
  },
};
export default de;
