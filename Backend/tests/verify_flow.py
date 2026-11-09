import sys
from pathlib import Path
from datetime import date, timedelta

# Đảm bảo UTF-8
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from app.database import SessionLocal
from app.models.pitch import Pitch
from app.models.booking import Booking
from app.models.user import User
from app.schemas.user import UserRegister, UserLogin
from app.schemas.booking import BookingCreate, BookingStatusUpdate
from app.routers.auth import register, login
from app.routers.bookings import create_booking
from app.routers.admin import get_dashboard_summary, update_booking_status
from app.dependencies.auth import get_current_admin_user
from fastapi import HTTPException

def run_verification():
    db = SessionLocal()
    print("=" * 60)
    print("BẮT ĐẦU KIỂM TRA TOÀN DIỆN LUỒNG AUTH & PHÂN QUYỀN SÂN YÊN PHÚ")
    print("=" * 60)

    # 1. Đăng ký tài khoản User mới
    test_phone = "0944556677"
    # Dọn dẹp nếu đã tồn tại
    existing = db.query(User).filter(User.phone == test_phone).first()
    if existing:
        db.delete(existing)
        db.commit()

    print("\n[Bước 1] Kiểm tra Đăng ký tài khoản thường (User):")
    user_in = UserRegister(
        full_name="Nguyễn Văn Minh",
        phone=test_phone,
        email="minh@gmail.com",
        password="minhpassword123"
    )
    new_user = register(user_in=user_in, db=db)
    print(f"  -> Đăng ký thành công: ID={new_user.id}, Tên='{new_user.full_name}', Role='{new_user.role}'")
    assert new_user.role == "user", f"Lỗi: Role phải là 'user', hiện tại là {new_user.role}"

    # 2. Đăng nhập tài khoản User vừa tạo
    print("\n[Bước 2] Kiểm tra Đăng nhập tài khoản User:")
    login_res = login(UserLogin(login_id=test_phone, password="minhpassword123"), db=db)
    user_token = login_res["access_token"]
    print(f"  -> Đăng nhập thành công! Sinh token JWT độ dài {len(user_token)} ký tự.")
    assert "access_token" in login_res

    # 3. Phân quyền: Thử lấy Admin Dashboard bằng User thường
    print("\n[Bước 3] Kiểm tra Phân quyền: User thường truy cập khu vực Admin:")
    try:
        get_current_admin_user(current_user=new_user)
        print("  -> LỖI: User thường lại vượt qua được Admin Guard!")
        assert False
    except HTTPException as e:
        print(f"  -> CHẶN THÀNH CÔNG: HTTP {e.status_code} - {e.detail}")
        assert e.status_code == 403

    # 4. Đăng nhập tài khoản Admin
    print("\n[Bước 4] Kiểm tra Đăng nhập tài khoản Admin:")
    admin_login = login(UserLogin(login_id="0988123456", password="admin123"), db=db)
    admin_token = admin_login["access_token"]
    admin_user = admin_login["user"]
    print(f"  -> Admin đăng nhập thành công: Tên='{admin_user.full_name}', Role='{admin_user.role}'")
    assert admin_user.role == "admin"

    # 5. Admin truy cập Dashboard
    print("\n[Bước 5] Admin truy cập Dashboard thống kê:")
    dashboard_res = get_dashboard_summary(target_date=date.today(), db=db, admin=admin_user)
    print(f"  -> Thành công! Doanh thu dự kiến hôm nay: {dashboard_res['total_revenue_projected']:,.0f}đ")
    print(f"  -> Số đơn đặt: {dashboard_res['total_bookings_count']}")

    # 6. Kiểm tra đặt sân khi chưa đăng nhập (current_user=None) -> Phải bị chặn 401
    print("\n[Bước 6] Kiểm tra chống đơn rác (Đặt sân khi chưa đăng nhập):")
    p1 = db.query(Pitch).first()
    tomorrow = date.today() + timedelta(days=2)
    booking_payload = BookingCreate(
        pitch_id=p1.id,
        booking_date=tomorrow,
        start_time="17:00",
        end_time="18:30",
        customer_name="Khách Rác",
        customer_phone="0999000111",
        payment_method="cash"
    )
    try:
        create_booking(booking_in=booking_payload, current_user=None, db=db)
        print("  -> LỖI: Chưa đăng nhập mà vẫn cho đặt sân!")
        assert False
    except HTTPException as e:
        print(f"  -> CHẶN THÀNH CÔNG: HTTP {e.status_code} - {e.detail}")
        assert e.status_code == 401

    # 7. Đặt sân thành công với User đã đăng nhập
    print("\n[Bước 7] Đặt sân với User đã đăng nhập:")
    booking_success = create_booking(booking_in=booking_payload, current_user=new_user, db=db)
    print(f"  -> Đặt sân thành công! Mã đơn: #{booking_success.id}, Giá: {booking_success.total_price:,.0f}đ, Trạng thái: {booking_success.status}")
    assert booking_success.user_id == new_user.id

    # 8. Admin duyệt đơn đặt sân
    print("\n[Bước 8] Admin duyệt đơn và đánh dấu hoàn thành:")
    confirmed_b = update_booking_status(
        booking_id=booking_success.id,
        status_update=BookingStatusUpdate(status="confirmed"),
        db=db,
        admin=admin_user
    )
    print(f"  -> Admin đã duyệt đơn #{confirmed_b.id}: Trạng thái mới='{confirmed_b.status}'")
    assert confirmed_b.status == "confirmed"

    completed_b = update_booking_status(
        booking_id=booking_success.id,
        status_update=BookingStatusUpdate(status="completed"),
        db=db,
        admin=admin_user
    )
    print(f"  -> Admin đã hoàn tất đơn #{completed_b.id}: Trạng thái mới='{completed_b.status}'")
    assert completed_b.status == "completed"

    print("\n" + "=" * 60)
    print("TẤT CẢ 8/8 BƯỚC KIỂM THỬ XÁC THỰC & PHÂN QUYỀN ĐỀU HOÀN TOÀN THÀNH CÔNG!")
    print("=" * 60)
    db.close()

if __name__ == "__main__":
    run_verification()

