import os
import bcrypt
from jose import JWTError, jwt
from datetime import datetime, timedelta

SECRET_KEY     = os.environ.get("SECRET_KEY", "")
ALGORITHM      = "HS256"
EXPIRE_MINUTES = 60 * 8

if not SECRET_KEY:
    raise RuntimeError(
        "SECRET_KEY manquant ! Définissez-le dans le fichier .env avant de démarrer."
    )

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))

def create_token(data: dict) -> str:
    to_encode = data.copy()
    expire    = datetime.utcnow() + timedelta(minutes=EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])