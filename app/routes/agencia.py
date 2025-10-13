# app/routes/agencias.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import requests

from app.schemas.agencia import AgenciaCreate, AgenciaUpdate, AgenciaOut
from app.crud import agencia_crud
from app.database import SessionLocal
from app.utils.cnpj import only_digits, is_cnpj_like

router = APIRouter(prefix="/agencias", tags=["agencias"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# -------- CRUD --------

@router.get("", response_model=List[AgenciaOut])
def listar(
    nome: Optional[str] = Query(
        None,
        description="Filtro (ilike) por nome_agencia OU codinome"
    ),
    db: Session = Depends(get_db),
):
    regs = agencia_crud.list_by_name(db, nome) if nome else agencia_crud.list_all(db)
    return [AgenciaOut.model_validate(r) for r in regs]

@router.get("/codinome/{codinome}", response_model=AgenciaOut)
def obter_por_codinome(codinome: str, db: Session = Depends(get_db)):
    reg = agencia_crud.get_by_codename(db, codinome)
    if not reg:
        raise HTTPException(status_code=404, detail="Agência não encontrada.")
    return AgenciaOut.model_validate(reg)

@router.get("/cnpj/{cnpj}", response_model=AgenciaOut)
def obter_por_cnpj(cnpj: str, db: Session = Depends(get_db)):
    reg = agencia_crud.get_by_cnpj(db, only_digits(cnpj))
    if not reg:
        raise HTTPException(status_code=404, detail="Agência não encontrada.")
    return AgenciaOut.model_validate(reg)

@router.get("/{agencia_id:int}", response_model=AgenciaOut)
def obter(agencia_id: int, db: Session = Depends(get_db)):
    reg = agencia_crud.get_by_id(db, agencia_id)
    if not reg:
        raise HTTPException(status_code=404, detail="Agência não encontrada.")
    return AgenciaOut.model_validate(reg)

@router.post("", response_model=AgenciaOut, status_code=status.HTTP_201_CREATED)
def criar(body: AgenciaCreate, db: Session = Depends(get_db)):
    try:
        payload = body.model_dump()
        payload["cnpj_agencia"] = only_digits(payload["cnpj_agencia"])
        novo = agencia_crud.create(db, payload)
        return AgenciaOut.model_validate(novo)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

@router.put("/{agencia_id:int}", response_model=AgenciaOut)
def atualizar(agencia_id: int, body: AgenciaUpdate, db: Session = Depends(get_db)):
    try:
        dados = body.model_dump(exclude_unset=True)
        if "cnpj_agencia" in dados and dados["cnpj_agencia"]:
            dados["cnpj_agencia"] = only_digits(dados["cnpj_agencia"])
        upd = agencia_crud.update(db, agencia_id, dados)
        return AgenciaOut.model_validate(upd)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

@router.delete("/{agencia_id:int}")
def deletar(agencia_id: int, db: Session = Depends(get_db)):
    try:
        agencia_crud.delete(db, agencia_id)
        return JSONResponse({"ok": True, "deleted_id": agencia_id})
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

@router.delete("/cnpj/{cnpj}")
def deletar_por_cnpj(cnpj: str, db: Session = Depends(get_db)):
    try:
        ok = agencia_crud.delete_by_cnpj(db, only_digits(cnpj))
        if not ok:
            raise HTTPException(status_code=404, detail="Agência não encontrada.")
        return JSONResponse({"ok": True, "deleted_cnpj": only_digits(cnpj)})
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

# -------- Consulta BrasilAPI --------

@router.get("/cnpj/{cnpj}/consulta")
def consultar_cnpj_brasilapi(cnpj: str):
    cnpj_limpo = only_digits(cnpj)
    if not is_cnpj_like(cnpj_limpo):
        raise HTTPException(status_code=400, detail="CNPJ inválido.")
    url = f"https://brasilapi.com.br/api/cnpj/v1/{cnpj_limpo}"
    try:
        r = requests.get(url, timeout=10)
        if r.status_code == 200:
            return r.json()
        elif r.status_code == 404:
            raise HTTPException(status_code=404, detail="CNPJ não encontrado na BrasilAPI.")
        else:
            raise HTTPException(status_code=502, detail=f"BrasilAPI respondeu {r.status_code}.")
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Erro ao consultar BrasilAPI: {e}")
