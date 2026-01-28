# app/routes/pi_detalhes.py
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.deps import get_db
from app.deps_auth import get_current_user

from app.crud.pi_detalhes_crud import obter_detalhes_por_pi_id
from app.schemas.pi_detalhes import PIDetalhesOut

router = APIRouter(tags=["PIs"])


@router.get("/pis/{pi_id}/detalhes", response_model=PIDetalhesOut)
def detalhes_pi(
    pi_id: int,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    try:
        payload = obter_detalhes_por_pi_id(db, pi_id)
        return payload
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception:
        raise HTTPException(status_code=500, detail="Erro ao carregar detalhes do PI.")
