# app/crud/produto_crud.py
from __future__ import annotations
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from app.models import Produto

# ------------- helpers -------------
def _normalize_nome(nome: Optional[str]) -> str:
    if not nome:
        return ""
    return nome.strip()

def _clean_empty(s: Optional[str]) -> Optional[str]:
    if s is None:
        return None
    t = s.strip()
    return t if t else None

# ------------- queries básicas -------------
def get_by_id(db: Session, produto_id: int) -> Optional[Produto]:
    # Session.get é a API moderna (evita warning do .query(Model).get)
    return db.get(Produto, produto_id)

def get_by_name(db: Session, nome: str) -> Optional[Produto]:
    n = _normalize_nome(nome)
    if not n:
        return None
    return db.query(Produto).filter(Produto.nome == n).first()

def list_all(db: Session) -> List[Produto]:
    return db.query(Produto).order_by(Produto.nome.asc()).all()

def list_by_name(db: Session, termo: str) -> List[Produto]:
    t = (termo or "").strip()
    if not t:
        return list_all(db)
    return (
        db.query(Produto)
        .filter(Produto.nome.ilike(f"%{t}%"))
        .order_by(Produto.nome.asc())
        .all()
    )

def list_distinct_names(db: Session) -> List[str]:
    rows = db.query(Produto.nome).distinct().order_by(Produto.nome.asc()).all()
    return [r[0] for r in rows if r and r[0]]

# ------------- CRUD -------------
def create(db: Session, dados: Dict[str, Any]) -> Produto:
    """
    Espera campos: nome (obrigatório), descricao (opcional), valor_unitario (opcional, >= 0)
    """
    nome = _normalize_nome(dados.get("nome"))
    if not nome:
        raise ValueError("Nome do produto é obrigatório.")

    # Evita duplicidade exata de nome
    if get_by_name(db, nome):
        raise ValueError("Já existe um produto com esse nome.")

    descricao = _clean_empty(dados.get("descricao"))
    vu = dados.get("valor_unitario")
    if vu is not None:
        try:
            vu = float(vu)
        except (TypeError, ValueError):
            raise ValueError("valor_unitario inválido.")
        if vu < 0:
            raise ValueError("valor_unitario não pode ser negativo.")

    novo = Produto(
        nome=nome,
        descricao=descricao,
        valor_unitario=vu,
    )
    db.add(novo)
    db.commit()
    db.refresh(novo)
    return novo

def update(db: Session, produto_id: int, dados: Dict[str, Any]) -> Produto:
    """
    Atualiza nome/descricao/valor_unitario. Garante unicidade do nome.
    """
    prod = get_by_id(db, produto_id)
    if not prod:
        raise ValueError("Produto não encontrado.")

    if "nome" in dados and dados["nome"] is not None:
        novo_nome = _normalize_nome(dados["nome"])
        if not novo_nome:
            raise ValueError("Nome do produto é obrigatório.")
        if novo_nome != prod.nome and get_by_name(db, novo_nome):
            raise ValueError("Já existe um produto com esse nome.")
        prod.nome = novo_nome

    if "descricao" in dados:
        prod.descricao = _clean_empty(dados.get("descricao"))

    if "valor_unitario" in dados:
        vu = dados.get("valor_unitario")
        if vu is None:
            prod.valor_unitario = None
        else:
            try:
                vu = float(vu)
            except (TypeError, ValueError):
                raise ValueError("valor_unitario inválido.")
            if vu < 0:
                raise ValueError("valor_unitario não pode ser negativo.")
            prod.valor_unitario = vu

    db.commit()
    db.refresh(prod)
    return prod

def delete(db: Session, produto_id: int) -> None:
    """
    Exclui o produto. Se houver relacionamento com veiculações e a regra do negócio
    impedir exclusão, valida antes (só se a relação existir no modelo).
    """
    prod = get_by_id(db, produto_id)
    if not prod:
        raise ValueError("Produto não encontrado.")

    # Se o modelo tiver relacionamento 'veiculacoes', bloqueie exclusão quando houver filhos.
    vlist = getattr(prod, "veiculacoes", None)
    if vlist is not None and len(vlist) > 0:
        raise ValueError("Não é possível excluir: existem veiculações vinculadas a este produto.")

    db.delete(prod)
    db.commit()
