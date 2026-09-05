import type { Translations } from "../types";
import en from "./en";
import { canvasStudioEs } from "../canvasStudio";
import { pricingPeriodEs } from "../pricingPeriod";

const es: Translations = {
  ...en,
  common: {
    cancel: "Cancelar",
    confirm: "Confirmar",
    close: "Cerrar",
  },
  canvasStudio: canvasStudioEs,
  creator: {
    ...en.creator,
    generateFailed: "Error al generar el retrato con IA.",
    generateFailedRefunded:
      "Error al generar el retrato. Se reembolsaron los créditos usados.",
    generateNetworkError: "No se pudo conectar con el servidor. Comprueba tu red.",
    generateRetryHint: "Inténtalo de nuevo más tarde o con otra foto.",
    generateRetry: "Reintentar",
    deletePortraitConfirm:
      "¿Eliminar este retrato generado? Esta acción no se puede deshacer.",
    deletePortraitConfirmTitle: "Eliminar retrato",
    deletePortraitDone: "El retrato generado se eliminó.",
    deleteConfirmYes: "Eliminar",
    deleteConfirmNo: "Cancelar",
    summaryTitle: "Tu selección",
    summaryStyleLabel: "Estilo conceptual",
    summarySubjectLabel: "Sujeto · Edad",
    summaryBackgroundLabel: "Fondo",
    summaryPhotosLabel: "Fotos subidas",
    summaryPhotosValue: "{count} fotos",
    compareButton: "Comparar A/B",
    compareTitle: "Comparación dividida A/B",
    compareSubtitle:
      "Desliza el separador para comparar la expresión, los detalles y la iluminación.",
    compareSliderLabel: "Ajustar el separador entre el borrador A y el borrador B",
    compareClose: "Cerrar comparación",
  },
  gallery: {
    ...en.gallery,
    worksDeleteConfirm: "¿Eliminar esta obra? Esta acción no se puede deshacer.",
    worksDeleteConfirmTitle: "Eliminar obra",
    worksDeleteDone: "La obra se eliminó.",
    worksDeleteYes: "Eliminar",
    worksDeleteNo: "Cancelar",
  },
  payment: {
    ...en.payment,
    creditsIncludedAnnual:
      "{count} créditos para retratos incluidos durante los 12 meses de acceso",
    autoRenewNotice: "El plan mensual se renueva cada mes hasta que lo canceles.",
    annualOneTimeNotice:
      "El pase anual se paga una sola vez por adelantado para 12 meses y no se renueva automáticamente.",
    annualExpiryNotice:
      "Al vencer, enviaremos un aviso de finalización y la información para volver a comprar al precio normal.",
  },
  mypage: {
    ...en.mypage,
    expiryDate: "Fecha de vencimiento del acceso",
    annualNoRenewNotice:
      "El pase anual vence en la fecha indicada y no se renueva automáticamente.",
  },
  thumbnail: {
    ...en.thumbnail,
    dragHint:
      "Arrastra la capa en el lienzo para ajustar la posición (guía de marco y ajuste magnético).",
    ctrTips: {
      short: "Lo ideal es un texto de 8 a 28 caracteres.",
      emoji: "Incluye al menos un emoji para atraer la atención.",
      hook: "Refuerza el gancho con duda o urgencia.",
      lines: "Tres líneas o menos se leen mejor.",
    },
    deletePortrait: "🗑️ Eliminar retrato generado",
    deletePortraitConfirm:
      "¿Eliminar este retrato generado? Esta acción no se puede deshacer.",
  },
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
    ...pricingPeriodEs,
    annualBilling: "Pase anual prepago (pago único)",
    monthlyBilling: "💳 Pago mensual",
    annualSubscription: "Pase anual prepago",
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
    annualPrepaid: "${total} por adelantado · sin renovación automática",
  },
};
export default es;
