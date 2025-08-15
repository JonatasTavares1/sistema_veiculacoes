# app/routes/produtos.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import SessionLocal
from app.schemas.produto import ProdutoCreate, ProdutoUpdate, ProdutoOut
from app.crud import produto_crud

router = APIRouter(prefix="/produtos", tags=["produtos"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("", response_model=List[ProdutoOut])
def listar(termo: Optional[str] = Query(None, description="Filtro por nome (ilike)"),
           db: Session = Depends(get_db)):
    regs = produto_crud.list_by_name(db, termo) if termo else produto_crud.list_all(db)
    return [ProdutoOut.model_validate(r) for r in regs]

@router.get("/{produto_id:int}", response_model=ProdutoOut)
def obter(produto_id: int, db: Session = Depends(get_db)):
    reg = produto_crud.get_by_id(db, produto_id)
    if not reg:
        raise HTTPException(status_code=404, detail="Produto não encontrado.")
    return ProdutoOut.model_validate(reg)

@router.post("", response_model=ProdutoOut, status_code=status.HTTP_201_CREATED)
def criar(body: ProdutoCreate, db: Session = Depends(get_db)):
    try:
        novo = produto_crud.create(db, body.dict())
        return ProdutoOut.model_validate(novo)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

@router.put("/{produto_id:int}", response_model=ProdutoOut)
def atualizar(produto_id: int, body: ProdutoUpdate, db: Session = Depends(get_db)):
    try:
        upd = produto_crud.update(db, produto_id, body.dict(exclude_unset=True))
        return ProdutoOut.model_validate(upd)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

@router.delete("/{produto_id:int}")
def deletar(produto_id: int, db: Session = Depends(get_db)):
    try:
        produto_crud.delete(db, produto_id)
        return JSONResponse({"ok": True, "deleted_id": produto_id})
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
