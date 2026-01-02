# app/core/security.py
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
import jwt

pwd_context = CryptContext(
    schemes=["bcrypt_sha256", "bcrypt"],
    deprecated="auto",
)

def hash_password(password: str) -> str:
    # Gera sempre com o primeiro scheme ("bcrypt_sha256")
    return pwd_context.hash(password)

def verify_password(plain_password: str, password_hash: str) -> bool:
    # Verifica tanto bcrypt_sha256 quanto bcrypt (se existir legado)
    return pwd_context.verify(plain_password, password_hash)

def create_access_token(
    payload: dict,
    secret: str,
    algorithm: str,
    expires_minutes: int
) -> str:
    to_encode = dict(payload)

    # Token com exp em UTC (timezone-aware)
    expire = datetime.now(timezone.utc) + timedelta(minutes=int(expires_minutes))
    to_encode.update({"exp": expire})

    return jwt.encode(to_encode, secret, algorithm=algorithm)

