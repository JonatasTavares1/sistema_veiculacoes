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


def _to_float(v: Any) -> Optional[float]:
    if v is None:
        return None
    try:
        return float(v)
    except Exception:
        return None


def _normalize_agencia_campos(dados: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normaliza payload que vem do front/schema para o que existe no model:
    - remove campos que não existem no model (mes_venda/dia_venda etc.)
    - mapeia perfil_anunciante/subperfil_anunciante -> perfil/subperfil
    - aplica regra de comissão/tem_agencia
    """
    # --- remove campos "fantasmas" que causam invalid keyword argument ---
    dados.pop("mes_venda", None)
    dados.pop("dia_venda", None)

    # --- mapeia perfil do schema para o model ---
    if "perfil_anunciante" in dados and "perfil" not in dados:
        dados["perfil"] = dados.get("perfil_anunciante")
    if "subperfil_anunciante" in dados and "subperfil" not in dados:
        dados["subperfil"] = dados.get("subperfil_anunciante")

    dados.pop("perfil_anunciante", None)
    dados.pop("subperfil_anunciante", None)

    # --- normaliza valores numéricos da comissão ---
    if "tem_agencia" in dados and dados.get("tem_agencia") is None:
        dados["tem_agencia"] = False

    if "comissao_agencia_percentual" in dados:
        dados["comissao_agencia_percentual"] = _to_float(dados.get("comissao_agencia_percentual"))
    if "comissao_agencia_valor" in dados:
        dados["comissao_agencia_valor"] = _to_float(dados.get("comissao_agencia_valor"))

    tem_agencia = bool(dados.get("tem_agencia") or False)

    # Se não tem agência: zera comissão
    if not tem_agencia:
        dados["tem_agencia"] = False
        dados["comissao_agencia_percentual"] = None
        dados["comissao_agencia_valor"] = None
        return dados

    # Se tem agência, tenta calcular o valor caso percentual esteja presente e valor ausente
    bruto = _to_float(dados.get("valor_bruto")) or 0.0
    perc = dados.get("comissao_agencia_percentual")
    val = dados.get("comissao_agencia_valor")

    if (val is None) and (perc is not None):
        dados["comissao_agencia_valor"] = (perc / 100.0) * bruto

    return dados


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

    # normalizações / compat
    dados = _normalize_agencia_campos(dados)

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
        if (_to_float(dados.get("valor_bruto")) or 0) > saldo:
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

        # ✅ novos campos
        tem_agencia=bool(dados.get("tem_agencia") or False),
        comissao_agencia_percentual=_to_float(dados.get("comissao_agencia_percentual")),
        comissao_agencia_valor=_to_float(dados.get("comissao_agencia_valor")),

        data_venda=dados.get("data_venda"),
        canal=dados.get("canal"),
        perfil=dados.get("perfil"),
        subperfil=dados.get("subperfil"),
        valor_bruto=_to_float(dados.get("valor_bruto")),
        valor_liquido=_to_float(dados.get("valor_liquido")),
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

    # normalizações / compat
    dados = _normalize_agencia_campos(dados)

    if "data_venda" in dados:
        dados["data_venda"] = _parse_date(dados.get("data_venda"))
    if "vencimento" in dados:
        dados["vencimento"] = _parse_date(dados.get("vencimento"))
    if "data_emissao" in dados:
        dados["data_emissao"] = _parse_date(dados.get("data_emissao"))

    if "tipo_pi" in dados:
        dados["tipo_pi"] = _normalize_tipo(dados["tipo_pi"])

    # normaliza floats se vierem no update
    if "valor_bruto" in dados:
        dados["valor_bruto"] = _to_float(dados.get("valor_bruto"))
    if "valor_liquido" in dados:
        dados["valor_liquido"] = _to_float(dados.get("valor_liquido"))

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
