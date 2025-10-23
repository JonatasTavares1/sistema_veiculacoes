from __future__ import annotations

import io
import json
import os
import shutil
import tempfile
from pathlib import Path
from typing import List, Optional, Dict, Any, Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from fastapi.responses import JSONResponse, FileResponse, RedirectResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.schemas.pi import (
    PICreate,
    PIUpdate,
    PIOut,
    PISimpleOut,
    ProdutoIn,
    ProdutoOut,
    VeiculacaoOut,
    PiDetalheOut,
    VeiculacaoAgendaOut,
)
from app.crud import pi_crud
from app.database import SessionLocal
from app.utils.pi_pdf import extract_structured_fields_from_pdf
from app.utils.drive_upload import (
    upload_pdf_to_drive,
    get_drive_file_meta,
    download_drive_file_bytes,
)

router = APIRouter(prefix="/pis", tags=["pis"])

# -------- uploads base dir (usado para temporários/extrator e fallback local) --------
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
    for key in ("valor_liquido", "valor", "valor_bruto"):
        val = getattr(v, key, None)
        if val is not None:
            try:
                return float(val)
            except Exception:
                pass
    return None

def _to_detalhe(pi) -> PiDetalheOut:
    return PiDetalheOut.model_validate(pi)

def _map_produtos_para_crud(produtos: List[ProdutoIn]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for p in produtos or []:
        p_dict = p.model_dump()
        veics_in = p_dict.get("veiculacoes") or []
        veics_out: List[Dict[str, Any]] = []
        for v in veics_in:
            veics_out.append(
                {
                    "id": v.get("id"),
                    "canal": v.get("canal"),
                    "formato": v.get("formato"),
                    "data_inicio": v.get("data_inicio"),
                    "data_fim": v.get("data_fim"),
                    "quantidade": v.get("quantidade"),
                    "valor_bruto": v.get("valor_bruto"),
                    "desconto": v.get("desconto"),
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

# ===================== helpers de anexos/arquivo =====================

_TIPO_ALIAS = {
    "pi": "pi_pdf",
    "proposta": "proposta_pdf",
}

def _tipo_norm_to_db(tipo_query: str) -> str:
    tipo_norm = (tipo_query or "").strip().lower()
    tipo_bd = _TIPO_ALIAS.get(tipo_norm)
    if not tipo_bd:
        raise HTTPException(status_code=400, detail="Parâmetro 'tipo' deve ser 'pi' ou 'proposta'.")
    return tipo_bd

def _which_from_tipo_db(tipo_db: str) -> Literal["pi", "proposta"]:
    return "pi" if (tipo_db or "").startswith("pi") else "proposta"

def _get_latest_anexo(db: Session, pi_id: int, tipo_query: str):
    tipo_bd = _tipo_norm_to_db(tipo_query)
    anexos = pi_crud.anexos_list(db, pi_id)  # ordenado por uploaded_at desc
    for a in anexos:
        if (a.tipo or "").lower() == tipo_bd:
            return a
    return None

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

# ---------- compose & sync ----------

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

# ---------- lista de veiculações ----------

@router.get("/{pi_id:int}/veiculacoes", response_model=List[VeiculacaoAgendaOut])
def listar_veiculacoes_do_pi(pi_id: int, db: Session = Depends(get_db)):
    rows = pi_crud.list_veiculacoes_by_pi(db, pi_id)
    return rows

# ---------- anexos (PI PDF e Proposta) — Google Drive ----------

@router.get("/{pi_id:int}/arquivos")
def listar_arquivos(pi_id: int, db: Session = Depends(get_db)):
    anexos = pi_crud.anexos_list(db, pi_id)
    return [
        {
            "id": a.id,
            "tipo": a.tipo,
            "filename": a.filename,
            "path": a.path,  # gdrive://<fileId> ou caminho local legado
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
    """
    Envia anexos para o Google Drive usando a credencial/pasta correspondente:
    - arquivo_pi  -> service account/pasta de PI
    - proposta    -> service account/pasta de Propostas
    Registra no BD com path="gdrive://<fileId>".
    """
    if arquivo_pi is None and proposta is None:
        raise HTTPException(status_code=400, detail="Envie ao menos um arquivo (arquivo_pi ou proposta).")

    saved: List[Dict[str, Any]] = []

    async def _save_one(up: UploadFile, tipo_db: str):
        if not (up.filename or "").lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail=f"O arquivo '{up.filename}' precisa ser PDF.")

        which = _which_from_tipo_db(tipo_db)  # "pi" | "proposta"
        content = await up.read()
        safe_name = f"{tipo_db}-{uuid4().hex}.pdf"

        drive_file = upload_pdf_to_drive(content, safe_name, which=which)

        reg = pi_crud.anexos_add(
            db,
            pi_id,
            tipo=tipo_db,
            filename=up.filename or safe_name,
            path=f"gdrive://{drive_file['id']}",
            mime=drive_file.get("mimeType") or up.content_type,
            size=len(content),
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
                "webViewLink": drive_file.get("webViewLink"),
                "webContentLink": drive_file.get("webContentLink"),
            }
        )

    if arquivo_pi is not None:
        await _save_one(arquivo_pi, "pi_pdf")
    if proposta is not None:
        await _save_one(proposta, "proposta_pdf")

    return {"uploaded": saved}

# ---------- ALIASES de compatibilidade para o front ----------

@router.get("/{pi_id:int}/anexos")
def listar_anexos_alias(pi_id: int, db: Session = Depends(get_db)):
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

@router.post("/{pi_id:int}/anexos")
async def subir_anexos_alias(
    pi_id: int,
    # novo formato (usado no front atual): 1 arquivo + tipo
    arquivo: UploadFile | None = File(None, description="PDF"),
    tipo: Optional[str] = Form(default="pi_pdf"),
    # compat legado: lista de arquivos via "files"
    files: List[UploadFile] | None = File(None, description="um ou mais PDFs"),
    db: Session = Depends(get_db),
):
    """
    Aceita:
    - novo:  tipo=("pi_pdf"|"proposta"| "pi"|"proposta") + arquivo (UploadFile)
    - legado: files=[...], com 'tipo' aplicado para todos
    """
    uploads = []
    if arquivo is None and not files:
        raise HTTPException(status_code=400, detail="Envie 'arquivo' (novo) ou 'files' (legado).")

    # normaliza tipo
    tipo_raw = (tipo or "pi_pdf").strip().lower()
    if tipo_raw in {"pi", "pi_pdf"}:
        tipo_db = "pi_pdf"
    elif tipo_raw in {"proposta", "proposta_pdf"}:
        tipo_db = "proposta_pdf"
    else:
        raise HTTPException(status_code=400, detail="tipo deve ser 'pi'|'pi_pdf' ou 'proposta'|'proposta_pdf'.")

    async def _save(up: UploadFile):
        if not (up.filename or "").lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail=f"O arquivo '{up.filename}' precisa ser PDF.")

        which = _which_from_tipo_db(tipo_db)  # "pi" | "proposta"
        content = await up.read()
        safe_name = f"{tipo_db}-{uuid4().hex}.pdf"

        drive_file = upload_pdf_to_drive(content, safe_name, which=which)

        reg = pi_crud.anexos_add(
            db,
            pi_id,
            tipo=tipo_db,
            filename=up.filename or safe_name,
            path=f"gdrive://{drive_file['id']}",
            mime=drive_file.get("mimeType") or up.content_type,
            size=len(content),
        )
        uploads.append(
            {
                "id": reg.id,
                "tipo": reg.tipo,
                "filename": reg.filename,
                "path": reg.path,
                "mime": reg.mime,
                "size": reg.size,
                "uploaded_at": reg.uploaded_at,
                "webViewLink": drive_file.get("webViewLink"),
                "webContentLink": drive_file.get("webContentLink"),
            }
        )

    if arquivo is not None:
        await _save(arquivo)
    if files:
        for up in files:
            await _save(up)

    return {"uploaded": uploads}

# ---------- NOVA ROTA: obter anexo mais recente (pi|proposta) ----------

@router.get("/{pi_id:int}/arquivo")
def obter_arquivo_mais_recente(
    pi_id: int,
    tipo: Literal["pi", "proposta"] = Query("pi", description="Tipo do anexo"),
    modo: Literal["redirect", "download"] = Query("redirect", description="redirect abre link do Drive; download faz proxy"),
    db: Session = Depends(get_db),
):
    """
    Retorna o anexo mais recente do tipo informado.
    - modo=redirect: redireciona para webViewLink/webContentLink do Drive
    - modo=download: baixa via API (StreamingResponse) com Content-Disposition
    """
    anexo = _get_latest_anexo(db, pi_id, tipo)
    if not anexo:
        raise HTTPException(status_code=404, detail="Nenhum anexo encontrado para o tipo solicitado.")

    path = (anexo.path or "").strip()

    # Se for arquivo em Google Drive
    if path.startswith("gdrive://"):
        file_id = path.split("://", 1)[1]

        if modo == "download":
            data, name, mime = download_drive_file_bytes(file_id)
            headers = {"Content-Disposition": f'attachment; filename="{name}"'}
            return StreamingResponse(io.BytesIO(data), media_type=mime, headers=headers)

        # redirect (padrão): enviar ao link do Drive
        meta = get_drive_file_meta(file_id)
        url = meta.get("webViewLink") or meta.get("webContentLink")
        if url:
            return RedirectResponse(url)
        # fallback: se não houver link, faz download
        data, name, mime = download_drive_file_bytes(file_id)
        headers = {"Content-Disposition": f'attachment; filename="{name}"'}
        return StreamingResponse(io.BytesIO(data), media_type=mime, headers=headers)

    # Fallback: anexo legado salvo em disco local
    if os.path.exists(path):
        return FileResponse(path, filename=anexo.filename or os.path.basename(path))

    raise HTTPException(status_code=410, detail="Caminho de anexo inválido ou não disponível.")
