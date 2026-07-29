import type { Translations } from "../types";
import en from "./en";

const fr: Translations = {
  ...en,
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
    title: "Formules d’abonnement",
    subtitle: "Choisissez la formule adaptée et découvrez un studio IA premium",
    annualBilling: "🔥 Paiement annuel (jusqu’à 30 % de réduction)",
    monthlyBilling: "💳 Paiement mensuel",
    annualSubscription: "Abonnement annuel",
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
    annualPrepaid: "${total} facturés une fois par an",
    upgradeNotice: "La mise à niveau facture uniquement la différence au prorata, conserve tous les crédits et redémarre le cycle au paiement.",
  },
};
export default fr;
