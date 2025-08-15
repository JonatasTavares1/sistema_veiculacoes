# app/routes/entregas.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
from app.schemas.entrega import EntregaCreate, EntregaUpdate, EntregaOut
from app.crud import entrega_crud
from app.database import SessionLocal

router = APIRouter(prefix="/entregas", tags=["entregas"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ---- listas ----
@router.get("", response_model=List[EntregaOut])
def listar_todas(db: Session = Depends(get_db)):
    regs = entrega_crud.list_all(db)
    # serialização simples: convert date -> str ISO (YYYY-MM-DD)
    out = []
    for r in regs:
        out.append(EntregaOut(
            id=r.id,
            veiculacao_id=r.veiculacao_id,
            data_entrega=r.data_entrega.isoformat() if r.data_entrega else "",
            foi_entregue=r.foi_entregue or "pendente",
            motivo=r.motivo or "",
        ))
    return out

@router.get("/veiculacao/{veiculacao_id:int}", response_model=List[EntregaOut])
def por_veiculacao(veiculacao_id: int, db: Session = Depends(get_db)):
    regs = entrega_crud.list_by_veiculacao(db, veiculacao_id)
    return [
        EntregaOut(
            id=r.id,
            veiculacao_id=r.veiculacao_id,
            data_entrega=r.data_entrega.isoformat() if r.data_entrega else "",
            foi_entregue=r.foi_entregue or "pendente",
            motivo=r.motivo or "",
        )
        for r in regs
    ]

@router.get("/pendentes", response_model=List[EntregaOut])
def pendentes(db: Session = Depends(get_db)):
    regs = entrega_crud.list_pendentes(db)
    return [
        EntregaOut(
            id=r.id,
            veiculacao_id=r.veiculacao_id,
            data_entrega=r.data_entrega.isoformat() if r.data_entrega else "",
            foi_entregue=r.foi_entregue or "pendente",
            motivo=r.motivo or "",
        )
        for r in regs
    ]

# ---- CRUD ----
@router.post("", response_model=EntregaOut, status_code=status.HTTP_201_CREATED)
def criar(body: EntregaCreate, db: Session = Depends(get_db)):
    try:
        novo = entrega_crud.create(db, body.dict())
        return EntregaOut(
            id=novo.id,
            veiculacao_id=novo.veiculacao_id,
            data_entrega=novo.data_entrega.isoformat(),
            foi_entregue=novo.foi_entregue or "pendente",
            motivo=novo.motivo or "",
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

@router.put("/{entrega_id:int}", response_model=EntregaOut)
def atualizar(entrega_id: int, body: EntregaUpdate, db: Session = Depends(get_db)):
    try:
        upd = entrega_crud.update(db, entrega_id, body.dict(exclude_unset=True))
        return EntregaOut(
            id=upd.id,
            veiculacao_id=upd.veiculacao_id,
            data_entrega=upd.data_entrega.isoformat() if upd.data_entrega else "",
            foi_entregue=upd.foi_entregue or "pendente",
            motivo=upd.motivo or "",
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

@router.put("/{entrega_id:int}/entregue", response_model=EntregaOut)
def marcar_como_entregue(entrega_id: int, db: Session = Depends(get_db)):
    try:
        ent = entrega_crud.marcar_entregue(db, entrega_id)
        return EntregaOut(
            id=ent.id,
            veiculacao_id=ent.veiculacao_id,
            data_entrega=ent.data_entrega.isoformat() if ent.data_entrega else "",
            foi_entregue=ent.foi_entregue or "pendente",
            motivo=ent.motivo or "",
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

@router.put("/{entrega_id:int}/motivo", response_model=EntregaOut)
def atualizar_motivo(entrega_id: int, motivo: str, db: Session = Depends(get_db)):
    try:
        ent = entrega_crud.atualizar_motivo(db, entrega_id, motivo)
        return EntregaOut(
            id=ent.id,
            veiculacao_id=ent.veiculacao_id,
            data_entrega=ent.data_entrega.isoformat() if ent.data_entrega else "",
            foi_entregue=ent.foi_entregue or "pendente",
            motivo=ent.motivo or "",
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

@router.delete("/{entrega_id:int}")
def deletar(entrega_id: int, db: Session = Depends(get_db)):
    try:
        entrega_crud.delete(db, entrega_id)
        return JSONResponse({"ok": True, "deleted_id": entrega_id})
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
