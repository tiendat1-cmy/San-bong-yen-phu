import sys
import os
from pathlib import Path

# Đảm bảo UTF-8 cho console Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Đảm bảo đường dẫn gốc backend luôn nằm trong sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from datetime import datetime, date, time
from app.database import SessionLocal, Base, engine
from app.models.user import User
from app.models.pitch import Pitch
from app.models.booking import Booking
from app.models.payment import Payment
from app.services.auth_service import hash_password

def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        print("[Seed] Dang kiem tra va khoi tao du lieu...")

        # 1. Khởi tạo 2 Sân bóng chính thức
        if db.query(Pitch).count() == 0:
            pitch1 = Pitch(
                pitch_name="Sân 1 (7 Pro)",
                pitch_type="Sân 7 người tiêu chuẩn FIFA",
                description="Mặt cỏ nhân tạo 5cm cao cấp, đệm cao su đàn hồi êm chân, giàn đèn LED cao áp chống chói ban đêm.",
                price_per_hour=380000.0,
                status="active"
            )
            pitch2 = Pitch(
                pitch_name="Sân 2 (5-7 Pro)",
                pitch_type="Sân 5-7 người linh hoạt",
                description="Phù hợp thi đấu đối kháng 5-7 người, lưới chắn bóng an toàn, miễn phí 02 bình nước mát.",
                price_per_hour=300000.0,
                status="active"
            )
            db.add_all([pitch1, pitch2])
            db.commit()
            print("  [+] Da tao 02 san bong: San 1 (7 Pro) va San 2 (5-7 Pro)")
        else:
            print("  [-] San bong da co san trong he thong.")

        # 2. Khởi tạo tài khoản Admin
        admin_user = db.query(User).filter(User.phone == "0988123456").first()
        if not admin_user:
            admin_user = User(
                full_name="Admin Sân Yên Phú",
                phone="0988123456",
                email="admin@sanbongyenphu.vn",
                password_hash=hash_password("admin123"),
                role="admin"
            )
            db.add(admin_user)
            db.commit()
            print("  [+] Da tao tai khoan Admin: SDT: 0988123456 | Mat khau: admin123")
        else:
            print("  [-] Tai khoan Admin da co san.")

        # 3. Tạo tài khoản khách hàng mẫu
        customer_user = db.query(User).filter(User.phone == "0912345678").first()
        if not customer_user:
            customer_user = User(
                full_name="Nguyễn Văn Tuấn",
                phone="0912345678",
                email="tuan@gmail.com",
                password_hash=hash_password("123456"),
                role="customer"
            )
            db.add(customer_user)
            db.commit()
            print("  [+] Da tao tai khoan Khach hang mau: SDT: 0912345678 | Mat khau: 123456")

        # 4. Tạo một vài đơn đặt sân mẫu cho ngày hôm nay
        today = datetime.now().date()
        p1 = db.query(Pitch).filter(Pitch.pitch_name == "Sân 1 (7 Pro)").first()
        p2 = db.query(Pitch).filter(Pitch.pitch_name == "Sân 2 (5-7 Pro)").first()

        if db.query(Booking).count() == 0 and p1 and p2:
            # Đơn 1
            b1 = Booking(
                user_id=customer_user.id if customer_user else None,
                pitch_id=p1.id,
                booking_date=today,
                start_time=time(17, 0),
                end_time=time(18, 0),
                total_price=380000.0,
                customer_name="Anh Hải (FC Bình Phú)",
                customer_phone="0982111000",
                note="Mượn 1 quả bóng Động Lực",
                status="confirmed"
            )
            db.add(b1)
            db.flush()
            db.add(Payment(booking_id=b1.id, amount=100000.0, payment_method="cash", payment_status="deposit"))

            # Đơn 2
            b2 = Booking(
                user_id=customer_user.id if customer_user else None,
                pitch_id=p1.id,
                booking_date=today,
                start_time=time(18, 0),
                end_time=time(20, 0),
                total_price=760000.0,
                customer_name="Nguyễn Văn Tuấn (FC Sói Vàng)",
                customer_phone="0912345678",
                note="Cần 2 bộ áo bib tập phân đội",
                status="pending"
            )
            db.add(b2)
            db.flush()
            db.add(Payment(booking_id=b2.id, amount=760000.0, payment_method="qr", payment_status="unpaid"))

            # Đơn 3
            b3 = Booking(
                user_id=None,
                pitch_id=p2.id,
                booking_date=today,
                start_time=time(18, 0),
                end_time=time(19, 30),
                total_price=450000.0,
                customer_name="FC Yên Mỹ",
                customer_phone="0977222000",
                note="Nước đá lạnh",
                status="completed"
            )
            db.add(b3)
            db.flush()
            db.add(Payment(booking_id=b3.id, amount=450000.0, payment_method="qr", payment_status="paid"))

            db.commit()
            print("  [+] Da tao 03 don dat san mau hien thi tren Dashboard Admin!")

        print("[Seed] Hoan tat khoi tao du lieu thanh cong!")
    except Exception as e:
        db.rollback()
        print(f"[Seed Error] {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
