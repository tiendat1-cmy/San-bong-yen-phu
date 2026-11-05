"""
===================================================================
UNIT TEST SUITE CHO HỆ THỐNG FASTAPI SÂN BÓNG NHÀ MÁY NƯỚC YÊN PHÚ
Kiểm thử tự động:
1. Đăng ký & Đăng nhập (Mã hóa bcrypt & JWT Token).
2. Lấy danh sách sân bóng & giá niêm yết.
3. Đặt sân bóng & tự động tính tiền trên server (không tin frontend).
4. Kiểm tra chống trùng lịch (Overlapping time slots).
5. Phân quyền Quản trị viên (Admin RBAC).
===================================================================
"""
import sys
import unittest
from pathlib import Path
from datetime import date, time, timedelta

# Đảm bảo console UTF-8
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi import HTTPException

from app.database import Base
from app.models.pitch import Pitch
from app.models.booking import Booking
from app.models.user import User
from app.schemas.user import UserRegister, UserLogin
from app.schemas.booking import BookingCreate, BookingStatusUpdate
from app.services.auth_service import hash_password, verify_password, create_access_token, decode_token
from app.routers.auth import register, login
from app.routers.pitches import get_all_pitches
from app.routers.bookings import create_booking, get_slots
from app.routers.admin import get_dashboard_summary, update_booking_status

TEST_DB_URL = "sqlite:///:memory:"

class TestFootballPitchSystem(unittest.TestCase):
    def setUp(self):
        """Khởi tạo Database in-memory trước mỗi bài test"""
        self.engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
        Base.metadata.create_all(bind=self.engine)
        self.Session = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        self.db = self.Session()

        # Tạo sẵn 1 sân bóng mẫu: Sân 1 giá 380k/h
        self.pitch = Pitch(
            pitch_name="Sân 1 (7 Pro)",
            pitch_type="Sân 7 người",
            price_per_hour=380000.0,
            status="active"
        )
        self.db.add(self.pitch)

        # Tạo 1 tài khoản Admin
        self.admin = User(
            full_name="Admin Yên Phú",
            phone="0988123456",
            email="admin@yenphu.vn",
            password_hash=hash_password("admin123"),
            role="admin"
        )
        self.db.add(self.admin)

        # Tạo 1 tài khoản Customer thường
        self.customer = User(
            full_name="Nguyễn Văn Tuấn",
            phone="0912345678",
            email="tuan@gmail.com",
            password_hash=hash_password("tuan123"),
            role="customer"
        )
        self.db.add(self.customer)
        self.db.commit()

    def tearDown(self):
        """Dọn dẹp database sau mỗi bài test"""
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    # ---------------- 1. TEST BẢO MẬT & XÁC THỰC (AUTH) ----------------
    def test_auth_hashing_and_jwt(self):
        raw_pass = "matkhauBiMat@2026"
        hashed = hash_password(raw_pass)
        self.assertNotEqual(raw_pass, hashed)
        self.assertTrue(verify_password(raw_pass, hashed))
        self.assertFalse(verify_password("sai_mat_khau", hashed))

        # Sinh và giải mã Token JWT
        token = create_access_token(data={"sub": "99", "role": "admin"})
        payload = decode_token(token)
        self.assertIsNotNone(payload)
        self.assertEqual(payload["sub"], "99")
        self.assertEqual(payload["role"], "admin")

    def test_user_registration_and_login(self):
        # Đăng ký tài khoản mới qua router
        user_in = UserRegister(
            full_name="Trần Văn Nam",
            phone="0933444555",
            email="nam@gmail.com",
            password="password123"
        )
        new_user = register(user_in=user_in, db=self.db)
        self.assertEqual(new_user.phone, "0933444555")
        self.assertEqual(new_user.role, "customer")

        # Đăng nhập thành công
        login_res = login(credentials=UserLogin(login_id="0933444555", password="password123"), db=self.db)
        self.assertIn("access_token", login_res)

        # Đăng nhập sai mật khẩu -> Phải raise HTTPException 401
        with self.assertRaises(HTTPException) as cm:
            login(credentials=UserLogin(login_id="0933444555", password="wrong_password"), db=self.db)
        self.assertEqual(cm.exception.status_code, 401)

    # ---------------- 2. TEST DANH SÁCH SÂN & MA TRẬN KHUNG GIỜ ----------------
    def test_get_pitches(self):
        pitches = get_all_pitches(db=self.db)
        self.assertEqual(len(pitches), 1)
        self.assertEqual(pitches[0].pitch_name, "Sân 1 (7 Pro)")
        self.assertEqual(pitches[0].price_per_hour, 380000.0)

    # ---------------- 3. TEST ĐẶT SÂN & TÍNH TIỀN TỰ ĐỘNG ----------------
    def test_create_booking_price_calculation(self):
        tomorrow = date.today() + timedelta(days=1)
        booking_in = BookingCreate(
            pitch_id=self.pitch.id,
            booking_date=tomorrow,
            start_time="18:00",
            end_time="20:00",  # 2 giờ => 2 * 380.000 = 760.000đ
            customer_name="FC Sói Vàng",
            customer_phone="0988000111",
            note="Thuê 2 bộ áo bib",
            payment_method="qr"
        )
        res = create_booking(booking_in=booking_in, current_user=self.customer, db=self.db)
        self.assertEqual(res.total_price, 760000.0)
        self.assertEqual(res.status, "pending")
        self.assertEqual(res.customer_name, "FC Sói Vàng")

    # ---------------- 4. TEST CHỐNG TRÙNG LỊCH (OVERLAPPING SLOTS) ----------------
    def test_prevent_overlapping_bookings(self):
        tomorrow = date.today() + timedelta(days=1)
        # Đội 1 đặt: 18:00 -> 20:00
        booking1 = BookingCreate(
            pitch_id=self.pitch.id,
            booking_date=tomorrow,
            start_time="18:00",
            end_time="20:00",
            customer_name="FC Đội 1",
            customer_phone="0988111222",
            payment_method="qr"
        )
        create_booking(booking_in=booking1, current_user=None, db=self.db)

        # Đội 2 cố gắng đặt đè khung giờ: 19:00 -> 20:30 trên cùng Sân 1
        booking2 = BookingCreate(
            pitch_id=self.pitch.id,
            booking_date=tomorrow,
            start_time="19:00",
            end_time="20:30",
            customer_name="FC Đội 2",
            customer_phone="0977333444",
            payment_method="cash"
        )
        # Phải bị chặn với mã lỗi HTTP 409 Conflict
        with self.assertRaises(HTTPException) as cm:
            create_booking(booking_in=booking2, current_user=None, db=self.db)
        self.assertEqual(cm.exception.status_code, 409)
        self.assertIn("đã có đội đặt", cm.exception.detail)

    # ---------------- 5. TEST CHẶN ĐẶT NGÀY TRONG QUÁ KHỨ ----------------
    def test_prevent_past_booking(self):
        yesterday = date.today() - timedelta(days=1)
        past_booking = BookingCreate(
            pitch_id=self.pitch.id,
            booking_date=yesterday,
            start_time="16:00",
            end_time="17:30",
            customer_name="Khách thử",
            customer_phone="0988123456"
        )
        with self.assertRaises(HTTPException) as cm:
            create_booking(booking_in=past_booking, current_user=None, db=self.db)
        self.assertEqual(cm.exception.status_code, 400)
        self.assertIn("quá khứ", cm.exception.detail)

    # ---------------- 6. TEST QUẢN TRỊ VIÊN CẬP NHẬT TRẠNG THÁI ----------------
    def test_admin_update_booking_status(self):
        tomorrow = date.today() + timedelta(days=1)
        booking_in = BookingCreate(
            pitch_id=self.pitch.id,
            booking_date=tomorrow,
            start_time="16:00",
            end_time="17:30",
            customer_name="Anh Tuấn",
            customer_phone="0912345678"
        )
        b = create_booking(booking_in=booking_in, current_user=None, db=self.db)
        self.assertEqual(b.status, "pending")

        # Admin duyệt đơn thành confirmed
        updated = update_booking_status(
            booking_id=b.id,
            status_update=BookingStatusUpdate(status="confirmed"),
            db=self.db,
            admin=self.admin
        )
        self.assertEqual(updated.status, "confirmed")

if __name__ == "__main__":
    unittest.main()
