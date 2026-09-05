import type { Translations } from "../types";
import en from "./en";
import { canvasStudioFr } from "../canvasStudio";
import { pricingPeriodFr } from "../pricingPeriod";

const fr: Translations = {
  ...en,
  common: {
    cancel: "Annuler",
    confirm: "Confirmer",
    close: "Fermer",
  },
  canvasStudio: canvasStudioFr,
  creator: {
    ...en.creator,
    generateFailed: "Échec de la génération du portrait IA.",
    generateFailedRefunded:
      "Échec de la génération du portrait. Les crédits utilisés ont été remboursés.",
    generateNetworkError: "Impossible de joindre le serveur. Vérifiez votre connexion.",
    generateRetryHint: "Réessayez plus tard ou avec une autre photo.",
    generateRetry: "Réessayer",
    deletePortraitConfirm:
      "Supprimer ce portrait généré ? Cette action est irréversible.",
    deletePortraitConfirmTitle: "Supprimer le portrait",
    deletePortraitDone: "Le portrait généré a été supprimé.",
    deleteConfirmYes: "Supprimer",
    deleteConfirmNo: "Annuler",
    summaryTitle: "Vos choix",
    summaryStyleLabel: "Style concept",
    summarySubjectLabel: "Sujet · Âge",
    summaryBackgroundLabel: "Arrière-plan",
    summaryPhotosLabel: "Photos importées",
    summaryPhotosValue: "{count} photos",
    compareButton: "Comparer A/B",
    compareTitle: "Comparaison A/B par balayage",
    compareSubtitle:
      "Faites glisser le séparateur pour comparer l’expression, les détails et la lumière.",
    compareSliderLabel: "Régler le séparateur entre la version A et la version B",
    compareClose: "Fermer la comparaison",
  },
  gallery: {
    ...en.gallery,
    worksDeleteConfirm: "Supprimer cette œuvre ? Cette action est irréversible.",
    worksDeleteConfirmTitle: "Supprimer l’œuvre",
    worksDeleteDone: "L’œuvre a été supprimée.",
    worksDeleteYes: "Supprimer",
    worksDeleteNo: "Annuler",
  },
  payment: {
    ...en.payment,
    creditsIncludedAnnual:
      "{count} crédits portrait inclus pendant les 12 mois d’accès",
    autoRenewNotice: "La formule mensuelle est renouvelée chaque mois jusqu’à résiliation.",
    annualOneTimeNotice:
      "Le pass annuel est réglé une seule fois à l’avance pour 12 mois, sans renouvellement automatique.",
    annualExpiryNotice:
      "À l’échéance, nous enverrons un avis de fin d’accès et les modalités de rachat au tarif normal.",
  },
  mypage: {
    ...en.mypage,
    expiryDate: "Date d’expiration de l’accès",
    annualNoRenewNotice:
      "Le pass annuel expire à la date indiquée et ne se renouvelle pas automatiquement.",
  },
  thumbnail: {
    ...en.thumbnail,
    dragHint:
      "Faites glisser le calque sur le canevas pour ajuster la position (cadre guide et magnétisme).",
    ctrTips: {
      short: "Visez un texte de 8 à 28 caractères.",
      emoji: "Ajoutez au moins un emoji pour attirer l’attention.",
      hook: "Renforcez l’accroche avec une question ou une urgence.",
      lines: "Trois lignes ou moins restent plus lisibles.",
    },
    deletePortrait: "🗑️ Supprimer le portrait généré",
    deletePortraitConfirm:
      "Supprimer ce portrait généré ? Cette action est irréversible.",
  },
  auth: {
    ...en.auth,
    googlePrimary: "🌐 Commencer en 1 seconde avec Google",
    mockLoginHint: "En local, test@gmail.com est utilisé sans ouvrir Google.",
    orEmail: "ou commencer par e-mail",
  },
  promotion: {
    ...en.promotion,
    title: "Saisir un code",
    description: "Saisissez un code promotionnel pour charger les crédits restants.",
    currentCredits: "Crédits actuels du code",
    loadCredits: "Charger les crédits",
    checking: "Vérification…",
    invalid: "Code promotionnel invalide.",
    expired: "Ce code a expiré ou n’a plus de crédits.",
    activationFailed: "Échec de l’activation du code.",
  },
  pricing: {
    ...en.pricing,
    ...pricingPeriodFr,
    annualBilling: "Pass annuel prépayé (paiement unique)",
    monthlyBilling: "💳 Paiement mensuel",
    annualSubscription: "Pass annuel prépayé",
    monthlySubscription: "Abonnement mensuel",
    annualRecommended: "🔥 Fortement recommandé",
    monthlyPopular: "✨ Populaire",
    generationBenefit: "{period} : {credits} portraits et miniatures IA ({credits} crédits)",
    photoBenefit: "{count} photos de visage ou d’objet enregistrables",
    fhdBenefit: "Qualité FHD (1080p)",
    fourKBenefit: "Ultra haute qualité 4K",
    fastBenefit: "Génération rapide",
    commercialBenefit: "Utilisation commerciale autorisée",
    permanentBenefit: "Stockage permanent illimité",
    watermarkBenefit: "Suppression totale du filigrane",
    annualPrepaid: "${total} payés d’avance · sans renouvellement automatique",
  },
};
export default fr;
