from datetime import date, datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.pitch import Pitch
from app.models.booking import Booking
from app.models.payment import Payment
from app.models.user import User
from app.schemas.booking import BookingCreate, BookingResponse, DaySlotsResponse, SlotItem
from app.services.booking_service import (
    parse_time_str, 
    validate_booking_time, 
    check_time_conflict, 
    calculate_price, 
    generate_day_slots
)
from app.dependencies.auth import get_optional_current_user

router = APIRouter(tags=["Đặt sân & Lịch trống"])

@router.get("/slots", response_model=List[SlotItem])
def get_slots(
    date: date = Query(default_factory=lambda: datetime.now().date(), description="Ngày kiểm tra lịch (YYYY-MM-DD)"),
    pitch_id: Optional[int] = Query(None, description="Lọc theo ID sân"),
    db: Session = Depends(get_db)
):
    """
    Lấy ma trận các khung giờ và tình trạng (Trống / Đã đặt) theo ngày
    """
    pitches_query = db.query(Pitch).filter(Pitch.status == "active")
    if pitch_id:
        pitches_query = pitches_query.filter(Pitch.id == pitch_id)
    pitches = pitches_query.all()

    all_slots = []
    for pitch in pitches:
        slots = generate_day_slots(db, date, pitch)
        all_slots.extend(slots)
        
    return all_slots

@router.get("/bookings/available")
def check_availability(
    pitch_id: int = Query(..., description="ID sân bóng"),
    booking_date: date = Query(..., description="Ngày đá bóng"),
    start_time: str = Query(..., description="Giờ bắt đầu (HH:MM)"),
    end_time: str = Query(..., description="Giờ kết thúc (HH:MM)"),
    db: Session = Depends(get_db)
):
    """Kiểm tra một khung giờ cụ thể còn trống hay đã có người đặt"""
    pitch = db.query(Pitch).filter(Pitch.id == pitch_id).first()
    if not pitch:
        raise HTTPException(status_code=404, detail="Không tìm thấy sân bóng.")

    start_t = parse_time_str(start_time)
    end_t = parse_time_str(end_time)
    validate_booking_time(booking_date, start_t, end_t)

    conflict = check_time_conflict(db, pitch_id, booking_date, start_t, end_t)
    return {
        "pitch_id": pitch_id,
        "pitch_name": pitch.pitch_name,
        "booking_date": str(booking_date),
        "start_time": start_time,
        "end_time": end_time,
        "is_available": conflict is None,
        "estimated_price": calculate_price(pitch, start_t, end_t)
    }

@router.post("/bookings", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
def create_booking(
    booking_in: BookingCreate,
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db)
):
    """
    Tạo đơn đặt sân mới.
    Áp dụng toàn bộ quy tắc nghiệp vụ nghiêm ngặt:
    - Không cho phép đặt trong quá khứ.
    - Thời gian kết thúc > thời gian bắt đầu.
    - Chống trùng lịch (Concurrency / Overlapping check).
    - Tính tổng tiền tự động ở server theo đơn giá sân.
    """
    pitch = db.query(Pitch).filter(Pitch.id == booking_in.pitch_id).first()
    if not pitch:
        raise HTTPException(status_code=404, detail="Sân bóng không tồn tại!")
    if pitch.status == "maintenance":
        raise HTTPException(status_code=400, detail="Sân bóng này hiện đang bảo trì, vui lòng chọn sân khác!")

    start_t = parse_time_str(booking_in.start_time)
    end_t = parse_time_str(booking_in.end_time)

    # 1. Kiểm tra logic thời gian
    validate_booking_time(booking_in.booking_date, start_t, end_t)

    # 2. Kiểm tra trùng lịch trên Database
    conflict = check_time_conflict(db, pitch.id, booking_in.booking_date, start_t, end_t)
    if conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Khung giờ từ {start_t.strftime('%H:%M')} đến {end_t.strftime('%H:%M')} trên {pitch.pitch_name} đã có đội đặt! Vui lòng chọn khung giờ khác."
        )

    # 3. Tính tiền tự động (Backend hoàn toàn kiểm soát giá)
    total_price = calculate_price(pitch, start_t, end_t)

    # 4. Lưu đơn đặt sân
    new_booking = Booking(
        user_id=current_user.id if current_user else None,
        pitch_id=pitch.id,
        booking_date=booking_in.booking_date,
        start_time=start_t,
        end_time=end_t,
        total_price=total_price,
        customer_name=booking_in.customer_name.strip(),
        customer_phone=booking_in.customer_phone.strip(),
        note=booking_in.note,
        status="pending"
    )
    db.add(new_booking)
    db.flush()  # Để lấy new_booking.id

    # 5. Tạo bản ghi thanh toán khởi tạo
    payment_rec = Payment(
        booking_id=new_booking.id,
        amount=total_price,
        payment_method=booking_in.payment_method,
        payment_status="unpaid"
    )
    db.add(payment_rec)
    db.commit()
    db.refresh(new_booking)

    # Đính kèm pitch_name để trả về response
    res = BookingResponse.model_validate(new_booking)
    res.pitch_name = pitch.pitch_name
    return res

@router.get("/bookings/{booking_id}", response_model=BookingResponse)
def get_booking_detail(booking_id: int, db: Session = Depends(get_db)):
    """Xem thông tin chi tiết một đơn đặt sân theo ID"""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn đặt sân này.")
    
    res = BookingResponse.model_validate(booking)
    res.pitch_name = booking.pitch.pitch_name if booking.pitch else "Sân bóng"
    return res

