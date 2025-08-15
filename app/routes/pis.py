# app/routes/pis.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
from app.schemas.pi import PICreate, PIUpdate, PIOut, PISimpleOut
from app.crud import pi_crud
from app.database import SessionLocal

router = APIRouter(prefix="/pis", tags=["pis"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Auxiliares (dropdowns + saldo)
@router.get("/matriz/ativos", response_model=List[PISimpleOut])
def listar_matriz_ativos(db: Session = Depends(get_db)):
    regs = pi_crud.list_matriz_ativos(db)
    return [PISimpleOut(numero_pi=r.numero_pi, nome_campanha=r.nome_campanha) for r in regs]

@router.get("/normal/ativos", response_model=List[PISimpleOut])
def listar_normal_ativos(db: Session = Depends(get_db)):
    regs = pi_crud.list_normal_ativos(db)
    return [PISimpleOut(numero_pi=r.numero_pi, nome_campanha=r.nome_campanha) for r in regs]

@router.get("/{numero_pi}/saldo")
def saldo_matriz(numero_pi: str, db: Session = Depends(get_db)):
    saldo = pi_crud.calcular_saldo_restante(db, numero_pi)
    return {"numero_pi_matriz": numero_pi, "saldo_restante": saldo}

# CRUD
@router.get("", response_model=List[PIOut])
def listar_todos(db: Session = Depends(get_db)):
    regs = pi_crud.list_all(db)
    return [PIOut(id=r.id, numero_pi=r.numero_pi, tipo_pi=r.tipo_pi, nome_campanha=r.nome_campanha) for r in regs]

@router.get("/{pi_id:int}", response_model=PIOut)
def obter_por_id(pi_id: int, db: Session = Depends(get_db)):
    reg = pi_crud.get_by_id(db, pi_id)
    if not reg:
        raise HTTPException(status_code=404, detail="PI não encontrado.")
    return PIOut(id=reg.id, numero_pi=reg.numero_pi, tipo_pi=reg.tipo_pi, nome_campanha=reg.nome_campanha)

@router.get("/numero/{numero_pi}", response_model=PIOut)
def obter_por_numero(numero_pi: str, db: Session = Depends(get_db)):
    reg = pi_crud.get_by_numero(db, numero_pi)
    if not reg:
        raise HTTPException(status_code=404, detail="PI não encontrado.")
    return PIOut(id=reg.id, numero_pi=reg.numero_pi, tipo_pi=reg.tipo_pi, nome_campanha=reg.nome_campanha)

@router.post("", response_model=PIOut, status_code=status.HTTP_201_CREATED)
def criar_pi(body: PICreate, db: Session = Depends(get_db)):
    try:
        novo = pi_crud.create(db, body.dict())
        return PIOut(id=novo.id, numero_pi=novo.numero_pi, tipo_pi=novo.tipo_pi, nome_campanha=novo.nome_campanha)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

@router.put("/{pi_id:int}", response_model=PIOut)
def atualizar_pi(pi_id: int, body: PIUpdate, db: Session = Depends(get_db)):
    try:
        upd = pi_crud.update(db, pi_id, body.dict(exclude_unset=True))
        return PIOut(id=upd.id, numero_pi=upd.numero_pi, tipo_pi=upd.tipo_pi, nome_campanha=upd.nome_campanha)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

@router.delete("/{pi_id:int}")
def deletar_pi(pi_id: int, db: Session = Depends(get_db)):
    try:
        pi_crud.delete(db, pi_id)
        return JSONResponse({"ok": True, "deleted_id": pi_id})
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
