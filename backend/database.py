import os
from dotenv import load_dotenv
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '.env'))
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DATABASE_URL = os.environ.get("DATABASE_URL_SYNC") or os.environ.get("DATABASE_URL", "").replace("+asyncpg", "")

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL non définie ! "
        "Vérifiez votre fichier .env etquezvous que DATABASE_URL ou DATABASE_URL_SYNC est défini."
    )

engine = create_engine(DATABASE_URL, echo=False)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()