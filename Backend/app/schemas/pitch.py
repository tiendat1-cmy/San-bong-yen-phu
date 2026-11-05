from typing import Optional
from pydantic import BaseModel, Field

class PitchBase(BaseModel):
    pitch_name: str = Field(..., max_length=100, description="Tên sân")
    pitch_type: str = Field(..., max_length=50, description="Loại sân (ví dụ: Sân 7 người)")
    description: Optional[str] = None
    price_per_hour: float = Field(..., gt=0, description="Giá thuê theo giờ (VNĐ)")
    status: str = Field("active", description="Trạng thái: active hoặc maintenance")

class PitchCreate(PitchBase):
    pass

class PitchUpdate(BaseModel):
    pitch_name: Optional[str] = None
    pitch_type: Optional[str] = None
    description: Optional[str] = None
    price_per_hour: Optional[float] = Field(None, gt=0)
    status: Optional[str] = None

class PitchResponse(PitchBase):
    id: int

    class Config:
        from_attributes = True

