import type { Translations } from "../types";
import en from "./en";

const es: Translations = {
  ...en,
  auth: {
    ...en.auth,
    googlePrimary: "🌐 Empieza en 1 segundo con tu cuenta de Google",
    mockLoginHint: "En local se inicia sesión con test@gmail.com sin abrir Google.",
    orEmail: "o empezar con correo electrónico",
  },
  promotion: {
    ...en.promotion,
    title: "Introducir código",
    description: "Introduce un código promocional para cargar los créditos restantes.",
    currentCredits: "Créditos actuales del código",
    loadCredits: "Cargar créditos",
    checking: "Comprobando…",
    invalid: "Código promocional no válido.",
    expired: "Este código ha caducado o no tiene créditos.",
    activationFailed: "No se pudo activar el código.",
  },
  pricing: {
    ...en.pricing,
    title: "Planes de suscripción",
    subtitle: "Elige el plan que necesitas y disfruta de un estudio de IA premium",
    annualBilling: "🔥 Pago anual (hasta un 30 % de descuento)",
    monthlyBilling: "💳 Pago mensual",
    annualSubscription: "Suscripción anual",
    monthlySubscription: "Suscripción mensual",
    annualRecommended: "🔥 Muy recomendado",
    monthlyPopular: "✨ Popular",
    generationBenefit: "{period}: {credits} imágenes y miniaturas de IA ({credits} créditos)",
    photoBenefit: "{count} fotos de rostro u objeto registrables",
    fhdBenefit: "Calidad FHD (1080p)",
    fourKBenefit: "Ultra alta calidad 4K",
    fastBenefit: "Generación rápida",
    commercialBenefit: "Uso comercial permitido",
    permanentBenefit: "Almacenamiento permanente ilimitado",
    watermarkBenefit: "Sin marca de agua",
    annualPrepaid: "${total} en un único pago anual",
    upgradeNotice: "Al actualizar solo pagas la diferencia prorrateada, conservas todos los créditos y el ciclo se reinicia desde el pago.",
  },
};
export default es;
