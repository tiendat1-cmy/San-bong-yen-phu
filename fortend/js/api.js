/**
 * ===================================================================
 * SÂN BÓNG NHÀ MÁY NƯỚC – YÊN PHÚ
 * Module API gọi Backend FastAPI (api.js)
 * ===================================================================
 */

const API = {
  /**
   * Hàm trợ giúp gửi Request với fetch
   */
  async request(endpoint, options = {}) {
    const url = `${CONFIG.API_BASE_URL}${endpoint}`;
    
    // Tự động gắn token nếu đã đăng nhập
    const token = localStorage.getItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
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

  // 3. Tạo đơn đặt sân mới
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

  // 5. Đăng ký tài khoản
  async register(userData) {
    return this.request("/auth/register", {
      method: "POST",
      body: JSON.stringify(userData)
    });
  },

  // 6. Đăng nhập
  async login(credentials) {
    return this.request("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials)
    });
  },

  // ================= QUẢN TRỊ VIÊN APIS =================

  // 7. Lấy thống kê Dashboard hôm nay
  async getAdminDashboard() {
    return this.request("/admin/dashboard");
  },

  // 8. Lấy danh sách đơn đặt sân (có thể lọc theo pitch_id hoặc date)
  async getAdminBookings(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/admin/bookings${query ? `?${query}` : ""}`);
  },

  // 9. Cập nhật trạng thái đơn (confirmed, completed, cancelled)
  async updateBookingStatus(bookingId, status) {
    return this.request(`/admin/bookings/${bookingId}`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
  },

  // 10. Hủy hoặc xóa đơn đặt sân
  async deleteBooking(bookingId) {
    return this.request(`/admin/bookings/${bookingId}`, {
      method: "DELETE"
    });
  },

  // 11. Cập nhật trạng thái hoặc thông tin sân
  async updatePitch(pitchId, pitchData) {
    return this.request(`/admin/pitches/${pitchId}`, {
      method: "PUT",
      body: JSON.stringify(pitchData)
    });
  }
};

