from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Float, Date, Time, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    pitch_id = Column(Integer, ForeignKey("pitches.id", ondelete="CASCADE"), nullable=False)
    
    booking_date = Column(Date, index=True, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    total_price = Column(Float, nullable=False)
    
    customer_name = Column(String(100), nullable=False)
    customer_phone = Column(String(20), nullable=False)
    note = Column(Text, nullable=True)
    
    # Trạng thái đặt sân: "pending" (chờ xác nhận), "confirmed" (đã xác nhận), "cancelled" (đã hủy), "completed" (hoàn thành)
    status = Column(String(20), default="pending", nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Quan hệ
    user = relationship("User", back_populates="bookings")
    pitch = relationship("Pitch", back_populates="bookings")
    payments = relationship("Payment", back_populates="booking", cascade="all, delete-orphan")

