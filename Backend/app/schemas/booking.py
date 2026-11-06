from datetime import date, time, datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from app.schemas.payment import PaymentResponse

class BookingCreate(BaseModel):
    pitch_id: int = Field(..., description="ID sân muốn đặt")
    booking_date: date = Field(..., description="Ngày đặt sân (YYYY-MM-DD)")
    start_time: str = Field(..., description="Giờ bắt đầu (định dạng HH:MM, ví dụ: '16:00')")
    end_time: str = Field(..., description="Giờ kết thúc (định dạng HH:MM, ví dụ: '17:30')")
    customer_name: str = Field(..., min_length=2, max_length=100, description="Tên khách hàng / Đội trưởng")
    customer_phone: str = Field(..., min_length=9, max_length=15, description="Số điện thoại")
    note: Optional[str] = Field(None, description="Ghi chú đồ tập, bóng, nước...")
    payment_method: str = Field("qr", description="Phương thức: 'qr' hoặc 'cash'")

class BookingStatusUpdate(BaseModel):
    status: str = Field(..., description="pending, confirmed, completed, cancelled")

class BookingResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    pitch_id: int
    booking_date: date
    start_time: time
    end_time: time
    total_price: float
    customer_name: str
    customer_phone: str
    note: Optional[str] = None
    status: str
    created_at: datetime
    pitch_name: Optional[str] = None
    payments: List[PaymentResponse] = []

    class Config:
        from_attributes = True

class SlotItem(BaseModel):
    pitch_id: int
    pitch_name: str
    start_time: str
    end_time: str
    is_available: bool
    price: float
    booked_by: Optional[str] = None
    status_label: str

class DaySlotsResponse(BaseModel):
    date: date
    pitch_id: Optional[int] = None
    slots: List[SlotItem]

