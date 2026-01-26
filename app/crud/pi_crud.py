from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import and_, or_, asc, func, case
from sqlalchemy.orm import Session, joinedload

from app.models import PI, Produto, Veiculacao, PIAnexo, Entrega

# =========================================================
# Helpers
# =========================================================

def _normalize_tipo(tipo: Optional[str]) -> str:
    if not tipo:
        return ""
    t = str(tipo).strip()
    if t.lower() == "cs":
        return "CS"
    if t.lower() in ("veiculação", "veiculacao"):
        return "Veiculação"
    return t.capitalize()

def _clean_empty_strings(d: Dict[str, Any]) -> Dict[str, Any]:
    for k, v in list(d.items()):
        if isinstance(v, str):
            t = v.strip()
            d[k] = t if t != "" else None
    return d

def _parse_date_maybe(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    v = value.strip()
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(v, fmt).date()
        except ValueError:
            pass
    return None

def _money_or_zero(*vals: Optional[float]) -> float:
    for v in vals:
        if v is not None:
            return float(v)
    return 0.0

# =========================================================
# Consultas básicas
# =========================================================

def get_by_id(db: Session, pi_id: int) -> Optional[PI]:
    return db.get(PI, pi_id)

def get_by_numero(db: Session, numero: str) -> Optional[PI]:
    return db.query(PI).filter(PI.numero_pi == numero).first()

def list_all(db: Session) -> List[PI]:
    return db.query(PI).order_by(PI.numero_pi.desc()).all()

def list_by_tipo(db: Session, tipo: str) -> List[PI]:
    return db.query(PI).filter(PI.tipo_pi == tipo).order_by(PI.numero_pi.desc()).all()

def list_matriz(db: Session) -> List[PI]:
    return list_by_tipo(db, "Matriz")

def list_normal(db: Session) -> List[PI]:
    return list_by_tipo(db, "Normal")

# =========================================================
# Regras de negócio
# =========================================================

def calcular_saldo_restante(db: Session, numero_pi_matriz: str, *, ignorar_pi_id: Optional[int] = None) -> float:
    matriz = get_by_numero(db, numero_pi_matriz)
    if not matriz or matriz.tipo_pi != "Matriz":
        return 0.0
    abatimentos = db.query(PI).filter(
        PI.numero_pi_matriz == numero_pi_matriz,
        PI.tipo_pi == "Abatimento"
    ).all()
    total = 0.0
    for f in abatimentos:
        if ignorar_pi_id and f.id == ignorar_pi_id:
            continue
        total += (f.valor_bruto or 0.0)
    return (matriz.valor_bruto or 0.0) - total

# =========================================================
# CRUD PI
# =========================================================

def create(db: Session, dados: Dict[str, Any]) -> PI:
    dados = _clean_empty_strings(dados)
    dados["tipo_pi"] = _normalize_tipo(dados.get("tipo_pi"))

    dados["vencimento"] = _parse_date_maybe(dados.get("vencimento"))
    dados["data_emissao"] = _parse_date_maybe(dados.get("data_emissao"))
    dados["data_venda"] = _parse_date_maybe(dados.get("data_venda"))

    if get_by_numero(db, dados["numero_pi"]):
        raise ValueError(f"O PI '{dados['numero_pi']}' já está cadastrado.")

    tipo = dados["tipo_pi"]

    if tipo == "Abatimento":
        if not dados.get("numero_pi_matriz"):
            raise ValueError("Abatimento exige PI Matriz.")
        saldo = calcular_saldo_restante(db, dados["numero_pi_matriz"])
        if float(dados.get("valor_bruto") or 0) > saldo:
            raise ValueError("Valor do abatimento excede saldo do Matriz.")
        dados["numero_pi_normal"] = None

    elif tipo == "CS":
        if not dados.get("numero_pi_normal"):
            raise ValueError("CS exige PI Normal.")
        dados["numero_pi_matriz"] = None

    elif tipo in ("Matriz", "Normal"):
        dados["numero_pi_matriz"] = None
        dados["numero_pi_normal"] = None

    pi = PI(
        numero_pi=dados["numero_pi"],
        tipo_pi=tipo,
        numero_pi_matriz=dados.get("numero_pi_matriz"),
        numero_pi_normal=dados.get("numero_pi_normal"),
        nome_anunciante=dados.get("nome_anunciante"),
        razao_social_anunciante=dados.get("razao_social_anunciante"),
        cnpj_anunciante=dados.get("cnpj_anunciante"),
        uf_cliente=dados.get("uf_cliente"),
        executivo=dados.get("executivo"),
        diretoria=dados.get("diretoria"),
        nome_campanha=dados.get("nome_campanha"),
        nome_agencia=dados.get("nome_agencia"),
        razao_social_agencia=dados.get("razao_social_agencia"),
        cnpj_agencia=dados.get("cnpj_agencia"),
        uf_agencia=dados.get("uf_agencia"),
        data_venda=dados.get("data_venda"),
        canal=dados.get("canal"),
        perfil=dados.get("perfil"),
        subperfil=dados.get("subperfil"),
        valor_bruto=dados.get("valor_bruto"),
        valor_liquido=dados.get("valor_liquido"),
        vencimento=dados.get("vencimento"),
        data_emissao=dados.get("data_emissao"),
        observacoes=dados.get("observacoes"),
        eh_matriz=(tipo == "Matriz"),
    )

    db.add(pi)
    db.commit()
    db.refresh(pi)
    return pi
