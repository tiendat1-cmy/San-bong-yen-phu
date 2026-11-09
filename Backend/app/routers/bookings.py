from datetime import date, datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status,BackgroundTasks
from app.services.notification_service import notify_new_booking
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
    price_breakdown, 
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
    """Kiểm tra một khung giờ cụ thể còn trống hay đã có người đặt, kèm giá"""
    pitch = db.query(Pitch).filter(Pitch.id == pitch_id).first()
    if not pitch:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy sân bóng id={pitch_id}.")

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
        "conflict": None if conflict is None else {
            "start_time": conflict.start_time.strftime("%H:%M"),
            "end_time": conflict.end_time.strftime("%H:%M"),
        },
        "estimated_price": calculate_price(pitch, start_t, end_t),
        "breakdown": price_breakdown(start_t, end_t),
    }
@router.get("/bookings/booked")
def get_booked_ranges(
    pitch_id: int = Query(..., description="ID sân bóng"),
    booking_date: date = Query(..., description="Ngày cần xem"),
    db: Session = Depends(get_db)
):
    """Danh sách các khoảng giờ đã có đội đặt trong ngày (không lộ thông tin người đặt)"""
    rows = db.query(Booking).filter(
        Booking.pitch_id == pitch_id,
        Booking.booking_date == booking_date,
        Booking.status != "cancelled"
    ).order_by(Booking.start_time).all()
    return [
        {"start_time": b.start_time.strftime("%H:%M"), "end_time": b.end_time.strftime("%H:%M")}
        for b in rows
    ]

@router.post("/bookings", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
def create_booking(
    booking_in: BookingCreate,
    background_tasks: BackgroundTasks,
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
    # 0. Yêu cầu đăng nhập tài khoản để chống tạo đơn rác
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Vui lòng đăng nhập tài khoản trước khi thực hiện đặt sân!"
        )
    

    pitch = db.query(Pitch).filter(Pitch.id == booking_in.pitch_id).first()
    if not pitch:
        raise HTTPException(
            status_code=404,
            detail=f"Sân bóng id={booking_in.pitch_id} không tồn tại! (user={current_user.id})"
        )
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
    background_tasks.add_task(notify_new_booking, {
        "id": new_booking.id,
        "pitch_name": pitch.pitch_name,
        "booking_date": str(new_booking.booking_date),
        "start_time": new_booking.start_time.strftime("%H:%M"),
        "end_time": new_booking.end_time.strftime("%H:%M"),
        "customer_name": new_booking.customer_name,
        "customer_phone": new_booking.customer_phone,
        "total_price": new_booking.total_price,
        "payment_method": booking_in.payment_method,
        "note": new_booking.note,
    })
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

