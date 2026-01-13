# app/routes/admin_users.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.deps import get_db
from app.deps_auth import require_admin
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
    # ✅ NOVO: se role=executivo, precisa vir preenchido
    executivo_nome: str | None = None


class UserItem(BaseModel):
    id: int
    email: EmailStr
    role: str
    status: str
    is_approved: bool
    executivo_nome: str | None = None


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
            executivo_nome=getattr(u, "executivo_nome", None),
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

    role = (data.role or "user").strip().lower()

    allowed_roles = {"user", "admin", "executivo", "financeiro"}
    if role not in allowed_roles:
        raise HTTPException(
            status_code=422,
            detail=f"Role inválida. Use: {', '.join(sorted(allowed_roles))}",
        )

    # ✅ se for executivo, executivo_nome é obrigatório
    if role == "executivo":
        exec_nome = (data.executivo_nome or "").strip()
        if not exec_nome:
            raise HTTPException(status_code=422, detail="Para role=executivo, informe executivo_nome.")
        user.executivo_nome = exec_nome
    else:
        user.executivo_nome = None

    # Ajusta role
    set_user_role(db, user_id=user.id, role=role)

    # aprova
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
