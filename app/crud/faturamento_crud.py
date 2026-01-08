from __future__ import annotations
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime

from app.models import Faturamento, FaturamentoAnexo, Entrega, Veiculacao

VALID_STATUS = {"ENVIADO", "EM_FATURAMENTO", "FATURADO", "PAGO"}


def get_by_id(db: Session, fat_id: int) -> Optional[Faturamento]:
    return db.query(Faturamento).get(fat_id)


def get_by_entrega(db: Session, entrega_id: int) -> Optional[Faturamento]:
    return db.query(Faturamento).filter(Faturamento.entrega_id == entrega_id).first()


def list_all(
    db: Session,
    status: Optional[str] = None,
    pi_id: Optional[int] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
) -> List[Faturamento]:
    # ✅ precisa passar por Entrega -> Veiculação para pegar pi_id
    q = (
        db.query(Faturamento)
        .join(Entrega, Entrega.id == Faturamento.entrega_id)
        .join(Veiculacao, Veiculacao.id == Entrega.veiculacao_id)
    )

    if status:
        q = q.filter(Faturamento.status == status)

    if pi_id is not None:
        q = q.filter(Veiculacao.pi_id == pi_id)

    if date_from is not None:
        q = q.filter(Faturamento.enviado_em >= date_from)

    if date_to is not None:
        q = q.filter(Faturamento.enviado_em <= date_to)

    return q.order_by(Faturamento.enviado_em.desc()).all()


def criar_ou_obter(db: Session, entrega_id: int) -> Faturamento:
    ent = db.query(Entrega).get(entrega_id)
    if not ent:
        raise ValueError("Entrega não encontrada.")

    existente = get_by_entrega(db, entrega_id)
    if existente:
        return existente

    fat = Faturamento(
        entrega_id=entrega_id,
        status="ENVIADO",
        enviado_em=datetime.utcnow(),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(fat)
    db.commit()
    db.refresh(fat)
    return fat


def atualizar_status(
    db: Session,
    fat_id: int,
    status: str,
    nf_numero: Optional[str] = None,
    observacao: Optional[str] = None,
) -> Faturamento:
    fat = get_by_id(db, fat_id)
    if not fat:
        raise ValueError("Faturamento não encontrado.")

    st = (status or "").strip().upper()
    if st not in VALID_STATUS:
        raise ValueError("Status inválido. Use ENVIADO, EM_FATURAMENTO, FATURADO ou PAGO.")

    fat.status = st
    fat.updated_at = datetime.utcnow()

    if observacao is not None:
        fat.observacao = observacao

    if nf_numero is not None:
        fat.nf_numero = nf_numero

    if st == "EM_FATURAMENTO" and fat.em_faturamento_em is None:
        fat.em_faturamento_em = datetime.utcnow()
    if st == "FATURADO" and fat.faturado_em is None:
        fat.faturado_em = datetime.utcnow()
    if st == "PAGO" and fat.pago_em is None:
        fat.pago_em = datetime.utcnow()

    db.commit()
    db.refresh(fat)
    return fat


def adicionar_anexo(
    db: Session,
    fat_id: int,
    tipo: str,
    filename: str,
    path: str,
    mime: Optional[str] = None,
    size: Optional[int] = None,
) -> FaturamentoAnexo:
    fat = get_by_id(db, fat_id)
    if not fat:
        raise ValueError("Faturamento não encontrado.")

    t = (tipo or "").strip().upper()
    if not t:
        raise ValueError("tipo do anexo é obrigatório.")

    an = FaturamentoAnexo(
        faturamento_id=fat_id,
        tipo=t,
        filename=filename,
        path=path,
        mime=mime,
        size=size,
        uploaded_at=datetime.utcnow(),
    )
    db.add(an)

    fat.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(an)
    return an
