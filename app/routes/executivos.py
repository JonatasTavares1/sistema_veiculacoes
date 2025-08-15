# app/routes/executivos.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from app.database import SessionLocal
from app.schemas.executivo import ExecNomeOut, RegistroExecutivoOut, EditarRegistroIn
from app.crud import executivo_crud

router = APIRouter(prefix="/executivos", tags=["executivos"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("", response_model=List[str])
def listar_nomes(db: Session = Depends(get_db)):
    """Lista nomes distintos de executivos em Agências e Anunciantes."""
    return executivo_crud.listar_executivos(db)

@router.get("/busca", response_model=List[RegistroExecutivoOut])
def buscar(
    executivo: Optional[str] = Query(None, description="Nome exato do executivo"),
    tipo: Optional[str] = Query(None, description="Agência/Agencia ou Anunciante"),
    db: Session = Depends(get_db),
):
    regs = executivo_crud.buscar_por_executivo(db, executivo, tipo)
    return [RegistroExecutivoOut(**r) for r in regs]

@router.put("/editar", response_model=RegistroExecutivoOut)
def editar(body: EditarRegistroIn, db: Session = Depends(get_db)):
    """
    Atualiza um registro (Agência ou Anunciante) usando nomes de campos genéricos
    compatíveis com seu controller antigo.
    """
    try:
        r: Dict[str, Any] = executivo_crud.editar_registro(db, body.tipo, body.id, {
            "Nome": body.nome,
            "Razão Social": body.razao_social,
            "CNPJ": body.cnpj,
            "UF": body.uf,
        })
        return RegistroExecutivoOut(**r)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
