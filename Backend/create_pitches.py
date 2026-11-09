import sys
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from app.database import SessionLocal, Base, engine
from app.models.pitch import Pitch

PITCHES = [
    {"pitch_name": "Sân 1 (7 Pro)", "pitch_type": "Sân 7", "description": "Sân cỏ nhân tạo 7 người, đèn LED", "price_per_hour": 380000},
    {"pitch_name": "Sân 2 (7 Pro)", "pitch_type": "Sân 7", "description": "Sân cỏ nhân tạo 7 người, đèn LED", "price_per_hour": 380000},
]

def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        for p in PITCHES:
            exists = db.query(Pitch).filter(Pitch.pitch_name == p["pitch_name"]).first()
            if exists:
                print(f"Da co san: {p['pitch_name']} (id={exists.id})")
                continue
            pitch = Pitch(**p, status="active")
            db.add(pitch)
            db.commit()
            db.refresh(pitch)
            print(f"Da tao san: {pitch.pitch_name} (id={pitch.id})")
    except Exception as e:
        db.rollback()
        print(f"[Loi] {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
