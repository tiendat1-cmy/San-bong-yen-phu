from datetime import date, time, datetime
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.pitch import Pitch
from app.models.booking import Booking

# ===== CẤU HÌNH GIỜ MỞ CỬA & BẢNG GIÁ (sửa ở đây) =====
OPEN_MIN = 6 * 60          # 06:00
CLOSE_MIN = 23 * 60 + 30   # 23:30
MIN_DURATION = 45          # phút
MAX_DURATION = 4 * 60      # phút

# (từ phút, đến phút, giá mỗi giờ)
PRICE_TABLE = [
    (6 * 60, 13 * 60, 250000),
    (13 * 60, 16 * 60, 400000),
    (16 * 60, 21 * 60, 500000),
    (21 * 60, 24 * 60, 400000),
]
MATCH_MINUTES = 90


def _fmt(m: int) -> str:
    return f"{m // 60:02d}:{m % 60:02d}"


def parse_time_str(time_str: str) -> time:
    """Chuyển chuỗi 'HH:MM' hoặc 'HH:MM:SS' thành đối tượng datetime.time"""
    parts = time_str.strip().split(":")
    if len(parts) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Định dạng giờ '{time_str}' không hợp lệ. Vui lòng dùng 'HH:MM' (ví dụ: '16:00')"
        )
    try:
        hours = int(parts[0])
        minutes = int(parts[1])
        seconds = int(parts[2]) if len(parts) > 2 else 0
        return time(hour=hours, minute=minutes, second=seconds)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Thời gian '{time_str}' chứa giá trị không hợp lệ."
        )


def validate_booking_time(booking_date: date, start_t: time, end_t: time):
    """
    1. Giờ kết thúc > giờ bắt đầu.
    2. Không đặt trong quá khứ.
    3. Trong giờ mở cửa 06:00 - 23:30.
    4. Thời lượng từ 45 phút đến 4 tiếng.
    """
    if start_t >= end_t:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Thời gian kết thúc trận đấu phải lớn hơn thời gian bắt đầu."
        )

    now = datetime.now()
    if booking_date < now.date():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể đặt lịch sân bóng cho ngày trong quá khứ."
        )
    if booking_date == now.date() and start_t <= now.time():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Khung giờ bắt đầu này đã trôi qua trong ngày hôm nay."
        )

    start_minutes = start_t.hour * 60 + start_t.minute
    end_minutes = end_t.hour * 60 + end_t.minute

    if start_minutes < OPEN_MIN or end_minutes > CLOSE_MIN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Sân chỉ nhận đặt trong khoảng {_fmt(OPEN_MIN)} - {_fmt(CLOSE_MIN)}."
        )

    duration = end_minutes - start_minutes
    if duration < MIN_DURATION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Thời lượng đặt sân tối thiểu là {MIN_DURATION} phút mỗi trận."
        )
    if duration > MAX_DURATION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Thời lượng đặt sân tối đa là 4 tiếng mỗi lần."
        )


def check_time_conflict(
    db: Session,
    pitch_id: int,
    booking_date: date,
    start_t: time,
    end_t: time,
    exclude_booking_id: int | None = None
) -> Booking | None:
    """Trùng khi start_t < old_end VÀ end_t > old_start (bỏ qua đơn 'cancelled')"""
    query = db.query(Booking).filter(
        Booking.pitch_id == pitch_id,
        Booking.booking_date == booking_date,
        Booking.status != "cancelled",
        Booking.start_time < end_t,
        Booking.end_time > start_t
    )
    if exclude_booking_id:
        query = query.filter(Booking.id != exclude_booking_id)
    return query.first()


def price_breakdown(start_t: time, end_t: time) -> list:
    """Tách theo từng mốc giá, tính tiền theo tỷ lệ phút / 90 phút"""
    s = start_t.hour * 60 + start_t.minute
    e = end_t.hour * 60 + end_t.minute
    parts = []
    for lo, hi, rate in PRICE_TABLE:
        a, b = max(s, lo), min(e, hi)
        if b > a:
            parts.append({
                "from": _fmt(a),
                "to": _fmt(b),
                "minutes": b - a,
                "rate_per_match": rate,
                "amount": rate * (b - a) / MATCH_MINUTES,
            })
    return parts

def calculate_price(pitch: Pitch, start_t: time, end_t: time) -> float:
    """Backend tự tính giá theo bảng giá theo giờ, KHÔNG tin giá từ frontend"""
    total = sum(p["amount"] for p in price_breakdown(start_t, end_t))
    return round(total, -3)


# Khung giờ tiêu chuẩn hiển thị trên ma trận lịch sân (trang chủ)
STANDARD_SLOTS = [
    ("06:00", "07:30"),
    ("07:30", "09:00"),
    ("16:00", "17:30"),
    ("17:30", "19:00"),
    ("19:00", "20:30"),
    ("20:30", "22:00"),
    ("22:00", "23:30"),
]


def generate_day_slots(db: Session, target_date: date, pitch: Pitch) -> list:
    bookings = db.query(Booking).filter(
        Booking.pitch_id == pitch.id,
        Booking.booking_date == target_date,
        Booking.status != "cancelled"
    ).all()

    now = datetime.now()
    slot_results = []
    for s_start, s_end in STANDARD_SLOTS:
        st = parse_time_str(s_start)
        et = parse_time_str(s_end)

        conflict = next((b for b in bookings if (st < b.end_time and et > b.start_time)), None)
        is_past = target_date == now.date() and st <= now.time()

        is_avail = conflict is None and not is_past
        status_label = "Trống sân"
        booked_by = None
        if conflict:
            status_label = "Đã có đội đặt"
            booked_by = conflict.customer_name if conflict.customer_name else "Đã đặt"
        elif is_past:
            status_label = "Đã qua giờ"
            booked_by = "Đã qua"

        slot_results.append({
            "pitch_id": pitch.id,
            "pitch_name": pitch.pitch_name,
            "start_time": s_start,
            "end_time": s_end,
            "is_available": is_avail,
            "price": calculate_price(pitch, st, et),
            "booked_by": booked_by,
            "status_label": status_label
        })

    return slot_results