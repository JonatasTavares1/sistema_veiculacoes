# app/routes/produtos.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import SessionLocal
from app.crud import produto_crud
from app.schemas.produto import (
    ProdutoCreate, ProdutoUpdate, ProdutoOut,
)
from app.models import Produto  # só para queries simples (opções de nome)

router = APIRouter(prefix="/produtos", tags=["produtos"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ---------- list ----------
@router.get("", response_model=List[ProdutoOut])
def listar_produtos(
    termo: Optional[str] = Query(None, description="Filtro por nome (contém)"),
    db: Session = Depends(get_db),
):
    if termo:
        regs = produto_crud.list_by_name(db, termo)
    else:
        regs = produto_crud.list_all(db)
    return regs

# ---------- detalhe ----------
@router.get("/{produto_id:int}", response_model=ProdutoOut)
def detalhe_produto(produto_id: int, db: Session = Depends(get_db)):
    prod = produto_crud.get_by_id(db, produto_id)
    if not prod:
        raise HTTPException(status_code=404, detail="Produto não encontrado.")
    return prod

# ---------- create ----------
@router.post("", response_model=ProdutoOut, status_code=status.HTTP_201_CREATED)
def criar_produto(body: ProdutoCreate, db: Session = Depends(get_db)):
    try:
        novo = produto_crud.create(db, body.model_dump())
        return novo
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

# ---------- update ----------
@router.put("/{produto_id:int}", response_model=ProdutoOut)
def atualizar_produto(produto_id: int, body: ProdutoUpdate, db: Session = Depends(get_db)):
    try:
        upd = produto_crud.update(db, produto_id, body.model_dump(exclude_unset=True))
        return upd
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

# ---------- delete ----------
@router.delete("/{produto_id:int}")
def deletar_produto(produto_id: int, db: Session = Depends(get_db)):
    try:
        produto_crud.delete(db, produto_id)
        return {"ok": True, "deleted_id": produto_id}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

# ---------- opções de nomes (autocomplete no PI) ----------
@router.get("/opcoes-nome", response_model=List[str])
def opcoes_nome_produtos(db: Session = Depends(get_db)):
    rows = db.query(Produto.nome).distinct().order_by(Produto.nome.asc()).all()
    return [r[0] for r in rows if r and r[0]]
