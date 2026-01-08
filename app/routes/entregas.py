# app/routes/entregas.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from app.schemas.entrega import EntregaCreate, EntregaUpdate, EntregaOut
from app.crud import entrega_crud
from app.crud import faturamento_crud
from app.database import SessionLocal

from app.deps_auth import require_roles

router = APIRouter(prefix="/entregas", tags=["entregas"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------- helpers de serialização ----------
def _serialize_entrega(r) -> EntregaOut:
    foi = (r.foi_entregue or "pendente").strip()
    foi_lower = foi.lower()
    entregue_bool = foi_lower in {"sim", "entregue", "ok", "1", "true"}
    status_txt = "Entregue" if entregue_bool else "Pendente"

    fat = getattr(r, "faturamento", None)
    fat_id = fat.id if fat else None
    fat_status = (fat.status or "").upper() if fat else None

    return EntregaOut(
        id=r.id,
        pi_id=r.pi_id,
        veiculacao_id=r.veiculacao_id,
        data_entrega=r.data_entrega.isoformat() if r.data_entrega else "",
        foi_entregue=foi or "pendente",
        status=status_txt,
        status_entrega=status_txt,
        entregue=entregue_bool,
        motivo=r.motivo or "",
        faturamento_id=fat_id,
        faturamento_status=fat_status,
    )


# ---- listas ----
@router.get("", response_model=List[EntregaOut])
def listar_todas(
    db: Session = Depends(get_db),
    pi_id: Optional[int] = Query(default=None),
    veiculacao_id: Optional[int] = Query(default=None),
):
    if pi_id is not None:
        regs = entrega_crud.list_by_pi(db, pi_id)
    elif veiculacao_id is not None:
        regs = entrega_crud.list_by_veiculacao(db, veiculacao_id)
    else:
        regs = entrega_crud.list_all(db)
    return [_serialize_entrega(r) for r in regs]


@router.get("/veiculacao/{veiculacao_id:int}", response_model=List[EntregaOut])
def por_veiculacao(veiculacao_id: int, db: Session = Depends(get_db)):
    regs = entrega_crud.list_by_veiculacao(db, veiculacao_id)
    return [_serialize_entrega(r) for r in regs]


@router.get("/pi/{pi_id:int}", response_model=List[EntregaOut])
def por_pi(pi_id: int, db: Session = Depends(get_db)):
    regs = entrega_crud.list_by_pi(db, pi_id)
    return [_serialize_entrega(r) for r in regs]


# ---- CRUD ----
@router.post("", response_model=EntregaOut, status_code=status.HTTP_201_CREATED)
def criar(body: EntregaCreate, db: Session = Depends(get_db)):
    try:
        novo = entrega_crud.create(db, body.dict())
        return _serialize_entrega(novo)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.put("/{entrega_id:int}", response_model=EntregaOut)
def atualizar(entrega_id: int, body: EntregaUpdate, db: Session = Depends(get_db)):
    try:
        upd = entrega_crud.update(db, entrega_id, body.dict(exclude_unset=True))
        return _serialize_entrega(upd)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.put("/{entrega_id:int}/entregue", response_model=EntregaOut)
def marcar_como_entregue(entrega_id: int, db: Session = Depends(get_db)):
    try:
        ent = entrega_crud.marcar_entregue(db, entrega_id)
        return _serialize_entrega(ent)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.put("/{entrega_id:int}/motivo", response_model=EntregaOut)
def atualizar_motivo(entrega_id: int, motivo: str, db: Session = Depends(get_db)):
    try:
        ent = entrega_crud.atualizar_motivo(db, entrega_id, motivo)
        return _serialize_entrega(ent)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.delete("/{entrega_id:int}")
def deletar(entrega_id: int, db: Session = Depends(get_db)):
    try:
        entrega_crud.delete(db, entrega_id)
        return JSONResponse({"ok": True, "deleted_id": entrega_id})
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


# ============================
# ✅ enviar para faturamento
# ============================
@router.post(
    "/{entrega_id:int}/enviar-faturamento",
    response_model=dict,
    status_code=status.HTTP_201_CREATED,
)
def enviar_para_faturamento(
    entrega_id: int,
    db: Session = Depends(get_db),
    _user=Depends(require_roles("admin", "opec")),
):
    try:
        fat = faturamento_crud.criar_ou_obter(db, entrega_id)
        return {"ok": True, "faturamento_id": fat.id, "status": fat.status}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
