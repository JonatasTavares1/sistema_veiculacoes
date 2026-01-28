# app/routes/vendas.py
from __future__ import annotations

from typing import Optional, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.deps import get_db
from app.deps_auth import require_roles
from app.crud import vendas_crud

# ✅ NOVO: consolidado por setor (Privado / Gov. Estadual / Gov. Federal / Gestão Executiva)
from app.crud.vendas_consolidado_crud import obter_consolidado
from app.schemas.vendas_consolidado import VendasConsolidadoOut

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
    top_n: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    _user=Depends(require_roles("admin")),
):
    return vendas_crud.painel_vendas_para_front(
        db,
        mes=mes,
        ano=ano,
        executivo=executivo,
        diretoria=diretoria,
        tipo_pi=tipo_pi,
        anunciante=anunciante,
        fonte=fonte,
        top_n=top_n,
    )


@router.get("/executivo/pis")
def get_pis_executivo(
    executivo: str = Query(...),
    mes: Optional[str] = Query(None),
    ano: Optional[str] = Query(None),
    tipo_pi: Optional[str] = Query(None),
    fonte: Literal["pi", "pi_prefer_liquido"] = Query("pi_prefer_liquido"),
    db: Session = Depends(get_db),
    _user=Depends(require_roles("admin")),
):
    return vendas_crud.listar_pis_do_executivo_para_front(
        db,
        executivo=executivo,
        mes=mes,
        ano=ano,
        tipo_pi=tipo_pi,
        fonte=fonte,
    )


# ==========================================================
# ✅ NOVO: CONSOLIDADO GERAL POR SETOR (o “vermelho”)
# GET /vendas/consolidado?mes=1&ano=2026
# (opcional) &executivo=Fulano
# ==========================================================
@router.get("/consolidado", response_model=VendasConsolidadoOut)
def get_consolidado_setores(
    mes: int = Query(..., ge=1, le=12),
    ano: int = Query(..., ge=2000, le=2100),
    executivo: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _user=Depends(require_roles("admin")),
):
    return obter_consolidado(db, mes=mes, ano=ano, executivo=executivo)
