/**
 * ===================================================================
 * SÂN BÓNG NHÀ MÁY NƯỚC – YÊN PHÚ
 * Logic tương tác trang đặt sân & thanh toán (booking.js)
 * Kết nối API Backend FastAPI
 * ===================================================================
 */

let selectedMethod = "qr";

// Thông tin đơn đặt sân hiện tại
let bookingContext = {
  pitchId: 1,
  pitchName: "Sân 1 (7 Pro)",
  date: UTILS.getLocalDateString(),
  startTime: "18:00",
  endTime: "20:00",
  unitPrice: 380000,
  price: 760000
};

document.addEventListener("DOMContentLoaded", async () => {
  highlightActiveNav();
  await initBookingPage();
});

/**
 * Khởi tạo dữ liệu trang đặt sân từ tham số URL hoặc gọi API
 */
async function initBookingPage() {
  const params = new URLSearchParams(window.location.search);

  // 1. Đọc tham số URL
  if (params.has("pitchId")) {
    bookingContext.pitchId = Number(params.get("pitchId"));
  }
  if (params.has("pitchName")) {
    bookingContext.pitchName = params.get("pitchName");
  }
  if (params.has("date")) {
    bookingContext.date = params.get("date");
  }
  if (params.has("start")) {
    bookingContext.startTime = params.get("start");
  }
  if (params.has("end")) {
    bookingContext.endTime = params.get("end");
  }
  if (params.has("price")) {
    bookingContext.price = Number(params.get("price"));
  }

  // 2. Tải thông tin sân thực tế từ Backend để lấy giá chuẩn
  try {
    const pitch = await API.getBookingDetail(bookingContext.pitchId).catch(() => null);
    const pitches = await API.getPitches();
    const currentPitch = pitches.find((p) => p.id === bookingContext.pitchId);
    if (currentPitch) {
      bookingContext.pitchName = currentPitch.pitch_name;
      bookingContext.unitPrice = currentPitch.price_per_hour;
    }
  } catch (e) {
    console.warn("Không thể tải thông tin sân:", e.message);
  }

  // 3. Tính toán thời lượng và tổng tiền ước tính
  updateSummaryUI();
}

/**
 * Cập nhật giao diện tóm tắt trận đấu
 */
function updateSummaryUI() {
  // Tính số giờ
  const startParts = bookingContext.startTime.split(":").map(Number);
  const endParts = bookingContext.endTime.split(":").map(Number);
  let durationHours = 1.5;
  if (startParts.length >= 2 && endParts.length >= 2) {
    const startMin = startParts[0] * 60 + startParts[1];
    const endMin = endParts[0] * 60 + endParts[1];
    if (endMin > startMin) {
      durationHours = (endMin - startMin) / 60.0;
    }
  }

  const calculatedTotal = Math.round(durationHours * bookingContext.unitPrice);
  bookingContext.price = calculatedTotal;

  // Cập nhật DOM
  const titleEl = document.getElementById("summary-pitch-title");
  const unitPriceEl = document.getElementById("summary-unit-price");
  const dateEl = document.getElementById("summary-date-display");
  const timeEl = document.getElementById("summary-time-display");
  const durationEl = document.getElementById("summary-duration");
  const calcEl = document.getElementById("summary-calc-price");
  const totalEl = document.getElementById("summary-total-price");
  const qrNoteEl = document.querySelector("#qr-bank-details span:last-child");

  if (titleEl) titleEl.textContent = bookingContext.pitchName;
  if (unitPriceEl) unitPriceEl.innerHTML = `${Math.round(bookingContext.unitPrice / 1000)}k<span class="font-label-sm text-label-sm text-on-surface-variant">/giờ</span>`;
  if (dateEl) dateEl.textContent = `${UTILS.formatDateDisplay(bookingContext.date)}`;
  if (timeEl) timeEl.textContent = `${bookingContext.startTime} - ${bookingContext.endTime}`;
  if (durationEl) durationEl.textContent = `${durationHours} Giờ (Bật giàn LED cao áp)`;
  if (calcEl) calcEl.textContent = `${UTILS.formatPrice(bookingContext.unitPrice)} × ${durationHours} giờ`;
  if (totalEl) totalEl.textContent = UTILS.formatPrice(calculatedTotal);

  if (qrNoteEl) {
    qrNoteEl.textContent = `Nội dung: ${bookingContext.pitchName.toUpperCase()} - ${UTILS.formatDateDisplay(bookingContext.date)}`;
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
    cashCard.className = "cursor-pointer transition-all p-3.5 rounded-DEFAULT bg-surface-container-lowest shadow-md flex items-center justify-between";
    qrCard.className = "cursor-pointer transition-all p-3.5 rounded-DEFAULT bg-surface-container-high hover:bg-surface-container-highest flex items-center justify-between";

    if (checkCash) checkCash.className = "w-5 h-5 rounded-full bg-primary text-on-primary flex items-center justify-center";
    if (checkQr) checkQr.className = "w-5 h-5 rounded-full bg-surface-variant flex items-center justify-center text-surface-variant";

    if (qrDetails) qrDetails.style.display = "none";
  } else {
    qrCard.className = "cursor-pointer transition-all p-3.5 rounded-DEFAULT bg-surface-container-lowest shadow-md flex items-center justify-between";
    cashCard.className = "cursor-pointer transition-all p-3.5 rounded-DEFAULT bg-surface-container-high hover:bg-surface-container-highest flex items-center justify-between";

    if (checkQr) checkQr.className = "w-5 h-5 rounded-full bg-primary text-on-primary flex items-center justify-center";
    if (checkCash) checkCash.className = "w-5 h-5 rounded-full bg-surface-variant flex items-center justify-center text-surface-variant";

    if (qrDetails) qrDetails.style.display = "flex";
  }
}

/**
 * Xử lý xác nhận đặt sân gửi dữ liệu THẬT lên Backend FastAPI
 */
async function submitBooking() {
  const nameInput = document.getElementById("captain-name");
  const phoneInput = document.getElementById("captain-phone");
  const notesInput = document.getElementById("booking-notes");
  const submitBtn = document.getElementById("btn-submit-booking");
  const submitText = document.getElementById("btn-submit-text");
  const submitIcon = document.getElementById("btn-submit-icon");

  const name = nameInput ? nameInput.value.trim() : "";
  const phone = phoneInput ? phoneInput.value.trim().replace(/\s+/g, "") : "";
  const notes = notesInput ? notesInput.value.trim() : "";

  // 1. Kiểm tra họ tên (tối thiểu 2 ký tự)
  if (!name || name.length < 2) {
    alert("Vui lòng nhập đầy đủ Họ và Tên người đại diện (tối thiểu 2 ký tự)!");
    if (nameInput) nameInput.focus();
    return;
  }

  // 2. Kiểm tra số điện thoại (9 đến 15 chữ số)
  const phoneRegex = /^[0-9]{9,15}$/;
  if (!phone || !phoneRegex.test(phone)) {
    alert("Số điện thoại không hợp lệ! Vui lòng nhập từ 9 đến 15 chữ số.");
    if (phoneInput) phoneInput.focus();
    return;
  }

  // Khóa nút submit và hiển thị spinner
  if (submitBtn) submitBtn.disabled = true;
  if (submitText) submitText.textContent = "ĐANG XỬ LÝ ĐẶT SÂN...";
  if (submitIcon) {
    submitIcon.textContent = "progress_activity";
    submitIcon.classList.add("animate-spin");
  }

  try {
    const bookingPayload = {
      pitch_id: Number(bookingContext.pitchId),
      booking_date: bookingContext.date,
      start_time: bookingContext.startTime,
      end_time: bookingContext.endTime,
      customer_name: name,
      customer_phone: phone,
      note: notes || undefined,
      payment_method: selectedMethod
    };

    // Gửi yêu cầu đặt sân lên Backend FastAPI
    const response = await API.createBooking(bookingPayload);

    // Điền dữ liệu THẬT từ Response vào Modal thành công
    const ticketCodeDisplay = document.getElementById("ticket-code-display");
    const ticketName = document.getElementById("ticket-name");
    const ticketPitch = document.getElementById("ticket-pitch");
    const ticketTime = document.getElementById("ticket-time");
    const ticketPayment = document.getElementById("ticket-payment");

    if (ticketCodeDisplay) ticketCodeDisplay.textContent = `#YP-${response.id}`;
    if (ticketName) ticketName.textContent = response.customer_name;
    if (ticketPitch) ticketPitch.textContent = response.pitch_name || bookingContext.pitchName;
    if (ticketTime) {
      ticketTime.textContent = `${response.start_time.slice(0, 5)} - ${response.end_time.slice(0, 5)} (${UTILS.formatDateDisplay(response.booking_date)})`;
    }
    if (ticketPayment) {
      const methodLabel = selectedMethod === "qr" ? "QR Chuyển Khoản" : "Tiền mặt tại sân";
      ticketPayment.textContent = `${methodLabel} (${UTILS.formatPrice(response.total_price)})`;
    }

    // Hiển thị Modal thành công
    const modal = document.getElementById("success-modal");
    if (modal) modal.classList.remove("hidden");
  } catch (error) {
    // Hiển thị thông báo lỗi từ Backend (409 trùng giờ, 400 quá khứ, ...)
    alert(`Đặt sân không thành công: ${error.message}`);
    // Giữ nguyên dữ liệu trong form để người dùng không phải nhập lại!
  } finally {
    // Mở khóa lại nút submit
    if (submitBtn) submitBtn.disabled = false;
    if (submitText) submitText.textContent = "XÁC NHẬN ĐẶT SÂN NGAY";
    if (submitIcon) {
      submitIcon.textContent = "sports_soccer";
      submitIcon.classList.remove("animate-spin");
    }
  }
}

/**
 * Đóng Modal thành công và chuyển hướng về trang chủ
 */
function closeModal() {
  const modal = document.getElementById("success-modal");
  if (modal) modal.classList.add("hidden");
  window.location.href = "index.html";
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
