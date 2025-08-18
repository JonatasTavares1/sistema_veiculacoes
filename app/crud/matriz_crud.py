# app/crud/matriz_crud.py
from __future__ import annotations
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models import PI
from app.crud import pi_crud

# ---------- Leitura / Listas ----------

def list_all(db: Session, *, order: str = "desc") -> List[PI]:
    """
    Todas as matrizes (objetos PI).
    'order' aqui é só aplicado em Python, pois pi_crud.list_matriz não aceita isso.
    """
    regs = pi_crud.list_matriz(db)  # <- não passa 'order' pro pi_crud
    if order in ("asc", "numero_asc"):
        return sorted(regs, key=lambda x: x.numero_pi)
    # default desc
    return sorted(regs, key=lambda x: x.numero_pi, reverse=True)

def list_ativos(db: Session, *, order: Optional[str] = None) -> List[Dict]:
    """
    Matrizes com saldo > 0 (já calculado) e com ordenação opcional.
    Retorna lista de dicts prontos para o front:
      { numero_pi, nome_campanha, executivo, diretoria, valor_bruto, saldo_restante }
    order:
      - None / "saldo" / "saldo_desc" => saldo desc (default)
      - "numero" / "numero_desc"      => numero_pi desc
      - "numero_asc" / "asc"          => numero_pi asc
    """
    out: List[Dict] = []
    for m in pi_crud.list_matriz(db):  # <- não passa 'order'
        s = pi_crud.calcular_saldo_restante(db, m.numero_pi)
        if s > 0:
            out.append({
                "numero_pi": m.numero_pi,
                "nome_campanha": m.nome_campanha,
                "executivo": m.executivo,
                "diretoria": m.diretoria,
                "valor_bruto": m.valor_bruto,
                "saldo_restante": s,
            })

    # ordenação
    if order in (None, "saldo", "saldo_desc"):
        out.sort(key=lambda x: (x["saldo_restante"] or 0.0, x["numero_pi"]), reverse=True)
    elif order in ("numero", "numero_desc"):
        out.sort(key=lambda x: x["numero_pi"], reverse=True)
    elif order in ("numero_asc", "asc"):
        out.sort(key=lambda x: x["numero_pi"])

    return out

def get_by_numero(db: Session, numero_pi: str) -> Optional[PI]:
    pi = pi_crud.get_by_numero(db, numero_pi)
    if pi and pi.tipo_pi == "Matriz":
        return pi
    return None

def list_abatimentos(db: Session, numero_pi_matriz: str, *, order: str = "asc") -> List[PI]:
    """
    Abatimentos vinculados a uma matriz (objetos PI).
    """
    regs = pi_crud.list_abatimentos_of_matriz(db, numero_pi_matriz)  # <- não passa 'order'
    if order in ("desc", "numero_desc"):
        return sorted(regs, key=lambda x: x.numero_pi, reverse=True)
    return sorted(regs, key=lambda x: x.numero_pi)

def calcular_valor_abatido(db: Session, numero_pi_matriz: str) -> float:
    return pi_crud.calcular_valor_abatido(db, numero_pi_matriz)

def calcular_saldo_restante(db: Session, numero_pi_matriz: str) -> float:
    return pi_crud.calcular_saldo_restante(db, numero_pi_matriz)

# ---------- Criação / Atualização / Exclusão ----------

def create_matriz(db: Session, dados: Dict[str, Any]) -> PI:
    """
    Cria PI do tipo Matriz (tipo forçado e vínculos limpos).
    """
    payload = dict(dados)
    payload.update({
        "tipo_pi": "Matriz",
        "numero_pi_matriz": None,
        "numero_pi_normal": None,
    })
    return pi_crud.create(db, payload)

def update_matriz(db: Session, pi_id: int, dados: Dict[str, Any]) -> PI:
    """
    Atualiza Matriz garantindo que continue sendo Matriz e sem vínculos indevidos.
    """
    payload = dict(dados)
    payload.update({
        "tipo_pi": "Matriz",
        "numero_pi_matriz": None,
        "numero_pi_normal": None,
    })
    return pi_crud.update(db, pi_id, payload)

def delete_matriz(db: Session, pi_id: int) -> None:
    """
    Exclui Matriz (bloqueia se houver abatimentos vinculados via pi_crud.delete).
    """
    return pi_crud.delete(db, pi_id)

def create_abatimento(db: Session, numero_pi_matriz: str, dados: Dict[str, Any]) -> PI:
    """
    Cria Abatimento vinculado à Matriz indicada.
    Campos úteis: numero_pi, valor_bruto, valor_liquido, nome_campanha, vencimento, data_emissao, observacoes.
    """
    payload = dict(dados)
    payload.update({
        "tipo_pi": "Abatimento",
        "numero_pi_matriz": numero_pi_matriz,
        "numero_pi_normal": None,
    })
    return pi_crud.create(db, payload)
