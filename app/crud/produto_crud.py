# app/crud/produto_crud.py
from __future__ import annotations
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from app.models import Produto

# ---- helpers ----
CATEG_VALIDAS = {"PAINEL", "PORTAL", "RÁDIO", "RADIO"}  # ajuste como preferir
MODAL_VALIDAS = {"UNITARIO", "DIARIA", "SEMANAL", "QUINZENAL", "MENSAL", "CPM", "SPOT"}

def _normalize_nome(nome: Optional[str]) -> str:
    return (nome or "").strip()

def _clean_empty(s: Optional[str]) -> Optional[str]:
    if s is None:
        return None
    t = s.strip()
    return t if t else None

def _to_int_or_none(v: Any) -> Optional[int]:
    if v is None:
        return None
    if isinstance(v, int):
        return v
    if isinstance(v, str):
        t = v.strip()
        if t == "":
            return None
        try:
            return int(float(t))  # tolera "10.0"
        except ValueError:
            return None
    if isinstance(v, float):
        return int(v)
    return None

def _validate_nonneg(name: str, v: Optional[int]):
    if v is not None and v < 0:
        raise ValueError(f"{name} não pode ser negativo.")

def _norm_categoria(cat: Optional[str]) -> Optional[str]:
    c = _clean_empty(cat)
    if not c:
        return None
    c_up = c.upper()
    # normaliza "RÁDIO" e "RADIO"
    if c_up == "RADIO":
        c_up = "RÁDIO"
    if CATEG_VALIDAS and c_up not in CATEG_VALIDAS:
        raise ValueError(f"Categoria inválida: {c}.")
    return c_up

def _norm_modalidade(mod: Optional[str]) -> Optional[str]:
    m = _clean_empty(mod)
    if not m:
        return None
    m_up = m.upper()
    if MODAL_VALIDAS and m_up not in MODAL_VALIDAS:
        raise ValueError(f"Modalidade de preço inválida: {m}.")
    return m_up

# ---- queries ----
def get_by_id(db: Session, produto_id: int) -> Optional[Produto]:
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

# ---- CRUD ----
def create(db: Session, dados: Dict[str, Any]) -> Produto:
    nome = _normalize_nome(dados.get("nome"))
    if not nome:
        raise ValueError("Nome do produto é obrigatório.")
    if get_by_name(db, nome):
        raise ValueError("Já existe um produto com esse nome.")

    base_segundos = _to_int_or_none(dados.get("base_segundos"))
    _validate_nonneg("base_segundos", base_segundos)

    novo = Produto(
        nome=nome,
        descricao=_clean_empty(dados.get("descricao")),
        # 🔻 removido: valor_unitario (preço não pertence mais ao produto)
        categoria=_norm_categoria(dados.get("categoria")),
        modalidade_preco=_norm_modalidade(dados.get("modalidade_preco")),
        base_segundos=base_segundos,
        unidade_rotulo=_clean_empty(dados.get("unidade_rotulo")),
    )
    db.add(novo)
    db.commit()
    db.refresh(novo)
    return novo

def update(db: Session, produto_id: int, dados: Dict[str, Any]) -> Produto:
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

    # 🔻 removido: valor_unitario

    if "categoria" in dados:
        prod.categoria = _norm_categoria(dados.get("categoria"))

    if "modalidade_preco" in dados:
        prod.modalidade_preco = _norm_modalidade(dados.get("modalidade_preco"))

    if "base_segundos" in dados:
        base_segundos = _to_int_or_none(dados.get("base_segundos"))
        _validate_nonneg("base_segundos", base_segundos)
        prod.base_segundos = base_segundos

    if "unidade_rotulo" in dados:
        prod.unidade_rotulo = _clean_empty(dados.get("unidade_rotulo"))

    db.commit()
    db.refresh(prod)
    return prod

def delete(db: Session, produto_id: int) -> None:
    prod = get_by_id(db, produto_id)
    if not prod:
        raise ValueError("Produto não encontrado.")

    vlist = getattr(prod, "veiculacoes", None)
    if vlist is not None and len(vlist) > 0:
        raise ValueError("Não é possível excluir: existem veiculações vinculadas a este produto.")

    db.delete(prod)
    db.commit()
