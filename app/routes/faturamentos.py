from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime

from app.database import SessionLocal
from app.schemas.faturamento import FaturamentoOut, FaturamentoStatusUpdate
from app.crud import faturamento_crud
from app.deps_auth import require_roles

router = APIRouter(prefix="/faturamentos", tags=["faturamentos"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _iso(dt):
    return dt.isoformat() if dt else None


def _serialize_pi(pi) -> Optional[Dict[str, Any]]:
    if not pi:
        return None

    return {
        "id": pi.id,
        "numero_pi": getattr(pi, "numero_pi", None),
        "tipo_pi": getattr(pi, "tipo_pi", None),
        "numero_pi_matriz": getattr(pi, "numero_pi_matriz", None),
        "numero_pi_normal": getattr(pi, "numero_pi_normal", None),
        "nome_anunciante": getattr(pi, "nome_anunciante", None),
        "razao_social_anunciante": getattr(pi, "razao_social_anunciante", None),
        "cnpj_anunciante": getattr(pi, "cnpj_anunciante", None),
        "nome_agencia": getattr(pi, "nome_agencia", None),
        "razao_social_agencia": getattr(pi, "razao_social_agencia", None),
        "cnpj_agencia": getattr(pi, "cnpj_agencia", None),
        "nome_campanha": getattr(pi, "nome_campanha", None),
        "executivo": getattr(pi, "executivo", None),
        "diretoria": getattr(pi, "diretoria", None),
        "uf_cliente": getattr(pi, "uf_cliente", None),
        "canal": getattr(pi, "canal", None),
        "valor_bruto": getattr(pi, "valor_bruto", None),
        "valor_liquido": getattr(pi, "valor_liquido", None),
        "vencimento": _iso(getattr(pi, "vencimento", None)),
        "data_emissao": _iso(getattr(pi, "data_emissao", None)),
    }


def _serialize_fat(f, pi=None):
    return {
        "id": f.id,
        "entrega_id": f.entrega_id,
        "status": (f.status or "").upper(),
        "enviado_em": _iso(f.enviado_em),
        "em_faturamento_em": _iso(f.em_faturamento_em),
        "faturado_em": _iso(f.faturado_em),
        "pago_em": _iso(f.pago_em),
        "nf_numero": f.nf_numero,
        "observacao": f.observacao,
        "pi": _serialize_pi(pi),
        "anexos": [
            {
                "id": a.id,
                "tipo": a.tipo,
                "filename": a.filename,
                "path": a.path,
                "mime": a.mime,
                "size": a.size,
                "uploaded_at": _iso(a.uploaded_at),
            }
            for a in (getattr(f, "anexos", None) or [])
        ],
    }


@router.get("", response_model=List[FaturamentoOut])
def listar(
    db: Session = Depends(get_db),
    status_: Optional[str] = Query(default=None, alias="status"),
    pi_id: Optional[int] = Query(default=None),
    _user=Depends(require_roles("admin", "financeiro", "opec")),
):
    regs = faturamento_crud.list_all(
        db,
        status=status_.upper() if status_ else None,
        pi_id=pi_id,
    )

    entrega_ids = [r.entrega_id for r in regs if getattr(r, "entrega_id", None)]
    pi_by_entrega: Dict[int, Any] = {}

    if entrega_ids:
        from app.models import Entrega, Veiculacao, PI

        rows = (
            db.query(Entrega.id.label("entrega_id"), PI)
            .join(Veiculacao, Veiculacao.id == Entrega.veiculacao_id)
            .join(PI, PI.id == Veiculacao.pi_id)
            .filter(Entrega.id.in_(entrega_ids))
            .all()
        )

        for entrega_id_row, pi_obj in rows:
            pi_by_entrega[int(entrega_id_row)] = pi_obj

    return [_serialize_fat(x, pi=pi_by_entrega.get(x.entrega_id)) for x in regs]


@router.post("/gerar", response_model=dict)
def gerar_por_pi(
    pi_id: int = Query(...),
    db: Session = Depends(get_db),
    _user=Depends(require_roles("admin", "financeiro", "opec")),
):
    from app.models import Entrega, Veiculacao

    entregas = (
        db.query(Entrega)
        .join(Veiculacao, Veiculacao.id == Entrega.veiculacao_id)
        .filter(Veiculacao.pi_id == pi_id)
        .all()
    )

    created = 0
    for e in entregas:
        before = faturamento_crud.get_by_entrega(db, e.id)
        fat = faturamento_crud.criar_ou_obter(db, e.id)
        if before is None and fat is not None:
            created += 1

    return {
        "ok": True,
        "pi_id": pi_id,
        "entregas": len(entregas),
        "novos_faturamentos": created,
    }


@router.put("/{fat_id}/status", response_model=FaturamentoOut)
def atualizar_status(
    fat_id: int,
    body: FaturamentoStatusUpdate,
    db: Session = Depends(get_db),
    _user=Depends(require_roles("admin", "financeiro")),
):
    try:
        upd = faturamento_crud.atualizar_status(
            db,
            fat_id,
            body.status,
            nf_numero=body.nf_numero,
            observacao=body.observacao,
        )

        from app.models import Entrega, Veiculacao, PI

        pi = (
            db.query(PI)
            .join(Veiculacao, Veiculacao.pi_id == PI.id)
            .join(Entrega, Entrega.veiculacao_id == Veiculacao.id)
            .filter(Entrega.id == upd.entrega_id)
            .first()
        )

        return _serialize_fat(upd, pi=pi)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/{fat_id}/anexos", response_model=dict, status_code=status.HTTP_201_CREATED)
async def anexar(
    fat_id: int,
    tipo: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(require_roles("admin", "financeiro", "opec")),
):
    t = (tipo or "").strip().upper()
    role = ((getattr(user, "role", "") or "")).lower().strip()

    def deny():
        raise HTTPException(status_code=403, detail="Sem permissão para anexar este tipo de documento.")

    # admin pode tudo
    if role != "admin":
        if t == "OPEC":
            if role not in {"opec"}:
                deny()
        elif t in {"NF", "COMPROVANTE_PAGAMENTO"}:
            if role not in {"financeiro"}:
                deny()
        else:
            deny()

    from pathlib import Path

    uploads_dir = Path("uploads") / "faturamento" / str(fat_id)
    uploads_dir.mkdir(parents=True, exist_ok=True)

    safe_name = (file.filename or "arquivo").replace("/", "_").replace("\\", "_")
    save_path = uploads_dir / f"{int(datetime.utcnow().timestamp())}_{safe_name}"

    content = await file.read()
    with open(save_path, "wb") as f:
        f.write(content)

    try:
        an = faturamento_crud.adicionar_anexo(
            db=db,
            fat_id=fat_id,
            tipo=t,
            filename=file.filename,
            path=str(save_path),
            mime=file.content_type,
            size=len(content),
        )
        return {"ok": True, "anexo_id": an.id, "path": str(save_path), "tipo": t}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
