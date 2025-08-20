# app/routes/veiculacoes.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from datetime import date, datetime
from typing import List, Optional, Dict, Any

from app.database import SessionLocal
from app.schemas.veiculacao import (
    VeiculacaoCreate, VeiculacaoUpdate,
    VeiculacaoOut, VeiculacaoAgendaOut,
)
from app.crud import veiculacao_crud
from app.models import Veiculacao

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

def _to_out(v: Veiculacao) -> VeiculacaoOut:
    # mapeia SA model -> schema com extras
    prod = getattr(v, "produto", None)
    pi = getattr(v, "pi", None)
    data: Dict[str, Any] = {
        "id": v.id,
        "produto_id": v.produto_id,
        "pi_id": v.pi_id,
        "data_inicio": v.data_inicio,
        "data_fim": v.data_fim,
        "quantidade": v.quantidade,
        "valor_unitario": v.valor_unitario,
        "desconto": v.desconto,
        "valor_total": v.valor_total,
        "produto_nome": getattr(prod, "nome", None),
        "numero_pi": getattr(pi, "numero_pi", None),
    }
    return VeiculacaoOut(**data)

# ---------- CRUD ----------
@router.get("", response_model=List[VeiculacaoOut])
def listar_todas(db: Session = Depends(get_db)):
    rows = veiculacao_crud.list_all(db)
    return [_to_out(r) for r in rows]

@router.get("/por-pi/{pi_id:int}", response_model=List[VeiculacaoOut])
def listar_por_pi(pi_id: int, db: Session = Depends(get_db)):
    rows = veiculacao_crud.list_by_pi(db, pi_id)
    return [_to_out(r) for r in rows]

@router.get("/por-produto/{produto_id:int}", response_model=List[VeiculacaoOut])
def listar_por_produto(produto_id: int, db: Session = Depends(get_db)):
    rows = veiculacao_crud.list_by_produto(db, produto_id)
    return [_to_out(r) for r in rows]

@router.get("/{veic_id:int}", response_model=VeiculacaoOut)
def obter(veic_id: int, db: Session = Depends(get_db)):
    v = veiculacao_crud.get_by_id(db, veic_id)
    if not v:
        raise HTTPException(status_code=404, detail="Veiculação não encontrada.")
    return _to_out(v)

@router.post("", response_model=VeiculacaoOut, status_code=status.HTTP_201_CREATED)
def criar(body: VeiculacaoCreate, db: Session = Depends(get_db)):
    try:
        v = veiculacao_crud.create(db, body.model_dump())
        # recarrega com joins pra preencher extras
        v = (
            db.query(Veiculacao)
            .options(joinedload(Veiculacao.produto), joinedload(Veiculacao.pi))
            .filter(Veiculacao.id == v.id)
            .first()
        )
        return _to_out(v)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

@router.put("/{veic_id:int}", response_model=VeiculacaoOut)
def atualizar(veic_id: int, body: VeiculacaoUpdate, db: Session = Depends(get_db)):
    try:
        v = veiculacao_crud.update(db, veic_id, body.model_dump(exclude_unset=True))
        v = (
            db.query(Veiculacao)
            .options(joinedload(Veiculacao.produto), joinedload(Veiculacao.pi))
            .filter(Veiculacao.id == v.id)
            .first()
        )
        return _to_out(v)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

@router.delete("/{veic_id:int}")
def deletar(veic_id: int, db: Session = Depends(get_db)):
    try:
        veiculacao_crud.delete(db, veic_id)
        return {"ok": True, "deleted_id": veic_id}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

# ---------- Agenda (para Operações ver o que precisa veicular) ----------
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
    rows = veiculacao_crud.list_agenda(
        db, di, df,
        canal=canal, formato=formato,
        executivo=executivo, diretoria=diretoria, uf_cliente=uf_cliente
    )
    return [VeiculacaoAgendaOut(**r) for r in rows]
