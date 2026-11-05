/**
 * ===================================================================
 * SÂN BÓNG NHÀ MÁY NƯỚC – YÊN PHÚ
 * Logic tương tác trang chủ (index.js)
 * ===================================================================
 */

let currentPitch = 'Sân 1 (7 Pro)';
let currentPitchId = 1;
let selectedTimeSlot = '16:00 - 17:30';
let estimatedPrice = '450.000đ';
let selectedDate = new Date().toISOString().split('T')[0];

document.addEventListener('DOMContentLoaded', () => {
  setupDateSelectors();
  initDynamicDates();
  highlightActiveNav();
});

/**
 * Khởi tạo hiển thị thứ/ngày thực tế trên các nút chọn ngày
 */
function initDynamicDates() {
  const dateButtons = document.querySelectorAll('#date-selector button');
  if (!dateButtons || dateButtons.length === 0) return;

  const today = new Date();
  const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

  dateButtons.forEach((btn, index) => {
    const targetDate = new Date();
    targetDate.setDate(today.getDate() + index);

    const dayOfWeek = dayNames[targetDate.getDay()];
    const dateFormatted = `${String(targetDate.getDate()).padStart(2, '0')}/${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
    const isoDate = targetDate.toISOString().split('T')[0];

    btn.dataset.date = isoDate;
    const dayLabel = btn.querySelector('.font-headline-sm');
    const dateLabel = btn.querySelector('.font-label-sm:last-child');

    if (dayLabel) dayLabel.textContent = dayOfWeek;
    if (dateLabel) dateLabel.textContent = dateFormatted;
  });
}

/**
 * Xử lý sự kiện click chuyển ngày
 */
function setupDateSelectors() {
  const buttons = document.querySelectorAll('#date-selector button');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => {
        b.className = 'flex-1 min-w-[70px] py-2.5 px-2 rounded-DEFAULT bg-surface-container hover:bg-surface-container-high text-on-surface flex flex-col items-center active:scale-95 transition-all';
        const label = b.querySelector('.font-label-sm');
        if (label) label.className = 'font-label-sm text-label-sm text-outline uppercase';
      });

      btn.className = 'flex-1 min-w-[70px] py-2.5 px-2 rounded-DEFAULT bg-primary text-on-primary flex flex-col items-center shadow-md active:scale-95 transition-all';
      const activeLabel = btn.querySelector('.font-label-sm');
      if (activeLabel) activeLabel.className = 'font-label-sm text-label-sm uppercase font-bold';

      if (btn.dataset.date) {
        selectedDate = btn.dataset.date;
      }
    });
  });
}

/**
 * Chuyển tab giữa Sân 1 và Sân 2
 */
function switchPitch(pitchKey) {
  const tab1 = document.getElementById('tab-san1');
  const tab2 = document.getElementById('tab-san2');
  if (!tab1 || !tab2) return;

  if (pitchKey === 'san1') {
    tab1.className = 'py-2 px-3 rounded-full bg-primary text-on-primary font-label-md text-label-md uppercase font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm';
    tab2.className = 'py-2 px-3 rounded-full bg-surface-container text-on-surface-variant font-label-md text-label-md uppercase font-bold flex items-center justify-center gap-1.5 transition-all';
    currentPitch = 'Sân 1 (7 Pro)';
    currentPitchId = 1;
  } else {
    tab2.className = 'py-2 px-3 rounded-full bg-primary text-on-primary font-label-md text-label-md uppercase font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm';
    tab1.className = 'py-2 px-3 rounded-full bg-surface-container text-on-surface-variant font-label-md text-label-md uppercase font-bold flex items-center justify-center gap-1.5 transition-all';
    currentPitch = 'Sân 2 (5-7 Pro)';
    currentPitchId = 2;
  }

  const summaryPitch = document.getElementById('summary-pitch');
  if (summaryPitch) summaryPitch.textContent = currentPitch;
}

/**
 * Chọn khung giờ đá trên ma trận
 */
function selectSlot(element, time, pitch, price) {
  document.querySelectorAll('.slot-card').forEach((el) => {
    el.classList.remove('bg-secondary-container', 'ring-2', 'ring-primary');
    el.classList.add('bg-surface-container');
  });

  element.classList.remove('bg-surface-container');
  element.classList.add('bg-secondary-container');

  selectedTimeSlot = time;
  estimatedPrice = price;

  const summaryPitch = document.getElementById('summary-pitch');
  const summaryTime = document.getElementById('summary-time');
  const summaryPrice = document.getElementById('summary-price');

  if (summaryPitch) summaryPitch.textContent = currentPitch;
  if (summaryTime) summaryTime.textContent = selectedTimeSlot;
  if (summaryPrice) summaryPrice.textContent = estimatedPrice;

  // Mở drawer xác nhận nhanh
  openDrawer();
}

/**
 * Mở và đóng Booking Drawer
 */
function openDrawer() {
  const drawer = document.getElementById('booking-drawer');
  if (drawer) drawer.classList.remove('hidden');
}

function closeDrawer() {
  const drawer = document.getElementById('booking-drawer');
  if (drawer) drawer.classList.add('hidden');
}

/**
 * Xác nhận gửi đặt sân từ drawer trang chủ
 */
function confirmBooking() {
  const name = document.getElementById('cust-name')?.value.trim();
  const phone = document.getElementById('cust-phone')?.value.trim();
  const note = document.getElementById('cust-note')?.value.trim() || '';

  if (!phone) {
    alert('Vui lòng nhập số điện thoại để sân bóng Yên Phú liên hệ xác nhận giờ đá!');
    return;
  }

  // Tạm lưu thông tin sang trang booking.html hoặc hiển thị thông báo
  const pendingBooking = {
    pitchId: currentPitchId,
    pitchName: currentPitch,
    date: selectedDate,
    timeSlot: selectedTimeSlot,
    price: estimatedPrice,
    customerName: name || 'Khách đặt qua web',
    customerPhone: phone,
    note: note
  };

  try {
    localStorage.setItem(CONFIG.STORAGE_KEYS.CURRENT_BOOKING, JSON.stringify(pendingBooking));
  } catch (e) {
    console.warn('LocalStorage error:', e);
  }

  closeDrawer();
  const toast = document.getElementById('booking-toast');
  if (toast) {
    toast.classList.remove('hidden');
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 4500);
  }
}

/**
 * Chuyển tiếp tới trang đặt sân chi tiết (booking.html)
 */
function goToDetailedBooking() {
  const params = new URLSearchParams({
    pitchId: currentPitchId,
    pitchName: currentPitch,
    date: selectedDate,
    time: selectedTimeSlot,
    price: estimatedPrice
  });
  window.location.href = `booking.html?${params.toString()}`;
}

/**
 * Đánh dấu nút điều hướng đang active ở footer
 */
function highlightActiveNav() {
  const navLinks = document.querySelectorAll('nav a');
  navLinks.forEach((link) => {
    if (link.getAttribute('data-path') === 'trang-chu') {
      link.classList.add('text-primary', 'font-bold');
      link.classList.remove('text-on-surface-variant');
    }
  });
}

