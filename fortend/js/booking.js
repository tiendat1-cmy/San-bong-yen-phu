/**
 * Trang đặt sân & thanh toán (booking.js)
 * Người dùng tự chọn sân / ngày / giờ. Giá và trạng thái trống do Backend quyết định.
 */

let selectedMethod = "qr";
let pitches = [];
let isAvailable = false;
let checkSeq = 0;

// Giờ mở cửa & bước chọn (phút) - khớp với Backend
const OPEN = 6 * 60;
const CLOSE = 23 * 60 + 30;
const STEP = 30;
const MIN_DUR = 60;
const MAX_DUR = 240;

const ctx = {
  pitchId: null,
  pitchName: "",
  date: UTILS.getLocalDateString(),
  start: "",
  end: "",
  price: 0,
};

const $ = (id) => document.getElementById(id);
const toMin = (s) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
const toStr = (m) => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
const nowMinutes = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const isToday = () => ctx.date === UTILS.getLocalDateString();

document.addEventListener("DOMContentLoaded", async () => {
  if (!API.isLoggedIn()) {
    const qs = window.location.search;
    window.location.href = `login.html?redirect=${encodeURIComponent("booking.html" + qs)}`;
    return;
  }

  API.renderHeaderAuth();
  API.renderNavAuth();
  highlightActiveNav();

  await initBookingPage();
  prefillUserInfo();
});

function prefillUserInfo() {
  const user = API.getStoredUser();
  if (!user) return;
  const nameInput = $("captain-name");
  const phoneInput = $("captain-phone");
  if (nameInput && !nameInput.value && user.full_name) nameInput.value = user.full_name;
  if (phoneInput && !phoneInput.value && user.phone) phoneInput.value = user.phone;
}

/* ====================== KHỞI TẠO ====================== */

async function initBookingPage() {
  const params = new URLSearchParams(window.location.search);

  // 1. Tải danh sách sân thật từ Backend
  try {
    const res = await API.getPitches();
    const list = Array.isArray(res) ? res : (res.data || res.items || []);
    pitches = list.filter((p) => p.status !== "maintenance");
  } catch (e) {
    console.error("Không thể tải danh sách sân:", e);
  }

  if (pitches.length === 0) {
    setBox("error", "Hiện chưa có sân nào để đặt hoặc không tải được danh sách sân.");
    setSubmitEnabled(false);
    return;
  }

  // 2. Đổ danh sách sân vào ô chọn
  const pitchSel = $("pitch-select");
  pitchSel.innerHTML = "";
  pitches.forEach((p) => pitchSel.add(new Option(p.pitch_name, String(p.id))));

  const urlPitch = Number(params.get("pitchId"));
  const found = pitches.find((p) => Number(p.id) === urlPitch);
  ctx.pitchId = Number((found || pitches[0]).id);
  pitchSel.value = String(ctx.pitchId);

  // 3. Ngày: lấy từ URL nếu hợp lệ, không thì hôm nay
  const dateInput = $("booking-date");
  const today = UTILS.getLocalDateString();
  dateInput.min = today;
  const urlDate = params.get("date");
  ctx.date = urlDate && urlDate >= today ? urlDate : today;
  dateInput.value = ctx.date;

  // 4. Giờ: lấy từ URL nếu có, không thì gợi ý khung giờ gần nhất
  const urlStart = params.get("start");
  const urlEnd = params.get("end");
  buildStartOptions(urlStart);
  buildEndOptions($("start-select").value, urlStart ? urlEnd : null);

  // 5. Gắn sự kiện
  pitchSel.addEventListener("change", onPitchOrDateChange);
  dateInput.addEventListener("change", onPitchOrDateChange);
  $("start-select").addEventListener("change", () => {
    buildEndOptions($("start-select").value, $("end-select").value);
    refreshAvailability();
  });
  $("end-select").addEventListener("change", refreshAvailability);

  await loadBooked();
  await refreshAvailability();
}

function onPitchOrDateChange() {
  ctx.pitchId = Number($("pitch-select").value);
  ctx.date = $("booking-date").value || UTILS.getLocalDateString();
  buildStartOptions($("start-select").value);
  buildEndOptions($("start-select").value, $("end-select").value);
  loadBooked();
  refreshAvailability();
}

/* ====================== Ô CHỌN GIỜ ====================== */

function buildStartOptions(preferred) {
  const el = $("start-select");
  el.innerHTML = "";
  let firstEnabled = null;

  for (let m = OPEN; m <= CLOSE - MIN_DUR; m += STEP) {
    const v = toStr(m);
    const opt = new Option(v, v);
    if (isToday() && m <= nowMinutes()) opt.disabled = true;
    else if (!firstEnabled) firstEnabled = v;
    el.add(opt);
  }

  // Hôm nay đã hết giờ -> chuyển sang ngày mai
  if (!firstEnabled) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    ctx.date = UTILS.getLocalDateString(d);
    $("booking-date").value = ctx.date;
    buildStartOptions(null);
    return;
  }

  const ok = preferred && [...el.options].some((o) => o.value === preferred && !o.disabled);
  el.value = ok ? preferred : firstEnabled;
}

function buildEndOptions(startStr, preferred) {
  const el = $("end-select");
  el.innerHTML = "";
  const s = toMin(startStr);
  for (let m = s + MIN_DUR; m <= Math.min(s + MAX_DUR, CLOSE); m += STEP) {
    el.add(new Option(toStr(m), toStr(m)));
  }
  const has = (v) => v && [...el.options].some((o) => o.value === v);
  const fallback = toStr(Math.min(s + 90, CLOSE));
  el.value = has(preferred) ? preferred : (has(fallback) ? fallback : el.options[el.options.length - 1].value);
}

/* ====================== KIỂM TRA TRỐNG / GIÁ ====================== */

async function loadBooked() {
  const box = $("booked-list");
  if (!box) return;
  try {
    const ranges = await API.getBookedRanges(ctx.pitchId, ctx.date);
    if (!ranges || ranges.length === 0) {
      box.innerHTML = `<span class="font-body-sm text-body-sm text-primary">Chưa có đội nào đặt, ngày này còn trống cả ngày.</span>`;
      return;
    }
    box.innerHTML = ranges
      .map((r) => `<span class="px-2.5 py-1 rounded-full bg-surface-container-lowest text-outline font-label-md text-label-md line-through">${r.start_time} – ${r.end_time}</span>`)
      .join("");
  } catch (e) {
    box.innerHTML = `<span class="font-body-sm text-body-sm text-error">Không tải được danh sách giờ đã đặt.</span>`;
  }
}

async function refreshAvailability() {
  ctx.pitchId = Number($("pitch-select").value);
  ctx.date = $("booking-date").value || ctx.date;
  ctx.start = $("start-select").value;
  ctx.end = $("end-select").value;
  const found = pitches.find((p) => Number(p.id) === ctx.pitchId);
  ctx.pitchName = found ? found.pitch_name : "";

  const seq = ++checkSeq;
  setBox("checking", "Đang kiểm tra khung giờ...");
  setSubmitEnabled(false);
  updateSummaryUI(null);

  try {
    const data = await API.checkAvailability(ctx.pitchId, ctx.date, ctx.start, ctx.end);
    if (seq !== checkSeq) return; // có lần chọn mới hơn rồi

    ctx.price = data.estimated_price;
    updateSummaryUI(data);

    if (data.is_available) {
      setBox("ok", `Khung giờ ${ctx.start} – ${ctx.end} còn trống. Bạn có thể đặt ngay.`);
      setSubmitEnabled(true);
    } else {
      const c = data.conflict ? ` (đã có đội đặt ${data.conflict.start_time} – ${data.conflict.end_time})` : "";
      setBox("taken", `Sân không còn trống khung giờ này${c}. Vui lòng chọn giờ khác.`);
      setSubmitEnabled(false);
    }
  } catch (e) {
    if (seq !== checkSeq) return;
    setBox("error", e.message);
    setSubmitEnabled(false);
  }
}

function setBox(kind, text) {
  const box = $("availability-box");
  if (!box) return;
  const base = "p-3 rounded-DEFAULT font-body-sm text-body-sm font-semibold ";
  const styles = {
    checking: "bg-surface-container-high text-on-surface-variant",
    ok: "bg-primary/15 text-primary border border-primary/30",
    taken: "bg-error-container text-on-error-container",
    error: "bg-error-container text-on-error-container",
  };
  box.className = base + styles[kind];
  box.textContent = text;
}

function setSubmitEnabled(enabled) {
  isAvailable = enabled;
  const btn = $("btn-submit-booking");
  if (btn) btn.disabled = !enabled;
}

/* ====================== TÓM TẮT & GIÁ ====================== */

function updateSummaryUI(data) {
  const set = (id, fn) => { const el = $(id); if (el) fn(el); };

  set("summary-pitch-title", (el) => (el.textContent = ctx.pitchName || "Chọn sân"));
  set("summary-unit-price", (el) => (el.innerHTML = `250k–500k<span class="font-label-sm text-label-sm text-on-surface-variant font-normal">/trận 90'</span>`));
  set("summary-date-display", (el) => (el.textContent = UTILS.formatDateDisplay(ctx.date)));
  set("summary-time-display", (el) => (el.textContent = ctx.start && ctx.end ? `${ctx.start} - ${ctx.end}` : "--:--"));

  if (ctx.start && ctx.end) {
    const mins = toMin(ctx.end) - toMin(ctx.start);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    set("summary-duration", (el) => (el.textContent = `${h} giờ${m ? " " + m + " phút" : ""}`));
  }

    set("summary-calc-price", (el) => {
    if (!data || !data.breakdown) { el.textContent = "--"; return; }
    el.innerHTML = data.breakdown
      .map((p) => `${p.from}–${p.to} (${p.minutes} phút): ${UTILS.formatPrice(p.rate_per_match)}/90 phút`)
      .join("<br>");
  });

  set("summary-total-price", (el) => (el.textContent = data ? UTILS.formatPrice(data.estimated_price) : "--"));
  set("qr-bank-note", (el) => (el.textContent = `Nội dung CK: ${(ctx.pitchName || "").toUpperCase()} - ${UTILS.formatDateDisplay(ctx.date)} ${ctx.start}`));
}

/* ====================== THANH TOÁN ====================== */

const CARD_ACTIVE = "cursor-pointer transition-all p-3.5 rounded-DEFAULT bg-surface-container-lowest shadow-md flex items-center justify-between gap-3 border border-primary/20";
const CARD_IDLE = "cursor-pointer transition-all p-3.5 rounded-DEFAULT bg-surface-container-high hover:bg-surface-container-highest flex items-center justify-between gap-3";
const CHECK_ON = "w-5 h-5 rounded-full bg-primary text-on-primary flex items-center justify-center flex-shrink-0";
const CHECK_OFF = "w-5 h-5 rounded-full bg-surface-variant flex items-center justify-center text-surface-variant flex-shrink-0";

function selectPayment(method) {
  selectedMethod = method;
  const isCash = method === "cash";
  $("pay-opt-cash").className = isCash ? CARD_ACTIVE : CARD_IDLE;
  $("pay-opt-qr").className = isCash ? CARD_IDLE : CARD_ACTIVE;
  $("check-cash").className = isCash ? CHECK_ON : CHECK_OFF;
  $("check-qr").className = isCash ? CHECK_OFF : CHECK_ON;
  $("qr-bank-details").style.display = isCash ? "none" : "flex";
}

/* ====================== GỬI ĐƠN ĐẶT SÂN ====================== */

async function submitBooking() {
  if (!API.isLoggedIn()) {
    alert("Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại để xác nhận đặt sân!");
    window.location.href = `login.html?redirect=${encodeURIComponent("booking.html" + window.location.search)}`;
    return;
  }

  if (!isAvailable) {
    alert("Khung giờ này không còn trống hoặc chưa hợp lệ. Vui lòng chọn giờ khác!");
    return;
  }

  const nameInput = $("captain-name");
  const phoneInput = $("captain-phone");
  const notesInput = $("booking-notes");
  const submitBtn = $("btn-submit-booking");
  const submitText = $("btn-submit-text");
  const submitIcon = $("btn-submit-icon");

  const name = nameInput ? nameInput.value.trim() : "";
  const phone = phoneInput ? phoneInput.value.trim().replace(/\s+/g, "") : "";
  const notes = notesInput ? notesInput.value.trim() : "";

  if (!name || name.length < 2) {
    alert("Vui lòng nhập đầy đủ Họ và Tên người đại diện (tối thiểu 2 ký tự)!");
    if (nameInput) nameInput.focus();
    return;
  }
  if (!/^[0-9]{9,15}$/.test(phone)) {
    alert("Số điện thoại không hợp lệ! Vui lòng nhập từ 9 đến 15 chữ số.");
    if (phoneInput) phoneInput.focus();
    return;
  }

  if (submitBtn) submitBtn.disabled = true;
  if (submitText) submitText.textContent = "ĐANG XỬ LÝ ĐẶT SÂN...";
  if (submitIcon) {
    submitIcon.textContent = "progress_activity";
    submitIcon.classList.add("animate-spin");
  }

  try {
    const response = await API.createBooking({
      pitch_id: Number(ctx.pitchId),
      booking_date: ctx.date,
      start_time: ctx.start,
      end_time: ctx.end,
      customer_name: name,
      customer_phone: phone,
      note: notes || undefined,
      payment_method: selectedMethod,
    });

    $("ticket-code-display").textContent = `#YP-${response.id}`;
    $("ticket-name").textContent = response.customer_name;
    $("ticket-pitch").textContent = response.pitch_name || ctx.pitchName;
    $("ticket-time").textContent = `${response.start_time.slice(0, 5)} - ${response.end_time.slice(0, 5)} (${UTILS.formatDateDisplay(response.booking_date)})`;
    const methodLabel = selectedMethod === "qr" ? "QR Chuyển Khoản" : "Tiền mặt tại sân";
    $("ticket-payment").textContent = `${methodLabel} (${UTILS.formatPrice(response.total_price)})`;

    $("success-modal").classList.remove("hidden");
  } catch (error) {
    alert(`Đặt sân không thành công: ${error.message}`);
    // Có thể vừa bị đội khác đặt mất -> làm mới trạng thái
    loadBooked();
    refreshAvailability();
  } finally {
    if (submitText) submitText.textContent = "XÁC NHẬN ĐẶT SÂN NGAY";
    if (submitIcon) {
      submitIcon.textContent = "sports_soccer";
      submitIcon.classList.remove("animate-spin");
    }
    if (submitBtn) submitBtn.disabled = !isAvailable;
  }
}

function closeModal() {
  const modal = $("success-modal");
  if (modal) modal.classList.add("hidden");
  window.location.href = "index.html";
}

function highlightActiveNav() {
  document.querySelectorAll("nav a").forEach((link) => {
    if (link.getAttribute("data-path") === "dat-san") {
      link.classList.add("text-primary", "font-bold");
      link.classList.remove("text-on-surface-variant");
    }
  });
}