# app/crud/anunciante_crud.py
from __future__ import annotations
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from app.models import Anunciante

def get_by_id(db: Session, anunciante_id: int) -> Optional[Anunciante]:
    return db.query(Anunciante).get(anunciante_id)

def get_by_cnpj(db: Session, cnpj: str) -> Optional[Anunciante]:
    return db.query(Anunciante).filter(Anunciante.cnpj_anunciante == cnpj).first()

def list_all(db: Session) -> List[Anunciante]:
    return db.query(Anunciante).order_by(Anunciante.nome_anunciante.asc()).all()

def list_by_name(db: Session, nome: str) -> List[Anunciante]:
    return (
        db.query(Anunciante)
        .filter(Anunciante.nome_anunciante.ilike(f"%{nome}%"))
        .order_by(Anunciante.nome_anunciante.asc())
        .all()
    )

def create(db: Session, dados: Dict[str, Any]) -> Anunciante:
    if get_by_cnpj(db, dados["cnpj_anunciante"]):
        raise ValueError("CNPJ de anunciante já cadastrado.")
    novo = Anunciante(
        nome_anunciante=dados["nome_anunciante"],
        razao_social_anunciante=dados.get("razao_social_anunciante"),
        cnpj_anunciante=dados["cnpj_anunciante"],
        uf_cliente=dados.get("uf_cliente"),
        executivo=dados["executivo"],
        email_anunciante=dados.get("email_anunciante"),
        data_cadastro=dados.get("data_cadastro"),
    )
    db.add(novo)
    db.commit()
    db.refresh(novo)
    return novo

def update(db: Session, anunciante_id: int, dados: Dict[str, Any]) -> Anunciante:
    an = get_by_id(db, anunciante_id)
    if not an:
        raise ValueError("Anunciante não encontrado.")

    if "cnpj_anunciante" in dados and dados["cnpj_anunciante"] and dados["cnpj_anunciante"] != an.cnpj_anunciante:
        if get_by_cnpj(db, dados["cnpj_anunciante"]):
            raise ValueError("CNPJ de anunciante já cadastrado.")

    for campo, valor in dados.items():
        if hasattr(an, campo) and valor is not None:
            setattr(an, campo, valor)

    db.commit()
    db.refresh(an)
    return an

def delete(db: Session, anunciante_id: int) -> None:
    an = get_by_id(db, anunciante_id)
    if not an:
        raise ValueError("Anunciante não encontrado.")
    # integridade: impedir exclusão com PIs vinculados
    if an.pis and len(an.pis) > 0:
        raise ValueError("Não é possível excluir: existem PIs vinculados ao anunciante.")
    db.delete(an)
    db.commit()

def delete_by_cnpj(db: Session, cnpj: str) -> bool:
    an = get_by_cnpj(db, cnpj)
    if not an:
        return False
    if an.pis and len(an.pis) > 0:
        raise ValueError("Não é possível excluir: existem PIs vinculados ao anunciante.")
    db.delete(an)
    db.commit()
    return True
