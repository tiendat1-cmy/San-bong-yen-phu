import smtplib
from email.message import EmailMessage

# ===== ĐIỀN 3 DÒNG NÀY =====
SMTP_USER = "mmo.vuanh2807@gmail.com"
SMTP_PASS = "jretzowxnhvkpjcx".replace(" ", "").strip()  
NOTIFY_TO = "mmo.vuanh2807@gmail.com"


def _build_text(b: dict) -> str:
    method = "Chuyển khoản QR" if b["payment_method"] == "qr" else "Tiền mặt tại sân"
    return (
        f"ĐƠN ĐẶT SÂN MỚI #YP-{b['id']}\n"
        f"Sân: {b['pitch_name']}\n"
        f"Ngày: {b['booking_date']}\n"
        f"Giờ: {b['start_time']} - {b['end_time']}\n"
        f"Khách: {b['customer_name']}\n"
        f"SĐT: {b['customer_phone']}\n"
        f"Tiền sân: {int(b['total_price']):,}đ\n"
        f"Thanh toán: {method}\n"
        f"Ghi chú: {b.get('note') or '-'}"
    )


def notify_new_booking(b: dict):
    """Gửi Gmail báo đơn mới. Lỗi chỉ ghi log, không ảnh hưởng việc đặt sân."""
    password = SMTP_PASS.replace(" ", "").strip()
    print(f"[Notify] Độ dài mật khẩu đang dùng: {len(password)} (phải là 16)")
    try:
        msg = EmailMessage()
        msg["Subject"] = f"[Sân Yên Phú] Đơn mới #{b['id']} - {b['pitch_name']} {b['start_time']} {b['booking_date']}"
        msg["From"] = SMTP_USER
        msg["To"] = NOTIFY_TO
        msg.set_content(_build_text(b))
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=20) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.ehlo()
            smtp.login(SMTP_USER, password)
            smtp.send_message(msg)
        print(f"[Notify] Đã gửi Gmail đơn #{b['id']} tới {NOTIFY_TO}")
    except Exception as e:
        print(f"[Notify] Gửi Gmail lỗi: {e}")