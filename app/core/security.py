# app/core/security.py
from datetime import datetime, timedelta, timezone
from typing import Any, Dict
import jwt
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)

def create_access_token(
    data: Dict[str, Any],
    secret: str,
    algorithm: str = "HS256",
    expires_minutes: int = 60 * 24 * 7,
) -> str:
    payload = dict(data)
    exp = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
    payload["exp"] = exp
    return jwt.encode(payload, secret, algorithm=algorithm)

def decode_token(token: str, secret: str, algorithm: str = "HS256") -> Dict[str, Any]:
    return jwt.decode(token, secret, algorithms=[algorithm])