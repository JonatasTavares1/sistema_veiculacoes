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
    # ✅ novos (adicione no crud/users.py)
    list_all_users,
    update_user_fields,
)

router = APIRouter(prefix="/admin/users", tags=["admin"])


# =========================
# Schemas
# =========================
class ApproveIn(BaseModel):
    role: str = "user"
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
    # ✅ agora inclui opec
    return {"user", "admin", "executivo", "financeiro", "opec"}


def _to_item(u) -> UserItem:
    return UserItem(
        id=u.id,
        email=u.email,
        role=getattr(u, "role", "user") or "user",
        status=getattr(u, "status", None),
        is_approved=bool(getattr(u, "is_approved", False)),
        executivo_nome=getattr(u, "executivo_nome", None),
        ativo=getattr(u, "ativo", None),
        created_at=str(getattr(u, "created_at", None)) if getattr(u, "created_at", None) else None,
    )


# =========================
# Rotas
# =========================
@router.get("/pending", response_model=list[UserItem])
def pending(
    db: Session = Depends(get_db),
    _current_user=Depends(require_admin),
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

    if getattr(user, "is_approved", False):
        return {"ok": True, "message": "Usuário já está aprovado."}

    role = (data.role or "user").strip().lower()
    allowed_roles = _allowed_roles()
    if role not in allowed_roles:
        raise HTTPException(
            status_code=422,
            detail=f"Role inválida. Use: {', '.join(sorted(allowed_roles))}",
        )

    # regra: executivo_nome obrigatório se role=executivo
    if role == "executivo":
        exec_nome = (data.executivo_nome or "").strip()
        if not exec_nome:
            raise HTTPException(status_code=422, detail="Para role=executivo, informe executivo_nome.")
        setattr(user, "executivo_nome", exec_nome)
    else:
        # para opec/financeiro/admin/user, não mantém vínculo
        setattr(user, "executivo_nome", None)

    # Ajusta role (via CRUD)
    set_user_role(db, user_id=user.id, role=role)

    # Aprova (via CRUD)
    approve_user(db, user_id=user.id, approved_by=current_user.id)

    # garante persistência do executivo_nome (se o crud não fizer commit disso)
    db.add(user)
    db.commit()
    db.refresh(user)

    send_email(
        to_email=user.email,
        subject="Cadastro aprovado - Sistema de Veiculações",
        body=(
            "Seu cadastro foi aprovado.\n\n"
            f"Você já pode fazer login em:\n{FRONTEND_BASE_URL}/login\n"
        ),
    )

    return {"ok": True, "message": "Usuário aprovado e notificado por e-mail."}


# ✅ GET /admin/users  -> corrige o 404 do front
@router.get("", response_model=list[UserItem])
def list_users(
    db: Session = Depends(get_db),
    _current_user=Depends(require_admin),
):
    users = list_all_users(db)  # ✅ não depende de User no route
    return [_to_item(u) for u in users]


# ✅ POST /admin/users/{id}/update -> corrige o 404 do front
@router.post("/{user_id}/update", response_model=UserItem)
def update_user(
    user_id: int,
    data: UpdateIn,
    db: Session = Depends(get_db),
    _current_user=Depends(require_admin),
):
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    allowed_roles = _allowed_roles()

    # valida role (se vier)
    if data.role is not None:
        new_role = (data.role or "user").strip().lower()
        if new_role not in allowed_roles:
            raise HTTPException(
                status_code=422,
                detail=f"Role inválida. Use: {', '.join(sorted(allowed_roles))}",
            )

        # se for executivo, precisa de executivo_nome
        if new_role == "executivo":
            exec_nome = (data.executivo_nome or "").strip()
            if not exec_nome:
                raise HTTPException(status_code=422, detail="Para role=executivo, informe executivo_nome.")

        # aplica role via CRUD
        set_user_role(db, user_id=user.id, role=new_role)

        # aplica vínculo
        if new_role == "executivo":
            setattr(user, "executivo_nome", (data.executivo_nome or "").strip())
        else:
            setattr(user, "executivo_nome", None)

    # se não mudou role, mas quer mudar executivo_nome, só permite se já for executivo
    if data.role is None and data.executivo_nome is not None:
        current_role = (getattr(user, "role", "user") or "user").strip().lower()
        if current_role == "executivo":
            exec_nome = (data.executivo_nome or "").strip()
            if not exec_nome:
                raise HTTPException(status_code=422, detail="Para role=executivo, informe executivo_nome.")
            setattr(user, "executivo_nome", exec_nome)
        else:
            setattr(user, "executivo_nome", None)

    # ativo (se existir no model)
    if data.ativo is not None:
        setattr(user, "ativo", bool(data.ativo))

    # is_approved
    if data.is_approved is not None:
        setattr(user, "is_approved", bool(data.is_approved))

    # ✅ persiste (via CRUD helper)
    user = update_user_fields(db, user)

    return _to_item(user)
