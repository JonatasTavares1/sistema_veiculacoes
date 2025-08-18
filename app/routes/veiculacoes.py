

# app/routes/veiculacoes.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
from app.database import SessionLocal
from app.schemas.veiculacao import VeiculacaoCreate, VeiculacaoUpdate, VeiculacaoOut
from app.crud import veiculacao_crud

router = APIRouter(prefix="/veiculacoes", tags=["veiculacoes"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def _to_out(r) -> VeiculacaoOut:
    return VeiculacaoOut(
        id=r.id,
        produto_id=r.produto_id,
        pi_id=r.pi_id,
        data_inicio=r.data_inicio,
        data_fim=r.data_fim,
        quantidade=r.quantidade,
        valor_unitario=r.valor_unitario,
        desconto=r.desconto,
        valor_total=r.valor_total,
        produto_nome=(r.produto.nome if r.produto else None),
        numero_pi=(r.pi.numero_pi if r.pi else None),
    )

@router.get("", response_model=List[VeiculacaoOut])
def listar_todas(db: Session = Depends(get_db)):
    regs = veiculacao_crud.list_all(db)
    return [_to_out(r) for r in regs]

@router.get("/pi/{pi_id:int}", response_model=List[VeiculacaoOut])
def listar_por_pi(pi_id: int, db: Session = Depends(get_db)):
    regs = veiculacao_crud.list_by_pi(db, pi_id)
    return [_to_out(r) for r in regs]

@router.get("/produto/{produto_id:int}", response_model=List[VeiculacaoOut])
def listar_por_produto(produto_id: int, db: Session = Depends(get_db)):
    regs = veiculacao_crud.list_by_produto(db, produto_id)
    return [_to_out(r) for r in regs]

@router.get("/{veic_id:int}", response_model=VeiculacaoOut)
def obter(veic_id: int, db: Session = Depends(get_db)):
    r = veiculacao_crud.get_by_id(db, veic_id)
    if not r:
        raise HTTPException(status_code=404, detail="Veiculação não encontrada.")
    return _to_out(r)

@router.post("", response_model=VeiculacaoOut, status_code=status.HTTP_201_CREATED)
def criar(body: VeiculacaoCreate, db: Session = Depends(get_db)):
    try:
        novo = veiculacao_crud.create(db, body.dict())
        return _to_out(novo)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

@router.put("/{veic_id:int}", response_model=VeiculacaoOut)
def atualizar(veic_id: int, body: VeiculacaoUpdate, db: Session = Depends(get_db)):
    try:
        upd = veiculacao_crud.update(db, veic_id, body.dict(exclude_unset=True))
        return _to_out(upd)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

@router.delete("/{veic_id:int}")
def deletar(veic_id: int, db: Session = Depends(get_db)):
    try:
        veiculacao_crud.delete(db, veic_id)
        return JSONResponse({"ok": True, "deleted_id": veic_id})
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
