from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False)
    amount = Column(Float, nullable=False)
    
    # Phương thức: "cash" (tiền mặt), "qr" (chuyển khoản VietQR), "bank_transfer"
    payment_method = Column(String(50), default="cash", nullable=False)
    
    # Trạng thái: "unpaid" (chưa thanh toán), "deposit" (đã cọc), "paid" (đã thanh toán đủ)
    payment_status = Column(String(20), default="unpaid", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Quan hệ
    booking = relationship("Booking", back_populates="payments")

