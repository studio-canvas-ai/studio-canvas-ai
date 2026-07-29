import type { Translations } from "../types";
import en from "./en";

const it: Translations = {
  ...en,
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
    title: "Piani di abbonamento",
    subtitle: "Scegli il piano adatto alle tue esigenze e prova uno studio AI premium",
    annualBilling: "🔥 Pagamento annuale (fino al 30% di sconto)",
    monthlyBilling: "💳 Pagamento mensile",
    annualSubscription: "Abbonamento annuale",
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
    annualPrepaid: "${total} addebitati una volta all’anno",
    upgradeNotice: "Con l’upgrade paghi solo la differenza proporzionale, mantieni tutti i crediti e il ciclo riparte dal pagamento.",
  },
};
export default it;
