/**
 * ===================================================================
 * SÂN BÓNG NHÀ MÁY NƯỚC – YÊN PHÚ
 * Logic tương tác trang quản trị (admin.js)
 * Kết nối API Backend FastAPI - Bảo vệ bằng JWT Admin RBAC
 * ===================================================================
 */

// Bộ nhớ đệm danh sách đơn đặt sân để lọc nhanh
let allAdminBookings = [];
let currentFilter = "all";
let selectedQuickAddPitchId = 1;

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Kiểm tra quyền Quản trị viên (RBAC Check)
  if (!API.isLoggedIn() || !API.isAdmin()) {
    console.warn("[Admin Guard] Từ chối truy cập: Người dùng chưa đăng nhập hoặc không có role 'admin'.");
    alert("Khu vực quản trị chỉ dành cho tài khoản Admin! Vui lòng đăng nhập.");
    window.location.href = "login.html?redirect=admin.html&error=unauthorized";
    return;
  }

  // 2. Render góc phải Header và thanh điều hướng
  API.renderHeaderAuth();
  API.renderNavAuth();
  highlightActiveNav();

  // 3. Khởi tạo dữ liệu Dashboard & Danh sách Đơn đặt sân từ Backend
  await loadDashboard();
  await loadBookings();

  // 4. Thiết lập sự kiện tương tác
  setupQuickAddModal();
  setupPitchPickers();
});

/**
 * Hiển thị Toast thông báo nhanh ở góc màn hình
 */
function showToast(msg) {
  const toast = document.getElementById("adminToast");
  const label = document.getElementById("toastMsg");
  if (!toast || !label) return;

  label.textContent = msg;
  toast.classList.remove("hidden");
  toast.classList.add("flex");

  setTimeout(() => {
    toast.classList.add("hidden");
    toast.classList.remove("flex");
  }, 3000);
}

/**
 * Tải dữ liệu Thống kê Dashboard hôm nay từ FastAPI Backend
 */
async function loadDashboard() {
  try {
    const summary = await API.getAdminDashboard();
    
    // Cập nhật tên Admin
    const adminNameEl = document.getElementById("admin-display-name");
    if (adminNameEl && summary.admin_name) {
      adminNameEl.textContent = summary.admin_name;
    }

    // Doanh thu dự kiến
    const projectedRevEl = document.getElementById("stat-projected-revenue");
    if (projectedRevEl) {
      projectedRevEl.innerHTML = `${UTILS.formatPrice(summary.total_revenue_projected)}`;
    }

    // Tiền đã thu
    const collectedRevEl = document.getElementById("stat-collected-revenue");
    if (collectedRevEl) {
      collectedRevEl.textContent = `Đã thu: ${UTILS.formatPrice(summary.collected_amount)}`;
    }

    // Số khung giờ / lượt đặt hôm nay
    const slotsCountEl = document.getElementById("stat-slots-count");
    if (slotsCountEl) {
      slotsCountEl.textContent = `${summary.total_bookings_count} Lượt đặt`;
    }

    // Thanh tiến độ thu tiền
    const progressBar = document.getElementById("stat-progress-bar");
    if (progressBar) {
      const percent = summary.total_revenue_projected > 0 
        ? Math.min(100, Math.round((summary.collected_amount / summary.total_revenue_projected) * 100))
        : 0;
      progressBar.style.width = `${percent}%`;
    }

    // Thống kê theo sân (Sân 1 & Sân 2)
    if (summary.pitch_metrics && summary.pitch_metrics.length >= 2) {
      const p1 = summary.pitch_metrics[0];
      const p2 = summary.pitch_metrics[1];
      
      const p1Count = document.getElementById("stat-pitch-1-count");
      if (p1Count) p1Count.textContent = `${p1.booked_count} Lượt`;

      const p2Count = document.getElementById("stat-pitch-2-count");
      if (p2Count) p2Count.textContent = `${p2.booked_count} Lượt`;
    }
  } catch (error) {
    console.error("[Dashboard] Lỗi tải thống kê:", error.message);
  }
}

/**
 * Tải danh sách đơn đặt sân từ Backend
 */
async function loadBookings() {
  const container = document.getElementById("admin-bookings-list");
  if (!container) return;

  container.innerHTML = `
    <div class="py-10 text-center text-on-surface-variant flex flex-col items-center justify-center gap-2">
      <span class="material-symbols-outlined text-[28px] animate-spin text-primary">progress_activity</span>
      <p class="font-body-sm">Đang đồng bộ đơn đặt sân từ hệ thống...</p>
    </div>
  `;

  try {
    const bookings = await API.getAdminBookings();
    allAdminBookings = bookings || [];
    renderBookingsList();
  } catch (error) {
    container.innerHTML = `
      <div class="p-4 rounded-DEFAULT bg-surface-container-high text-center">
        <span class="material-symbols-outlined text-error text-[28px]">error</span>
        <p class="text-error font-body-sm mt-1">Không thể tải danh sách đặt sân (${error.message}).</p>
        <button onclick="loadBookings()" class="mt-3 px-4 py-1.5 rounded-full bg-primary text-on-primary font-label-sm uppercase font-bold shadow">
          Thử Lại
        </button>
      </div>
    `;
  }
}

/**
 * Hiển thị danh sách thẻ đơn đặt sân theo bộ lọc
 */
function renderBookingsList() {
  const container = document.getElementById("admin-bookings-list");
  if (!container) return;

  // Cập nhật nhãn số lượng trên các nút lọc
  const totalCount = allAdminBookings.length;
  const p1Count = allAdminBookings.filter((b) => (b.pitch_id === 1 || (b.pitch_name && b.pitch_name.includes("1")))).length;
  const p2Count = allAdminBookings.filter((b) => (b.pitch_id === 2 || (b.pitch_name && b.pitch_name.includes("2")))).length;

  const btnAll = document.querySelector('button[data-filter="all"]');
  const btnP1 = document.querySelector('button[data-filter="san1"]');
  const btnP2 = document.querySelector('button[data-filter="san2"]');

  if (btnAll) btnAll.textContent = `Tất Cả (${totalCount})`;
  if (btnP1) btnP1.textContent = `Sân 1 (${p1Count})`;
  if (btnP2) btnP2.textContent = `Sân 2 (${p2Count})`;

  // Lọc theo tab đang chọn
  let filtered = allAdminBookings;
  if (currentFilter === "san1") {
    filtered = allAdminBookings.filter((b) => b.pitch_id === 1 || (b.pitch_name && b.pitch_name.includes("1")));
  } else if (currentFilter === "san2") {
    filtered = allAdminBookings.filter((b) => b.pitch_id === 2 || (b.pitch_name && b.pitch_name.includes("2")));
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="py-8 text-center text-on-surface-variant bg-surface-container rounded-lg p-6">
        <span class="material-symbols-outlined text-[36px] text-outline mb-2">sports_soccer</span>
        <p class="font-body-md text-on-surface font-semibold">Chưa có đơn đặt sân nào phù hợp.</p>
        <p class="font-body-sm text-outline mt-0.5">Các đơn đặt sân mới từ khách hàng sẽ xuất hiện ngay tại đây.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = "";
  filtered.forEach((b) => {
    const card = document.createElement("div");
    card.className = "booking-card rounded-lg bg-surface-container p-space-md shadow-md flex flex-col space-y-space-sm border border-surface-container-highest/60";

    // Phân loại trạng thái
    let statusBadge = "";
    let actionButtons = "";

    const startTimeFormatted = b.start_time ? b.start_time.slice(0, 5) : "--:--";
    const endTimeFormatted = b.end_time ? b.end_time.slice(0, 5) : "--:--";
    const bookingDateFormatted = UTILS.formatDateDisplay(b.booking_date);

    if (b.status === "pending") {
      statusBadge = `<span class="px-2.5 py-0.5 rounded-full bg-tertiary-container/80 text-on-tertiary-container font-label-sm text-label-sm font-bold">Chờ duyệt</span>`;
      actionButtons = `
        <div class="grid grid-cols-2 gap-2 pt-1">
          <button class="py-2.5 rounded-full bg-primary text-on-primary font-label-md text-label-md flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-transform" onclick="updateStatus(${b.id}, 'confirmed')">
            <span class="material-symbols-outlined text-[16px]">check_circle</span> Duyệt Đơn
          </button>
          <button class="py-2.5 rounded-full bg-error-container text-on-error-container font-label-md text-label-md flex items-center justify-center gap-1 hover:opacity-90 active:scale-95 transition-transform" onclick="cancelBooking(${b.id})">
            <span class="material-symbols-outlined text-[16px]">cancel</span> Hủy Đơn
          </button>
        </div>
      `;
    } else if (b.status === "confirmed") {
      statusBadge = `<span class="px-2.5 py-0.5 rounded-full bg-primary/20 text-primary font-label-sm text-label-sm font-bold">Đã duyệt / Giữ chỗ</span>`;
      actionButtons = `
        <div class="grid grid-cols-2 gap-2 pt-1">
          <button class="py-2.5 rounded-full bg-surface-container-highest text-primary hover:bg-surface-bright font-label-md text-label-md flex items-center justify-center gap-1 active:scale-95 transition-transform" onclick="updateStatus(${b.id}, 'completed')">
            <span class="material-symbols-outlined text-[16px]">how_to_reg</span> Check-in / Hoàn Tất
          </button>
          <button class="py-2.5 rounded-full bg-surface-container-high text-error hover:bg-error-container/20 font-label-md text-label-md flex items-center justify-center gap-1 active:scale-95 transition-transform" onclick="cancelBooking(${b.id})">
            <span class="material-symbols-outlined text-[16px]">cancel</span> Hủy
          </button>
        </div>
      `;
    } else if (b.status === "completed") {
      statusBadge = `<span class="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-bold">Đã hoàn thành</span>`;
      actionButtons = `
        <div class="text-right pt-1">
          <span class="font-label-sm text-outline text-[12px]">Trận đấu đã kết thúc & thanh toán đủ</span>
        </div>
      `;
    } else {
      statusBadge = `<span class="px-2.5 py-0.5 rounded-full bg-surface-variant text-outline font-label-sm text-label-sm">Đã hủy</span>`;
      actionButtons = `
        <div class="text-right pt-1">
          <span class="font-label-sm text-outline text-[12px]">Đơn này đã hủy hoặc không nhận sân</span>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="flex items-start justify-between gap-space-sm">
        <div class="flex flex-col min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="font-headline-sm text-headline-sm text-primary font-mono">#YP-${b.id}</span>
            <span class="px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface font-label-sm text-label-sm font-semibold truncate">
              ${b.pitch_name || "Sân bóng"}
            </span>
          </div>
          <span class="font-headline-sm text-headline-sm text-on-surface mt-1">
            ${startTimeFormatted} - ${endTimeFormatted} (${bookingDateFormatted})
          </span>
          <div class="flex flex-wrap items-center gap-1.5 text-on-surface-variant font-body-sm text-body-sm mt-0.5">
            <span class="material-symbols-outlined text-[15px] text-secondary">person</span>
            <span class="font-semibold text-on-surface">${b.customer_name}</span>
            <span class="text-outline">•</span>
            <a class="text-primary hover:underline font-mono" href="tel:${b.customer_phone}">${b.customer_phone}</a>
          </div>
          ${b.note ? `<p class="font-body-sm text-outline text-xs mt-1 italic">Ghi chú: "${b.note}"</p>` : ""}
        </div>
        <div class="text-right flex flex-col items-end flex-shrink-0">
          <span class="font-headline-sm text-headline-sm text-primary font-bold">${UTILS.formatPrice(b.total_price)}</span>
          <div class="mt-1">${statusBadge}</div>
        </div>
      </div>
      ${actionButtons}
    `;

    container.appendChild(card);
  });
}

/**
 * Bộ lọc danh sách đặt sân (Tất cả, Sân 1, Sân 2)
 */
function setPitchFilter(type) {
  currentFilter = type;
  const buttons = document.querySelectorAll(".pitch-filter-btn");
  buttons.forEach((btn) => {
    if (btn.getAttribute("data-filter") === type) {
      btn.className = "pitch-filter-btn flex-1 py-2 rounded-full font-label-md text-label-md text-center bg-primary text-on-primary transition-colors shadow-sm";
    } else {
      btn.className = "pitch-filter-btn flex-1 py-2 rounded-full font-label-md text-label-md text-center text-on-surface-variant hover:text-on-surface transition-colors";
    }
  });

  renderBookingsList();
}

/**
 * Cập nhật trạng thái đơn đặt sân (Duyệt: confirmed, Hoàn thành: completed)
 */
async function updateStatus(bookingId, newStatus) {
  const statusLabels = {
    confirmed: "Duyệt đơn giữ chỗ",
    completed: "Hoàn tất trận đấu & check-in"
  };

  try {
    await API.updateBookingStatus(bookingId, newStatus);
    showToast(`Đã ${statusLabels[newStatus] || newStatus} đơn #YP-${bookingId}!`);
    await loadDashboard();
    await loadBookings();
  } catch (error) {
    alert(`Không thể cập nhật đơn: ${error.message}`);
  }
}

/**
 * Hủy đơn đặt sân
 */
async function cancelBooking(bookingId) {
  if (!confirm(`Bạn có chắc chắn muốn HỦY đơn đặt sân #YP-${bookingId}?`)) {
    return;
  }

  try {
    await API.deleteBooking(bookingId);
    showToast(`Đã hủy đơn đặt sân #YP-${bookingId}! Khung giờ đã được giải phóng.`);
    await loadDashboard();
    await loadBookings();
  } catch (error) {
    alert(`Không thể hủy đơn: ${error.message}`);
  }
}

/**
 * Bật / tắt chế độ bảo dưỡng mặt sân hoặc dàn đèn
 */
async function toggleMaintenance(pitchId, btn) {
  const isMaintenance = btn.textContent.includes("Hoạt Động");
  const newStatus = isMaintenance ? "active" : "maintenance";

  try {
    await API.updatePitch(pitchId, { status: newStatus });
    if (newStatus === "maintenance") {
      btn.textContent = "Mở Hoạt Động";
      btn.classList.add("bg-error-container", "text-on-error-container");
      showToast(`Sân ${pitchId} đã chuyển sang chế độ BẢO TRÌ! Khách không thể đặt giờ.`);
    } else {
      btn.textContent = "Chuyển: Bảo Trì";
      btn.classList.remove("bg-error-container", "text-on-error-container");
      showToast(`Sân ${pitchId} đã mở HOẠT ĐỘNG sẵn sàng đón trận!`);
    }
    await loadDashboard();
  } catch (error) {
    alert(`Không thể cập nhật trạng thái sân: ${error.message}`);
  }
}

/**
 * Thiết lập Modal thêm đơn đặt sân trực tiếp tại quầy
 */
function setupQuickAddModal() {
  const modal = document.getElementById("quickAddModal");
  const btnQuickAdd = document.getElementById("btnQuickAdd");
  const btnCloseModal = document.getElementById("btnCloseModal");
  const btnConfirm = document.getElementById("btnConfirmQuickAdd");

  if (btnQuickAdd && modal) {
    btnQuickAdd.addEventListener("click", () => {
      modal.classList.remove("hidden");
    });
  }

  if (btnCloseModal && modal) {
    btnCloseModal.addEventListener("click", () => {
      modal.classList.add("hidden");
    });
  }

  if (btnConfirm && modal) {
    btnConfirm.addEventListener("click", async () => {
      const nameInput = modal.querySelector('input[placeholder*="tên khách"]');
      const phoneInput = modal.querySelector('input[type="tel"]');
      const startInput = modal.querySelector('input[value="18:00"]');
      const endInput = modal.querySelector('input[value="19:30"]');

      const name = nameInput ? nameInput.value.trim() : "";
      const phone = phoneInput ? phoneInput.value.trim() : "";
      const start = startInput ? startInput.value : "18:00";
      const end = endInput ? endInput.value : "19:30";

      if (!name || name.length < 2) {
        alert("Vui lòng nhập Tên khách hàng hoặc tên Đội bóng (tối thiểu 2 ký tự)!");
        return;
      }
      if (!phone || phone.length < 9) {
        alert("Vui lòng nhập Số điện thoại liên hệ hợp lệ!");
        return;
      }

      btnConfirm.disabled = true;
      btnConfirm.textContent = "Đang lưu...";

      try {
        await API.createBooking({
          pitch_id: Number(selectedQuickAddPitchId),
          booking_date: UTILS.getLocalDateString(),
          start_time: start,
          end_time: end,
          customer_name: name,
          customer_phone: phone,
          note: "Đặt trực tiếp tại quầy BQL",
          payment_method: "cash"
        });

        modal.classList.add("hidden");
        showToast("Đã thêm đơn đặt sân mới thành công vào hệ thống!");
        
        // Reset form
        if (nameInput) nameInput.value = "";
        if (phoneInput) phoneInput.value = "";

        await loadDashboard();
        await loadBookings();
      } catch (error) {
        alert(`Không thể tạo đơn: ${error.message}`);
      } finally {
        btnConfirm.disabled = false;
        btnConfirm.textContent = "Lưu & Giữ Sân Ngay";
      }
    });
  }
}

/**
 * Chọn nút chuyển đổi Sân 1 / Sân 2 trong modal thêm nhanh
 */
function setupPitchPickers() {
  const pitchPickers = document.querySelectorAll(".modal-pitch-sel");
  pitchPickers.forEach((p) => {
    p.addEventListener("click", () => {
      pitchPickers.forEach((item) => {
        item.classList.remove("bg-primary", "text-on-primary");
        item.classList.add("bg-surface-container-highest", "text-on-surface");
      });
      p.classList.add("bg-primary", "text-on-primary");
      p.classList.remove("bg-surface-container-highest", "text-on-surface");
      selectedQuickAddPitchId = Number(p.getAttribute("data-val") || "1");
    });
  });
}

/**
 * Đánh dấu nút Quản Trị đang active ở footer
 */
function highlightActiveNav() {
  const navLinks = document.querySelectorAll("nav a");
  navLinks.forEach((link) => {
    if (link.getAttribute("data-path") === "quan-tri") {
      link.classList.add("text-primary", "font-bold");
      link.classList.remove("text-on-surface-variant");
    }
  });
}
