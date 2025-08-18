# app/routes/matrizes.py
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List
from app.database import SessionLocal
from app.crud import matriz_crud as mc
from app.schemas.matriz import (
    MatrizItemOut, MatrizResumoOut,
    AbatimentoOut, MatrizCreate, AbatimentoCreate
)

router = APIRouter(prefix="/matrizes", tags=["matrizes"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ---------- Listas ----------
@router.get("", response_model=List[MatrizItemOut])
def listar_matrizes(
    order: str = Query("asc", description="Ordenação por numero_pi (asc|desc)"),
    db: Session = Depends(get_db)
):
    regs = mc.list_all(db, order=order)
    return [MatrizItemOut(numero_pi=r.numero_pi, nome_campanha=r.nome_campanha) for r in regs]

@router.get("/ativos", response_model=List[MatrizItemOut])
def listar_matrizes_ativas(
    order: str | None = Query(None, description="saldo_desc | numero_desc | numero_asc | asc"),
    db: Session = Depends(get_db)
):
    regs = mc.list_ativos(db, order=order)
    # se quiser devolver saldo_restante, acrescente no schema e no retorno abaixo
    return [MatrizItemOut(numero_pi=r["numero_pi"], nome_campanha=r.get("nome_campanha")) for r in regs]

# ---------- Detalhe / Resumo ----------
@router.get("/{numero_pi}", response_model=MatrizResumoOut)
def obter_resumo(numero_pi: str, db: Session = Depends(get_db)):
    mat = mc.get_by_numero(db, numero_pi)
    if not mat:
        raise HTTPException(status_code=404, detail="PI Matriz não encontrado.")
    abatido = mc.calcular_valor_abatido(db, numero_pi)
    saldo = mc.calcular_saldo_restante(db, numero_pi)
    return MatrizResumoOut(
        id=mat.id,
        numero_pi=mat.numero_pi,
        nome_campanha=mat.nome_campanha,
        valor_bruto=mat.valor_bruto,
        valor_abatido=float(abatido),
        saldo_restante=float(saldo),
    )

@router.get("/{numero_pi}/abatimentos", response_model=List[AbatimentoOut])
def listar_abatimentos(numero_pi: str, db: Session = Depends(get_db)):
    mat = mc.get_by_numero(db, numero_pi)
    if not mat:
        raise HTTPException(status_code=404, detail="PI Matriz não encontrado.")
    filhos = mc.list_abatimentos(db, numero_pi, order="asc")
    return [AbatimentoOut.model_validate(f) for f in filhos]

@router.get("/{numero_pi}/saldo")
def saldo(numero_pi: str, db: Session = Depends(get_db)):
    mat = mc.get_by_numero(db, numero_pi)
    if not mat:
        raise HTTPException(status_code=404, detail="PI Matriz não encontrado.")
    return {
        "numero_pi_matriz": numero_pi,
        "valor_abatido": mc.calcular_valor_abatido(db, numero_pi),
        "saldo_restante": mc.calcular_saldo_restante(db, numero_pi),
    }

# ---------- Criação ----------
@router.post("", response_model=MatrizResumoOut, status_code=status.HTTP_201_CREATED)
def criar_matriz(body: MatrizCreate, db: Session = Depends(get_db)):
    try:
        novo = mc.create_matriz(db, body.dict())
        return MatrizResumoOut(
            id=novo.id,
            numero_pi=novo.numero_pi,
            nome_campanha=novo.nome_campanha,
            valor_bruto=novo.valor_bruto,
            valor_abatido=0.0,
            saldo_restante=float(novo.valor_bruto or 0.0),
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

@router.post("/{numero_pi}/abatimentos", response_model=AbatimentoOut, status_code=status.HTTP_201_CREATED)
def criar_abatimento(numero_pi: str, body: AbatimentoCreate, db: Session = Depends(get_db)):
    try:
        novo = mc.create_abatimento(db, numero_pi, body.dict())
        return AbatimentoOut.model_validate(novo)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

# ---------- Exclusões ----------
@router.delete("/{numero_pi}")
def deletar_matriz(numero_pi: str, db: Session = Depends(get_db)):
    mat = mc.get_by_numero(db, numero_pi)
    if not mat:
        raise HTTPException(status_code=404, detail="PI Matriz não encontrado.")
    try:
        mc.delete_matriz(db, mat.id)
        return {"ok": True, "deleted_numero_pi": numero_pi}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
