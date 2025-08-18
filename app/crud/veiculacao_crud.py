# app/crud/veiculacao_crud.py
from __future__ import annotations
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session, joinedload
from app.models import Veiculacao, Produto, PI

# ---------- utils ----------
def _norm_desconto(v: Optional[float]) -> float:
    if v is None:
        return 0.0
    v = float(v)
    if v < 0:
        v = 0.0
    # se vier 0..100, converte para fração
    if v > 1.0:
        v = v / 100.0
    if v > 1.0:
        v = 1.0
    return v

def _calc_total(qtd: Optional[int], vu: Optional[float], desc: Optional[float]) -> float:
    q = int(qtd or 0)
    u = float(vu or 0.0)
    d = _norm_desconto(desc)
    return q * u * (1.0 - d)

def _get_produto_pi_or_fail(db: Session, produto_id: int, pi_id: int) -> Tuple[Produto, PI]:
    prod = db.query(Produto).get(produto_id)
    if not prod:
        raise ValueError("Produto não encontrado.")
    pi = db.query(PI).get(pi_id)
    if not pi:
        raise ValueError("PI não encontrada.")
    return prod, pi

# ---------- queries ----------
def get_by_id(db: Session, veic_id: int) -> Optional[Veiculacao]:
    return (
        db.query(Veiculacao)
        .options(joinedload(Veiculacao.produto), joinedload(Veiculacao.pi))
        .get(veic_id)
    )

def list_all(db: Session) -> List[Veiculacao]:
    return (
        db.query(Veiculacao)
        .options(joinedload(Veiculacao.produto), joinedload(Veiculacao.pi))
        .order_by(Veiculacao.id.desc())
        .all()
    )

def list_by_pi(db: Session, pi_id: int) -> List[Veiculacao]:
    return (
        db.query(Veiculacao)
        .options(joinedload(Veiculacao.produto), joinedload(Veiculacao.pi))
        .filter(Veiculacao.pi_id == pi_id)
        .order_by(Veiculacao.id.desc())
        .all()
    )

def list_by_produto(db: Session, produto_id: int) -> List[Veiculacao]:
    return (
        db.query(Veiculacao)
        .options(joinedload(Veiculacao.produto), joinedload(Veiculacao.pi))
        .filter(Veiculacao.produto_id == produto_id)
        .order_by(Veiculacao.id.desc())
        .all()
    )

# ---------- CRUD ----------
def create(db: Session, dados: Dict[str, Any]) -> Veiculacao:
    prod, pi = _get_produto_pi_or_fail(db, dados["produto_id"], dados["pi_id"])

    qtd = dados.get("quantidade") or 0
    vu = dados.get("valor_unitario")
    if vu is None:
        vu = prod.valor_unitario  # fallback do produto
    desc = _norm_desconto(dados.get("desconto"))
    total = _calc_total(qtd, vu, desc)

    novo = Veiculacao(
        produto_id=prod.id,
        pi_id=pi.id,
        data_inicio=dados.get("data_inicio"),
        data_fim=dados.get("data_fim"),
        quantidade=qtd,
        valor_unitario=vu,
        desconto=desc,
        valor_total=total,
    )
    db.add(novo)
    db.commit()
    db.refresh(novo)
    return novo

def update(db: Session, veic_id: int, dados: Dict[str, Any]) -> Veiculacao:
    veic = db.query(Veiculacao).get(veic_id)
    if not veic:
        raise ValueError("Veiculação não encontrada.")

    # troca de produto/pi (se vier)
    if "produto_id" in dados and dados["produto_id"]:
        prod = db.query(Produto).get(dados["produto_id"])
        if not prod:
            raise ValueError("Produto não encontrado.")
        veic.produto_id = prod.id
    else:
        prod = db.query(Produto).get(veic.produto_id)

    if "pi_id" in dados and dados["pi_id"]:
        pi = db.query(PI).get(dados["pi_id"])
        if not pi:
            raise ValueError("PI não encontrada.")
        veic.pi_id = pi.id

    # campos simples
    if "data_inicio" in dados:
        veic.data_inicio = dados["data_inicio"]
    if "data_fim" in dados:
        veic.data_fim = dados["data_fim"]
    if "quantidade" in dados and dados["quantidade"] is not None:
        veic.quantidade = int(dados["quantidade"])
    if "valor_unitario" in dados:
        veic.valor_unitario = float(dados["valor_unitario"]) if dados["valor_unitario"] is not None else None
    if "desconto" in dados:
        veic.desconto = _norm_desconto(dados["desconto"])

    # fallback de valor_unitario se None
    if veic.valor_unitario is None and prod is not None:
        veic.valor_unitario = prod.valor_unitario or 0.0

    # recalcula total
    veic.valor_total = _calc_total(veic.quantidade, veic.valor_unitario, veic.desconto)

    db.commit()
    db.refresh(veic)
    return veic

def delete(db: Session, veic_id: int) -> None:
    veic = db.query(Veiculacao).get(veic_id)
    if not veic:
        raise ValueError("Veiculação não encontrada.")
    # proteção: não excluir se houver entregas vinculadas
    if veic.entregas and len(veic.entregas) > 0:
        raise ValueError("Não é possível excluir: existem entregas vinculadas a esta veiculação.")
    db.delete(veic)
    db.commit()
