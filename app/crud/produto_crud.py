# app/crud/produto_crud.py
from __future__ import annotations

from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from app.models import Produto

# ======================================
# Helpers / Validações
# ======================================

# ✅ RECOMENDADO: não travar categoria agora (deixa livre)
# Se quiser padronizar depois, podemos virar para enum/controlado.
CATEG_VALIDAS: set[str] = set()

# ✅ CASA COM O FRONT
MODAL_VALIDAS = {"DIA", "SPOT", "CPM", "PACOTE"}


def _normalize_nome(nome: Optional[str]) -> str:
    return (nome or "").strip()


def _clean_empty(s: Optional[str]) -> Optional[str]:
    if s is None:
        return None
    t = str(s).strip()
    return t if t else None


def _to_int_or_none(v: Any) -> Optional[int]:
    if v is None:
        return None
    if isinstance(v, int):
        return v
    if isinstance(v, float):
        return int(v)
    if isinstance(v, str):
        t = v.strip()
        if t == "":
            return None
        try:
            return int(float(t))
        except ValueError:
            return None
    return None


def _to_float_or_none(v: Any) -> Optional[float]:
    """
    Aceita:
      - 50000
      - 50000.00
      - "50000"
      - "50.000,00"
      - "50,000.00" (tenta melhor esforço)
    """
    if v is None:
        return None

    if isinstance(v, (int, float)):
        return float(v)

    if isinstance(v, str):
        t = v.strip()
        if t == "":
            return None

        # Remove espaços e símbolos comuns (caso o usuário cole "R$ 50.000,00")
        t = (
            t.replace("R$", "")
            .replace("r$", "")
            .replace(" ", "")
        )

        # Se tiver vírgula e ponto, assume padrão pt-BR "50.000,00"
        # Remove pontos de milhar e troca vírgula por ponto
        if "," in t and "." in t:
            t = t.replace(".", "").replace(",", ".")
        else:
            # Se só tiver vírgula, troca por ponto (ex.: "50000,5")
            t = t.replace(",", ".")

        try:
            return float(t)
        except ValueError:
            return None

    return None


def _validate_nonneg(name: str, v: Optional[float]):
    if v is not None and v < 0:
        raise ValueError(f"{name} não pode ser negativo.")


def _norm_categoria(cat: Optional[str]) -> Optional[str]:
    c = _clean_empty(cat)
    if not c:
        return None

    c_up = c.upper()
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


# ======================================
# Queries
# ======================================

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


# ======================================
# CRUD
# ======================================

def create(db: Session, dados: Dict[str, Any]) -> Produto:
    nome = _normalize_nome(dados.get("nome"))
    if not nome:
        raise ValueError("Nome do produto é obrigatório.")
    if get_by_name(db, nome):
        raise ValueError("Já existe um produto com esse nome.")

    modalidade = _norm_modalidade(dados.get("modalidade_preco"))

    base_segundos = _to_int_or_none(dados.get("base_segundos"))
    _validate_nonneg("base_segundos", float(base_segundos) if base_segundos is not None else None)

    # ✅ base_segundos só faz sentido em SPOT
    if (modalidade or "").upper() != "SPOT":
        base_segundos = None

    valor_unitario = _to_float_or_none(dados.get("valor_unitario"))
    _validate_nonneg("valor_unitario", valor_unitario)

    novo = Produto(
        nome=nome,
        descricao=_clean_empty(dados.get("descricao")),
        categoria=_norm_categoria(dados.get("categoria")),
        modalidade_preco=modalidade,
        base_segundos=base_segundos,
        unidade_rotulo=_clean_empty(dados.get("unidade_rotulo")),
        valor_unitario=valor_unitario,
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

    if "categoria" in dados:
        prod.categoria = _norm_categoria(dados.get("categoria"))

    if "modalidade_preco" in dados:
        prod.modalidade_preco = _norm_modalidade(dados.get("modalidade_preco"))

        # Se mudou modalidade para algo diferente de SPOT, zera base_segundos
        if (prod.modalidade_preco or "").upper() != "SPOT":
            prod.base_segundos = None

    # base_segundos: só persiste se SPOT
    if "base_segundos" in dados:
        base_segundos = _to_int_or_none(dados.get("base_segundos"))
        _validate_nonneg("base_segundos", float(base_segundos) if base_segundos is not None else None)

        if (prod.modalidade_preco or "").upper() != "SPOT":
            prod.base_segundos = None
        else:
            prod.base_segundos = base_segundos

    if "unidade_rotulo" in dados:
        prod.unidade_rotulo = _clean_empty(dados.get("unidade_rotulo"))

    if "valor_unitario" in dados:
        valor_unitario = _to_float_or_none(dados.get("valor_unitario"))
        _validate_nonneg("valor_unitario", valor_unitario)
        prod.valor_unitario = valor_unitario

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
