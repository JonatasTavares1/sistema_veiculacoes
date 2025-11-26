# app/crud/agencia_crud.py
from __future__ import annotations
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List, Dict, Any
import re

from app.models import Agencia


# ========== helpers ==========
def _normalize_url(u: Optional[str]) -> Optional[str]:
    """
    Normaliza URLs simples: adiciona https:// se vier sem esquema.
    Retorna None para strings vazias/brancas.
    """
    if not u:
        return None
    u = u.strip()
    if not u:
        return None
    if not re.match(r"^[a-zA-Z][a-zA-Z0-9+\-.]*://", u):
        return f"https://{u}"
    return u


# ========== reads ==========
def get_by_id(db: Session, agencia_id: int) -> Optional[Agencia]:
    # mantém o padrão do projeto (query().get())
    return db.query(Agencia).get(agencia_id)


def get_by_cnpj(db: Session, cnpj: str) -> Optional[Agencia]:
    return db.query(Agencia).filter(Agencia.cnpj_agencia == cnpj).first()


def get_by_codename(db: Session, codinome: str) -> Optional[Agencia]:
    return db.query(Agencia).filter(Agencia.codinome == codinome).first()


def list_all(db: Session) -> List[Agencia]:
    return db.query(Agencia).order_by(Agencia.nome_agencia.asc()).all()


def list_by_name(db: Session, nome: str) -> List[Agencia]:
    """
    Busca por nome_agencia, codinome, razão social ou grupo empresarial contendo o termo.
    """
    termo = f"%{nome}%"
    return (
        db.query(Agencia)
        .filter(
            or_(
                Agencia.nome_agencia.ilike(termo),
                Agencia.codinome.ilike(termo),
                Agencia.razao_social_agencia.ilike(termo),
                Agencia.grupo_empresarial.ilike(termo),
            )
        )
        .order_by(Agencia.nome_agencia.asc())
        .all()
    )


# ========== writes ==========
def create(db: Session, dados: Dict[str, Any]) -> Agencia:
    # unicidade por CNPJ
    if get_by_cnpj(db, dados["cnpj_agencia"]):
        raise ValueError("CNPJ de agência já cadastrado.")

    # (opcional) Unicidade de codinome se informado
    codinome = dados.get("codinome")
    if codinome:
        existente = get_by_codename(db, codinome)
        if existente:
            raise ValueError("Codinome já está em uso por outra agência.")

    novo = Agencia(
        # campos obrigatórios
        nome_agencia=dados["nome_agencia"],
        cnpj_agencia=dados["cnpj_agencia"],
        executivo=dados["executivo"],

        # campos existentes
        razao_social_agencia=dados.get("razao_social_agencia"),
        uf_agencia=dados.get("uf_agencia"),
        email_agencia=dados.get("email_agencia"),
        data_cadastro=dados.get("data_cadastro"),

        # novos campos básicos
        grupo_empresarial=dados.get("grupo_empresarial"),
        codinome=codinome,
        site=_normalize_url(dados.get("site")),
        linkedin=_normalize_url(dados.get("linkedin")),
        instagram=_normalize_url(dados.get("instagram")),

        # novos: endereço / negócio / telefones
        endereco=dados.get("endereco"),
        logradouro=dados.get("logradouro"),
        bairro=dados.get("bairro"),
        cep=dados.get("cep"),
        segmento=dados.get("segmento"),
        subsegmento=dados.get("subsegmento"),
        telefone_socio1=dados.get("telefone_socio1"),
        telefone_socio2=dados.get("telefone_socio2"),
    )

    db.add(novo)
    db.commit()
    db.refresh(novo)
    return novo


def update(db: Session, agencia_id: int, dados: Dict[str, Any]) -> Agencia:
    ag = get_by_id(db, agencia_id)
    if not ag:
        raise ValueError("Agência não encontrada.")

    # troca de CNPJ -> checa unicidade
    if (
        "cnpj_agencia" in dados
        and dados["cnpj_agencia"]
        and dados["cnpj_agencia"] != ag.cnpj_agencia
    ):
        if get_by_cnpj(db, dados["cnpj_agencia"]):
            raise ValueError("CNPJ de agência já cadastrado.")

    # (opcional) troca de codinome -> checa unicidade
    if (
        "codinome" in dados
        and dados["codinome"]
        and dados["codinome"] != getattr(ag, "codinome", None)
    ):
        if get_by_codename(db, dados["codinome"]):
            raise ValueError("Codinome já está em uso por outra agência.")

    # normalização das URLs se vierem no payload
    if "site" in dados:
        dados["site"] = _normalize_url(dados.get("site"))
    if "linkedin" in dados:
        dados["linkedin"] = _normalize_url(dados.get("linkedin"))
    if "instagram" in dados:
        dados["instagram"] = _normalize_url(dados.get("instagram"))

    # aplica campos conhecidos (ignora None para não sobrescrever com nulo)
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
    # integridade: agência com PIs vinculados não pode ser excluída
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
