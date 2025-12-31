# app/crud/password_resets.py
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models_password_reset import PasswordReset


def create_reset(db: Session, user_id: int, token_hash: str, expires_minutes: int) -> PasswordReset:
    pr = PasswordReset(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=datetime.utcnow() + timedelta(minutes=expires_minutes),
    )
    db.add(pr)
    db.commit()
    db.refresh(pr)
    return pr


def get_valid_reset_by_hash(db: Session, token_hash: str) -> PasswordReset | None:
    now = datetime.utcnow()
    q = (
        select(PasswordReset)
        .where(PasswordReset.token_hash == token_hash)
        .where(PasswordReset.used_at.is_(None))
        .where(PasswordReset.expires_at > now)
        .order_by(PasswordReset.created_at.desc())
    )
    return db.execute(q).scalars().first()


def mark_used(db: Session, pr: PasswordReset) -> PasswordReset:
    pr.used_at = datetime.utcnow()
    db.commit()
    db.refresh(pr)
    return pr
