from __future__ import annotations

from datetime import date, datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models import PI


# =========================================================
# Helpers
# =========================================================

def _normalize_tipo(tipo: Optional[str]) -> str:
    if not tipo:
        return ""
    t = tipo.strip().lower()
    if t == "cs":
        return "CS"
    if t in ("veiculacao", "veiculação"):
        return "Veiculação"
    return t.capitalize()


def _clean_empty_strings(d: Dict[str, Any]) -> Dict[str, Any]:
    for k, v in list(d.items()):
        if isinstance(v, str):
            v = v.strip()
            d[k] = v if v else None
    return d


def _parse_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            pass
    return None


# =========================================================
# Consultas
# =========================================================

def get_by_id(db: Session, pi_id: int) -> Optional[PI]:
    return db.get(PI, pi_id)


def get_by_numero(db: Session, numero_pi: str) -> Optional[PI]:
    return db.query(PI).filter(PI.numero_pi == numero_pi).first()


def list_all(db: Session) -> List[PI]:
    return db.query(PI).order_by(PI.id.desc()).all()


def list_matriz_ativos(db: Session) -> List[PI]:
    return db.query(PI).filter(PI.tipo_pi == "Matriz").all()


def list_normal_ativos(db: Session) -> List[PI]:
    return db.query(PI).filter(PI.tipo_pi == "Normal").all()


# =========================================================
# Regras de negócio
# =========================================================

def calcular_saldo_restante(
    db: Session,
    numero_pi_matriz: str,
    *,
    ignorar_pi_id: Optional[int] = None,
) -> float:
    matriz = get_by_numero(db, numero_pi_matriz)
    if not matriz or matriz.tipo_pi != "Matriz":
        return 0.0

    abatimentos = (
        db.query(PI)
        .filter(
            PI.tipo_pi == "Abatimento",
            PI.numero_pi_matriz == numero_pi_matriz,
        )
        .all()
    )

    total = 0.0
    for a in abatimentos:
        if ignorar_pi_id and a.id == ignorar_pi_id:
            continue
        total += a.valor_bruto or 0.0

    return (matriz.valor_bruto or 0.0) - total


# =========================================================
# CRUD
# =========================================================

def create(db: Session, dados: Dict[str, Any]) -> PI:
    dados = _clean_empty_strings(dados)
    dados["tipo_pi"] = _normalize_tipo(dados.get("tipo_pi"))

    dados["data_venda"] = _parse_date(dados.get("data_venda"))
    dados["vencimento"] = _parse_date(dados.get("vencimento"))
    dados["data_emissao"] = _parse_date(dados.get("data_emissao"))

    if get_by_numero(db, dados["numero_pi"]):
        raise ValueError(f"PI '{dados['numero_pi']}' já cadastrado.")

    tipo = dados["tipo_pi"]

    if tipo == "Abatimento":
        if not dados.get("numero_pi_matriz"):
            raise ValueError("Abatimento exige PI Matriz.")
        saldo = calcular_saldo_restante(db, dados["numero_pi_matriz"])
        if (dados.get("valor_bruto") or 0) > saldo:
            raise ValueError("Valor do abatimento excede saldo.")
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


def update(db: Session, pi_id: int, dados: Dict[str, Any]) -> PI:
    pi = get_by_id(db, pi_id)
    if not pi:
        raise ValueError("PI não encontrado.")

    dados = _clean_empty_strings(dados)

    if "data_venda" in dados:
        dados["data_venda"] = _parse_date(dados.get("data_venda"))
    if "vencimento" in dados:
        dados["vencimento"] = _parse_date(dados.get("vencimento"))
    if "data_emissao" in dados:
        dados["data_emissao"] = _parse_date(dados.get("data_emissao"))

    if "tipo_pi" in dados:
        dados["tipo_pi"] = _normalize_tipo(dados["tipo_pi"])

    for campo, valor in dados.items():
        if hasattr(pi, campo):
            setattr(pi, campo, valor)

    pi.eh_matriz = pi.tipo_pi == "Matriz"

    db.commit()
    db.refresh(pi)
    return pi


def delete(db: Session, pi_id: int) -> None:
    pi = get_by_id(db, pi_id)
    if not pi:
        raise ValueError("PI não encontrado.")

    db.delete(pi)
    db.commit()
