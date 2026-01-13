# app/models_auth.py
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey
from datetime import datetime
from app.models_base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)

    # (opcional)
    nome = Column(String, nullable=True)

    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)

    # ✅ roles possíveis no seu sistema hoje:
    # admin | executivo | financeiro | user
    role = Column(String, nullable=False, default="user")

    # ✅ NOVO: vínculo do usuário com um executivo (nome exato como aparece em PI.executivo / Agencia.executivo / Anunciante.executivo)
    executivo_nome = Column(String, nullable=True, index=True)

    # controle de aprovação
    # status: PENDENTE | APROVADO | REJEITADO
    status = Column(String, nullable=False, default="PENDENTE")

    is_approved = Column(Boolean, default=False, nullable=False)
    approved_at = Column(DateTime, nullable=True)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    # reset de senha
    reset_token = Column(String, nullable=True, index=True)
    reset_token_expires_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
