# app/deps_auth.py
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from app.core.config import JWT_ALG, JWT_SECRET
from app.core.security import decode_token

security = HTTPBearer(auto_error=False)

def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(security),
):
    if not creds or not creds.credentials:
        raise HTTPException(status_code=401, detail="Token ausente.")

    token = creds.credentials
    try:
        payload = decode_token(token, JWT_SECRET, JWT_ALG)
        return payload
    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido ou expirado.")
