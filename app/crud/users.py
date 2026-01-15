# app/crud/users.py
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models_auth import User
from app.core.security import hash_password


def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def get_user_by_email(db: Session, email: str) -> User | None:
    email = normalize_email(email)
    return db.execute(select(User).where(User.email == email)).scalars().first()


def get_user_by_id(db: Session, user_id: int) -> User | None:
    return db.execute(select(User).where(User.id == user_id)).scalars().first()


def list_users(db: Session, status: str | None = None) -> list[User]:
    q = select(User).order_by(User.created_at.desc())
    if status:
        q = q.where(User.status == status)
    return list(db.execute(q).scalars().all())


def list_pending_users(db: Session) -> list[User]:
    q = (
        select(User)
        .where(User.status == "PENDENTE")
        .order_by(User.created_at.desc())
    )
    return list(db.execute(q).scalars().all())


def create_user(
    db: Session,
    email: str,
    senha: str,
    role: str = "user",
    nome: str | None = None,
    is_approved: bool = False,
) -> User:
    email_norm = normalize_email(email)
    role_norm = (role or "user").strip().lower()

    u = User(
        nome=(nome or None),
        email=email_norm,
        password_hash=hash_password(senha),
        role=role_norm,
        is_approved=bool(is_approved),
        status=("APROVADO" if is_approved else "PENDENTE"),
        approved_at=(datetime.utcnow() if is_approved else None),
        approved_by=None,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def create_user_pending(db: Session, email: str, senha: str, nome: str | None = None) -> User:
    email_norm = normalize_email(email)

    u = User(
        nome=(nome or None),
        email=email_norm,
        password_hash=hash_password(senha),
        role="user",
        status="PENDENTE",
        is_approved=False,
        approved_at=None,
        approved_by=None,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def set_user_role(db: Session, user_id: int, role: str) -> User:
    u = get_user_by_id(db, user_id)
    if not u:
        raise ValueError("Usuário não encontrado.")
    u.role = (role or "user").strip().lower()
    db.commit()
    db.refresh(u)
    return u


def approve_user(db: Session, user_id: int, approved_by: int | None = None) -> User:
    u = get_user_by_id(db, user_id)
    if not u:
        raise ValueError("Usuário não encontrado.")

    u.status = "APROVADO"
    u.is_approved = True
    u.approved_at = datetime.utcnow()
    u.approved_by = approved_by
    db.commit()
    db.refresh(u)
    return u


def reject_user(db: Session, user_id: int, approved_by: int | None = None) -> User:
    u = get_user_by_id(db, user_id)
    if not u:
        raise ValueError("Usuário não encontrado.")

    u.status = "REJEITADO"
    u.is_approved = False
    u.approved_at = datetime.utcnow()
    u.approved_by = approved_by
    db.commit()
    db.refresh(u)
    return u


def set_reset_token(db: Session, user: User, token: str, minutes: int) -> User:
    user.reset_token = (token or "").strip()
    user.reset_token_expires_at = datetime.utcnow() + timedelta(minutes=int(minutes))
    db.commit()
    db.refresh(user)
    return user


def get_user_by_reset_token(db: Session, token: str) -> User | None:
    token = (token or "").strip()
    if not token:
        return None
    return db.execute(select(User).where(User.reset_token == token)).scalars().first()


def clear_reset_token(db: Session, user: User) -> User:
    user.reset_token = None
    user.reset_token_expires_at = None
    db.commit()
    db.refresh(user)
    return user


def update_password(db: Session, user: User, nova_senha: str) -> User:
    user.password_hash = hash_password(nova_senha)
    db.commit()
    db.refresh(user)
    return user


# =========================
# ✅ NOVOS HELPERS p/ AdminUsers.tsx (GET /admin/users + POST /admin/users/:id/update)
# =========================

def list_all_users(db: Session) -> list[User]:
    """
    Retorna todos os usuários (admin) ordenando do mais novo para o mais antigo.
    """
    # pode reaproveitar list_users sem filtro
    return list_users(db, status=None)


def update_user_fields(db: Session, user: User) -> User:
    """
    Persiste alterações em um usuário já carregado (role, executivo_nome, ativo, is_approved, etc).
    """
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
