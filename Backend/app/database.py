import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.exc import OperationalError
from app.config import settings

logger = logging.getLogger("uvicorn.error")

# Khởi tạo Base cho các Model
Base = declarative_base()

def get_engine():
    """
    Tạo engine kết nối Database.
    Ưu tiên kết nối MySQL theo cấu hình.
    Nếu MySQL chưa bật hoặc chưa cài, tự động fallback sang SQLite
    để người mới học có thể chạy và test API ngay lập tức mà không bị crash.
    """
    if settings.USE_SQLITE:
        logger.info("[Database] Sử dụng SQLite database theo cấu hình USE_SQLITE=True.")
        return create_engine(
            "sqlite:///./dat_san_bong.db", 
            connect_args={"check_same_thread": False}
        )

    # Thử kết nối MySQL
    try:
        engine = create_engine(
            settings.DATABASE_URL,
            pool_pre_ping=True,
            pool_recycle=3600
        )
        # Kiểm tra kết nối thử
        with engine.connect() as conn:
            logger.info("[Database] Kết nối MySQL thành công: %s", settings.DATABASE_URL.split("@")[-1])
            return engine
    except (OperationalError, Exception) as e:
        logger.warning(
            "[Database] Không thể kết nối tới MySQL (%s). "
            "Tự động chuyển sang SQLite (./dat_san_bong.db) để đảm bảo ứng dụng hoạt động thông suốt. "
            "Khi bạn khởi động MySQL Server, ứng dụng sẽ tự động kết nối lại MySQL.",
            str(e)
        )
        return create_engine(
            "sqlite:///./dat_san_bong.db", 
            connect_args={"check_same_thread": False}
        )

engine = get_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    """Dependency cung cấp session database cho mỗi request FastAPI"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

