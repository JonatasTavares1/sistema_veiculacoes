# app/crud/pi_crud.py
from __future__ import annotations
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from app.models import PI

# -------- utils --------
def _parse_date_maybe(value: str | None) -> date | None:
    if not value:
        return None
    v = value.strip()
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(v, fmt).date()
        except ValueError:
            pass
    return None

def _normalize_tipo(tipo: str | None) -> str:
    if not tipo:
        return ""
    t = tipo.strip()
    if t.lower() == "cs":
        return "CS"
    return t.capitalize()

# -------- basic queries --------
def get_by_id(db: Session, pi_id: int) -> Optional[PI]:
    return db.query(PI).get(pi_id)

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

def list_abatimentos_of_matriz(db: Session, numero_pi_matriz: str) -> List[PI]:
    return db.query(PI).filter(
        PI.numero_pi_matriz == numero_pi_matriz,
        PI.tipo_pi == "Abatimento"
    ).all()

def list_cs_of_normal(db: Session, numero_pi_normal: str) -> List[PI]:
    return db.query(PI).filter(
        PI.numero_pi_normal == numero_pi_normal,
        PI.tipo_pi == "CS"
    ).all()

# -------- business --------
def calcular_valor_abatido(db: Session, numero_pi_matriz: str) -> float:
    filhos = list_abatimentos_of_matriz(db, numero_pi_matriz)
    return sum((f.valor_bruto or 0.0) for f in filhos)

def calcular_saldo_restante(db: Session, numero_pi_matriz: str, *, ignorar_pi_id: Optional[int] = None) -> float:
    matriz = get_by_numero(db, numero_pi_matriz)
    if not matriz or matriz.tipo_pi != "Matriz":
        return 0.0
    abatimentos = list_abatimentos_of_matriz(db, numero_pi_matriz)
    total = 0.0
    for f in abatimentos:
        if ignorar_pi_id and f.id == ignorar_pi_id:
            continue
        total += (f.valor_bruto or 0.0)
    return (matriz.valor_bruto or 0.0) - total

def list_matriz_ativos(db: Session) -> List[PI]:
    items = list_matriz(db)
    return [pi for pi in items if calcular_saldo_restante(db, pi.numero_pi) > 0]

def list_normal_ativos(db: Session) -> List[PI]:
    return list_normal(db)

# -------- CRUD --------
def create(db: Session, dados: Dict[str, Any]) -> PI:
    # normalizações
    dados["tipo_pi"] = _normalize_tipo(dados.get("tipo_pi"))
    dados["vencimento"] = _parse_date_maybe(dados.get("vencimento"))
    dados["data_emissao"] = _parse_date_maybe(dados.get("data_emissao"))

    # mapear perfil/subperfil vindos do front para os campos do modelo
    if "perfil_anunciante" in dados and dados["perfil_anunciante"] is not None:
        dados["perfil"] = dados.pop("perfil_anunciante")
    if "subperfil_anunciante" in dados and dados["subperfil_anunciante"] is not None:
        dados["subperfil"] = dados.pop("subperfil_anunciante")

    numero_pi = dados["numero_pi"]
    if get_by_numero(db, numero_pi):
        raise ValueError(f"O PI '{numero_pi}' já está cadastrado.")

    tipo = dados["tipo_pi"]

    if tipo == "Abatimento":
        num_matriz = dados.get("numero_pi_matriz")
        if not num_matriz:
            raise ValueError("Para cadastrar um ABATIMENTO é obrigatório informar o PI Matriz.")
        pi_matriz = get_by_numero(db, num_matriz)
        if not pi_matriz or pi_matriz.tipo_pi != "Matriz":
            raise ValueError(f"PI Matriz '{num_matriz}' não encontrado.")
        valor = dados.get("valor_bruto")
        if valor is None:
            raise ValueError("Informe o valor do abatimento.")
        saldo = calcular_saldo_restante(db, num_matriz)
        if float(valor) > float(saldo):
            raise ValueError(f"O valor do abatimento ({valor}) excede o saldo restante do Matriz ({saldo}).")
        dados["numero_pi_normal"] = None

    elif tipo == "CS":
        num_normal = dados.get("numero_pi_normal")
        if not num_normal:
            raise ValueError("Para cadastrar um CS é obrigatório informar o PI Normal vinculado.")
        pi_normal = get_by_numero(db, num_normal)
        if not pi_normal or pi_normal.tipo_pi != "Normal":
            raise ValueError(f"PI Normal '{num_normal}' não encontrado.")
        dados["numero_pi_matriz"] = None

    elif tipo in ("Matriz", "Normal"):
        dados["numero_pi_matriz"] = None
        dados["numero_pi_normal"] = None

    else:
        raise ValueError(f"Tipo de PI inválido: {tipo}")

    novo = PI(
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
        mes_venda=dados.get("mes_venda"),
        dia_venda=dados.get("dia_venda"),
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
    db.add(novo)
    db.commit()
    db.refresh(novo)
    return novo

def update(db: Session, pi_id: int, dados: Dict[str, Any]) -> PI:
    pi = get_by_id(db, pi_id)
    if not pi:
        raise ValueError(f"PI com ID {pi_id} não encontrado.")

    # duplicidade de numero_pi
    novo_num = dados.get("numero_pi")
    if novo_num and novo_num != pi.numero_pi and get_by_numero(db, novo_num):
        raise ValueError(f"O PI '{novo_num}' já está cadastrado.")

    # normalizações seletivas
    if "vencimento" in dados:
        dados["vencimento"] = _parse_date_maybe(dados.get("vencimento"))
    if "data_emissao" in dados:
        dados["data_emissao"] = _parse_date_maybe(dados.get("data_emissao"))
    if "tipo_pi" in dados and dados["tipo_pi"]:
        dados["tipo_pi"] = _normalize_tipo(dados["tipo_pi"])
    if "perfil_anunciante" in dados:
        dados["perfil"] = dados.pop("perfil_anunciante")
    if "subperfil_anunciante" in dados:
        dados["subperfil"] = dados.pop("subperfil_anunciante")

    # aplica campos existentes
    for campo, valor in dados.items():
        if hasattr(pi, campo) and valor is not None:
            setattr(pi, campo, valor)

    # revalida regras por tipo
    tipo = pi.tipo_pi
    if tipo == "Abatimento":
        if not pi.numero_pi_matriz:
            raise ValueError("Abatimento requer 'numero_pi_matriz'.")
        saldo = calcular_saldo_restante(db, pi.numero_pi_matriz, ignorar_pi_id=pi.id)
        valor = pi.valor_bruto or 0.0
        if float(valor) > float(saldo):
            raise ValueError(f"O valor do abatimento ({valor}) excede o saldo restante do Matriz ({saldo}).")
        pi.numero_pi_normal = None

    elif tipo == "CS":
        if not pi.numero_pi_normal:
            raise ValueError("CS requer 'numero_pi_normal'.")
        normal = get_by_numero(db, pi.numero_pi_normal)
        if not normal or normal.tipo_pi != "Normal":
            raise ValueError(f"PI Normal '{pi.numero_pi_normal}' não encontrado.")
        pi.numero_pi_matriz = None

    elif tipo in ("Matriz", "Normal"):
        pi.numero_pi_matriz = None
        pi.numero_pi_normal = None
    else:
        raise ValueError(f"Tipo de PI inválido: {tipo}")

    pi.eh_matriz = (tipo == "Matriz")
    db.commit()
    db.refresh(pi)
    return pi

def delete(db: Session, pi_id: int) -> None:
    pi = get_by_id(db, pi_id)
    if not pi:
        raise ValueError(f"PI com ID {pi_id} não encontrado.")

    if pi.tipo_pi == "Matriz":
        filhos = list_abatimentos_of_matriz(db, pi.numero_pi)
        if filhos:
            raise ValueError("Não é possível excluir Matriz com abatimentos vinculados.")
    if pi.tipo_pi == "Normal":
        filhos = list_cs_of_normal(db, pi.numero_pi)
        if filhos:
            raise ValueError("Não é possível excluir PI Normal com CS vinculados.")

    db.delete(pi)
    db.commit()
