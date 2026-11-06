from datetime import date, datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.pitch import Pitch
from app.models.booking import Booking
from app.models.payment import Payment
from app.models.user import User
from app.schemas.pitch import PitchCreate, PitchUpdate, PitchResponse
from app.schemas.booking import BookingResponse, BookingStatusUpdate
from app.dependencies.auth import get_current_admin_user

router = APIRouter(prefix="/admin", tags=["Quản trị viên (Bảo vệ bằng JWT Admin)"])

@router.get("/dashboard")
def get_dashboard_summary(
    target_date: Optional[date] = Query(default_factory=lambda: datetime.now().date()),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    """Thống kê doanh thu, số lượt đặt và tình trạng cụm sân hôm nay"""
    # 1. Tổng đơn đặt trong ngày (không tính đơn hủy)
    today_bookings = db.query(Booking).filter(
        Booking.booking_date == target_date,
        Booking.status != "cancelled"
    ).all()

    total_projected_revenue = sum(b.total_price for b in today_bookings)
    total_slots_booked = len(today_bookings)

    # 2. Thống kê theo từng sân
    pitches = db.query(Pitch).all()
    pitch_metrics = []
    for p in pitches:
        p_count = sum(1 for b in today_bookings if b.pitch_id == p.id)
        pitch_metrics.append({
            "pitch_id": p.id,
            "pitch_name": p.pitch_name,
            "pitch_type": p.pitch_type,
            "status": p.status,
            "booked_count": p_count
        })

    # 3. Tiền đã thanh toán / đã cọc
    collected_amount = db.query(func.sum(Payment.amount)).join(Booking).filter(
        Booking.booking_date == target_date,
        Payment.payment_status.in_(["deposit", "paid"])
    ).scalar() or 0.0

    return {
        "date": str(target_date),
        "total_revenue_projected": total_projected_revenue,
        "collected_amount": collected_amount,
        "total_bookings_count": total_slots_booked,
        "pitch_metrics": pitch_metrics,
        "admin_name": admin.full_name
    }

@router.get("/bookings", response_model=List[BookingResponse])
def get_admin_bookings(
    pitch_id: Optional[int] = None,
    booking_date: Optional[date] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    """Xem danh sách các đơn đặt sân với bộ lọc linh hoạt"""
    query = db.query(Booking)
    if pitch_id:
        query = query.filter(Booking.pitch_id == pitch_id)
    if booking_date:
        query = query.filter(Booking.booking_date == booking_date)
    if status:
        query = query.filter(Booking.status == status)

    bookings = query.order_by(Booking.booking_date.desc(), Booking.start_time.asc()).all()
    
    results = []
    for b in bookings:
        item = BookingResponse.model_validate(b)
        item.pitch_name = b.pitch.pitch_name if b.pitch else "Sân bóng"
        results.append(item)
    return results

@router.patch("/bookings/{booking_id}", response_model=BookingResponse)
def update_booking_status(
    booking_id: int,
    status_update: BookingStatusUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    """Cập nhật trạng thái đơn đặt sân: pending, confirmed, completed, cancelled"""
    valid_statuses = ["pending", "confirmed", "completed", "cancelled"]
    new_status = status_update.status.lower()
    if new_status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Trạng thái không hợp lệ. Chỉ chấp nhận: {', '.join(valid_statuses)}"
        )

    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn đặt sân.")

    booking.status = new_status

    # Nếu hoàn thành trận đấu (completed), tự động đánh dấu đã thanh toán đủ
    if new_status == "completed":
        for payment in booking.payments:
            payment.payment_status = "paid"

    db.commit()
    db.refresh(booking)

    item = BookingResponse.model_validate(booking)
    item.pitch_name = booking.pitch.pitch_name if booking.pitch else "Sân bóng"
    return item

@router.delete("/bookings/{booking_id}")
def delete_or_cancel_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    """Hủy đơn đặt sân an toàn (chuyển trạng thái sang 'cancelled')"""
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn đặt sân.")

    booking.status = "cancelled"
    db.commit()
    return {"message": f"Đã hủy đơn đặt sân #{booking.id} thành công!"}

@router.post("/pitches", response_model=PitchResponse, status_code=status.HTTP_201_CREATED)
def create_pitch(
    pitch_in: PitchCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    """Thêm sân bóng mới vào cụm sân"""
    new_pitch = Pitch(**pitch_in.model_dump())
    db.add(new_pitch)
    db.commit()
    db.refresh(new_pitch)
    return new_pitch

@router.put("/pitches/{pitch_id}", response_model=PitchResponse)
def update_pitch(
    pitch_id: int,
    pitch_update: PitchUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    """Sửa thông tin hoặc chuyển chế độ bảo trì sân bóng"""
    pitch = db.query(Pitch).filter(Pitch.id == pitch_id).first()
    if not pitch:
        raise HTTPException(status_code=404, detail="Không tìm thấy sân bóng.")

    update_data = pitch_update.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(pitch, field, val)

    db.commit()
    db.refresh(pitch)
    return pitch

@router.delete("/pitches/{pitch_id}")
def deactivate_pitch(
    pitch_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    """Chuyển sân sang chế độ bảo trì an toàn thay vì xóa vĩnh viễn dữ liệu lịch sử"""
    pitch = db.query(Pitch).filter(Pitch.id == pitch_id).first()
    if not pitch:
        raise HTTPException(status_code=404, detail="Không tìm thấy sân bóng.")

    pitch.status = "maintenance"
    db.commit()
    return {"message": f"Đã chuyển {pitch.pitch_name} sang chế độ bảo trì."}

