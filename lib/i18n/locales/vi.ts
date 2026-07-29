import type { Translations } from "../types";
import en from "./en";

const vi: Translations = {
  ...en,
  auth: {
    ...en.auth,
    googlePrimary: "🌐 Bắt đầu trong 1 giây bằng Google",
    mockLoginHint: "Ở máy cục bộ, test@gmail.com được dùng mà không mở Google.",
    orEmail: "hoặc bắt đầu bằng email",
  },
  promotion: {
    ...en.promotion,
    title: "Nhập mã",
    description: "Nhập mã khuyến mãi để tải số credit còn lại.",
    currentCredits: "Credit hiện tại của mã",
    loadCredits: "Tải credit",
    checking: "Đang kiểm tra…",
    invalid: "Mã khuyến mãi không hợp lệ.",
    expired: "Mã đã hết hạn hoặc không còn credit.",
    activationFailed: "Không thể kích hoạt mã.",
  },
  pricing: {
    ...en.pricing,
    title: "Gói đăng ký",
    subtitle: "Chọn gói phù hợp và trải nghiệm studio AI cao cấp",
    annualBilling: "🔥 Thanh toán năm (giảm đến 30%)",
    monthlyBilling: "💳 Thanh toán tháng",
    annualSubscription: "Đăng ký năm",
    monthlySubscription: "Đăng ký tháng",
    annualRecommended: "🔥 Rất đáng chọn",
    monthlyPopular: "✨ Phổ biến",
    generationBenefit: "{period} {credits} ảnh và thumbnail AI ({credits} credit)",
    photoBenefit: "Đăng ký tối đa {count} ảnh khuôn mặt hoặc đồ vật",
    fhdBenefit: "Chất lượng FHD (1080p)",
    fourKBenefit: "Chất lượng siêu nét 4K",
    fastBenefit: "Tạo ảnh nhanh",
    commercialBenefit: "Được phép sử dụng thương mại",
    permanentBenefit: "Lưu trữ vĩnh viễn không giới hạn",
    watermarkBenefit: "Xóa hoàn toàn watermark",
    annualPrepaid: "Thanh toán ${total} một lần mỗi năm",
    upgradeNotice: "Khi nâng cấp, bạn chỉ trả phần chênh lệch theo tỷ lệ, giữ toàn bộ credit và chu kỳ bắt đầu lại từ ngày thanh toán.",
  },
};
export default vi;
