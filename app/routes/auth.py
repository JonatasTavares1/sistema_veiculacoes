# app/routes/auth.py
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.deps import get_db
from app.core.config import (
    ALLOWED_EMAIL_DOMAIN,
    JWT_ALG,
    JWT_EXPIRES_MINUTES,
    JWT_SECRET,
    FRONTEND_BASE_URL,
    RESET_TOKEN_EXPIRES_MINUTES,
)
from app.core.security import create_access_token, verify_password
from app.core.email import send_email
from app.crud.users import (
    get_user_by_email,
    create_user_pending,
    set_reset_token,
    get_user_by_reset_token,
    clear_reset_token,
    update_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginIn(BaseModel):
    email: EmailStr
    senha: str


class RegisterIn(BaseModel):
    email: EmailStr
    senha: str


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str
    nova_senha: str


class UserOut(BaseModel):
    id: int
    email: EmailStr
    role: str
    # ✅ NOVO: devolve vínculo do executivo (para renderizar "Meu Perfil")
    executivo_nome: str | None = None


class LoginOut(BaseModel):
    token: str
    user: UserOut


def _enforce_domain(email: str):
    if not email.endswith(ALLOWED_EMAIL_DOMAIN):
        raise HTTPException(
            status_code=403,
            detail=f"Acesso permitido apenas para e-mails {ALLOWED_EMAIL_DOMAIN}",
        )


@router.post("/login", response_model=LoginOut)
def login(data: LoginIn, db: Session = Depends(get_db)):
    email = data.email.strip().lower()
    _enforce_domain(email)

    user = get_user_by_email(db, email)
    if not user:
        raise HTTPException(status_code=401, detail="Credenciais inválidas.")

    if not getattr(user, "is_approved", False):
        raise HTTPException(
            status_code=403,
            detail="Cadastro pendente de aprovação do administrador.",
        )

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
        user=UserOut(
            id=user.id,
            email=user.email,
            role=user.role,
            executivo_nome=getattr(user, "executivo_nome", None),
        ),
    )


@router.post("/register")
def register(data: RegisterIn, db: Session = Depends(get_db)):
    email = data.email.strip().lower()
    _enforce_domain(email)

    if not data.senha or len(data.senha.strip()) < 6:
        raise HTTPException(
            status_code=400,
            detail="A senha deve ter pelo menos 6 caracteres.",
        )

    exists = get_user_by_email(db, email)
    if exists:
        raise HTTPException(
            status_code=409,
            detail="Usuário já existe. Tente recuperar a senha ou aguarde aprovação.",
        )

    user = create_user_pending(db, email=email, senha=data.senha)
    return {
        "ok": True,
        "message": "Cadastro enviado para aprovação. Você receberá um e-mail após aprovação.",
        "user_id": user.id,
    }


@router.post("/forgot-password")
def forgot_password(data: ForgotIn, db: Session = Depends(get_db)):
    email = data.email.strip().lower()
    _enforce_domain(email)

    user = get_user_by_email(db, email)

    # Sempre retornar OK (não vaza se existe ou não)
    if not user or not getattr(user, "is_approved", False):
        return {
            "ok": True,
            "message": "Se este e-mail estiver habilitado, enviaremos instruções de redefinição.",
        }

    token = uuid4().hex
    set_reset_token(db, user, token, minutes=RESET_TOKEN_EXPIRES_MINUTES)

    link = f"{FRONTEND_BASE_URL}/reset-password?token={token}"
    send_email(
        to_email=user.email,
        subject="Redefinição de senha - Sistema de Veiculações",
        body=(
            "Olá.\n\n"
            f"Para redefinir sua senha, acesse o link abaixo (válido por {RESET_TOKEN_EXPIRES_MINUTES} minutos):\n"
            f"{link}\n\n"
            "Se você não solicitou, ignore este e-mail."
        ),
    )

    return {
        "ok": True,
        "message": "Se este e-mail estiver habilitado, enviaremos instruções de redefinição.",
    }


@router.post("/reset-password")
def reset_password(data: ResetIn, db: Session = Depends(get_db)):
    token = (data.token or "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="Token inválido.")

    if not data.nova_senha or len(data.nova_senha.strip()) < 6:
        raise HTTPException(
            status_code=400,
            detail="A nova senha deve ter pelo menos 6 caracteres.",
        )

    user = get_user_by_reset_token(db, token)
    if not user:
        raise HTTPException(status_code=400, detail="Token inválido ou expirado.")

    if not getattr(user, "reset_token_expires_at", None) or user.reset_token_expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Token inválido ou expirado.")

    update_password(db, user, data.nova_senha)
    clear_reset_token(db, user)

    return {"ok": True, "message": "Senha atualizada com sucesso."}
