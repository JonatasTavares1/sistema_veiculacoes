# app/routes/admin_users.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.deps import get_db
from app.deps_auth import require_admin
from app.core.email import send_email
from app.core.config import FRONTEND_BASE_URL

# CRUD existente
from app.crud.users import (
    list_pending_users,
    get_user_by_id,
    approve_user,
    set_user_role,
)

# ✅ AJUSTE ESTE IMPORT PARA O SEU MODEL REAL
# Ex.: from app.models import User
from app.models import User  # <- ajuste se necessário

router = APIRouter(prefix="/admin/users", tags=["admin"])


# =========================
# Schemas
# =========================
class ApproveIn(BaseModel):
    role: str = "user"
    # se role=executivo, precisa vir preenchido
    executivo_nome: str | None = None


class UpdateIn(BaseModel):
    role: str | None = None
    executivo_nome: str | None = None
    ativo: bool | None = None
    is_approved: bool | None = None


class UserItem(BaseModel):
    id: int
    email: EmailStr
    role: str
    status: str | None = None
    is_approved: bool
    executivo_nome: str | None = None
    ativo: bool | None = None
    created_at: str | None = None


# =========================
# Helpers
# =========================
def _allowed_roles():
    return {"user", "admin", "executivo", "financeiro"}


def _to_item(u) -> UserItem:
    return UserItem(
        id=u.id,
        email=u.email,
        role=u.role,
        status=getattr(u, "status", None),
        is_approved=bool(getattr(u, "is_approved", False)),
        executivo_nome=getattr(u, "executivo_nome", None),
        ativo=getattr(u, "ativo", None),
        created_at=str(getattr(u, "created_at", None)) if getattr(u, "created_at", None) else None,
    )


# =========================
# Rotas existentes
# =========================
@router.get("/pending", response_model=list[UserItem])
def pending(
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    users = list_pending_users(db)
    return [_to_item(u) for u in users]


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

    allowed_roles = _allowed_roles()
    if role not in allowed_roles:
        raise HTTPException(
            status_code=422,
            detail=f"Role inválida. Use: {', '.join(sorted(allowed_roles))}",
        )

    # se for executivo, executivo_nome é obrigatório
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

    db.add(user)
    db.commit()
    db.refresh(user)

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


# =========================
# ✅ NOVAS ROTAS (para corrigir o 404 do front)
# =========================
@router.get("", response_model=list[UserItem])
def list_all_users(
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    # lista todos (você pode ordenar como quiser)
    users = db.query(User).order_by(User.id.desc()).all()
    return [_to_item(u) for u in users]


@router.post("/{user_id}/update", response_model=UserItem)
def update_user(
    user_id: int,
    data: UpdateIn,
    db: Session = Depends(get_db),
    current_user=Depends(require_admin),
):
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    allowed_roles = _allowed_roles()

    # role
    if data.role is not None:
        role = (data.role or "user").strip().lower()
        if role not in allowed_roles:
            raise HTTPException(
                status_code=422,
                detail=f"Role inválida. Use: {', '.join(sorted(allowed_roles))}",
            )

        # aplica role via crud (se quiser manter padrão)
        set_user_role(db, user_id=user.id, role=role)

        # regra: executivo_nome obrigatório se role=executivo
        if role == "executivo":
            exec_nome = (data.executivo_nome or "").strip()
            if not exec_nome:
                raise HTTPException(status_code=422, detail="Para role=executivo, informe executivo_nome.")
            user.executivo_nome = exec_nome
        else:
            # se não for executivo, remove vínculo
            user.executivo_nome = None

    # executivo_nome (permitir atualizar sem trocar role, mas só se já for executivo)
    if data.role is None and data.executivo_nome is not None:
        current_role = (getattr(user, "role", "user") or "user").strip().lower()
        if current_role == "executivo":
            exec_nome = (data.executivo_nome or "").strip()
            if not exec_nome:
                raise HTTPException(status_code=422, detail="Para role=executivo, informe executivo_nome.")
            user.executivo_nome = exec_nome
        else:
            # se não é executivo, ignora/zera
            user.executivo_nome = None

    # ativo
    if data.ativo is not None:
        # se seu model não tiver "ativo", isso precisa existir no model/DB
        setattr(user, "ativo", bool(data.ativo))

    # is_approved (revogar / reaprovar)
    if data.is_approved is not None:
        user.is_approved = bool(data.is_approved)

    db.add(user)
    db.commit()
    db.refresh(user)

    return _to_item(user)
