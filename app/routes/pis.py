from __future__ import annotations

import json
import shutil
import tempfile
from pathlib import Path
from typing import List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.schemas.pi import (
    PICreate, PIUpdate, PIOut, PISimpleOut,
    ProdutoIn, ProdutoOut, VeiculacaoOut, PiDetalheOut
)
from app.crud import pi_crud
from app.database import SessionLocal
from app.utils.pi_pdf import extract_structured_fields_from_pdf

router = APIRouter(prefix="/pis", tags=["pis"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def _save_upload_to_temp(upload: UploadFile, expected_ext: str = ".pdf") -> Path:
    suffix = expected_ext if expected_ext.startswith(".") else f".{expected_ext}"
    tmp_dir = Path(tempfile.gettempdir())
    tmp_path = tmp_dir / f"{uuid4().hex}{suffix}"

    with open(tmp_path, "wb") as f:
        shutil.copyfileobj(upload.file, f)

    try:
        upload.file.seek(0)
    except Exception:
        pass

    return tmp_path

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

@router.get("", response_model=List[PIOut])
def listar_todos(db: Session = Depends(get_db)):
    return pi_crud.list_all(db)

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
        novo = pi_crud.create(db, body.model_dump())
        return novo
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

@router.put("/{pi_id:int}", response_model=PIOut)
def atualizar_pi(pi_id: int, body: PIUpdate, db: Session = Depends(get_db)):
    try:
        upd = pi_crud.update(db, pi_id, body.model_dump(exclude_unset=True))
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

@router.post("/extrair-pdf")
async def extrair_pdf_para_preenchimento(
    arquivo_pdf: UploadFile = File(..., description="PDF do PI"),
):
    if not (arquivo_pdf.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Envie um arquivo PDF.")

    tmp_path = _save_upload_to_temp(arquivo_pdf, ".pdf")
    try:
        parsed = extract_structured_fields_from_pdf(str(tmp_path))
        return {
            "numero_pi": parsed.get("numero_pi"),
            "tipo_pi": parsed.get("tipo_pi"),
            "nome_anunciante": parsed.get("nome_anunciante"),
            "razao_social_anunciante": parsed.get("razao_social_anunciante"),
            "cnpj_anunciante": parsed.get("cnpj_anunciante"),
            "nome_agencia": parsed.get("nome_agencia"),
            "razao_social_agencia": parsed.get("razao_social_agencia"),
            "cnpj_agencia": parsed.get("cnpj_agencia"),
            "nome_campanha": parsed.get("nome_campanha"),
            "canal": parsed.get("canal"),
            "executivo": parsed.get("executivo"),
            "vencimento": parsed.get("vencimento"),
            "data_emissao": parsed.get("data_emissao"),
            "valor_bruto": parsed.get("valor_bruto"),
            "valor_liquido": parsed.get("valor_liquido"),
            "observacoes": parsed.get("observacoes"),
            "mes_ref": parsed.get("mes_ref"),
            "produtos": parsed.get("produtos") or [],
        }
    finally:
        try:
            tmp_path.unlink(missing_ok=True)
        except Exception:
            pass

@router.post("/importar", response_model=PIOut, status_code=status.HTTP_201_CREATED)
async def importar_pi(
    arquivo_pdf: UploadFile = File(..., description="PDF do PI"),
    pi_json: Optional[str] = Form(None, description="JSON opcional com campos de PICreate para sobrescrever"),
    db: Session = Depends(get_db),
):
    if not (arquivo_pdf.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Envie um arquivo PDF.")

    tmp_path = _save_upload_to_temp(arquivo_pdf, ".pdf")
    try:
        parsed = extract_structured_fields_from_pdf(str(tmp_path))

        overrides = {}
        if pi_json:
            try:
                overrides = json.loads(pi_json) or {}
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"pi_json inválido: {e}")

        payload = {**parsed, **overrides}

        try:
            data = PICreate.model_validate(payload)
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"Payload inválido: {e}")

        return pi_crud.create(db, data.model_dump())
    finally:
        try:
            tmp_path.unlink(missing_ok=True)
        except Exception:
            pass
