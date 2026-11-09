/**
 * ===================================================================
 * SÂN BÓNG NHÀ MÁY NƯỚC – YÊN PHÚ
 * Module API gọi Backend FastAPI (api.js)
 * Tích hợp Quản lý Xác thực (JWT Auth) & Phân quyền RBAC
 * ===================================================================
 */

const API = {
  /**
   * Lấy Token từ LocalStorage một cách an toàn và chuẩn hóa (bỏ Bearer, trim quotes)
   */
  getStoredToken() {
    let token = localStorage.getItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN) || 
                localStorage.getItem("token") || 
                localStorage.getItem("access_token");
    if (!token) return null;

    token = token.trim();
    if (token.toLowerCase().startsWith("bearer ")) {
      token = token.slice(7).trim();
    }
    if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
      token = token.slice(1, -1).trim();
    }
    return token || null;
  },

  /**
   * Lấy thông tin User đã lưu trữ từ LocalStorage
   */
  getStoredUser() {
    try {
      const userStr = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_INFO) || localStorage.getItem("user");
      if (!userStr) return null;
      return JSON.parse(userStr);
    } catch (e) {
      console.warn("[Auth] Lỗi đọc user từ LocalStorage:", e.message);
      return null;
    }
  },

  /**
   * Lưu Token và User khi đăng nhập/đăng ký thành công
   */
  saveAuth(accessToken, user) {
    if (!accessToken) return;
    let cleanToken = accessToken.trim();
    if (cleanToken.toLowerCase().startsWith("bearer ")) {
      cleanToken = cleanToken.slice(7).trim();
    }
    localStorage.setItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN, cleanToken);
    if (user) {
      localStorage.setItem(CONFIG.STORAGE_KEYS.USER_INFO, JSON.stringify(user));
    }
  },

  /**
   * Xóa toàn bộ trạng thái đăng nhập
   */
  clearAuth() {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
    localStorage.removeItem(CONFIG.STORAGE_KEYS.USER_INFO);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("access_token");
  },

  /**
   * Kiểm tra người dùng đã đăng nhập hay chưa
   */
  isLoggedIn() {
    const token = this.getStoredToken();
    const user = this.getStoredUser();
    return Boolean(token && user);
  },

  /**
   * Kiểm tra người dùng có quyền Quản trị viên (Admin) hay không
   */
  isAdmin() {
    const user = this.getStoredUser();
    return Boolean(this.isLoggedIn() && user && user.role === "admin");
  },

  /**
   * Đăng xuất tài khoản an toàn
   */
  logout() {
    this.clearAuth();
    window.location.href = "login.html";
  },

  /**
   * Hàm trợ giúp gửi Request với fetch, tự động đính kèm JWT Bearer
   */
  async request(endpoint, options = {}) {
    const url = `${CONFIG.API_BASE_URL}${endpoint}`;
    
    // Tự động gắn token nếu đã đăng nhập
    const token = this.getStoredToken();
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {})
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        // Xử lý token hết hạn hoặc không hợp lệ (401)
        if (response.status === 401 && !endpoint.startsWith("/auth/login") && !endpoint.startsWith("/auth/register")) {
          console.warn("[Auth] Phiên đăng nhập hết hạn hoặc không hợp lệ.");
          this.clearAuth();
          // Nếu đang ở trang cần bảo vệ thì chuyển hướng về login
          if (window.location.pathname.includes("admin.html") || window.location.pathname.includes("booking.html")) {
            window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}&expired=1`;
          }
        }

        const errorMsg = data?.detail || `Lỗi kết nối máy chủ (${response.status})`;
        const err = new Error(errorMsg);
        err.status = response.status;
        err.data = data;
        throw err;
      }

      return data;
    } catch (error) {
      console.error(`[API Error] ${endpoint}:`, error.message);
      throw error;
    }
  },

  // ================= KHÁCH HÀNG APIS =================

  // 1. Lấy danh sách sân bóng
  async getPitches() {
    return this.request("/pitches");
  },

  // 2. Lấy danh sách khung giờ & tình trạng sân theo ngày
  async getSlots(date, pitchId = null) {
    let url = `/slots?date=${encodeURIComponent(date)}`;
    if (pitchId) url += `&pitch_id=${encodeURIComponent(pitchId)}`;
    return this.request(url);
  },

  // 3. Tạo đơn đặt sân mới (Backend yêu cầu Token hợp lệ)
  async createBooking(bookingData) {
    return this.request("/bookings", {
      method: "POST",
      body: JSON.stringify(bookingData)
    });
  },

  // 4. Lấy thông tin đơn đặt sân theo ID
  async getBooking(bookingId) {
    return this.request(`/bookings/${bookingId}`);
  },
   // 4b. Kiểm tra khung giờ còn trống + giá
  async checkAvailability(pitchId, date, start, end) {
    const q = new URLSearchParams({
      pitch_id: pitchId,
      booking_date: date,
      start_time: start,
      end_time: end
    }).toString();
    return this.request(`/bookings/available?${q}`);
  },

  // 4c. Các khoảng giờ đã có đội đặt trong ngày
  async getBookedRanges(pitchId, date) {
    const q = new URLSearchParams({ pitch_id: pitchId, booking_date: date }).toString();
    return this.request(`/bookings/booked?${q}`);
  },

  // 5. Đăng ký tài khoản mới (Mặc định role = user)
  async register(userData) {
    return this.request("/auth/register", {
      method: "POST",
      body: JSON.stringify(userData)
    });
  },

  // 6. Đăng nhập (Số điện thoại hoặc Email + Mật khẩu)
  async login(credentials) {
    const data = await this.request("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials)
    });
    if (data && data.access_token) {
      this.saveAuth(data.access_token, data.user);
    }
    return data;
  },

  // 7. Lấy thông tin tài khoản hiện tại từ máy chủ
  async getMe() {
    return this.request("/auth/me");
  },

  // ================= QUẢN TRỊ VIÊN APIS =================

  // 8. Lấy thống kê Dashboard hôm nay (Admin only)
  async getAdminDashboard() {
    return this.request("/admin/dashboard");
  },

  // 9. Lấy danh sách đơn đặt sân (Admin only)
  async getAdminBookings(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/admin/bookings${query ? `?${query}` : ""}`);
  },

  // 10. Cập nhật trạng thái đơn (confirmed, completed, cancelled)
  async updateBookingStatus(bookingId, status) {
    return this.request(`/admin/bookings/${bookingId}`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
  },

  // 11. Hủy hoặc xóa đơn đặt sân
  async deleteBooking(bookingId) {
    return this.request(`/admin/bookings/${bookingId}`, {
      method: "DELETE"
    });
  },

  // 12. Cập nhật trạng thái hoặc thông tin sân
  async updatePitch(pitchId, pitchData) {
    return this.request(`/admin/pitches/${pitchId}`, {
      method: "PUT",
      body: JSON.stringify(pitchData)
    });
  },

  // ================= UI RENDER HELPERS =================

  /**
   * Cập nhật hiển thị góc phải Header theo trạng thái đăng nhập
   */
  renderHeaderAuth() {
    const container = document.getElementById("header-user-area");
    if (!container) return;

    if (this.isLoggedIn()) {
      const user = this.getStoredUser();
      const isAdminUser = user.role === "admin";
      const displayName = user.full_name || user.phone || "Khách";
      const initial = displayName.trim().charAt(0).toUpperCase();

      container.innerHTML = `
        <a aria-label="Hotline Đặt Sân" class="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-primary bg-surface-container-high/80 hover:bg-surface-container-highest transition-colors" href="${CONFIG.HOTLINE_TEL}">
          <span class="material-symbols-outlined text-[18px]">call</span>
        </a>
        <div class="flex items-center gap-2 pl-1">
          <div class="relative group cursor-pointer">
            <div class="flex items-center gap-1.5 py-1 px-2.5 rounded-full bg-surface-container-high hover:bg-surface-container-highest border border-surface-container-highest transition-all">
              <div class="w-6 h-6 rounded-full ${isAdminUser ? 'bg-primary text-on-primary' : 'bg-primary/20 text-primary'} flex items-center justify-center font-bold text-xs">
                ${initial}
              </div>
              <span class="font-label-sm text-label-sm text-on-surface font-semibold max-w-[85px] sm:max-w-[120px] truncate">
                ${displayName}
              </span>
              <span class="font-label-sm text-[10px] px-1.5 py-0.2 rounded-full ${isAdminUser ? 'bg-primary/20 text-primary' : 'bg-surface-variant text-on-surface-variant'}">
                ${isAdminUser ? 'Admin' : 'Thành viên'}
              </span>
            </div>
            <!-- Dropdown Menu -->
            <div class="absolute right-0 top-full mt-1.5 w-44 py-1.5 bg-surface-container-high rounded-DEFAULT shadow-2xl border border-surface-container-highest hidden group-hover:block z-50">
              <div class="px-3 py-1.5 border-b border-surface-container-highest">
                <p class="font-label-sm text-label-sm text-on-surface font-bold truncate">${displayName}</p>
                <p class="font-label-sm text-[11px] text-on-surface-variant truncate">${user.phone || ''}</p>
              </div>
              ${isAdminUser ? `
                <a href="admin.html" class="flex items-center gap-2 px-3 py-2 text-primary hover:bg-surface-container font-label-sm text-label-sm">
                  <span class="material-symbols-outlined text-[16px]">admin_panel_settings</span>
                  <span>Bảng Quản Trị</span>
                </a>
              ` : ''}
              <button onclick="API.logout()" class="w-full flex items-center gap-2 px-3 py-2 text-error hover:bg-surface-container font-label-sm text-label-sm text-left">
                <span class="material-symbols-outlined text-[16px]">logout</span>
                <span>Đăng Xuất</span>
              </button>
            </div>
          </div>
        </div>
      `;
    } else {
      container.innerHTML = `
        <a aria-label="Hotline Đặt Sân" class="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-primary bg-surface-container-high/80 hover:bg-surface-container-highest transition-colors" href="${CONFIG.HOTLINE_TEL}">
          <span class="material-symbols-outlined text-[18px]">call</span>
        </a>
        <a href="login.html" class="px-3.5 py-1.5 rounded-full bg-primary text-on-primary hover:bg-primary-fixed font-label-sm text-label-sm uppercase font-bold flex items-center gap-1 shadow-md shadow-primary/20 active:scale-95 transition-all">
          <span class="material-symbols-outlined text-[16px]">login</span>
          <span>Đăng Nhập</span>
        </a>
      `;
    }
  },

  /**
   * Ẩn / hiện nút Quản Trị ở thanh Bottom Navigation tùy theo Role
   */
  renderNavAuth() {
    const adminLink = document.querySelector('nav a[data-path="quan-tri"]');
    if (adminLink) {
      if (this.isAdmin()) {
        adminLink.style.display = "flex";
      } else {
        adminLink.style.display = "none";
      }
    }
  }
};
