from datetime import datetime
from pydantic import BaseModel, Field

class PaymentCreate(BaseModel):
    booking_id: int
    amount: float = Field(..., gt=0)
    payment_method: str = Field("cash", description="cash hoặc qr")
    payment_status: str = Field("unpaid", description="unpaid, deposit, paid")

class PaymentResponse(BaseModel):
    id: int
    booking_id: int
    amount: float
    payment_method: str
    payment_status: str
    created_at: datetime

    class Config:
        from_attributes = True

