/**
 * ===================================================================
 * SÂN BÓNG NHÀ MÁY NƯỚC – YÊN PHÚ
 * File cấu hình dùng chung toàn bộ Frontend (config.js)
 * ===================================================================
 */

const CONFIG = {
  // Địa chỉ API FastAPI backend
  API_BASE_URL: "/api",
  
  // Thông tin thương hiệu sân bóng
  VENUE_NAME: "Sân bóng Nhà Máy Nước – Yên Phú",
  VENUE_ADDRESS: "Bình Phú, Yên Phú, Yên Mỹ, Hưng Yên",
  HOTLINE: "0988.123.456",
  HOTLINE_TEL: "tel:0988123456",

  // Cấu hình lưu trữ LocalStorage keys
  STORAGE_KEYS: {
    AUTH_TOKEN: "yenphu_token",
    USER_INFO: "yenphu_user",
    CURRENT_BOOKING: "yenphu_pitch_booking"
  }
};

// Các hàm tiện ích dùng chung (Helper Utilities)
const UTILS = {
  /**
   * Định dạng số tiền thành chuỗi tiền tệ Việt Nam (ví dụ: 450000 -> "450.000đ")
   */
  formatPrice(amount) {
    if (amount == null || isNaN(amount)) return "0đ";
    return Number(amount).toLocaleString("vi-VN") + "đ";
  },

  /**
   * Lấy ngày theo múi giờ địa phương của người dùng (YYYY-MM-DD), tránh lệch múi giờ
   */
  getLocalDateString(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  },

  /**
   * Hiển thị ngày dạng DD/MM/YYYY
   */
  formatDateDisplay(isoDate) {
    if (!isoDate) return "";
    const parts = isoDate.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return isoDate;
  },

  /**
   * Định dạng giờ "HH:MM:SS" -> "HH:MM"
   */
  formatTime(timeStr) {
    if (!timeStr) return "";
    return timeStr.slice(0, 5);
  }
};

// Cấu hình Theme & Design Tokens cho Tailwind CSS (Google Stitch)
if (typeof tailwind !== "undefined") {
  tailwind.config = {
    darkMode: "class",
    theme: {
      extend: {
        colors: {
          "surface-tint": "#83dd2c",
          "on-primary-container": "#254a00",
          "surface-variant": "#31372a",
          "secondary-fixed": "#bef28f",
          "on-secondary": "#1a3700",
          "background": "#10150a",
          "on-primary-fixed": "#0d2000",
          "on-error": "#690005",
          "on-tertiary-fixed": "#390033",
          "error-container": "#93000a",
          "surface-dim": "#10150a",
          "surface": "#10150a",
          "surface-container-low": "#181d12",
          "secondary-container": "#2c5501",
          "on-primary-fixed-variant": "#295000",
          "surface-bright": "#353b2e",
          "surface-container-high": "#262c20",
          "on-tertiary": "#5d0054",
          "tertiary-fixed": "#ffd7f1",
          "inverse-on-surface": "#2d3226",
          "inverse-primary": "#386b00",
          "on-error-container": "#ffdad6",
          "surface-container": "#1c2116",
          "on-tertiary-fixed-variant": "#7b1d6f",
          "surface-container-lowest": "#0b1006",
          "secondary-fixed-dim": "#a3d575",
          "primary": "#85e02f",
          "on-background": "#dfe5d3",
          "on-surface-variant": "#c0cab1",
          "outline": "#8a947d",
          "on-tertiary-container": "#751669",
          "on-surface": "#dfe5d3",
          "tertiary-fixed-dim": "#ffacea",
          "tertiary": "#ffb1ea",
          "on-secondary-fixed-variant": "#295000",
          "on-primary": "#1a3700",
          "inverse-surface": "#dfe5d3",
          "on-secondary-container": "#98ca6c",
          "tertiary-container": "#f588de",
          "on-secondary-fixed": "#0d2000",
          "secondary": "#a3d575",
          "primary-fixed": "#9dfa49",
          "primary-container": "#6bc303",
          "outline-variant": "#404a36",
          "error": "#ffb4ab",
          "surface-container-highest": "#31372a",
          "primary-fixed-dim": "#83dd2c"
        },
        borderRadius: {
          "DEFAULT": "1rem",
          "lg": "2rem",
          "xl": "3rem",
          "full": "9999px"
        },
        spacing: {
          "margin": "1rem",
          "space-xl": "2.5rem",
          "space-lg": "1.5rem",
          "gutter-desktop": "1.5rem",
          "space-xs": "0.25rem",
          "space-sm": "0.5rem",
          "space-md": "1rem",
          "gutter": "1rem",
          "margin-desktop": "2.5rem"
        },
        fontFamily: {
          "label-lg": ["Space Grotesk"],
          "label-sm": ["Space Grotesk"],
          "headline-xl-mobile": ["Anybody"],
          "headline-lg-mobile": ["Anybody"],
          "headline-md": ["Anybody"],
          "headline-sm": ["Anybody"],
          "body-lg": ["Space Grotesk"],
          "label-md": ["Space Grotesk"],
          "headline-xl": ["Anybody"],
          "headline-lg": ["Anybody"],
          "body-md": ["Space Grotesk"],
          "body-sm": ["Space Grotesk"]
        },
        fontSize: {
          "label-lg": ["14px", { lineHeight: "16px", letterSpacing: "0.06em", fontWeight: "700" }],
          "label-sm": ["10px", { lineHeight: "12px", letterSpacing: "0.08em", fontWeight: "600" }],
          "headline-xl-mobile": ["36px", { lineHeight: "40px", letterSpacing: "-0.03em", fontWeight: "900" }],
          "headline-lg-mobile": ["28px", { lineHeight: "32px", letterSpacing: "-0.02em", fontWeight: "800" }],
          "headline-md": ["24px", { lineHeight: "28px", letterSpacing: "-0.02em", fontWeight: "700" }],
          "headline-sm": ["20px", { lineHeight: "24px", letterSpacing: "-0.01em", fontWeight: "700" }],
          "body-lg": ["18px", { lineHeight: "26px", fontWeight: "500" }],
          "label-md": ["12px", { lineHeight: "14px", letterSpacing: "0.05em", fontWeight: "600" }],
          "headline-xl": ["56px", { lineHeight: "60px", letterSpacing: "-0.04em", fontWeight: "900" }],
          "headline-lg": ["40px", { lineHeight: "44px", letterSpacing: "-0.03em", fontWeight: "800" }],
          "body-md": ["15px", { lineHeight: "22px", fontWeight: "400" }],
          "body-sm": ["13px", { lineHeight: "18px", fontWeight: "400" }]
        }
      }
    }
  };
}

