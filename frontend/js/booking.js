/**
 * ===================================================================
 * SÂN BÓNG NHÀ MÁY NƯỚC – YÊN PHÚ
 * Logic tương tác trang đặt sân & thanh toán (booking.js)
 * ===================================================================
 */

let selectedMethod = "qr";

// Thông tin trận đấu hiện tại
let bookingContext = {
  pitchId: 1,
  pitchName: "Sân 1 (Sân 7 Cỏ Nhân Tạo)",
  date: "Hôm nay, 04/11",
  isoDate: new Date().toISOString().split('T')[0],
  timeSlot: "18:00 - 20:00",
  startTime: "18:00",
  endTime: "20:00",
  unitPrice: "380.000đ",
  totalPrice: 760000,
  formattedPrice: "760.000đ"
};

document.addEventListener("DOMContentLoaded", () => {
  readQueryParams();
  highlightActiveNav();
});

/**
 * Đọc tham số URL hoặc LocalStorage nếu khách chuyển từ index.html sang
 */
function readQueryParams() {
  const params = new URLSearchParams(window.location.search);
  
  if (params.has("pitchName")) {
    bookingContext.pitchName = params.get("pitchName");
  }
  if (params.has("time")) {
    bookingContext.timeSlot = params.get("time");
    const parts = bookingContext.timeSlot.split("-").map(p => p.trim());
    if (parts.length === 2) {
      bookingContext.startTime = parts[0];
      bookingContext.endTime = parts[1];
    }
  }
  if (params.has("price")) {
    bookingContext.formattedPrice = params.get("price");
  }

  // Cập nhật lên UI nếu các phần tử tồn tại
  const pitchTitleEl = document.querySelector(".font-headline-sm.text-on-surface");
  if (pitchTitleEl && params.has("pitchName")) {
    pitchTitleEl.textContent = bookingContext.pitchName;
  }
}

/**
 * Lựa chọn phương thức thanh toán: QR hoặc Tiền mặt
 */
function selectPayment(method) {
  selectedMethod = method;
  const cashCard = document.getElementById("pay-opt-cash");
  const qrCard = document.getElementById("pay-opt-qr");
  const checkCash = document.getElementById("check-cash");
  const checkQr = document.getElementById("check-qr");
  const qrDetails = document.getElementById("qr-bank-details");

  if (!cashCard || !qrCard) return;

  if (method === "cash") {
    cashCard.className =
      "cursor-pointer transition-all p-3.5 rounded-DEFAULT bg-surface-container-lowest shadow-md flex items-center justify-between";
    qrCard.className =
      "cursor-pointer transition-all p-3.5 rounded-DEFAULT bg-surface-container-high hover:bg-surface-container-highest flex items-center justify-between";

    checkCash.className =
      "w-5 h-5 rounded-full bg-primary text-on-primary flex items-center justify-center";
    checkQr.className =
      "w-5 h-5 rounded-full bg-surface-variant flex items-center justify-center text-surface-variant";

    if (qrDetails) qrDetails.style.display = "none";
  } else {
    qrCard.className =
      "cursor-pointer transition-all p-3.5 rounded-DEFAULT bg-surface-container-lowest shadow-md flex items-center justify-between";
    cashCard.className =
      "cursor-pointer transition-all p-3.5 rounded-DEFAULT bg-surface-container-high hover:bg-surface-container-highest flex items-center justify-between";

    checkQr.className =
      "w-5 h-5 rounded-full bg-primary text-on-primary flex items-center justify-center";
    checkCash.className =
      "w-5 h-5 rounded-full bg-surface-variant flex items-center justify-center text-surface-variant";

    if (qrDetails) qrDetails.style.display = "flex";
  }
}

/**
 * Xử lý xác nhận đặt sân
 */
function submitBooking() {
  const nameInput = document.getElementById("captain-name");
  const phoneInput = document.getElementById("captain-phone");
  const notesInput = document.getElementById("booking-notes");

  const name = nameInput ? nameInput.value.trim() : "";
  const phone = phoneInput ? phoneInput.value.trim() : "";
  const notes = notesInput ? notesInput.value.trim() : "";

  if (!name || !phone) {
    alert("Vui lòng nhập đầy đủ Họ tên và Số điện thoại nhận mã sân!");
    return;
  }

  // Tạo mã vé ngẫu nhiên theo ngày
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  const ticketCode = `#YP-${dateStr}-${randomSuffix}`;

  // Đóng gói dữ liệu đặt sân
  const bookingData = {
    ticketCode: ticketCode,
    pitch: bookingContext.pitchName,
    date: bookingContext.date,
    timeSlot: bookingContext.timeSlot,
    totalPrice: bookingContext.formattedPrice,
    captainName: name,
    phone: phone,
    notes: notes,
    paymentMethod: selectedMethod === "qr" ? "Chuyển khoản QR ngân hàng" : "Tiền mặt tại sân",
    status: "Chờ xác nhận",
    createdAt: new Date().toISOString()
  };

  try {
    localStorage.setItem(CONFIG.STORAGE_KEYS.CURRENT_BOOKING, JSON.stringify(bookingData));
  } catch (e) {
    console.warn("LocalStorage unavailable:", e);
  }

  // Cập nhật thông tin lên Ticket Modal
  const ticketName = document.getElementById("ticket-name");
  const ticketPayment = document.getElementById("ticket-payment");
  const ticketDisplay = document.getElementById("ticket-code-display");

  if (ticketName) ticketName.textContent = name;
  if (ticketPayment) {
    ticketPayment.textContent = selectedMethod === "qr"
      ? `QR Chuyển Khoản (${bookingContext.formattedPrice})`
      : `Tiền mặt tại sân (${bookingContext.formattedPrice})`;
  }
  if (ticketDisplay) ticketDisplay.textContent = ticketCode;

  // Hiển thị Popup thành công
  const modal = document.getElementById("success-modal");
  if (modal) modal.classList.remove("hidden");
}

/**
 * Đóng Modal xác nhận
 */
function closeModal() {
  const modal = document.getElementById("success-modal");
  if (modal) modal.classList.add("hidden");
}

/**
 * Đánh dấu nút Đặt Sân đang active ở footer
 */
function highlightActiveNav() {
  const navLinks = document.querySelectorAll("nav a");
  navLinks.forEach((link) => {
    if (link.getAttribute("data-path") === "dat-san") {
      link.classList.add("text-primary", "font-bold");
      link.classList.remove("text-on-surface-variant");
    }
  });
}

