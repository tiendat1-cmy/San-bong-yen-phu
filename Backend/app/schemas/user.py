from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field

class UserRegister(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100, description="Họ và tên")
    phone: str = Field(..., min_length=9, max_length=15, description="Số điện thoại")
    password: str = Field(..., min_length=6, description="Mật khẩu tối thiểu 6 ký tự")
    email: Optional[EmailStr] = Field(None, description="Email (tùy chọn)")

class UserLogin(BaseModel):
    login_id: str = Field(..., description="Số điện thoại hoặc Email đăng nhập")
    password: str = Field(..., description="Mật khẩu")

class UserResponse(BaseModel):
    id: int
    full_name: str
    phone: str
    email: Optional[str] = None
    role: str
    created_at: datetime

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

