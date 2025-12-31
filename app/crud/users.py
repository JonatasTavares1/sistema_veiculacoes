# app/crud/users.py
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models_auth import User


def get_user_by_email(db: Session, email: str) -> User | None:
    email = (email or "").strip().lower()
    return db.execute(select(User).where(User.email == email)).scalars().first()


def get_user_by_id(db: Session, user_id: int) -> User | None:
    return db.execute(select(User).where(User.id == user_id)).scalars().first()


def create_user(db: Session, nome: str | None, email: str, password_hash: str, role: str = "user") -> User:
    u = User(
        nome=(nome or None),
        email=email.strip().lower(),
        password_hash=password_hash,
        role=role,
        status="PENDENTE",
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def list_users(db: Session, status: str | None = None) -> list[User]:
    q = select(User).order_by(User.created_at.desc())
    if status:
        q = q.where(User.status == status)
    return list(db.execute(q).scalars().all())


def approve_user(db: Session, user_id: int, approved_by: int) -> User:
    u = get_user_by_id(db, user_id)
    if not u:
        raise ValueError("Usuário não encontrado.")
    u.status = "APROVADO"
    u.approved_at = datetime.utcnow()
    u.approved_by = approved_by
    db.commit()
    db.refresh(u)
    return u


def reject_user(db: Session, user_id: int, approved_by: int) -> User:
    u = get_user_by_id(db, user_id)
    if not u:
        raise ValueError("Usuário não encontrado.")
    u.status = "REJEITADO"
    u.approved_at = datetime.utcnow()
    u.approved_by = approved_by
    db.commit()
    db.refresh(u)
    return u


def update_password(db: Session, user_id: int, new_password_hash: str) -> User:
    u = get_user_by_id(db, user_id)
    if not u:
        raise ValueError("Usuário não encontrado.")
    u.password_hash = new_password_hash
    db.commit()
    db.refresh(u)
    return u
