import type { Translations } from "../types";
import en from "./en";
import { canvasStudioIt } from "../canvasStudio";
import { pricingPeriodIt } from "../pricingPeriod";

const it: Translations = {
  ...en,
  common: {
    cancel: "Annulla",
    confirm: "Conferma",
    close: "Chiudi",
  },
  canvasStudio: canvasStudioIt,
  creator: {
    ...en.creator,
    generateFailed: "Generazione del ritratto IA non riuscita.",
    generateFailedRefunded:
      "Generazione del ritratto non riuscita. I crediti usati sono stati rimborsati.",
    generateNetworkError: "Impossibile contattare il server. Controlla la rete.",
    generateRetryHint: "Riprova più tardi o con un’altra foto.",
    generateRetry: "Riprova",
    deletePortraitConfirm:
      "Eliminare questo ritratto generato? L’azione non può essere annullata.",
    deletePortraitConfirmTitle: "Elimina ritratto",
    deletePortraitDone: "Il ritratto generato è stato eliminato.",
    deleteConfirmYes: "Elimina",
    deleteConfirmNo: "Annulla",
    summaryTitle: "Le tue scelte",
    summaryStyleLabel: "Stile concept",
    summarySubjectLabel: "Soggetto · Età",
    summaryBackgroundLabel: "Sfondo",
    summaryPhotosLabel: "Foto caricate",
    summaryPhotosValue: "{count} foto",
    compareButton: "Confronta A/B",
    compareTitle: "Confronto A/B con cursore",
    compareSubtitle:
      "Trascina il separatore per confrontare espressione, dettagli e resa della luce.",
    compareSliderLabel: "Regola il separatore tra la bozza A e la bozza B",
    compareClose: "Chiudi confronto",
  },
  gallery: {
    ...en.gallery,
    worksDeleteConfirm:
      "Eliminare quest’opera? L’azione non può essere annullata.",
    worksDeleteConfirmTitle: "Elimina opera",
    worksDeleteDone: "L’opera è stata eliminata.",
    worksDeleteYes: "Elimina",
    worksDeleteNo: "Annulla",
  },
  payment: {
    ...en.payment,
    creditsIncludedAnnual:
      "{count} crediti ritratto inclusi nei 12 mesi di accesso",
    autoRenewNotice: "Il piano mensile si rinnova ogni mese fino alla disdetta.",
    annualOneTimeNotice:
      "Il pass annuale si paga una sola volta in anticipo per 12 mesi e non si rinnova automaticamente.",
    annualExpiryNotice:
      "Alla scadenza invieremo un avviso di fine accesso e le informazioni per il riacquisto a prezzo pieno.",
  },
  mypage: {
    ...en.mypage,
    expiryDate: "Data di scadenza dell’accesso",
    annualNoRenewNotice:
      "Il pass annuale termina alla data indicata e non si rinnova automaticamente.",
  },
  thumbnail: {
    ...en.thumbnail,
    dragHint:
      "Trascina il livello sulla tela per regolare la posizione (guida riquadro e snap).",
    ctrTips: {
      short: "Il testo ideale è tra 8 e 28 caratteri.",
      emoji: "Aggiungi almeno un’emoji per catturare l’attenzione.",
      hook: "Rafforza l’hook con domanda o urgenza.",
      lines: "Tre righe o meno si leggono meglio.",
    },
    deletePortrait: "🗑️ Elimina ritratto generato",
    deletePortraitConfirm:
      "Eliminare questo ritratto generato? L’azione non può essere annullata.",
  },
  auth: {
    ...en.auth,
    googlePrimary: "🌐 Inizia in 1 secondo con Google",
    mockLoginHint: "In locale viene usato test@gmail.com senza aprire Google.",
    orEmail: "oppure inizia con l’e-mail",
  },
  promotion: {
    ...en.promotion,
    title: "Inserisci codice",
    description: "Inserisci un codice promozionale per caricare i crediti rimasti.",
    currentCredits: "Crediti attuali del codice",
    loadCredits: "Carica crediti",
    checking: "Verifica…",
    invalid: "Codice promozionale non valido.",
    expired: "Questo codice è scaduto o non ha più crediti.",
    activationFailed: "Attivazione del codice non riuscita.",
  },
  pricing: {
    ...en.pricing,
    ...pricingPeriodIt,
    annualBilling: "Pass annuale prepagato (pagamento unico)",
    monthlyBilling: "💳 Pagamento mensile",
    annualSubscription: "Pass annuale prepagato",
    monthlySubscription: "Abbonamento mensile",
    annualRecommended: "🔥 Super consigliato",
    monthlyPopular: "✨ Popolare",
    generationBenefit: "{period}: {credits} ritratti e miniature AI ({credits} crediti)",
    photoBenefit: "{count} foto di volti o oggetti registrabili",
    fhdBenefit: "Qualità FHD (1080p)",
    fourKBenefit: "Qualità ultra 4K",
    fastBenefit: "Generazione rapida",
    commercialBenefit: "Uso commerciale consentito",
    permanentBenefit: "Archiviazione permanente illimitata",
    watermarkBenefit: "Rimozione completa della filigrana",
    annualPrepaid: "${total} anticipati · nessun rinnovo automatico",
  },
};
export default it;
