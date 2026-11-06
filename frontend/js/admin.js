/**
 * ===================================================================
 * SÂN BÓNG NHÀ MÁY NƯỚC – YÊN PHÚ
 * Logic tương tác trang quản trị (admin.js)
 * ===================================================================
 */

document.addEventListener("DOMContentLoaded", () => {
  setupQuickAddModal();
  setupPitchPickers();
  highlightActiveNav();
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
  }, 2500);
}

/**
 * Bộ lọc danh sách đặt sân (Tất cả, Sân 1, Sân 2)
 */
function setPitchFilter(type) {
  const buttons = document.querySelectorAll(".pitch-filter-btn");
  buttons.forEach((btn) => {
    if (btn.getAttribute("data-filter") === type) {
      btn.classList.add("bg-primary", "text-on-primary");
      btn.classList.remove("text-on-surface-variant");
    } else {
      btn.classList.remove("bg-primary", "text-on-primary");
      btn.classList.add("text-on-surface-variant");
    }
  });

  const cards = document.querySelectorAll(".booking-card");
  cards.forEach((card) => {
    if (type === "all" || card.getAttribute("data-pitch") === type) {
      card.style.display = "flex";
    } else {
      card.style.display = "none";
    }
  });
}

/**
 * Xử lý các thao tác quản lý đơn: Check-in, Sửa, Hủy
 */
function handleAction(type, code) {
  if (type === "checkin") {
    showToast("Đã Check-in thành công: " + code);
  } else if (type === "edit") {
    showToast("Mở giao diện điều chỉnh lịch " + code);
  } else if (type === "cancel") {
    if (confirm("Xác nhận huỷ lượt đặt sân " + code + "?")) {
      showToast("Đã hủy lịch đặt " + code);
    }
  } else {
    showToast("Xem chi tiết đơn " + code);
  }
}

/**
 * Bật / tắt chế độ bảo dưỡng mặt sân hoặc dàn đèn
 */
function toggleMaintenance(pitchNum, btn) {
  if (btn.textContent.includes("Bảo Trì")) {
    btn.textContent = "Mở Hoạt Động";
    btn.classList.add("bg-error-container", "text-on-error-container");
    showToast("Sân " + pitchNum + " đã chuyển sang chế độ BẢO TRÌ!");
  } else {
    btn.textContent = "Chuyển: Bảo Trì";
    btn.classList.remove("bg-error-container", "text-on-error-container");
    showToast("Sân " + pitchNum + " đã sẵn sàng đón trận đấu!");
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
    btnConfirm.addEventListener("click", () => {
      modal.classList.add("hidden");
      showToast("Đã thêm đặt sân mới thành công vào hệ thống!");
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

