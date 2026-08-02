import type { Translations } from "../types";
import en from "./en";

const vi: Translations = {
  ...en,
  common: {
    cancel: "Hủy",
    confirm: "Xác nhận",
    close: "Đóng",
  },
  creator: {
    ...en.creator,
    generateFailed: "Tạo chân dung AI thất bại.",
    generateFailedRefunded:
      "Tạo chân dung thất bại. Credit đã dùng đã được hoàn lại.",
    generateNetworkError: "Không kết nối được máy chủ. Vui lòng kiểm tra mạng.",
    generateRetryHint: "Thử lại sau hoặc dùng ảnh khác.",
    generateRetry: "Thử lại",
    deletePortraitConfirm:
      "Xóa chân dung đã tạo? Thao tác này không thể hoàn tác.",
    deletePortraitConfirmTitle: "Xóa chân dung",
    deletePortraitDone: "Đã xóa chân dung đã tạo.",
    deleteConfirmYes: "Xóa",
    deleteConfirmNo: "Hủy",
    summaryTitle: "Lựa chọn của bạn",
    summaryStyleLabel: "Phong cách concept",
    summarySubjectLabel: "Đối tượng · Độ tuổi",
    summaryBackgroundLabel: "Nền",
    summaryPhotosLabel: "Ảnh đã tải lên",
    summaryPhotosValue: "{count} ảnh",
    compareButton: "So sánh A/B",
    compareTitle: "So sánh A/B bằng thanh trượt",
    compareSubtitle:
      "Kéo đường phân cách để so sánh biểu cảm, chi tiết và hiệu ứng ánh sáng.",
    compareSliderLabel: "Điều chỉnh đường phân cách giữa bản A và bản B",
    compareClose: "Đóng so sánh",
  },
  gallery: {
    ...en.gallery,
    worksDeleteConfirm: "Xóa tác phẩm này? Thao tác không thể hoàn tác.",
    worksDeleteConfirmTitle: "Xóa tác phẩm",
    worksDeleteDone: "Đã xóa tác phẩm.",
    worksDeleteYes: "Xóa",
    worksDeleteNo: "Hủy",
  },
  payment: {
    ...en.payment,
    creditsIncludedAnnual:
      "Bao gồm {count} credit tạo ảnh trong thời hạn sử dụng 12 tháng",
    autoRenewNotice: "Gói tháng tự động gia hạn hàng tháng cho đến khi bạn hủy.",
    annualOneTimeNotice:
      "Gói năm được thanh toán trước một lần cho 12 tháng và không tự động gia hạn.",
    annualExpiryNotice:
      "Khi hết hạn, chúng tôi sẽ gửi thông báo hết quyền sử dụng và hướng dẫn mua lại theo giá niêm yết.",
  },
  mypage: {
    ...en.mypage,
    expiryDate: "Ngày hết hạn quyền sử dụng",
    annualNoRenewNotice:
      "Gói năm kết thúc vào ngày trên và không tự động gia hạn.",
  },
  thumbnail: {
    ...en.thumbnail,
    dragHint:
      "Kéo lớp trên canvas để chỉnh vị trí (khung chọn và căn chỉnh từ tính).",
    ctrTips: {
      short: "Nên giữ chữ trong khoảng 8–28 ký tự.",
      emoji: "Thêm ít nhất 1 emoji để thu hút chú ý.",
      hook: "Tăng hook bằng câu hỏi hoặc cảm giác gấp.",
      lines: "Từ 3 dòng trở xuống dễ đọc hơn.",
    },
    deletePortrait: "🗑️ Xóa chân dung đã tạo",
    deletePortraitConfirm:
      "Xóa chân dung đã tạo? Thao tác này không thể hoàn tác.",
  },
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
    annualBilling: "Gói năm trả trước (thanh toán một lần)",
    monthlyBilling: "💳 Thanh toán tháng",
    annualSubscription: "Gói năm trả trước",
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
    annualPrepaid: "Trả trước ${total} một lần · không tự động gia hạn",
    upgradeNotice:
      "Khi nâng cấp, bạn chỉ trả phần chênh lệch theo tỷ lệ, giữ toàn bộ credit và chu kỳ bắt đầu lại từ ngày thanh toán.",
  },
};
export default vi;
