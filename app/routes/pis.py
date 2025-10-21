from __future__ import annotations

import json
import os
import shutil
import tempfile
from pathlib import Path
from typing import List, Optional, Dict, Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.schemas.pi import (
    PICreate, PIUpdate, PIOut, PISimpleOut,
    ProdutoIn, ProdutoOut, VeiculacaoOut, PiDetalheOut, VeiculacaoAgendaOut
)
from app.crud import pi_crud
from app.database import SessionLocal
from app.utils.pi_pdf import extract_structured_fields_from_pdf

router = APIRouter(prefix="/pis", tags=["pis"])

# -------- uploads base dir --------
UPLOAD_ROOT = Path(os.getenv("PI_UPLOAD_DIR", "uploads")) / "pis"
UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)

# --------------------- infra ---------------------

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


# --------------------- helpers desta rota ---------------------

def _best_valor(v) -> Optional[float]:
    """
    Escolhe o melhor valor para exibição/cálculo:
    1) valor_liquido, 2) valor (legado), 3) valor_bruto.
    """
    for key in ("valor_liquido", "valor", "valor_bruto"):
        val = getattr(v, key, None)
        if val is not None:
            try:
                return float(val)
            except Exception:
                pass
    return None


def _to_detalhe(pi) -> PiDetalheOut:
    """
    Converte o objeto PI (já com pi.produtos 'transitórios' montados no CRUD)
    para o schema de saída PiDetalheOut.
    """
    produtos_out: List[ProdutoOut] = []
    total_pi = 0.0

    for p in (getattr(pi, "produtos", None) or []):
        veics = []
        total_produto = 0.0

        for v in (getattr(p, "veiculacoes", None) or []):
            # melhor valor para exibição/cálculo
            best = _best_valor(v) or 0.0
            total_produto += best

            veics.append(
                VeiculacaoOut(
                    id=v.id,
                    canal=getattr(v, "canal", None),
                    formato=getattr(v, "formato", None),
                    data_inicio=getattr(v, "data_inicio", None),
                    data_fim=getattr(v, "data_fim", None),
                    quantidade=getattr(v, "quantidade", None),

                    # preços completos (novo modelo)
                    valor_bruto=getattr(v, "valor_bruto", None),
                    desconto=getattr(v, "desconto", None),
                    valor_liquido=getattr(v, "valor_liquido", None),

                    # compat legado (usado em telas antigas / agenda)
                    valor=best,
                )
            )

        total_pi += total_produto

        produtos_out.append(
            ProdutoOut(
                id=p.id,
                nome=p.nome,
                descricao=getattr(p, "descricao", None),
                total_produto=round(float(total_produto), 2),
                veiculacoes=veics,
            )
        )

    return PiDetalheOut(
        id=pi.id,
        numero_pi=pi.numero_pi,
        anunciante=getattr(pi, "nome_anunciante", None),
        campanha=getattr(pi, "nome_campanha", None),
        emissao=getattr(pi, "data_emissao", None),
        total_pi=round(float(total_pi), 2),
        produtos=produtos_out,
    )


def _map_produtos_para_crud(produtos: List[ProdutoIn]) -> List[Dict[str, Any]]:
    """
    Traduz ProdutoIn (que usa VeiculacaoIn com `valor` e/ou novo modelo)
    para o payload que o pi_crud espera (veiculação com `valor_liquido`/`valor_bruto`/`desconto`).
    Mantém `canal`, `formato`, datas e quantidade.
    """
    out: List[Dict[str, Any]] = []
    for p in produtos or []:
        p_dict = p.model_dump()
        veics_in = p_dict.get("veiculacoes") or []
        veics_out: List[Dict[str, Any]] = []
        for v in veics_in:
            veics_out.append(
                {
                    # identificação (preserva id para update)
                    "id": v.get("id"),

                    # conteúdo:
                    "canal": v.get("canal"),
                    "formato": v.get("formato"),
                    "data_inicio": v.get("data_inicio"),
                    "data_fim": v.get("data_fim"),
                    "quantidade": v.get("quantidade"),

                    # preços (novo modelo preferencial):
                    "valor_bruto": v.get("valor_bruto"),
                    "desconto": v.get("desconto"),
                    # se vier só `valor`, assume como `valor_liquido`
                    "valor_liquido": v.get("valor_liquido", v.get("valor")),
                }
            )
        out.append(
            {
                "id": p_dict.get("id"),
                "nome": p_dict.get("nome"),
                "descricao": p_dict.get("descricao"),
                "veiculacoes": veics_out,
            }
        )
    return out


# --------------------- endpoints ---------------------

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


# ---------- detalhe ----------

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


# ---------- compose & sync (com tradução de 'valor' -> 'valor_liquido') ----------

class PIComposeIn(BaseModel):
    pi: PICreate
    produtos: List[ProdutoIn] = []


@router.post("/compose", response_model=PiDetalheOut, status_code=status.HTTP_201_CREATED)
def criar_composto(body: PIComposeIn, db: Session = Depends(get_db)):
    try:
        payload = body.model_dump()
        payload["produtos"] = _map_produtos_para_crud(body.produtos)
        created = pi_crud.compose_create(db, payload)
        full = pi_crud.get_with_relations_by_id(db, created.id)
        return _to_detalhe(full)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


class ProdutosSyncIn(BaseModel):
    produtos: List[ProdutoIn] = []


@router.put("/{pi_id:int}/produtos/sync", response_model=PiDetalheOut)
def sync_produtos(pi_id: int, body: ProdutosSyncIn, db: Session = Depends(get_db)):
    try:
        payload_produtos = _map_produtos_para_crud(body.produtos)
        pi = pi_crud.sync_produtos(db, pi_id, payload_produtos)
        full = pi_crud.get_with_relations_by_id(db, pi.id)
        return _to_detalhe(full)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


# ---------- importação / extração de PDF ----------

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

        overrides: Dict[str, Any] = {}
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


# ---------- NOVO: lista de veiculações do PI (útil para a Agenda/Front) ----------

@router.get("/{pi_id:int}/veiculacoes", response_model=List[VeiculacaoAgendaOut])
def listar_veiculacoes_do_pi(pi_id: int, db: Session = Depends(get_db)):
    """
    Retorna todas as veiculações pertencentes ao PI informado, já com
    dados suficientes para a Agenda (cliente/campanha/canal/formato/datas/valor).
    """
    rows = pi_crud.list_veiculacoes_by_pi(db, pi_id)
    return rows


# ---------- NOVOS: anexos (PI PDF e Proposta) ----------

@router.get("/{pi_id:int}/arquivos")
def listar_arquivos(pi_id: int, db: Session = Depends(get_db)):
    anexos = pi_crud.anexos_list(db, pi_id)
    return [
        {
            "id": a.id,
            "tipo": a.tipo,
            "filename": a.filename,
            "path": a.path,
            "mime": a.mime,
            "size": a.size,
            "uploaded_at": a.uploaded_at,
        }
        for a in anexos
    ]


@router.post("/{pi_id:int}/arquivos")
async def subir_arquivos(
    pi_id: int,
    arquivo_pi: UploadFile | None = File(None, description="PDF do PI"),
    proposta: UploadFile | None = File(None, description="PDF da Proposta"),
    db: Session = Depends(get_db),
):
    if arquivo_pi is None and proposta is None:
        raise HTTPException(status_code=400, detail="Envie ao menos um arquivo (arquivo_pi ou proposta).")

    base = UPLOAD_ROOT / str(pi_id)
    base.mkdir(parents=True, exist_ok=True)

    saved = []

    async def _save_one(up: UploadFile, tipo: str):
        if not (up.filename or "").lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail=f"O arquivo '{up.filename}' precisa ser PDF.")
        safe_name = f"{tipo}-{uuid4().hex}.pdf"
        dest = base / safe_name
        with open(dest, "wb") as f:
            f.write(await up.read())
        reg = pi_crud.anexos_add(
            db,
            pi_id,
            tipo=tipo,
            filename=up.filename or safe_name,
            path=str(dest).replace("\\", "/"),
            mime=up.content_type,
            size=None,
        )
        saved.append(
            {
                "id": reg.id,
                "tipo": reg.tipo,
                "filename": reg.filename,
                "path": reg.path,
                "mime": reg.mime,
                "size": reg.size,
                "uploaded_at": reg.uploaded_at,
            }
        )

    if arquivo_pi is not None:
        await _save_one(arquivo_pi, "pi_pdf")
    if proposta is not None:
        await _save_one(proposta, "proposta_pdf")

    return {"uploaded": saved}
