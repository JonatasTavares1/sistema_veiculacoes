# app/routes/admin_users.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.deps import get_db
from app.core.email import send_email
from app.core.security import get_current_user  # você precisa ter isso no seu projeto
from app.crud.users import list_pending_users, get_user_by_id, approve_user
from app.core.config import FRONTEND_BASE_URL

router = APIRouter(prefix="/admin/users", tags=["admin"])

class ApproveIn(BaseModel):
    role: str = "user"

class UserItem(BaseModel):
    id: int
    email: EmailStr
    role: str
    is_approved: bool

def _require_admin(current_user):
    if not current_user or getattr(current_user, "role", None) != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito ao administrador.")

@router.get("/pending", response_model=list[UserItem])
def pending(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    _require_admin(current_user)
    users = list_pending_users(db)
    return [
        UserItem(id=u.id, email=u.email, role=u.role, is_approved=u.is_approved)
        for u in users
    ]

@router.post("/{user_id}/approve")
def approve(user_id: int, data: ApproveIn, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    _require_admin(current_user)
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    if user.is_approved:
        return {"ok": True, "message": "Usuário já está aprovado."}

    approve_user(db, user, role=data.role)

    send_email(
        to_email=user.email,
        subject="Cadastro aprovado - Sistema de Veiculações",
        body=f"Seu cadastro foi aprovado.\n\nVocê já pode fazer login em:\n{FRONTEND_BASE_URL}/login\n",
    )

    return {"ok": True, "message": "Usuário aprovado e notificado por e-mail."}
