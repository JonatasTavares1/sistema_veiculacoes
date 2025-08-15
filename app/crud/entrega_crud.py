# app/crud/entrega_crud.py
from __future__ import annotations
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from datetime import datetime, date

from app.models import Entrega, Veiculacao  # valida veiculacao opcionalmente

# ---------- utils ----------
def _parse_date_maybe(value: str | None) -> date | None:
    if not value:
        return None
    v = value.strip()
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(v, fmt).date()
        except ValueError:
            pass
    return None

def _normalize_status(s: str | None) -> str | None:
    if s is None:
        return None
    t = s.strip().lower()
    if t in ("sim", "s", "entregue", "ok"):
        return "Sim"
    if t in ("nao", "não", "n", "nao entregue", "não entregue"):
        return "Não"
    if t in ("pendente", "p", "aguardando"):
        return "pendente"
    raise ValueError("Status inválido. Use 'Sim', 'Não' ou 'pendente'.")

# ---------- queries ----------
def get_by_id(db: Session, entrega_id: int) -> Optional[Entrega]:
    return db.query(Entrega).get(entrega_id)

def list_all(db: Session) -> List[Entrega]:
    return db.query(Entrega).order_by(Entrega.data_entrega.desc()).all()

def list_by_veiculacao(db: Session, veiculacao_id: int) -> List[Entrega]:
    return (
        db.query(Entrega)
        .filter(Entrega.veiculacao_id == veiculacao_id)
        .order_by(Entrega.data_entrega.desc())
        .all()
    )

def list_pendentes(db: Session) -> List[Entrega]:
    hoje = date.today()
    # pendente: NÃO entregue e com data < hoje (atrasadas) OU status "pendente"
    return (
        db.query(Entrega)
        .filter(
            ((Entrega.foi_entregue != "Sim") & (Entrega.data_entrega < hoje))
            | (Entrega.foi_entregue == "pendente")
        )
        .order_by(Entrega.data_entrega.asc())
        .all()
    )

# ---------- CRUD ----------
def create(db: Session, dados: Dict[str, Any]) -> Entrega:
    # valida veiculacao (opcional, mas recomendado)
    veic_id = dados["veiculacao_id"]
    if not db.query(Veiculacao).get(veic_id):
        raise ValueError(f"Veiculação {veic_id} não encontrada.")

    dt = _parse_date_maybe(dados.get("data_entrega"))
    if not dt:
        raise ValueError("data_entrega inválida. Use dd/mm/aaaa ou aaaa-mm-dd.")

    status = _normalize_status(dados.get("foi_entregue") or "pendente")

    novo = Entrega(
        veiculacao_id=veic_id,
        data_entrega=dt,
        foi_entregue=status,
        motivo=dados.get("motivo") or "",
    )
    db.add(novo)
    db.commit()
    db.refresh(novo)
    return novo

def update(db: Session, entrega_id: int, dados: Dict[str, Any]) -> Entrega:
    ent = get_by_id(db, entrega_id)
    if not ent:
        raise ValueError("Entrega não encontrada.")

    if "veiculacao_id" in dados and dados["veiculacao_id"]:
        veic_id = dados["veiculacao_id"]
        if not db.query(Veiculacao).get(veic_id):
            raise ValueError(f"Veiculação {veic_id} não encontrada.")
        ent.veiculacao_id = veic_id

    if "data_entrega" in dados and dados["data_entrega"]:
        dt = _parse_date_maybe(dados["data_entrega"])
        if not dt:
            raise ValueError("data_entrega inválida. Use dd/mm/aaaa ou aaaa-mm-dd.")
        ent.data_entrega = dt

    if "foi_entregue" in dados and dados["foi_entregue"] is not None:
        ent.foi_entregue = _normalize_status(dados["foi_entregue"])

    if "motivo" in dados and dados["motivo"] is not None:
        ent.motivo = dados["motivo"]

    db.commit()
    db.refresh(ent)
    return ent

def marcar_entregue(db: Session, entrega_id: int) -> Entrega:
    ent = get_by_id(db, entrega_id)
    if not ent:
        raise ValueError("Entrega não encontrada.")
    ent.foi_entregue = "Sim"
    ent.motivo = ""
    db.commit()
    db.refresh(ent)
    return ent

def atualizar_motivo(db: Session, entrega_id: int, motivo: str) -> Entrega:
    ent = get_by_id(db, entrega_id)
    if not ent:
        raise ValueError("Entrega não encontrada.")
    ent.motivo = motivo or ""
    db.commit()
    db.refresh(ent)
    return ent

def delete(db: Session, entrega_id: int) -> None:
    ent = get_by_id(db, entrega_id)
    if not ent:
        raise ValueError("Entrega não encontrada.")
    db.delete(ent)
    db.commit()
