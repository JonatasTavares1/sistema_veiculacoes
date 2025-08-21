# app/crud/veiculacao_crud.py
from __future__ import annotations
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, date
from sqlalchemy.orm import Session, joinedload
from app.models import Veiculacao, Produto, PI

# ---------- utils ----------
def _parse_date(s: Optional[str]) -> Optional[date]:
    if not s:
        return None
    s = s.strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    return None

def _overlaps(win_start: date, win_end: date, s: Optional[str], f: Optional[str]) -> bool:
    ds = _parse_date(s)
    df = _parse_date(f)
    if ds and df:
        # [ds, df] intersect [win_start, win_end] ?
        return not (df < win_start or ds > win_end)
    if ds:
        return win_start <= ds <= win_end
    if df:
        return win_start <= df <= win_end
    # sem datas → considerar na janela
    return True

def _norm_desconto_percent(v: Optional[float]) -> float:
    """
    Normaliza entrada para PERCENTUAL 0..100.
    Aceita:
      - 10   -> 10%
      - 0.1  -> 10%
      - "10%", "10" -> 10%
      - "0,1" -> 0.1 => 10%
    """
    if v is None:
        return 0.0
    try:
        x = float(v)
    except (TypeError, ValueError):
        return 0.0
    # se veio em fração (0..1), converte para %
    if 0.0 <= x <= 1.0:
        return x * 100.0
    # clamp
    if x < 0:
        x = 0.0
    if x > 100.0:
        x = 100.0
    return x

def _calc_liquido(valor_bruto: Optional[float], desconto_percent: Optional[float]) -> float:
    b = float(valor_bruto or 0.0)
    d = _norm_desconto_percent(desconto_percent) / 100.0  # percentual -> fração
    return round(b * (1.0 - d), 2)

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

def list_agenda(
    db: Session,
    inicio: date,
    fim: date,
    *,
    canal: Optional[str] = None,
    formato: Optional[str] = None,  # ignorado se não existir no modelo
    executivo: Optional[str] = None,
    diretoria: Optional[str] = None,
    uf_cliente: Optional[str] = None,
) -> List[Dict[str, Any]]:
    rows = (
        db.query(Veiculacao)
        .options(joinedload(Veiculacao.produto), joinedload(Veiculacao.pi))
        .all()
    )
    out: List[Dict[str, Any]] = []
    for v in rows:
        pi = v.pi
        prod = v.produto

        if not _overlaps(inicio, fim, v.data_inicio, v.data_fim):
            continue

        if canal and (getattr(pi, "canal", None) or "") != canal:
            continue
        if executivo and (getattr(pi, "executivo", None) or "") != executivo:
            continue
        if diretoria and (getattr(pi, "diretoria", None) or "") != diretoria:
            continue
        if uf_cliente and (getattr(pi, "uf_cliente", None) or "") != uf_cliente:
            continue
        # 'formato' não existe na model base — ignore se não tiver

        out.append({
            "id": v.id,
            "numero_pi": getattr(pi, "numero_pi", None),
            "produto_nome": getattr(prod, "nome", None),
            "canal": getattr(pi, "canal", None),
            "data_inicio": v.data_inicio,
            "data_fim": v.data_fim,
            "quantidade": v.quantidade,
            "valor_bruto": v.valor_bruto,
            "desconto": v.desconto,          # percentual 0..100
            "valor_liquido": v.valor_liquido,
            "executivo": getattr(pi, "executivo", None),
            "diretoria": getattr(pi, "diretoria", None),
            "uf_cliente": getattr(pi, "uf_cliente", None),
        })
    return out

# ---------- CRUD ----------
def create(db: Session, dados: Dict[str, Any]) -> Veiculacao:
    prod, pi = _get_produto_pi_or_fail(db, dados["produto_id"], dados["pi_id"])

    qtd = int(dados.get("quantidade") or 0)
    bruto = float(dados.get("valor_bruto") or 0.0)
    desc_percent = _norm_desconto_percent(dados.get("desconto"))
    liquido = _calc_liquido(bruto, desc_percent)

    novo = Veiculacao(
        produto_id=prod.id,
        pi_id=pi.id,
        data_inicio=dados.get("data_inicio"),
        data_fim=dados.get("data_fim"),
        quantidade=qtd,
        valor_bruto=bruto,
        desconto=desc_percent,     # armazenado como percentual (0..100)
        valor_liquido=liquido,
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
    if "valor_bruto" in dados:
        veic.valor_bruto = float(dados["valor_bruto"] or 0.0)
    if "desconto" in dados:
        veic.desconto = _norm_desconto_percent(dados["desconto"])

    # recalcula líquido
    veic.valor_liquido = _calc_liquido(veic.valor_bruto, veic.desconto)

    db.commit()
    db.refresh(veic)
    return veic

def delete(db: Session, veic_id: int) -> None:
    veic = db.query(Veiculacao).get(veic_id)
    if not veic:
        raise ValueError("Veiculação não encontrada.")
    # proteção: não excluir se houver entregas vinculadas
    if getattr(veic, "entregas", None) and len(veic.entregas) > 0:
        raise ValueError("Não é possível excluir: existem entregas vinculadas a esta veiculação.")
    db.delete(veic)
    db.commit()
