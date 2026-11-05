from app.routers.auth import router as auth_router
from app.routers.pitches import router as pitches_router
from app.routers.bookings import router as bookings_router
from app.routers.admin import router as admin_router

__all__ = ["auth_router", "pitches_router", "bookings_router", "admin_router"]

