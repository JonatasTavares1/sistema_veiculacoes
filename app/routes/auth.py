# app/routes/auth.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.deps import get_db
from app.core.config import (
    ALLOWED_EMAIL_DOMAIN,
    JWT_ALG,
    JWT_EXPIRES_MINUTES,
    JWT_SECRET,
)
from app.core.security import create_access_token, verify_password
from app.crud.users import get_user_by_email

router = APIRouter(prefix="/auth", tags=["auth"])

class LoginIn(BaseModel):
    email: EmailStr
    senha: str

class UserOut(BaseModel):
    id: int
    email: EmailStr
    role: str

class LoginOut(BaseModel):
    token: str
    user: UserOut

@router.post("/login", response_model=LoginOut)
def login(data: LoginIn, db: Session = Depends(get_db)):
    email = data.email.strip().lower()

    # Regra principal: domínio permitido
    if not email.endswith(ALLOWED_EMAIL_DOMAIN):
        raise HTTPException(
            status_code=403,
            detail=f"Acesso permitido apenas para e-mails {ALLOWED_EMAIL_DOMAIN}",
        )

    user = get_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=401, detail="Credenciais inválidas.")

    if not verify_password(data.senha, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciais inválidas.")

    payload = {"id": user.id, "email": user.email, "role": user.role}
    token = create_access_token(
        payload,
        secret=JWT_SECRET,
        algorithm=JWT_ALG,
        expires_minutes=JWT_EXPIRES_MINUTES,
    )

    return LoginOut(
        token=token,
        user=UserOut(id=user.id, email=user.email, role=user.role),
    )
