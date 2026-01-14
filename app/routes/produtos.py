# app/routes/produtos.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import SessionLocal
from app.schemas.produto import ProdutoCreate, ProdutoUpdate, ProdutoOut
from app.crud import produto_crud
from app.deps_auth import require_roles

router = APIRouter(prefix="/produtos", tags=["produtos"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =========================
# ✅ LEITURA: admin + executivo + opec
# (se você NÃO quiser opec aqui, remova "opec")
# =========================
@router.get("", response_model=List[ProdutoOut])
def listar_produtos(
    termo: Optional[str] = Query(None, description="Filtro por nome (ilike)"),
    db: Session = Depends(get_db),
    _user=Depends(require_roles("executivo", "opec", "admin")),
):
    if termo:
        rows = produto_crud.list_by_name(db, termo)
    else:
        rows = produto_crud.list_all(db)
    return rows


@router.get("/{produto_id:int}", response_model=ProdutoOut)
def obter(
    produto_id: int,
    db: Session = Depends(get_db),
    _user=Depends(require_roles("executivo", "opec", "admin")),
):
    p = produto_crud.get_by_id(db, produto_id)
    if not p:
        raise HTTPException(status_code=404, detail="Produto não encontrado.")
    return p


@router.get("/opcoes-nome", response_model=List[str])
def opcoes_nome(
    db: Session = Depends(get_db),
    _user=Depends(require_roles("executivo", "opec", "admin")),
):
    """
    Retorna apenas a lista de nomes distintos de produtos, em ordem alfabética.
    """
    from app.models import Produto

    rows = db.query(Produto.nome).distinct().order_by(Produto.nome).all()
    return [r[0] for r in rows if r and r[0]]


# =========================
# ✅ ESCRITA: SOMENTE ADMIN
# =========================
@router.post("", response_model=ProdutoOut, status_code=status.HTTP_201_CREATED)
def criar(
    body: ProdutoCreate,
    db: Session = Depends(get_db),
    _user=Depends(require_roles("admin")),
):
    try:
        p = produto_crud.create(db, body.model_dump())
        return p
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.put("/{produto_id:int}", response_model=ProdutoOut)
def atualizar(
    produto_id: int,
    body: ProdutoUpdate,
    db: Session = Depends(get_db),
    _user=Depends(require_roles("admin")),
):
    try:
        p = produto_crud.update(db, produto_id, body.model_dump(exclude_unset=True))
        return p
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.delete("/{produto_id:int}")
def deletar(
    produto_id: int,
    db: Session = Depends(get_db),
    _user=Depends(require_roles("admin")),
):
    try:
        produto_crud.delete(db, produto_id)
        return {"ok": True, "deleted_id": produto_id}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
