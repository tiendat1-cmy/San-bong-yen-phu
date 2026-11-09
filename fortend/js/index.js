/**
 * ===================================================================
 * SÂN BÓNG NHÀ MÁY NƯỚC – YÊN PHÚ
 * Logic tương tác trang chủ (index.js)
 * Kết nối API Backend FastAPI
 * ===================================================================
 */

// Trạng thái toàn cục trang chủ
let allPitches = [];
let currentPitchId = null;
let currentPitchName = "";
let selectedDate = UTILS.getLocalDateString();
let selectedStartTime = "16:00";
let selectedEndTime = "17:30";
let selectedPrice = 450000;

document.addEventListener("DOMContentLoaded", () => {
  API.renderHeaderAuth();
  API.renderNavAuth();
  initDynamicDates();
  setupDateSelectors();
  highlightActiveNav();
  initPitches();
});

/**
 * Khởi tạo hiển thị các ngày (Hôm nay, Ngày mai, ...) theo giờ địa phương
 */
function initDynamicDates() {
  const dateButtons = document.querySelectorAll("#date-selector button");
  if (!dateButtons || dateButtons.length === 0) return;

  const today = new Date();
  const dayNames = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

  dateButtons.forEach((btn, index) => {
    const targetDate = new Date();
    targetDate.setDate(today.getDate() + index);

    const dayOfWeek = dayNames[targetDate.getDay()];
    const dateFormatted = `${String(targetDate.getDate()).padStart(2, "0")}/${String(targetDate.getMonth() + 1).padStart(2, "0")}`;
    const isoDate = UTILS.getLocalDateString(targetDate);

    btn.dataset.date = isoDate;
    const dayLabel = btn.querySelector(".font-headline-sm");
    const dateLabel = btn.querySelector(".font-label-sm:last-child");

    if (dayLabel) dayLabel.textContent = dayOfWeek;
    if (dateLabel) dateLabel.textContent = dateFormatted;

    // Gán ngày mặc định là hôm nay cho nút đầu tiên
    if (index === 0) {
      selectedDate = isoDate;
    }
  });
}

/**
 * Xử lý sự kiện click chuyển ngày
 */
function setupDateSelectors() {
  const buttons = document.querySelectorAll("#date-selector button");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => {
        b.className = "flex-1 min-w-[70px] py-2.5 px-2 rounded-DEFAULT bg-surface-container hover:bg-surface-container-high text-on-surface flex flex-col items-center active:scale-95 transition-all";
        const label = b.querySelector(".font-label-sm");
        if (label) label.className = "font-label-sm text-label-sm text-outline uppercase";
      });

      btn.className = "flex-1 min-w-[70px] py-2.5 px-2 rounded-DEFAULT bg-primary text-on-primary flex flex-col items-center shadow-md active:scale-95 transition-all";
      const activeLabel = btn.querySelector(".font-label-sm");
      if (activeLabel) activeLabel.className = "font-label-sm text-label-sm uppercase font-bold";

      if (btn.dataset.date) {
        selectedDate = btn.dataset.date;
        loadSlots();
      }
    });
  });
}

/**
 * Tải danh sách sân bóng từ Backend và dựng lại các Tab chọn sân
 */
async function initPitches() {
  const tabsContainer = document.getElementById("pitch-tabs-container");

  try {
    const pitches = await API.getPitches();
    allPitches = pitches.filter((p) => p.status !== "maintenance");

    if (allPitches.length === 0) {
      allPitches = pitches; // Nếu tất cả bảo trì thì vẫn hiển thị
    }

    if (tabsContainer && allPitches.length > 0) {
      tabsContainer.innerHTML = "";
      allPitches.forEach((pitch, index) => {
        const isFirst = index === 0;
        const btn = document.createElement("button");
        btn.id = `tab-pitch-${pitch.id}`;
        btn.className = isFirst
          ? "py-2 px-3 rounded-full bg-primary text-on-primary font-label-md text-label-md uppercase font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
          : "py-2 px-3 rounded-full bg-surface-container text-on-surface-variant font-label-md text-label-md uppercase font-bold flex items-center justify-center gap-1.5 transition-all";
        btn.innerHTML = `
          <span class="material-symbols-outlined text-[16px]">sports_soccer</span>
          <span>${pitch.pitch_name}</span>
        `;
        btn.addEventListener("click", () => switchPitch(pitch.id));
        tabsContainer.appendChild(btn);
      });

      currentPitchId = allPitches[0].id;
      currentPitchName = allPitches[0].pitch_name;
    } else {
      currentPitchId = 1;
      currentPitchName = "Sân 1 (7 Pro)";
    }

    // Sau khi có sân, tải danh sách khung giờ ngay
    loadSlots();
  } catch (error) {
    console.warn("[Pitches] Không thể tải danh sách sân:", error.message);
    currentPitchId = 1;
    currentPitchName = "Sân 1 (7 Pro)";
    loadSlots();
  }
}

/**
 * Chuyển tab sân bóng được chọn
 */
function switchPitch(pitchId) {
  currentPitchId = pitchId;
  const targetPitch = allPitches.find((p) => p.id === pitchId);
  if (targetPitch) {
    currentPitchName = targetPitch.pitch_name;
  }

  // Cập nhật style nút tab
  allPitches.forEach((p) => {
    const tab = document.getElementById(`tab-pitch-${p.id}`);
    if (tab) {
      if (p.id === pitchId) {
        tab.className = "py-2 px-3 rounded-full bg-primary text-on-primary font-label-md text-label-md uppercase font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm";
      } else {
        tab.className = "py-2 px-3 rounded-full bg-surface-container text-on-surface-variant font-label-md text-label-md uppercase font-bold flex items-center justify-center gap-1.5 transition-all";
      }
    }
  });

  const summaryPitch = document.getElementById("summary-pitch");
  if (summaryPitch) summaryPitch.textContent = currentPitchName;

  loadSlots();
}

/**
 * Tải danh sách khung giờ trống từ Backend API
 */
async function loadSlots() {
  const container = document.getElementById("slots-container");
  if (!container) return;

  // Hiển thị trạng thái đang tải
  container.innerHTML = `
    <div class="col-span-2 py-8 text-center text-on-surface-variant flex flex-col items-center justify-center gap-2">
      <span class="material-symbols-outlined text-[28px] animate-spin text-primary">progress_activity</span>
      <p class="font-body-sm">Đang tải lịch sân ${currentPitchName}...</p>
    </div>
  `;

  try {
    const slots = await API.getSlots(selectedDate, currentPitchId);

    if (!slots || slots.length === 0) {
      container.innerHTML = `
        <div class="col-span-2 py-8 text-center text-on-surface-variant">
          Chưa có khung giờ nào cho sân này trong ngày ${UTILS.formatDateDisplay(selectedDate)}.
        </div>
      `;
      return;
    }

    container.innerHTML = "";
    slots.forEach((slot) => {
      const card = document.createElement("div");

      if (slot.is_available) {
        // Khung giờ còn trống -> Cho phép chọn
        card.className = "slot-card p-3 rounded-DEFAULT bg-surface-container hover:bg-surface-container-high transition-all cursor-pointer flex flex-col justify-between";
        card.innerHTML = `
          <div class="flex items-center justify-between mb-1">
            <span class="font-label-md text-label-md font-bold text-on-surface">${slot.start_time} - ${slot.end_time}</span>
            <span class="w-2 h-2 rounded-full bg-primary"></span>
          </div>
          <div class="flex items-center justify-between">
            <span class="font-label-sm text-label-sm text-primary uppercase font-bold">${slot.status_label || "Trống sân"}</span>
            <span class="font-label-sm text-label-sm text-on-surface-variant">${UTILS.formatPrice(slot.price)}/trận</span>
          </div>
        `;
        card.addEventListener("click", () => {
          selectSlot(card, slot.start_time, slot.end_time, slot.price);
        });
      } else {
        // Khung giờ đã được đặt -> Làm mờ & khóa chọn
        card.className = "p-3 rounded-DEFAULT bg-surface-container-lowest opacity-55 flex flex-col justify-between cursor-not-allowed";
        card.innerHTML = `
          <div class="flex items-center justify-between mb-1">
            <span class="font-label-md text-label-md font-bold line-through text-on-surface-variant">${slot.start_time} - ${slot.end_time}</span>
            <span class="material-symbols-outlined text-outline text-[16px]">lock</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="font-label-sm text-label-sm text-outline uppercase font-semibold">${slot.status_label || "Đã có đội đặt"}</span>
            <span class="font-label-sm text-label-sm text-outline truncate max-w-[120px]">${slot.booked_by || "Đã kín sân"}</span>
          </div>
        `;
      }

      container.appendChild(card);
    });
  } catch (error) {
    container.innerHTML = `
      <div class="col-span-2 p-4 rounded-DEFAULT bg-surface-container-high text-center">
        <span class="material-symbols-outlined text-error text-[28px]">error</span>
        <p class="text-error font-body-sm mt-1">Không thể kết nối máy chủ Backend (${error.message}).</p>
        <p class="text-outline font-label-sm mt-0.5">Vui lòng đảm bảo FastAPI backend đang chạy tại ${CONFIG.API_BASE_URL}</p>
        <button onclick="loadSlots()" class="mt-3 px-4 py-1.5 rounded-full bg-primary text-on-primary font-label-sm uppercase font-bold shadow active:scale-95 transition-all">
          Thử Lại
        </button>
      </div>
    `;
  }
}

/**
 * Chọn khung giờ đá trên ma trận
 */
function selectSlot(element, startTime, endTime, price) {
  // 1. Kiểm tra đăng nhập (Bảo vệ luồng đặt sân - chống nặc danh / đơn rác)
  if (!API.isLoggedIn()) {
    const bookingQuery = new URLSearchParams({
      pitchId: currentPitchId,
      pitchName: currentPitchName,
      date: selectedDate,
      start: startTime,
      end: endTime,
      price: price
    }).toString();

    // Lưu vào LocalStorage
    localStorage.setItem(CONFIG.STORAGE_KEYS.CURRENT_BOOKING, JSON.stringify({
      pitchId: currentPitchId,
      pitchName: currentPitchName,
      date: selectedDate,
      startTime: startTime,
      endTime: endTime,
      price: price
    }));

    // Chuyển hướng tới trang Đăng nhập kèm link quay lại
    window.location.href = `login.html?redirect=${encodeURIComponent("booking.html?" + bookingQuery)}`;
    return;
  }

  document.querySelectorAll(".slot-card").forEach((el) => {
    el.classList.remove("bg-secondary-container", "ring-2", "ring-primary");
    el.classList.add("bg-surface-container");
  });

  element.classList.remove("bg-surface-container");
  element.classList.add("bg-secondary-container");

  selectedStartTime = startTime;
  selectedEndTime = endTime;
  selectedPrice = price;

  const summaryPitch = document.getElementById("summary-pitch");
  const summaryTime = document.getElementById("summary-time");
  const summaryPrice = document.getElementById("summary-price");

  if (summaryPitch) summaryPitch.textContent = currentPitchName;
  if (summaryTime) summaryTime.textContent = `${startTime} - ${endTime}`;
  if (summaryPrice) summaryPrice.textContent = UTILS.formatPrice(price);

  // Tự động điền họ tên và số điện thoại của người dùng đã đăng nhập vào form Drawer
  const user = API.getStoredUser();
  if (user) {
    const nameInput = document.getElementById("cust-name");
    const phoneInput = document.getElementById("cust-phone");
    if (nameInput && !nameInput.value) nameInput.value = user.full_name || "";
    if (phoneInput && !phoneInput.value) phoneInput.value = user.phone || "";
  }

  openDrawer();
}

/**
 * Mở và đóng Booking Drawer
 */
function openDrawer() {
  const drawer = document.getElementById("booking-drawer");
  if (drawer) drawer.classList.remove("hidden");
}

function closeDrawer() {
  const drawer = document.getElementById("booking-drawer");
  if (drawer) drawer.classList.add("hidden");
}

/**
 * Xác nhận gửi đặt sân từ Drawer trang chủ lên Backend
 */
async function confirmBooking() {
  // 1. Kiểm tra đăng nhập
  if (!API.isLoggedIn()) {
    alert("Vui lòng đăng nhập tài khoản trước khi hoàn tất đặt sân!");
    goToDetailedBooking();
    return;
  }

  const nameInput = document.getElementById("cust-name");
  const phoneInput = document.getElementById("cust-phone");
  const noteInput = document.getElementById("cust-note");
  const btnConfirm = document.getElementById("btn-confirm-drawer");
  const btnText = document.getElementById("btn-confirm-text");
  const btnIcon = document.getElementById("btn-confirm-icon");

  const name = nameInput ? nameInput.value.trim() : "";
  const phone = phoneInput ? phoneInput.value.trim().replace(/\s+/g, "") : "";
  const note = noteInput ? noteInput.value.trim() : "";

  // Kiểm tra họ tên
  if (!name || name.length < 2) {
    alert("Vui lòng nhập Họ tên Đội trưởng / Người đặt (tối thiểu 2 ký tự)!");
    if (nameInput) nameInput.focus();
    return;
  }

  // Kiểm tra số điện thoại (9 đến 15 chữ số)
  const phoneRegex = /^[0-9]{9,15}$/;
  if (!phone || !phoneRegex.test(phone)) {
    alert("Số điện thoại không hợp lệ! Vui lòng nhập từ 9 đến 15 chữ số.");
    if (phoneInput) phoneInput.focus();
    return;
  }

  // Đặt trạng thái đang tải
  if (btnConfirm) btnConfirm.disabled = true;
  if (btnText) btnText.textContent = "Đang gửi yêu cầu giữ chỗ...";
  if (btnIcon) btnIcon.textContent = "progress_activity";
  if (btnIcon) btnIcon.classList.add("animate-spin");

  try {
    const bookingPayload = {
      pitch_id: Number(currentPitchId),
      booking_date: selectedDate,
      start_time: selectedStartTime,
      end_time: selectedEndTime,
      customer_name: name,
      customer_phone: phone,
      note: note || undefined,
      payment_method: "cash"
    };

    const response = await API.createBooking(bookingPayload);

    // Thành công -> Đóng drawer, reset form
    closeDrawer();
    if (noteInput) noteInput.value = "";

    // Hiển thị Toast thông báo kèm mã đơn thật từ Database
    const toast = document.getElementById("booking-toast");
    const toastTitle = document.getElementById("toast-title");
    const toastDesc = document.getElementById("toast-desc");

    if (toastTitle) toastTitle.textContent = `Đặt Sân Thành Công! (Mã #${response.id})`;
    if (toastDesc) toastDesc.textContent = `Sân bóng Yên Phú đã ghi nhận đơn của ${response.customer_name}. Hotline 0988.123.456 sẽ liên hệ xác nhận!`;

    if (toast) {
      toast.classList.remove("hidden");
      setTimeout(() => {
        toast.classList.add("hidden");
      }, 5000);
    }

    // Tải lại ma trận khung giờ để ô vừa đặt chuyển sang trạng thái đã đặt
    await loadSlots();
  } catch (error) {
    alert(`Không thể đặt sân: ${error.message}`);
  } finally {
    // Khôi phục trạng thái nút
    if (btnConfirm) btnConfirm.disabled = false;
    if (btnText) btnText.textContent = "Gửi Yêu Cầu Giữ Chỗ Ngay";
    if (btnIcon) btnIcon.textContent = "check_circle";
    if (btnIcon) btnIcon.classList.remove("animate-spin");
  }
}

/**
 * Chuyển tiếp tới trang đặt sân chi tiết (booking.html) kèm đầy đủ tham số
 */
function goToDetailedBooking() {
  const params = new URLSearchParams({
    pitchId: currentPitchId,
    pitchName: currentPitchName,
    date: selectedDate,
    start: selectedStartTime,
    end: selectedEndTime,
    price: selectedPrice
  });

  if (!API.isLoggedIn()) {
    window.location.href = `login.html?redirect=${encodeURIComponent("booking.html?" + params.toString())}`;
  } else {
    window.location.href = `booking.html?${params.toString()}`;
  }
}

/**
 * Đánh dấu nút điều hướng Trang Chủ đang active ở footer
 */
function highlightActiveNav() {
  const navLinks = document.querySelectorAll("nav a");
  navLinks.forEach((link) => {
    if (link.getAttribute("data-path") === "trang-chu") {
      link.classList.add("text-primary", "font-bold");
      link.classList.remove("text-on-surface-variant");
    }
  });
}
