from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    full_name = Column(String(100), nullable=False)
    phone = Column(String(20), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), default="customer", nullable=False)  # "admin" hoặc "customer"
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Quan hệ với bảng Bookings
    bookings = relationship("Booking", back_populates="user", cascade="all, delete-orphan")

