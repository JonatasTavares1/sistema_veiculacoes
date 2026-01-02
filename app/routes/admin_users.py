# app/routes/admin_users.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.deps import get_db
from app.deps_auth import get_current_user, require_admin
from app.core.email import send_email
from app.core.config import FRONTEND_BASE_URL
from app.crud.users import (
    list_pending_users,
    get_user_by_id,
    approve_user,
    set_user_role,
)

router = APIRouter(prefix="/admin/users", tags=["admin"])


class ApproveIn(BaseModel):
    role: str = "user"


class UserItem(BaseModel):
    id: int
    email: EmailStr
    role: str
    status: str
    is_approved: bool


@router.get("/pending", response_model=list[UserItem])
def pending(
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    users = list_pending_users(db)
    return [
        UserItem(
            id=u.id,
            email=u.email,
            role=u.role,
            status=u.status,
            is_approved=u.is_approved,
        )
        for u in users
    ]


@router.post("/{user_id}/approve")
def approve(
    user_id: int,
    data: ApproveIn,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    if user.is_approved:
        return {"ok": True, "message": "Usuário já está aprovado."}

    # Ajusta role (se vier diferente)
    role = (data.role or "user").strip().lower()
    set_user_role(db, user_id=user.id, role=role)

    # Aprova (registra quem aprovou)
    approve_user(db, user_id=user.id, approved_by=current_user.id)

    # Notifica por e-mail
    send_email(
        to_email=user.email,
        subject="Cadastro aprovado - Sistema de Veiculações",
        body=(
            "Seu cadastro foi aprovado.\n\n"
            f"Você já pode fazer login em:\n{FRONTEND_BASE_URL}/login\n"
        ),
    )

    return {"ok": True, "message": "Usuário aprovado e notificado por e-mail."}