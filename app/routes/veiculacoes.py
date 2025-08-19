# app/routes/veiculacoes.py
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import date, datetime
from typing import List, Optional

from app.database import SessionLocal
from app.schemas.pi import VeiculacaoAgendaOut
from app.crud import pi_crud

router = APIRouter(prefix="/veiculacoes", tags=["veiculacoes"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def _parse_date(s: Optional[str]) -> Optional[date]:
    if not s: return None
    s = s.strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    return None

@router.get("/agenda", response_model=List[VeiculacaoAgendaOut])
def listar_agenda(
    inicio: Optional[str] = Query(None, description="YYYY-MM-DD ou dd/mm/aaaa; default: hoje"),
    fim: Optional[str] = Query(None, description="YYYY-MM-DD ou dd/mm/aaaa; default: hoje"),
    canal: Optional[str] = None,
    formato: Optional[str] = None,
    executivo: Optional[str] = None,
    diretoria: Optional[str] = None,
    uf_cliente: Optional[str] = None,
    db: Session = Depends(get_db),
):
    today = date.today()
    di = _parse_date(inicio) or today
    df = _parse_date(fim) or today

    rows = pi_crud.list_veiculacoes_agenda(
        db, di, df,
        canal=canal, formato=formato,
        executivo=executivo, diretoria=diretoria, uf_cliente=uf_cliente
    )
    return [VeiculacaoAgendaOut(**r) for r in rows]
