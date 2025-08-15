# app/routes/matrizes.py
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import SessionLocal
from app.crud import pi_crud
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
    order: str = Query("asc", pattern="^(asc|desc)$", description="Ordenação por numero_pi"),
    db: Session = Depends(get_db)
):
    regs = pi_crud.list_matriz(db, order=order)
    return [MatrizItemOut(numero_pi=r.numero_pi, nome_campanha=r.nome_campanha) for r in regs]

@router.get("/ativos", response_model=List[MatrizItemOut])
def listar_matrizes_ativas(
    order: str = Query("asc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db)
):
    regs = pi_crud.list_matriz_ativos(db, order=order)
    return [MatrizItemOut(numero_pi=r.numero_pi, nome_campanha=r.nome_campanha) for r in regs]

# ---------- Detalhe / Resumo ----------
@router.get("/{numero_pi}", response_model=MatrizResumoOut)
def obter_resumo(numero_pi: str, db: Session = Depends(get_db)):
    mat = pi_crud.get_by_numero(db, numero_pi)
    if not mat or mat.tipo_pi != "Matriz":
        raise HTTPException(status_code=404, detail="PI Matriz não encontrado.")
    abatido = pi_crud.calcular_valor_abatido(db, numero_pi)
    saldo = pi_crud.calcular_saldo_restante(db, numero_pi)
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
    # garante que a matriz existe
    mat = pi_crud.get_by_numero(db, numero_pi)
    if not mat or mat.tipo_pi != "Matriz":
        raise HTTPException(status_code=404, detail="PI Matriz não encontrado.")
    filhos = pi_crud.list_abatimentos_of_matriz(db, numero_pi, order="asc")
    return [AbatimentoOut.model_validate(f) for f in filhos]

@router.get("/{numero_pi}/saldo")
def saldo(numero_pi: str, db: Session = Depends(get_db)):
    # 200 mesmo se não existir, mas prefiro 404 para UX clara
    mat = pi_crud.get_by_numero(db, numero_pi)
    if not mat or mat.tipo_pi != "Matriz":
        raise HTTPException(status_code=404, detail="PI Matriz não encontrado.")
    return {
        "numero_pi_matriz": numero_pi,
        "valor_abatido": pi_crud.calcular_valor_abatido(db, numero_pi),
        "saldo_restante": pi_crud.calcular_saldo_restante(db, numero_pi),
    }

# ---------- Criação ----------
@router.post("", response_model=MatrizResumoOut, status_code=status.HTTP_201_CREATED)
def criar_matriz(body: MatrizCreate, db: Session = Depends(get_db)):
    try:
        payload = body.dict()
        # força tipo = Matriz e remove vínculos indevidos
        payload.update({
            "tipo_pi": "Matriz",
            "numero_pi_matriz": None,
            "numero_pi_normal": None,
        })
        novo = pi_crud.create(db, payload)
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
        # garante existência da Matriz
        mat = pi_crud.get_by_numero(db, numero_pi)
        if not mat or mat.tipo_pi != "Matriz":
            raise HTTPException(status_code=404, detail="PI Matriz não encontrado.")
        payload = body.dict()
        payload.update({
            "tipo_pi": "Abatimento",
            "numero_pi_matriz": numero_pi,  # vínculo pelo path
            "numero_pi_normal": None,
        })
        novo = pi_crud.create(db, payload)  # valida saldo, etc.
        return AbatimentoOut.model_validate(novo)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

# ---------- Exclusões (opcionais) ----------
@router.delete("/{numero_pi}")
def deletar_matriz(numero_pi: str, db: Session = Depends(get_db)):
    mat = pi_crud.get_by_numero(db, numero_pi)
    if not mat or mat.tipo_pi != "Matriz":
        raise HTTPException(status_code=404, detail="PI Matriz não encontrado.")
    try:
        # pi_crud.delete impede excluir se houver abatimentos
        pi_crud.delete(db, mat.id)
        return {"ok": True, "deleted_numero_pi": numero_pi}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
