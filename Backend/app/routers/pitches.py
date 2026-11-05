from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.pitch import Pitch
from app.schemas.pitch import PitchResponse

router = APIRouter(prefix="/pitches", tags=["Sân bóng"])

@router.get("", response_model=List[PitchResponse])
def get_all_pitches(db: Session = Depends(get_db)):
    """Lấy danh sách tất cả sân bóng tại Yên Phú"""
    pitches = db.query(Pitch).all()
    return pitches

@router.get("/{pitch_id}", response_model=PitchResponse)
def get_pitch_detail(pitch_id: int, db: Session = Depends(get_db)):
    """Xem chi tiết một sân theo ID"""
    pitch = db.query(Pitch).filter(Pitch.id == pitch_id).first()
    if not pitch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy sân bóng yêu cầu."
        )
    return pitch

