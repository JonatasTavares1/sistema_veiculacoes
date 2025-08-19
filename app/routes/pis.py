# app/routes/pis.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from app.schemas.pi import (
    PICreate, PIUpdate, PIOut, PISimpleOut,
    ProdutoIn, ProdutoOut, VeiculacaoOut, PiDetalheOut
)
from app.crud import pi_crud
from app.database import SessionLocal

router = APIRouter(prefix="/pis", tags=["pis"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# -------- Auxiliares (dropdowns + saldo) --------
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

# -------- CRUD básico --------
@router.get("", response_model=List[PIOut])
def listar_todos(db: Session = Depends(get_db)):
    regs = pi_crud.list_all(db)
    return regs

@router.get("/{pi_id:int}", response_model=PIOut)
def obter_por_id(pi_id: int, db: Session = Depends(get_db)):
    reg = pi_crud.get_by_id(db, pi_id)
    if not reg:
        raise HTTPException(status_code=404, detail="PI não encontrado.")
    return reg

@router.get("/numero/{numero_pi}", response_model=PIOut)
def obter_por_numero(numero_pi: str, db: Session = Depends(get_db)):
    reg = pi_crud.get_by_numero(db, numero_pi)
    if not reg:
        raise HTTPException(status_code=404, detail="PI não encontrado.")
    return reg

@router.post("", response_model=PIOut, status_code=status.HTTP_201_CREATED)
def criar_pi(body: PICreate, db: Session = Depends(get_db)):
    try:
        dados = body.model_dump()
        novo = pi_crud.create(db, dados)
        return novo
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

@router.put("/{pi_id:int}", response_model=PIOut)
def atualizar_pi(pi_id: int, body: PIUpdate, db: Session = Depends(get_db)):
    try:
        dados = body.model_dump(exclude_unset=True)
        upd = pi_crud.update(db, pi_id, dados)
        return upd
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

@router.delete("/{pi_id:int}")
def deletar_pi(pi_id: int, db: Session = Depends(get_db)):
    try:
        pi_crud.delete(db, pi_id)
        return JSONResponse({"ok": True, "deleted_id": pi_id})
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

# -------- Detalhe com Produtos & Veiculações (leitura) --------
def _to_detalhe(pi) -> PiDetalheOut:
    produtos_out: List[ProdutoOut] = []
    total_pi = 0.0
    for p in (pi.produtos or []):
        veics = [
            VeiculacaoOut(
                id=v.id,
                canal=v.canal,
                formato=v.formato,
                data_inicio=v.data_inicio,
                data_fim=v.data_fim,
                quantidade=v.quantidade,
                valor=v.valor,
            ) for v in (p.veiculacoes or [])
        ]
        total_produto = sum((v.valor or 0.0) for v in (p.veiculacoes or []))
        total_pi += total_produto
        produtos_out.append(ProdutoOut(
            id=p.id, nome=p.nome, descricao=p.descricao,
            total_produto=round(float(total_produto), 2),
            veiculacoes=veics
        ))
    return PiDetalheOut(
        id=pi.id,
        numero_pi=pi.numero_pi,
        anunciante=pi.nome_anunciante,
        campanha=pi.nome_campanha,
        emissao=pi.data_emissao,
        total_pi=round(float(total_pi), 2),
        produtos=produtos_out
    )

@router.get("/{pi_id:int}/detalhe", response_model=PiDetalheOut)
def obter_detalhe_por_id(pi_id: int, db: Session = Depends(get_db)):
    reg = pi_crud.get_with_relations_by_id(db, pi_id)
    if not reg:
        raise HTTPException(status_code=404, detail="PI não encontrado.")
    return _to_detalhe(reg)

@router.get("/numero/{numero_pi}/detalhe", response_model=PiDetalheOut)
def obter_detalhe_por_numero(numero_pi: str, db: Session = Depends(get_db)):
    reg = pi_crud.get_with_relations_by_numero(db, numero_pi)
    if not reg:
        raise HTTPException(status_code=404, detail="PI não encontrado.")
    return _to_detalhe(reg)

# -------- Compose (criar PI + produtos + veiculações) --------
class PIComposeIn(BaseModel):
    pi: PICreate
    produtos: List[ProdutoIn] = []

@router.post("/compose", response_model=PiDetalheOut, status_code=status.HTTP_201_CREATED)
def criar_composto(body: PIComposeIn, db: Session = Depends(get_db)):
    try:
        created = pi_crud.compose_create(db, body.model_dump())
        full = pi_crud.get_with_relations_by_id(db, created.id)
        return _to_detalhe(full)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

# -------- Sync (editar produtos & veiculações do PI) --------
class ProdutosSyncIn(BaseModel):
    produtos: List[ProdutoIn] = []

@router.put("/{pi_id:int}/produtos/sync", response_model=PiDetalheOut)
def sync_produtos(pi_id: int, body: ProdutosSyncIn, db: Session = Depends(get_db)):
    try:
        pi = pi_crud.sync_produtos(db, pi_id, body.model_dump().get("produtos") or [])
        full = pi_crud.get_with_relations_by_id(db, pi.id)
        return _to_detalhe(full)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
