from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from datetime import date, datetime
from typing import List, Optional, Dict, Any

from app.database import SessionLocal
from app.schemas.veiculacao import (
    VeiculacaoCreate,
    VeiculacaoUpdate,
    VeiculacaoOut,
    VeiculacaoAgendaOut,
    VeiculacaoCreateIn,
)
from app.crud import veiculacao_crud
from app.models import Veiculacao, Produto, PI

router = APIRouter(prefix="/veiculacoes", tags=["veiculacoes"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _parse_date(s: Optional[str]) -> Optional[date]:
    if not s:
        return None
    s = s.strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(s[:10], fmt).date()
        except ValueError:
            pass
    return None


def _first_non_empty(*vals):
    for v in vals:
        if v is None:
            continue
        if isinstance(v, str) and v.strip() == "":
            continue
        return v
    return None


def _today_between(s: Optional[str], f: Optional[str]) -> bool:
    today = date.today()

    def _p(x):
        if not x:
            return None
        for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
            try:
                return datetime.strptime(x[:10], fmt).date()
            except ValueError:
                pass
        return None

    ds = _p(s)
    df = _p(f)
    if ds and df:
        return ds <= today <= df
    if ds and not df:
        return ds <= today
    if not ds and df:
        return today <= df
    return True


def _to_out(v: Veiculacao) -> VeiculacaoOut:
    prod = getattr(v, "produto", None)
    pi = getattr(v, "pi", None)

    # ✅ canal vem do PI (veiculação não tem canal/formato)
    effective_canal = getattr(pi, "canal", None)

    cliente = _first_non_empty(
        getattr(v, "cliente", None),
        getattr(v, "anunciante", None),
        getattr(pi, "nome_anunciante", None),
        getattr(pi, "razao_social_anunciante", None),
    )
    campanha = _first_non_empty(
        getattr(v, "campanha", None),
        getattr(pi, "nome_campanha", None),
    )
    uf_cliente = _first_non_empty(
        getattr(v, "uf_cliente", None),
        getattr(pi, "uf_cliente", None),
    )

    data: Dict[str, Any] = {
        "id": v.id,
        "produto_id": v.produto_id,
        "pi_id": v.pi_id,
        "data_inicio": v.data_inicio,
        "data_fim": v.data_fim,
        "quantidade": v.quantidade,
        "valor_bruto": v.valor_bruto,
        "desconto": v.desconto,
        "valor_liquido": v.valor_liquido,
        "valor": (v.valor_liquido if v.valor_liquido is not None else v.valor_bruto),
        "produto_nome": getattr(prod, "nome", None),
        "numero_pi": getattr(pi, "numero_pi", None),
        "cliente": cliente,
        "campanha": campanha,
        "canal": effective_canal,
        "executivo": getattr(pi, "executivo", None),
        "diretoria": getattr(pi, "diretoria", None),
        "uf_cliente": uf_cliente,
        "em_veiculacao": _today_between(v.data_inicio, v.data_fim),
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
def criar(body: VeiculacaoCreateIn, db: Session = Depends(get_db)):
    # produto
    produto_id = body.produto_id
    if not produto_id:
        if not body.produto_nome:
            raise HTTPException(status_code=422, detail="Informe produto_id ou produto_nome.")
        prod = db.query(Produto).filter(Produto.nome == body.produto_nome).first()
        if not prod:
            raise HTTPException(status_code=400, detail=f"Produto '{body.produto_nome}' não encontrado.")
        produto_id = prod.id

    # pi
    pi_id = body.pi_id
    if not pi_id:
        if not body.numero_pi:
            raise HTTPException(status_code=422, detail="Informe pi_id ou numero_pi.")
        pi = db.query(PI).filter(PI.numero_pi == body.numero_pi).first()
        if not pi:
            raise HTTPException(status_code=400, detail=f"PI '{body.numero_pi}' não encontrado.")
        pi_id = pi.id

    payload = {
        "produto_id": produto_id,
        "pi_id": pi_id,
        "data_inicio": body.data_inicio,
        "data_fim": body.data_fim,
        "quantidade": body.quantidade,
        "valor_bruto": body.valor_bruto,
        "desconto": body.desconto,
        "valor_liquido": body.valor_liquido,
    }

    try:
        v = veiculacao_crud.create(db, payload)
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


@router.get("/agenda", response_model=List[VeiculacaoAgendaOut])
def listar_agenda(
    inicio: Optional[str] = Query(None, description="YYYY-MM-DD ou dd/mm/aaaa; default: hoje"),
    fim: Optional[str] = Query(None, description="YYYY-MM-DD ou dd/mm/aaaa; default: hoje"),
    canal: Optional[str] = None,
    executivo: Optional[str] = None,
    diretoria: Optional[str] = None,
    uf_cliente: Optional[str] = None,
    db: Session = Depends(get_db),
):
    today = date.today()
    di = _parse_date(inicio) or today
    df = _parse_date(fim) or today

    rows = veiculacao_crud.list_agenda(
        db,
        di,
        df,
        canal=canal,
        executivo=executivo,
        diretoria=diretoria,
        uf_cliente=uf_cliente,
    )
    return [VeiculacaoAgendaOut(**r) for r in rows]
