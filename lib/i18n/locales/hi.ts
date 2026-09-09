import type { Translations } from "../types";
import en from "./en";
import { canvasStudioHi } from "../canvasStudio";
import { pricingPeriodHi } from "../pricingPeriod";

const hi: Translations = {
  ...en,
  common: {
    cancel: "रद्द करें",
    confirm: "पुष्टि करें",
    close: "बंद करें",
  },
  canvasStudio: canvasStudioHi,
  creator: {
    ...en.creator,
    generateFailed: "AI पोर्ट्रेट जनरेट नहीं हो सका।",
    generateFailedRefunded:
      "पोर्ट्रेट जनरेशन विफल। उपयोग किए गए क्रेडिट वापस कर दिए गए।",
    generateNetworkError: "सर्वर से कनेक्ट नहीं हो सका। नेटवर्क जाँचें।",
    generateRetryHint: "बाद में फिर कोशिश करें या दूसरी फ़ोटो इस्तेमाल करें।",
    generateRetry: "फिर कोशिश करें",
    deletePortraitConfirm:
      "यह जनरेटेड पोर्ट्रेट हटाएँ? यह वापस नहीं लिया जा सकता।",
    deletePortraitConfirmTitle: "पोर्ट्रेट हटाएँ",
    deletePortraitDone: "जनरेटेड पोर्ट्रेट हटा दिया गया।",
    deleteConfirmYes: "हटाएँ",
    deleteConfirmNo: "रद्द करें",
    summaryTitle: "आपके चुने हुए विकल्प",
    summaryStyleLabel: "कॉन्सेप्ट स्टाइल",
    summarySubjectLabel: "विषय · आयु",
    summaryBackgroundLabel: "पृष्ठभूमि",
    summaryPhotosLabel: "अपलोड की गई फ़ोटो",
    summaryPhotosValue: "{count} फ़ोटो",
    compareButton: "A/B तुलना देखें",
    compareTitle: "A/B स्लाइड तुलना",
    compareSubtitle:
      "चेहरे के भाव, बारीकियों और रोशनी की तुलना के लिए विभाजक खिसकाएँ।",
    compareSliderLabel: "ड्राफ़्ट A और ड्राफ़्ट B के बीच तुलना विभाजक समायोजित करें",
    compareClose: "तुलना बंद करें",
  },
  gallery: {
    ...en.gallery,
    worksDeleteConfirm: "यह कार्य हटाएँ? यह वापस नहीं लिया जा सकता।",
    worksDeleteConfirmTitle: "कार्य हटाएँ",
    worksDeleteDone: "कार्य हटा दिया गया।",
    worksDeleteYes: "हटाएँ",
    worksDeleteNo: "रद्द करें",
  },
  payment: {
    ...en.payment,
    creditsIncludedAnnual:
      "12 महीने की उपयोग अवधि के लिए {count} पोर्ट्रेट क्रेडिट शामिल",
    autoRenewNotice: "मासिक प्लान रद्द किए जाने तक हर महीने अपने आप नवीनीकृत होता है।",
    annualOneTimeNotice:
      "वार्षिक पास का 12 महीनों का भुगतान एक बार अग्रिम लिया जाता है और यह अपने आप नवीनीकृत नहीं होता।",
    annualExpiryNotice:
      "समाप्ति पर हम उपयोग-अवधि की सूचना और नियमित मूल्य पर दोबारा खरीदने की जानकारी भेजेंगे।",
  },
  mypage: {
    ...en.mypage,
    expiryDate: "उपयोग समाप्ति तिथि",
    annualNoRenewNotice:
      "वार्षिक पास ऊपर दी गई तारीख पर समाप्त होगा और अपने आप नवीनीकृत नहीं होगा।",
  },
  thumbnail: {
    ...en.thumbnail,
    dragHint:
      "स्थिति समायोजित करने के लिए कैनवास पर लेयर खींचें (बॉक्स गाइड और स्नैप)।",
    ctrTips: {
      short: "टेक्स्ट 8–28 अक्षरों में रखना बेहतर है।",
      emoji: "ध्यान खींचने के लिए कम से कम एक इमोजी जोड़ें।",
      hook: "सवाल या तात्कालिकता से हुक मजबूत करें।",
      lines: "तीन पंक्तियों या उससे कम पढ़ने में आसान हैं।",
    },
    deletePortrait: "🗑️ जनरेटेड पोर्ट्रेट हटाएँ",
    deletePortraitConfirm:
      "यह जनरेटेड पोर्ट्रेट हटाएँ? यह वापस नहीं लिया जा सकता।",
  },
  auth: {
    ...en.auth,
    googlePrimary: "🌐 Google से 1 सेकंड में शुरू करें",
    mockLoginHint: "लोकल मोड में Google खोले बिना test@gmail.com उपयोग होता है।",
    orEmail: "या ईमेल से शुरू करें",
  },
  promotion: {
    ...en.promotion,
    title: "कोड दर्ज करें",
    description: "बचे हुए क्रेडिट लोड करने के लिए प्रोमो कोड दर्ज करें।",
    currentCredits: "कोड के मौजूदा क्रेडिट",
    loadCredits: "क्रेडिट लोड करें",
    checking: "जाँच जारी…",
    invalid: "अमान्य प्रोमो कोड।",
    expired: "यह कोड समाप्त हो गया है या इसमें क्रेडिट नहीं बचे हैं।",
    activationFailed: "कोड सक्रिय नहीं हो सका।",
  },
  pricing: {
    ...en.pricing,
    ...pricingPeriodHi,
    annualBilling: "वार्षिक प्रीपेड पास (एकमुश्त भुगतान)",
    monthlyBilling: "💳 मासिक भुगतान",
    annualSubscription: "वार्षिक प्रीपेड पास",
    monthlySubscription: "मासिक सदस्यता",
    annualRecommended: "🔥 अत्यधिक अनुशंसित",
    monthlyPopular: "✨ लोकप्रिय",
    generationBenefit: "{period} {credits} AI पोर्ट्रेट व थंबनेल ({credits} क्रेडिट)",
    photoBenefit: "{count} पंजीकरण योग्य चेहरा या वस्तु फ़ोटो",
    fhdBenefit: "FHD (1080p) गुणवत्ता",
    fourKBenefit: "4K अल्ट्रा गुणवत्ता",
    fastBenefit: "तेज़ जनरेशन",
    commercialBenefit: "व्यावसायिक उपयोग की अनुमति",
    permanentBenefit: "असीमित स्थायी स्टोरेज",
    watermarkBenefit: "वॉटरमार्क पूरी तरह हटाया गया",
    annualPrepaid: "${total} एक बार अग्रिम · स्वतः नवीनीकरण नहीं",
  },
};
export default hi;
