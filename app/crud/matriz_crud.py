# app/crud/matriz_crud.py
from __future__ import annotations
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models import PI
from app.crud import pi_crud

# ---------- Leitura / Listas ----------

def list_all(db: Session, *, order: str = "asc") -> List[PI]:
    """Todas as matrizes, ordenadas por numero_pi."""
    return pi_crud.list_matriz(db, order=order)

def list_ativos(db: Session, *, order: str = "asc") -> List[PI]:
    """Matrizes com saldo > 0."""
    return pi_crud.list_matriz_ativos(db, order=order)

def get_by_numero(db: Session, numero_pi: str) -> Optional[PI]:
    pi = pi_crud.get_by_numero(db, numero_pi)
    if pi and pi.tipo_pi == "Matriz":
        return pi
    return None

def list_abatimentos(db: Session, numero_pi_matriz: str, *, order: str = "asc") -> List[PI]:
    """Abatimentos vinculados a uma matriz."""
    return pi_crud.list_abatimentos_of_matriz(db, numero_pi_matriz, order=order)

def calcular_valor_abatido(db: Session, numero_pi_matriz: str) -> float:
    return pi_crud.calcular_valor_abatido(db, numero_pi_matriz)

def calcular_saldo_restante(db: Session, numero_pi_matriz: str) -> float:
    return pi_crud.calcular_saldo_restante(db, numero_pi_matriz)

# ---------- Criação / Atualização / Exclusão ----------

def create_matriz(db: Session, dados: Dict[str, Any]) -> PI:
    """
    Cria uma PI do tipo Matriz. Campos aceitos: os mesmos do POST /pis,
    mas aqui o tipo é forçado e vínculos são limpos.
    """
    payload = dict(dados)
    payload.update({
        "tipo_pi": "Matriz",
        "numero_pi_matriz": None,
        "numero_pi_normal": None,
    })
    # pi_crud.create já:
    # - normaliza datas (dd/mm/aaaa ou ISO)
    # - mapeia perfil_anunciante/subperfil_anunciante -> perfil/subperfil
    # - valida duplicidade de numero_pi
    return pi_crud.create(db, payload)

def update_matriz(db: Session, pi_id: int, dados: Dict[str, Any]) -> PI:
    """
    Atualiza uma Matriz. Garante que continue sendo Matriz e sem vínculos indevidos.
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
    Exclui uma Matriz. O pi_crud.delete impede exclusão se houver abatimentos vinculados.
    """
    return pi_crud.delete(db, pi_id)

def create_abatimento(db: Session, numero_pi_matriz: str, dados: Dict[str, Any]) -> PI:
    """
    Cria um Abatimento vinculado à Matriz indicada.
    Campos úteis: numero_pi (do abatimento), valor_bruto, valor_liquido, nome_campanha, vencimento, data_emissao, observacoes.
    """
    payload = dict(dados)
    payload.update({
        "tipo_pi": "Abatimento",
        "numero_pi_matriz": numero_pi_matriz,
        "numero_pi_normal": None,
    })
    # pi_crud.create valida:
    # - existência da Matriz
    # - saldo disponível
    # - valor_bruto informado
    return pi_crud.create(db, payload)
