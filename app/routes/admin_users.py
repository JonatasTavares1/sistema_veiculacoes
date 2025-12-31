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
    role: str = "user"  # "user" ou "admin" (se você permitir)


class UserItem(BaseModel):
    id: int
    email: EmailStr
    role: str
    is_approved: bool
    status: str


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
            is_approved=u.is_approved,
            status=u.status,
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

    # define role (opcional)
    role = (data.role or "user").strip().lower()
    if role not in ("user", "admin"):
        raise HTTPException(status_code=400, detail="Role inválida. Use 'user' ou 'admin'.")

    set_user_role(db, user_id=user_id, role=role)
    approve_user(db, user_id=user_id, approved_by=int(current_user.id))

    # e-mail de notificação
    send_email(
        to_email=user.email,
        subject="Cadastro aprovado - Sistema de Veiculações",
        body=(
            "Seu cadastro foi aprovado.\n\n"
            f"Você já pode fazer login em:\n{FRONTEND_BASE_URL}/login\n"
        ),
    )

    return {"ok": True, "message": "Usuário aprovado e notificado por e-mail."}


@router.post("/{user_id}/reject")
def reject(
    user_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    # opcional: se você quiser rejeição, implementamos no CRUD também.
    from app.crud.users import reject_user

    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    if user.status == "REJEITADO":
        return {"ok": True, "message": "Usuário já está rejeitado."}

    reject_user(db, user_id=user_id, approved_by=int(current_user.id))

    return {"ok": True, "message": "Usuário rejeitado com sucesso."}
