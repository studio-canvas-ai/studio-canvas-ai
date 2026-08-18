import type { Translations } from "../types";
import en from "./en";
import { canvasStudioDe } from "../canvasStudio";

const de: Translations = {
  ...en,
  common: {
    cancel: "Abbrechen",
    confirm: "Bestätigen",
    close: "Schließen",
  },
  canvasStudio: canvasStudioDe,
  creator: {
    ...en.creator,
    generateFailed: "KI-Porträt konnte nicht erzeugt werden.",
    generateFailedRefunded:
      "KI-Porträt fehlgeschlagen. Verbrauchte Credits wurden erstattet.",
    generateNetworkError: "Server nicht erreichbar. Bitte Netzwerk prüfen.",
    generateRetryHint: "Später erneut versuchen oder ein anderes Foto nutzen.",
    generateRetry: "Erneut versuchen",
    deletePortraitConfirm:
      "Dieses generierte Porträt löschen? Das kann nicht rückgängig gemacht werden.",
    deletePortraitConfirmTitle: "Porträt löschen",
    deletePortraitDone: "Das generierte Porträt wurde gelöscht.",
    deleteConfirmYes: "Löschen",
    deleteConfirmNo: "Abbrechen",
    summaryTitle: "Ihre Auswahl",
    summaryStyleLabel: "Konzeptstil",
    summarySubjectLabel: "Motiv · Alter",
    summaryBackgroundLabel: "Hintergrund",
    summaryPhotosLabel: "Hochgeladene Fotos",
    summaryPhotosValue: "{count} Fotos",
    compareButton: "A/B vergleichen",
    compareTitle: "A/B-Schiebereglervergleich",
    compareSubtitle:
      "Verschiebe die Trennlinie, um Ausdruck, Details und Lichtwirkung zu vergleichen.",
    compareSliderLabel: "Trennlinie zwischen Entwurf A und Entwurf B verschieben",
    compareClose: "Vergleich schließen",
  },
  gallery: {
    ...en.gallery,
    worksDeleteConfirm:
      "Dieses Werk löschen? Das kann nicht rückgängig gemacht werden.",
    worksDeleteConfirmTitle: "Werk löschen",
    worksDeleteDone: "Das Werk wurde gelöscht.",
    worksDeleteYes: "Löschen",
    worksDeleteNo: "Abbrechen",
  },
  payment: {
    ...en.payment,
    creditsIncludedAnnual:
      "{count} Porträt-Credits für den 12-monatigen Nutzungszeitraum",
    autoRenewNotice: "Der Monatsplan verlängert sich monatlich bis zur Kündigung.",
    annualOneTimeNotice:
      "Der Jahrespass wird einmalig für 12 Monate im Voraus bezahlt und verlängert sich nicht automatisch.",
    annualExpiryNotice:
      "Zum Ablauf senden wir eine Erinnerung und Informationen zum erneuten Kauf zum regulären Preis.",
  },
  mypage: {
    ...en.mypage,
    expiryDate: "Ablaufdatum des Zugangs",
    annualNoRenewNotice:
      "Der Jahrespass endet am oben angegebenen Datum und verlängert sich nicht automatisch.",
  },
  thumbnail: {
    ...en.thumbnail,
    dragHint:
      "Ziehen Sie die Ebene auf der Leinwand (Rahmenführung und Magnetraster).",
    ctrTips: {
      short: "Ideal sind 8–28 Zeichen Text.",
      emoji: "Mindestens ein Emoji steigert die Aufmerksamkeit.",
      hook: "Stärken Sie den Hook mit Frage oder Dringlichkeit.",
      lines: "Drei Zeilen oder weniger lesen sich besser.",
    },
    deletePortrait: "🗑️ Generiertes Porträt löschen",
    deletePortraitConfirm:
      "Dieses generierte Porträt löschen? Das kann nicht rückgängig gemacht werden.",
  },
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
    annualBilling: "Jahrespass im Voraus (Einmalzahlung)",
    monthlyBilling: "💳 Monatliche Zahlung",
    annualSubscription: "Jahrespass im Voraus",
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
    annualPrepaid: "${total} einmal im Voraus · keine automatische Verlängerung",
    upgradeNotice:
      "Beim Upgrade zahlst du nur die anteilige Differenz, behältst alle Credits und der Zyklus startet am Zahlungstag neu.",
  },
};
export default de;
