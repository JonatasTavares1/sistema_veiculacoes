from __future__ import annotations

from typing import Optional, Literal
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.deps import get_db
from app.crud import vendas_crud

router = APIRouter(prefix="/vendas", tags=["vendas"])

@router.get("/resumo")
def get_resumo(
    mes: Optional[str] = Query(None),
    ano: Optional[str] = Query(None),
    executivo: Optional[str] = Query(None),
    diretoria: Optional[str] = Query(None),
    tipo_pi: Optional[str] = Query(None),
    anunciante: Optional[str] = Query(None),
    fonte: Literal["pi", "pi_prefer_liquido"] = Query("pi_prefer_liquido"),
    db: Session = Depends(get_db),
):
    return vendas_crud.resumo_vendas(
        db,
        mes=mes,
        ano=ano,
        executivo=executivo,
        diretoria=diretoria,
        tipo_pi=tipo_pi,
        anunciante=anunciante,
        fonte=fonte,
    )

@router.get("/executivo/pis")
def get_pis_executivo(
    executivo: str = Query(...),
    mes: Optional[str] = Query(None),
    ano: Optional[str] = Query(None),
    tipo_pi: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    return vendas_crud.listar_pis_do_executivo(
        db,
        executivo=executivo,
        mes=mes,
        ano=ano,
        tipo_pi=tipo_pi,
    )
