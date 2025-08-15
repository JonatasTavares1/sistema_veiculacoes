# app/routes/anunciantes.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import requests

from app.schemas.anunciante import AnuncianteCreate, AnuncianteUpdate, AnuncianteOut
from app.crud import anunciante_crud
from app.database import SessionLocal
from app.utils.cnpj import only_digits, is_cnpj_like

router = APIRouter(prefix="/anunciantes", tags=["anunciantes"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# -------- CRUD --------

@router.get("", response_model=List[AnuncianteOut])
def listar(nome: Optional[str] = Query(None, description="Filtro por nome (ilike)"),
           db: Session = Depends(get_db)):
    regs = anunciante_crud.list_by_name(db, nome) if nome else anunciante_crud.list_all(db)
    return [AnuncianteOut.model_validate(r) for r in regs]

@router.get("/{anunciante_id:int}", response_model=AnuncianteOut)
def obter(anunciante_id: int, db: Session = Depends(get_db)):
    reg = anunciante_crud.get_by_id(db, anunciante_id)
    if not reg:
        raise HTTPException(status_code=404, detail="Anunciante não encontrado.")
    return AnuncianteOut.model_validate(reg)

@router.get("/cnpj/{cnpj}", response_model=AnuncianteOut)
def obter_por_cnpj(cnpj: str, db: Session = Depends(get_db)):
    reg = anunciante_crud.get_by_cnpj(db, only_digits(cnpj))
    if not reg:
        raise HTTPException(status_code=404, detail="Anunciante não encontrado.")
    return AnuncianteOut.model_validate(reg)

@router.post("", response_model=AnuncianteOut, status_code=status.HTTP_201_CREATED)
def criar(body: AnuncianteCreate, db: Session = Depends(get_db)):
    try:
        payload = body.dict()
        payload["cnpj_anunciante"] = only_digits(payload["cnpj_anunciante"])
        novo = anunciante_crud.create(db, payload)
        return AnuncianteOut.model_validate(novo)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

@router.put("/{anunciante_id:int}", response_model=AnuncianteOut)
def atualizar(anunciante_id: int, body: AnuncianteUpdate, db: Session = Depends(get_db)):
    try:
        dados = body.dict(exclude_unset=True)
        if "cnpj_anunciante" in dados and dados["cnpj_anunciante"]:
            dados["cnpj_anunciante"] = only_digits(dados["cnpj_anunciante"])
        upd = anunciante_crud.update(db, anunciante_id, dados)
        return AnuncianteOut.model_validate(upd)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

@router.delete("/{anunciante_id:int}")
def deletar(anunciante_id: int, db: Session = Depends(get_db)):
    try:
        anunciante_crud.delete(db, anunciante_id)
        return JSONResponse({"ok": True, "deleted_id": anunciante_id})
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

@router.delete("/cnpj/{cnpj}")
def deletar_por_cnpj(cnpj: str, db: Session = Depends(get_db)):
    try:
        ok = anunciante_crud.delete_by_cnpj(db, only_digits(cnpj))
        if not ok:
            raise HTTPException(status_code=404, detail="Anunciante não encontrado.")
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
