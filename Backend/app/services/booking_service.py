from datetime import date, time, datetime, timedelta
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.pitch import Pitch
from app.models.booking import Booking

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
    Kiểm tra các quy tắc thời gian cơ bản:
    1. Thời gian kết thúc phải lớn hơn thời gian bắt đầu.
    2. Không được đặt trong quá khứ.
    3. Thời lượng tối thiểu 45 phút, tối đa 4 tiếng.
    """
    if start_t >= end_t:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Thời gian kết thúc trận đấu phải lớn hơn thời gian bắt đầu."
        )

    # Kiểm tra thời gian quá khứ
    now = datetime.now()
    today = now.date()
    current_time = now.time()

    if booking_date < today:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể đặt lịch sân bóng cho ngày trong quá khứ."
        )
    
    if booking_date == today and start_t <= current_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Khung giờ bắt đầu này đã trôi qua trong ngày hôm nay."
        )

    # Tính độ dài trận đấu
    start_minutes = start_t.hour * 60 + start_t.minute
    end_minutes = end_t.hour * 60 + end_t.minute
    duration_minutes = end_minutes - start_minutes

    if duration_minutes < 45:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Thời lượng đặt sân tối thiểu là 45 phút mỗi trận."
        )

def check_time_conflict(
    db: Session, 
    pitch_id: int, 
    booking_date: date, 
    start_t: time, 
    end_t: time, 
    exclude_booking_id: int | None = None
) -> Booking | None:
    """
    Kiểm tra trùng lịch trên Database:
    Đơn mới [start_t, end_t] xung đột với đơn cũ [old_start, old_end] khi:
    start_t < old_end VÀ end_t > old_start
    (bỏ qua các đơn có trạng thái 'cancelled')
    """
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

def calculate_price(pitch: Pitch, start_t: time, end_t: time) -> float:
    """
    Tính tổng tiền sân dựa trên đơn giá niêm yết của sân và số giờ thuê thực tế.
    Backend tự tính, TUYỆT ĐỐI không tin giá tiền từ frontend gửi lên!
    """
    start_minutes = start_t.hour * 60 + start_t.minute
    end_minutes = end_t.hour * 60 + end_t.minute
    duration_hours = (end_minutes - start_minutes) / 60.0
    
    total = duration_hours * pitch.price_per_hour
    return round(total, -3)  # Làm tròn đến nghìn đồng

# Khung giờ tiêu chuẩn hiển thị trên ma trận lịch sân
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
    """Tạo ma trận tình trạng khung giờ (trống / đã đặt) cho một sân trong ngày"""
    bookings = db.query(Booking).filter(
        Booking.pitch_id == pitch.id,
        Booking.booking_date == target_date,
        Booking.status != "cancelled"
    ).all()

    slot_results = []
    for s_start, s_end in STANDARD_SLOTS:
        st = parse_time_str(s_start)
        et = parse_time_str(s_end)

        # Tìm đơn trùng với slot này
        conflict = next(
            (b for b in bookings if (st < b.end_time and et > b.start_time)), 
            None
        )

        is_avail = conflict is None
        # Giá tạm tính cho slot 90 phút (1.5h)
        estimated_slot_price = round(1.5 * pitch.price_per_hour, -3)

        booked_by = None
        status_label = "Trống sân"
        if conflict:
            status_label = "Đã có đội đặt"
            # Che bớt thông tin người đặt nếu là khách xem
            booked_by = conflict.customer_name if conflict.customer_name else "Đã đặt"

        slot_results.append({
            "pitch_id": pitch.id,
            "pitch_name": pitch.pitch_name,
            "start_time": s_start,
            "end_time": s_end,
            "is_available": is_avail,
            "price": estimated_slot_price,
            "booked_by": booked_by,
            "status_label": status_label
        })

    return slot_results

