# app/models_auth.py
from sqlalchemy import Column, Integer, String, DateTime, Boolean
from datetime import datetime
from app.models_base import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False, default="user")

    # novo: controle de aprovação
    is_approved = Column(Boolean, default=False, nullable=False)
    approved_at = Column(DateTime, nullable=True)

    # novo: reset de senha
    reset_token = Column(String, nullable=True, index=True)
    reset_token_expires_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
