from sqlalchemy import Column, Integer, String, Text, Float
from sqlalchemy.orm import relationship
from app.database import Base

class Pitch(Base):
    __tablename__ = "pitches"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    pitch_name = Column(String(100), nullable=False)  # ví dụ: "Sân 1 (7 Pro)"
    pitch_type = Column(String(50), nullable=False)   # ví dụ: "Sân 7 người"
    description = Column(Text, nullable=True)
    price_per_hour = Column(Float, nullable=False, default=300000.0)
    status = Column(String(20), default="active", nullable=False)  # "active" hoặc "maintenance"

    # Quan hệ với bảng Bookings
    bookings = relationship("Booking", back_populates="pitch")

