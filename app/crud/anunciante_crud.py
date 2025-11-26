# app/crud/anunciante_crud.py
from __future__ import annotations
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List, Dict, Any
import re

from app.models import Anunciante


# ========== helpers ==========


def _normalize_url(u: Optional[str]) -> Optional[str]:
    """
    Normaliza URLs: adiciona https:// se vier sem esquema.
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


def get_by_id(db: Session, anunciante_id: int) -> Optional[Anunciante]:
    # mantém padrão do projeto (get está deprecado em versões novas, mas ok aqui)
    return db.query(Anunciante).get(anunciante_id)


def get_by_cnpj(db: Session, cnpj: str) -> Optional[Anunciante]:
    return db.query(Anunciante).filter(Anunciante.cnpj_anunciante == cnpj).first()


def get_by_codename(db: Session, codinome: str) -> Optional[Anunciante]:
    return db.query(Anunciante).filter(Anunciante.codinome == codinome).first()


def list_all(db: Session) -> List[Anunciante]:
    return db.query(Anunciante).order_by(Anunciante.nome_anunciante.asc()).all()


def list_by_name(db: Session, nome: str) -> List[Anunciante]:
    """
    Busca por nome_anunciante, codinome, razão social OU grupo empresarial
    contendo o termo (ilike).
    """
    termo = f"%{nome}%"
    return (
        db.query(Anunciante)
        .filter(
            or_(
                Anunciante.nome_anunciante.ilike(termo),
                Anunciante.codinome.ilike(termo),
                Anunciante.razao_social_anunciante.ilike(termo),
                Anunciante.grupo_empresarial.ilike(termo),
            )
        )
        .order_by(Anunciante.nome_anunciante.asc())
        .all()
    )


# ========== writes ==========


def create(db: Session, dados: Dict[str, Any]) -> Anunciante:
    # unicidade por CNPJ
    if get_by_cnpj(db, dados["cnpj_anunciante"]):
        raise ValueError("CNPJ de anunciante já cadastrado.")

    # (opcional) unicidade de codinome, se informado
    codinome = dados.get("codinome")
    if codinome:
        if get_by_codename(db, codinome):
            raise ValueError("Codinome já está em uso por outro anunciante.")

    novo = Anunciante(
        # --- campos básicos obrigatórios ---
        nome_anunciante=dados["nome_anunciante"],
        cnpj_anunciante=dados["cnpj_anunciante"],
        executivo=dados["executivo"],

        # --- existentes ---
        razao_social_anunciante=dados.get("razao_social_anunciante"),
        uf_cliente=dados.get("uf_cliente"),
        email_anunciante=dados.get("email_anunciante"),
        data_cadastro=dados.get("data_cadastro"),

        # --- endereço (cartão CNPJ / site) ---
        logradouro=dados.get("logradouro"),
        numero=dados.get("numero"),
        complemento=dados.get("complemento"),
        bairro=dados.get("bairro"),
        municipio=dados.get("municipio"),
        cep=dados.get("cep"),
        endereco=dados.get("endereco"),

        # --- telefones principais ---
        telefone_socio1=dados.get("telefone_socio1"),
        telefone_socio2=dados.get("telefone_socio2"),

        # --- segmentação ---
        segmento=dados.get("segmento"),
        subsegmento=dados.get("subsegmento"),

        # --- negócio / digitais ---
        grupo_empresarial=dados.get("grupo_empresarial"),
        codinome=codinome,
        site=_normalize_url(dados.get("site")),
        linkedin=_normalize_url(dados.get("linkedin")),
        instagram=_normalize_url(dados.get("instagram")),
    )

    db.add(novo)
    db.commit()
    db.refresh(novo)
    return novo


def update(db: Session, anunciante_id: int, dados: Dict[str, Any]) -> Anunciante:
    an = get_by_id(db, anunciante_id)
    if not an:
        raise ValueError("Anunciante não encontrado.")

    # troca de CNPJ -> checa unicidade
    if (
        "cnpj_anunciante" in dados
        and dados["cnpj_anunciante"]
        and dados["cnpj_anunciante"] != an.cnpj_anunciante
    ):
        if get_by_cnpj(db, dados["cnpj_anunciante"]):
            raise ValueError("CNPJ de anunciante já cadastrado.")

    # (opcional) troca de codinome -> checa unicidade
    if (
        "codinome" in dados
        and dados["codinome"]
        and dados["codinome"] != getattr(an, "codinome", None)
    ):
        if get_by_codename(db, dados["codinome"]):
            raise ValueError("Codinome já está em uso por outro anunciante.")

    # normalização das URLs se vierem no payload
    if "site" in dados:
        dados["site"] = _normalize_url(dados.get("site"))
    if "linkedin" in dados:
        dados["linkedin"] = _normalize_url(dados.get("linkedin"))
    if "instagram" in dados:
        dados["instagram"] = _normalize_url(dados.get("instagram"))

    # aplica campos conhecidos (ignora None para não sobrescrever com nulo)
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
