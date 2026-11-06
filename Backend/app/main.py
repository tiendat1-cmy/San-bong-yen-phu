import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import engine, Base
import app.models  # Đảm bảo tất cả model được load trước khi tạo bảng
from app.routers import auth_router, pitches_router, bookings_router, admin_router

logger = logging.getLogger("uvicorn.error")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Khởi tạo bảng Database khi khởi động
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("[FastAPI] Đã kiểm tra và khởi tạo tất cả bảng Database thành công!")
    except Exception as e:
        logger.error("[FastAPI] Lỗi khi tạo bảng Database: %s", str(e))
    yield

app = FastAPI(
    title=settings.APP_NAME,
    description="Backend API quản lý và đặt sân bóng cho Sân bóng Nhà Máy Nước – Yên Phú (Bình Phú, Yên Phú, Yên Mỹ, Hưng Yên)",
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Cấu hình CORS để Frontend HTML/JS gọi được API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Cho phép tất cả origin cục bộ trong môi trường dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Đăng ký các Router API
app.include_router(auth_router, prefix="/api")
app.include_router(pitches_router, prefix="/api")
app.include_router(bookings_router, prefix="/api")
app.include_router(admin_router, prefix="/api")

@app.get("/", tags=["Trang chủ API"])
def root():
    return {
        "app": settings.APP_NAME,
        "venue": "Sân bóng Nhà Máy Nước – Yên Phú",
        "address": "Bình Phú, Yên Phú, Yên Mỹ, Hưng Yên",
        "hotline": "0988.123.456",
        "status": "Online",
        "docs_url": "/docs"
    }

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("[Global Exception] %s: %s", request.url.path, str(exc))
    return JSONResponse(
        status_code=500,
        content={"detail": "Lỗi máy chủ nội bộ. Vui lòng kiểm tra lại yêu cầu hoặc liên hệ ban quản lý."}
    )

