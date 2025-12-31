# app/crud/users.py
from sqlalchemy.orm import Session
from app.models_auth import User
from app.core.security import hash_password

def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()

def create_user(db: Session, email: str, password: str, role: str = "user"):
    user = User(
        email=email.strip().lower(),
        password_hash=hash_password(password),
        role=role or "user",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
