from fastapi import Depends, HTTPException, Header
from sqlalchemy.orm import Session
import jwt

from app.deps import get_db
from app.core.config import JWT_SECRET, JWT_ALG
from app.crud.users import get_user_by_id


def get_current_user(
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Não autenticado.")

    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido.")

    user_id = payload.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token inválido.")

    user = get_user_by_id(db, int(user_id))
    if not user:
        raise HTTPException(status_code=401, detail="Usuário não encontrado.")

    return user


def require_admin(user=Depends(get_current_user)):
    if (getattr(user, "role", "") or "").lower().strip() != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito ao administrador.")
    return user


def require_roles(*roles: str):
    """
    Permite acesso somente para os roles informados.
    ✅ Admin sempre é permitido (override).
    """
    def _dep(user=Depends(get_current_user)):
        role = (getattr(user, "role", "") or "").lower().strip()

        # ✅ admin sempre pode tudo
        if role == "admin":
            return user

        allowed = { (r or "").lower().strip() for r in roles if (r or "").strip() }
        if not allowed:
            # se ninguém passou roles, não deveria acontecer; mas evita liberar por acidente
            raise HTTPException(status_code=403, detail="Permissão insuficiente para esta ação.")

        if role not in allowed:
            raise HTTPException(status_code=403, detail="Permissão insuficiente para esta ação.")

        return user

    return _dep
