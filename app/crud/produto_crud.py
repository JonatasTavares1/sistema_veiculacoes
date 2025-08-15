# app/crud/produto_crud.py
from __future__ import annotations
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from app.models import Produto

def get_by_id(db: Session, produto_id: int) -> Optional[Produto]:
    return db.query(Produto).get(produto_id)

def get_by_name(db: Session, nome: str) -> Optional[Produto]:
    return db.query(Produto).filter(Produto.nome == nome).first()

def list_all(db: Session) -> List[Produto]:
    return db.query(Produto).order_by(Produto.nome.asc()).all()

def list_by_name(db: Session, termo: str) -> List[Produto]:
    return (
        db.query(Produto)
        .filter(Produto.nome.ilike(f"%{termo}%"))
        .order_by(Produto.nome.asc())
        .all()
    )

def create(db: Session, dados: Dict[str, Any]) -> Produto:
    nome = dados["nome"].strip()
    if get_by_name(db, nome):
        raise ValueError("Já existe um produto com esse nome.")
    novo = Produto(
        nome=nome,
        descricao=dados.get("descricao"),
        valor_unitario=dados.get("valor_unitario"),
    )
    db.add(novo)
    db.commit()
    db.refresh(novo)
    return novo

def update(db: Session, produto_id: int, dados: Dict[str, Any]) -> Produto:
    prod = get_by_id(db, produto_id)
    if not prod:
        raise ValueError("Produto não encontrado.")

    if "nome" in dados and dados["nome"]:
        novo_nome = dados["nome"].strip()
        if novo_nome != prod.nome and get_by_name(db, novo_nome):
            raise ValueError("Já existe um produto com esse nome.")
        prod.nome = novo_nome

    if "descricao" in dados:
        prod.descricao = dados["descricao"]

    if "valor_unitario" in dados:
        vu = dados["valor_unitario"]
        if vu is not None and vu < 0:
            raise ValueError("valor_unitario não pode ser negativo.")
        prod.valor_unitario = vu

    db.commit()
    db.refresh(prod)
    return prod

def delete(db: Session, produto_id: int) -> None:
    prod = get_by_id(db, produto_id)
    if not prod:
        raise ValueError("Produto não encontrado.")
    if prod.veiculacoes and len(prod.veiculacoes) > 0:
        raise ValueError("Não é possível excluir: existem veiculações vinculadas a este produto.")
    db.delete(prod)
    db.commit()
