# app/crud/agencia_crud.py
from __future__ import annotations
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from app.models import Agencia

def get_by_id(db: Session, agencia_id: int) -> Optional[Agencia]:
    return db.query(Agencia).get(agencia_id)

def get_by_cnpj(db: Session, cnpj: str) -> Optional[Agencia]:
    return db.query(Agencia).filter(Agencia.cnpj_agencia == cnpj).first()

def list_all(db: Session) -> List[Agencia]:
    return db.query(Agencia).order_by(Agencia.nome_agencia.asc()).all()

def list_by_name(db: Session, nome: str) -> List[Agencia]:
    return (
        db.query(Agencia)
        .filter(Agencia.nome_agencia.ilike(f"%{nome}%"))
        .order_by(Agencia.nome_agencia.asc())
        .all()
    )

def create(db: Session, dados: Dict[str, Any]) -> Agencia:
    if get_by_cnpj(db, dados["cnpj_agencia"]):
        raise ValueError("CNPJ de agência já cadastrado.")
    novo = Agencia(
        nome_agencia=dados["nome_agencia"],
        razao_social_agencia=dados.get("razao_social_agencia"),
        cnpj_agencia=dados["cnpj_agencia"],
        uf_agencia=dados.get("uf_agencia"),
        executivo=dados["executivo"],
        email_agencia=dados.get("email_agencia"),
        data_cadastro=dados.get("data_cadastro"),
    )
    db.add(novo)
    db.commit()
    db.refresh(novo)
    return novo

def update(db: Session, agencia_id: int, dados: Dict[str, Any]) -> Agencia:
    ag = get_by_id(db, agencia_id)
    if not ag:
        raise ValueError("Agência não encontrada.")

    if "cnpj_agencia" in dados and dados["cnpj_agencia"] and dados["cnpj_agencia"] != ag.cnpj_agencia:
        if get_by_cnpj(db, dados["cnpj_agencia"]):
            raise ValueError("CNPJ de agência já cadastrado.")

    for campo, valor in dados.items():
        if hasattr(ag, campo) and valor is not None:
            setattr(ag, campo, valor)

    db.commit()
    db.refresh(ag)
    return ag

def delete(db: Session, agencia_id: int) -> None:
    ag = get_by_id(db, agencia_id)
    if not ag:
        raise ValueError("Agência não encontrada.")
    # regra de integridade: impedir excluir com PIs vinculados
    if ag.pis and len(ag.pis) > 0:
        raise ValueError("Não é possível excluir: existem PIs vinculados à agência.")
    db.delete(ag)
    db.commit()

def delete_by_cnpj(db: Session, cnpj: str) -> bool:
    ag = get_by_cnpj(db, cnpj)
    if not ag:
        return False
    if ag.pis and len(ag.pis) > 0:
        raise ValueError("Não é possível excluir: existem PIs vinculados à agência.")
    db.delete(ag)
    db.commit()
    return True
