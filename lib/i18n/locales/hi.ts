import type { Translations } from "../types";
import en from "./en";

const hi: Translations = {
  ...en,
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
    title: "सदस्यता प्लान",
    subtitle: "अपनी जरूरत का प्लान चुनें और प्रीमियम AI स्टूडियो का अनुभव लें",
    annualBilling: "🔥 वार्षिक भुगतान (30% तक छूट)",
    monthlyBilling: "💳 मासिक भुगतान",
    annualSubscription: "वार्षिक सदस्यता",
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
    annualPrepaid: "साल में एक बार ${total}",
    upgradeNotice: "अपग्रेड पर केवल आनुपातिक अंतर लिया जाता है, सभी क्रेडिट आगे बढ़ते हैं और भुगतान की तारीख से नया चक्र शुरू होता है।",
  },
};
export default hi;
