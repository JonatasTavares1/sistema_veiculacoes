#app/crud/pis_crud.py
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import and_, or_, asc
from sqlalchemy.orm import Session, joinedload

from app.models import PI, Produto, Veiculacao, PIAnexo

# =========================================================
# Helpers
# =========================================================

def _normalize_tipo(tipo: Optional[str]) -> str:
    if not tipo:
        return ""
    t = str(tipo).strip()
    if t.lower() == "cs":
        return "CS"
    # Mantém capitalização das demais
    if t.lower() == "veiculação" or t.lower() == "veiculacao":
        return "Veiculação"
    return t.capitalize()

def _clean_empty_strings(d: Dict[str, Any]) -> Dict[str, Any]:
    for k, v in list(d.items()):
        if isinstance(v, str):
            t = v.strip()
            d[k] = t if t != "" else None
    return d

def _parse_date_maybe(value: Optional[str]) -> Optional[date]:
    """
    Aceita 'dd/mm/aaaa' ou 'aaaa-mm-dd' e retorna date.
    (Mantida para compat com código antigo; use _to_iso_date_str ao persistir em coluna String)
    """
    if not value:
        return None
    v = value.strip()
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(v, fmt).date()
        except ValueError:
            pass
    return None

def _to_iso_date_str(value: Optional[str]) -> Optional[str]:
    """
    Normaliza entrada (dd/mm/aaaa | yyyy-mm-dd) para 'YYYY-MM-DD' (string).
    Retorna None se não conseguir interpretar.
    """
    if not value:
        return None
    value = value.strip()
    # já no formato iso
    if len(value) >= 10 and value[4] == "-" and value[7] == "-":
        return value[:10]
    # dd/mm/aaaa
    if len(value) >= 10 and value[2] == "/" and value[5] == "/":
        try:
            d = datetime.strptime(value[:10], "%d/%m/%Y").date()
            return d.isoformat()
        except ValueError:
            return None
    # fallback: tenta parsear generico
    d = _parse_date_maybe(value)
    return d.isoformat() if d else None

def _money_or_zero(*vals: Optional[float]) -> float:
    for v in vals:
        if v is not None:
            return float(v)
    return 0.0

# =========================================================
# Consultas básicas
# =========================================================

def get_by_id(db: Session, pi_id: int) -> Optional[PI]:
    # Session.get é o recomendado nas versões novas
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

def list_abatimentos_of_matriz(db: Session, numero_pi_matriz: str) -> List[PI]:
    return (
        db.query(PI)
        .filter(PI.numero_pi_matriz == numero_pi_matriz, PI.tipo_pi == "Abatimento")
        .all()
    )

def list_cs_of_normal(db: Session, numero_pi_normal: str) -> List[PI]:
    return (
        db.query(PI)
        .filter(PI.numero_pi_normal == numero_pi_normal, PI.tipo_pi == "CS")
        .all()
    )

# =========================================================
# Regras de negócio (saldo/ativos)
# =========================================================

def calcular_valor_abatido(db: Session, numero_pi_matriz: str) -> float:
    filhos = list_abatimentos_of_matriz(db, numero_pi_matriz)
    # por regra antiga, abatimento usa valor_bruto
    return sum((f.valor_bruto or 0.0) for f in filhos)

def calcular_saldo_restante(
    db: Session,
    numero_pi_matriz: str,
    * ,
    ignorar_pi_id: Optional[int] = None,
) -> float:
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

# =========================================================
# CRUD PI
# =========================================================

def create(db: Session, dados: Dict[str, Any]) -> PI:
    dados = _clean_empty_strings(dados)
    dados["tipo_pi"] = _normalize_tipo(dados.get("tipo_pi"))

    # vencimento/data_emissao são colunas Date no modelo
    v = _parse_date_maybe(dados.get("vencimento"))
    e = _parse_date_maybe(dados.get("data_emissao"))
    dados["vencimento"] = v
    dados["data_emissao"] = e

    # mapear *_anunciante -> perfil/subperfil (campos nomeados no modelo)
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
            raise ValueError(
                f"O valor do abatimento ({valor}) excede o saldo restante do Matriz ({saldo})."
            )
        dados["numero_pi_normal"] = None

    elif tipo == "CS":
        num_normal = dados.get("numero_pi_normal")
        if not num_normal:
            raise ValueError("Para cadastrar um CS é obrigatório informar o PI Normal vinculado.")
        pi_normal = get_by_numero(db, num_normal)
        if not pi_normal or pi_normal.tipo_pi != "Normal":
            raise ValueError(f"PI Normal '{num_normal}' não encontrado.")
        dados["numero_pi_matriz"] = None

    elif tipo == "Veiculação":
        num_matriz = dados.get("numero_pi_matriz")
        if not num_matriz:
            raise ValueError("Para cadastrar uma VEICULAÇÃO é obrigatório informar o PI Matriz.")
        pi_matriz = get_by_numero(db, num_matriz)
        if not pi_matriz or pi_matriz.tipo_pi != "Matriz":
            raise ValueError(f"PI Matriz '{num_matriz}' não encontrado.")
        dados["numero_pi_normal"] = None

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
    dados = _clean_empty_strings(dados)

    novo_num = dados.get("numero_pi")
    if novo_num and novo_num != pi.numero_pi and get_by_numero(db, novo_num):
        raise ValueError(f"O PI '{novo_num}' já está cadastrado.")

    if "vencimento" in dados:
        dados["vencimento"] = _parse_date_maybe(dados.get("vencimento"))
    if "data_emissao" in dados:
        dados["data_emissao"] = _parse_date_maybe(dados.get("data_emissao"))
    if "tipo_pi" in dados and dados["tipo_pi"] is not None:
        dados["tipo_pi"] = _normalize_tipo(dados["tipo_pi"])
    if "perfil_anunciante" in dados:
        dados["perfil"] = dados.pop("perfil_anunciante")
    if "subperfil_anunciante" in dados:
        dados["subperfil"] = dados.pop("subperfil_anunciante")

    for campo, valor in dados.items():
        if hasattr(pi, campo):
            setattr(pi, campo, valor)

    tipo = pi.tipo_pi
    if tipo == "Abatimento":
        if not pi.numero_pi_matriz:
            raise ValueError("Abatimento requer 'numero_pi_matriz'.")
        saldo = calcular_saldo_restante(db, pi.numero_pi_matriz, ignorar_pi_id=pi.id)
        valor = pi.valor_bruto or 0.0
        if float(valor) > float(saldo):
            raise ValueError(
                f"O valor do abatimento ({valor}) excede o saldo restante do Matriz ({saldo})."
            )
        pi.numero_pi_normal = None

    elif tipo == "CS":
        if not pi.numero_pi_normal:
            raise ValueError("CS requer 'numero_pi_normal'.")
        normal = get_by_numero(db, pi.numero_pi_normal)
        if not normal or normal.tipo_pi != "Normal":
            raise ValueError(f"PI Normal '{pi.numero_pi_normal}' não encontrado.")
        pi.numero_pi_matriz = None

    elif tipo == "Veiculação":
        if not pi.numero_pi_matriz:
            raise ValueError("Veiculação requer 'numero_pi_matriz'.")
        matriz = get_by_numero(db, pi.numero_pi_matriz)
        if not matriz or matriz.tipo_pi != "Matriz":
            raise ValueError(f"PI Matriz '{pi.numero_pi_matriz}' não encontrado.")
        pi.numero_pi_normal = None

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

# =========================================================
# Eager load + montagem de produtos (compat com rotas atuais)
# =========================================================

def _attach_produtos_to_pi(db: Session, pi: PI) -> None:
    """
    Monta atributos **transitórios** no objeto PI para a resposta:
      - pi.produtos_agg: lista de dicts {id, nome, descricao, total_produto, veiculacoes:[...] }
      - pi.total_pi: soma dos totais de cada produto
    NÃO toca no relationship real (pi.produtos) para não acionar o ORM.
    """
    regs: List[Tuple[Veiculacao, Produto]] = (
        db.query(Veiculacao, Produto)
        .join(Produto, Veiculacao.produto_id == Produto.id)
        .filter(Veiculacao.pi_id == pi.id)
        .order_by(Produto.nome.asc(), Veiculacao.data_inicio.asc())
        .all()
    )

    agrup: Dict[int, Dict[str, Any]] = {}

    for v, p in regs:
        if p.id not in agrup:
            agrup[p.id] = {
                "id": p.id,
                "nome": p.nome,
                "descricao": getattr(p, "descricao", None),
                "veiculacoes": [],
                "total_produto": 0.0,
            }

        valor = _money_or_zero(v.valor_liquido, v.valor_bruto)

        agrup[p.id]["veiculacoes"].append(
            {
                "id": v.id,
                "canal": getattr(v, "canal", None),
                "formato": getattr(v, "formato", None),
                "data_inicio": v.data_inicio,
                "data_fim": v.data_fim,
                "quantidade": v.quantidade,
                # compat legado para telas/relatórios
                "valor": valor,
                # novos (seu schema aceita opcional)
                "valor_bruto": v.valor_bruto,
                "valor_liquido": v.valor_liquido,
                "desconto": getattr(v, "desconto", None),
            }
        )
        agrup[p.id]["total_produto"] += float(valor or 0.0)

    produtos_agg = list(agrup.values())
    total_pi = sum(p["total_produto"] for p in produtos_agg)

    # >>> Transitórios (não-relacionamento)
    setattr(pi, "produtos_agg", produtos_agg)
    setattr(pi, "total_pi", float(total_pi))

def get_with_relations_by_numero(db: Session, numero_pi: str) -> Optional[PI]:
    reg = (
        db.query(PI)
        .options(joinedload(PI.veiculacoes).joinedload(Veiculacao.produto))
        .filter(PI.numero_pi == numero_pi)
        .first()
    )
    if reg:
        _attach_produtos_to_pi(db, reg)
    return reg

def get_with_relations_by_id(db: Session, pi_id: int) -> Optional[PI]:
    reg = (
        db.query(PI)
        .options(joinedload(PI.veiculacoes).joinedload(Veiculacao.produto))
        .filter(PI.id == pi_id)
        .first()
    )
    if reg:
        _attach_produtos_to_pi(db, reg)
    return reg

# =========================================================
# Compose (PI + produtos + veiculações) — compat com catálogo
# =========================================================

def compose_create(db: Session, payload: Dict[str, Any]) -> PI:
    dados_pi: Dict[str, Any] = dict(payload.get("pi") or {})
    produtos_in: List[Dict[str, Any]] = list(payload.get("produtos") or [])

    # cria o PI
    dados_pi = _clean_empty_strings(dados_pi)
    dados_pi["tipo_pi"] = _normalize_tipo(dados_pi.get("tipo_pi"))
    dados_pi["vencimento"] = _parse_date_maybe(dados_pi.get("vencimento"))
    dados_pi["data_emissao"] = _parse_date_maybe(dados_pi.get("data_emissao"))
    if "perfil_anunciante" in dados_pi and dados_pi["perfil_anunciante"] is not None:
        dados_pi["perfil"] = dados_pi.pop("perfil_anunciante")
    if "subperfil_anunciante" in dados_pi and dados_pi["subperfil_anunciante"] is not None:
        dados_pi["subperfil"] = dados_pi.pop("subperfil_anunciante")

    numero_pi = dados_pi["numero_pi"]
    if get_by_numero(db, numero_pi):
        raise ValueError(f"O PI '{numero_pi}' já está cadastrado.")

    # validações de vínculo
    tipo = dados_pi["tipo_pi"]
    if tipo == "Abatimento":
        num_matriz = dados_pi.get("numero_pi_matriz")
        if not num_matriz:
            raise ValueError("Para cadastrar um ABATIMENTO é obrigatório informar o PI Matriz.")
        pi_matriz = get_by_numero(db, num_matriz)
        if not pi_matriz or pi_matriz.tipo_pi != "Matriz":
            raise ValueError(f"PI Matriz '{num_matriz}' não encontrado.")
        valor_abat = dados_pi.get("valor_bruto")
        if valor_abat is None:
            raise ValueError("Informe o valor do abatimento.")
        saldo = calcular_saldo_restante(db, num_matriz)
        if float(valor_abat) > float(saldo):
            raise ValueError(
                f"O valor do abatimento ({valor_abat}) excede o saldo restante do Matriz ({saldo})."
            )
        dados_pi["numero_pi_normal"] = None

    elif tipo == "CS":
        num_normal = dados_pi.get("numero_pi_normal")
        if not num_normal:
            raise ValueError("Para cadastrar um CS é obrigatório informar o PI Normal vinculado.")
        pi_normal = get_by_numero(db, num_normal)
        if not pi_normal or pi_normal.tipo_pi != "Normal":
            raise ValueError(f"PI Normal '{num_normal}' não encontrado.")
        dados_pi["numero_pi_matriz"] = None

    elif tipo == "Veiculação":
        num_matriz = dados_pi.get("numero_pi_matriz")
        if not num_matriz:
            raise ValueError("Para cadastrar uma VEICULAÇÃO é obrigatório informar o PI Matriz.")
        pi_matriz = get_by_numero(db, num_matriz)
        if not pi_matriz or pi_matriz.tipo_pi != "Matriz":
            raise ValueError(f"PI Matriz '{num_matriz}' não encontrado.")
        dados_pi["numero_pi_normal"] = None

    elif tipo in ("Matriz", "Normal"):
        dados_pi["numero_pi_matriz"] = None
        dados_pi["numero_pi_normal"] = None

    else:
        raise ValueError(f"Tipo de PI inválido: {tipo}")

    pi = PI(
        numero_pi=dados_pi["numero_pi"],
        tipo_pi=tipo,
        numero_pi_matriz=dados_pi.get("numero_pi_matriz"),
        numero_pi_normal=dados_pi.get("numero_pi_normal"),
        nome_anunciante=dados_pi.get("nome_anunciante"),
        razao_social_anunciante=dados_pi.get("razao_social_anunciante"),
        cnpj_anunciante=dados_pi.get("cnpj_anunciante"),
        uf_cliente=dados_pi.get("uf_cliente"),
        executivo=dados_pi.get("executivo"),
        diretoria=dados_pi.get("diretoria"),
        nome_campanha=dados_pi.get("nome_campanha"),
        nome_agencia=dados_pi.get("nome_agencia"),
        razao_social_agencia=dados_pi.get("razao_social_agencia"),
        cnpj_agencia=dados_pi.get("cnpj_agencia"),
        uf_agencia=dados_pi.get("uf_agencia"),
        mes_venda=dados_pi.get("mes_venda"),
        dia_venda=dados_pi.get("dia_venda"),
        canal=dados_pi.get("canal"),
        perfil=dados_pi.get("perfil"),
        subperfil=dados_pi.get("subperfil"),
        valor_bruto=dados_pi.get("valor_bruto"),
        valor_liquido=dados_pi.get("valor_liquido"),
        vencimento=dados_pi.get("vencimento"),
        data_emissao=dados_pi.get("data_emissao"),
        observacoes=dados_pi.get("observacoes"),
        eh_matriz=(tipo == "Matriz"),
    )
    db.add(pi)
    db.flush()

    # cria (ou reusa) produtos do catálogo e as veiculações vinculadas ao PI
    for p in produtos_in:
        nome = (p.get("nome") or "").strip()
        if not nome:
            raise ValueError("Produto sem nome.")

        # produto de catálogo (sem pi_id)
        prod = db.query(Produto).filter(Produto.nome == nome).first()
        if not prod:
            prod = Produto(nome=nome, descricao=p.get("descricao"))
            db.add(prod)
            db.flush()

        for v in (p.get("veiculacoes") or []):
            veic = Veiculacao(
                produto_id=prod.id,
                pi_id=pi.id,
                # campos de período (string ISO)
                data_inicio=_to_iso_date_str(v.get("data_inicio")),
                data_fim=_to_iso_date_str(v.get("data_fim")),
                quantidade=v.get("quantidade"),
                # novo modelo de preço
                valor_bruto=v.get("valor_bruto"),
                desconto=v.get("desconto"),
                valor_liquido=v.get("valor_liquido"),
                # se seu modelo tem estes campos:
                canal=v.get("canal"),
                formato=v.get("formato"),
            )
            db.add(veic)

    db.commit()
    db.refresh(pi)
    return pi

# =========================================================
# Sync (produtos/veiculações) no contexto de um PI
# =========================================================

def sync_produtos(db: Session, pi_id: int, produtos_in: List[Dict[str, Any]]) -> PI:
    """
    Mantém as veiculações do PI de acordo com 'produtos_in'.
    - Atualiza/cria VEICULAÇÕES vinculadas ao PI.
    - Pode criar novos Produtos de catálogo.
    - NÃO apaga linhas de Produto (catálogo) — apenas remove veiculações não listadas.
    """
    pi = get_by_id(db, pi_id)
    if not pi:
        raise ValueError("PI não encontrado.")

    # Carrega veiculações existentes do PI com seus produtos
    regs: List[Tuple[Veiculacao, Produto]] = (
        db.query(Veiculacao, Produto)
        .join(Produto, Veiculacao.produto_id == Produto.id)
        .filter(Veiculacao.pi_id == pi.id)
        .all()
    )

    # Índices: produto_id -> { veic_id -> Veiculacao }
    veics_por_prod: Dict[int, Dict[int, Veiculacao]] = defaultdict(dict)
    produtos_existentes: Dict[int, Produto] = {}
    for v, p in regs:
        produtos_existentes[p.id] = p
        veics_por_prod[p.id][v.id] = v

    # Controle do que permanece
    vistos_veic: set[int] = set()

    # Itera entrada
    for p_in in produtos_in:
        nome = (p_in.get("nome") or "").strip()
        if not nome:
            raise ValueError("Produto sem nome.")

        # Se veio ID de produto, tenta usar; senão procura por nome e cria se necessário
        pid = p_in.get("id")
        prod_obj: Optional[Produto] = None

        if pid and pid in produtos_existentes:
            prod_obj = produtos_existentes[pid]
            # opcional: atualizar nome/descrição do catálogo (cuidado se usado por outros PIs)
            if "descricao" in p_in:
                prod_obj.descricao = p_in.get("descricao")
            if nome and nome != prod_obj.nome:
                prod_obj.nome = nome
        else:
            # procura por nome no catálogo
            prod_obj = db.query(Produto).filter(Produto.nome == nome).first()
            if not prod_obj:
                prod_obj = Produto(nome=nome, descricao=p_in.get("descricao"))
                db.add(prod_obj)
                db.flush()
            produtos_existentes[prod_obj.id] = prod_obj  # entra no índice local

        # veiculações desse produto
        existentes = veics_por_prod.get(prod_obj.id, {})
        for v_in in (p_in.get("veiculacoes") or []):
            vid = v_in.get("id")
            if vid and vid in existentes:
                veic = existentes[vid]
                veic.canal = v_in.get("canal")
                veic.formato = v_in.get("formato")
                veic.data_inicio = _to_iso_date_str(v_in.get("data_inicio"))
                veic.data_fim = _to_iso_date_str(v_in.get("data_fim"))
                veic.quantidade = v_in.get("quantidade")
                veic.valor_bruto = v_in.get("valor_bruto")
                veic.desconto = v_in.get("desconto")
                veic.valor_liquido = v_in.get("valor_liquido")
            else:
                veic = Veiculacao(
                    produto_id=prod_obj.id,
                    pi_id=pi.id,
                    canal=v_in.get("canal"),
                    formato=v_in.get("formato"),
                    data_inicio=_to_iso_date_str(v_in.get("data_inicio")),
                    data_fim=_to_iso_date_str(v_in.get("data_fim")),
                    quantidade=v_in.get("quantidade"),
                    valor_bruto=v_in.get("valor_bruto"),
                    desconto=v_in.get("desconto"),
                    valor_liquido=v_in.get("valor_liquido"),
                )
                db.add(veic)
                db.flush()
            vistos_veic.add(veic.id)

    # Apagar veiculações que pertenciam ao PI e não foram enviadas
    for p_id, veics_map in veics_por_prod.items():
        for veic_id, veic in list(veics_map.items()):
            if veic_id not in vistos_veic:
                db.delete(veic)

    db.commit()
    db.refresh(pi)
    return pi

# =========================================================
# Agenda de veiculações (por período e filtros)
# =========================================================

def list_veiculacoes_agenda(
    db: Session,
    inicio: date,
    fim: date,
    * ,
    canal: Optional[str] = None,
    formato: Optional[str] = None,
    executivo: Optional[str] = None,
    diretoria: Optional[str] = None,
    uf_cliente: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Considerando data_inicio/data_fim como strings ISO (YYYY-MM-DD) no BD,
    o overlap fica:
      data_inicio <= fim_str  AND  (data_fim IS NULL OR data_fim >= inicio_str)
    """
    inicio_str = inicio.isoformat()
    fim_str = fim.isoformat()

    q = (
        db.query(Veiculacao, Produto, PI)
        .join(Produto, Veiculacao.produto_id == Produto.id)
        .join(PI, Veiculacao.pi_id == PI.id)  # via pi_id direto (Produto não tem pi_id)
        .filter(
            and_(
                Veiculacao.data_inicio <= fim_str,
                or_(Veiculacao.data_fim == None, Veiculacao.data_fim >= inicio_str),
            )
        )
    )

    if canal:
        q = q.filter(Veiculacao.canal == canal)
    if formato:
        q = q.filter(Veiculacao.formato == formato)
    if executivo:
        q = q.filter(PI.executivo == executivo)
    if diretoria:
        q = q.filter(PI.diretoria == diretoria)
    if uf_cliente:
        q = q.filter(PI.uf_cliente == uf_cliente)

    regs = q.order_by(Veiculacao.data_inicio.asc()).all()

    out: List[Dict[str, Any]] = []
    for v, prod, pi in regs:
        out.append(
            dict(
                id=v.id,
                produto_id=prod.id,
                pi_id=pi.id,
                numero_pi=pi.numero_pi,
                cliente=pi.nome_anunciante,
                campanha=pi.nome_campanha,
                canal=getattr(v, "canal", None),
                formato=getattr(v, "formato", None),
                data_inicio=v.data_inicio,
                data_fim=v.data_fim,
                quantidade=v.quantidade,
                # a UI da agenda espera 'valor' — usamos o líquido se houver
                valor=_money_or_zero(v.valor_liquido, v.valor_bruto),
                produto_nome=prod.nome,
                executivo=pi.executivo,
                diretoria=pi.diretoria,
                uf_cliente=pi.uf_cliente,
            )
        )
    return out

def list_veiculacoes_by_pi(db: Session, pi_id: int) -> List[Dict[str, Any]]:
    """
    Retorna as veiculações de um PI já mapeadas no formato esperado por
    VeiculacaoAgendaOut (definido em app/schemas/pi.py).
    """
    regs = (
        db.query(Veiculacao, Produto, PI)
        .join(Produto, Veiculacao.produto_id == Produto.id)
        .join(PI, Veiculacao.pi_id == PI.id)
        .filter(Veiculacao.pi_id == pi_id)
        .order_by(asc(Veiculacao.data_inicio))
        .all()
    )

    out: List[Dict[str, Any]] = []
    for v, prod, pi in regs:
        # canal efetivo: prioriza o da veiculação; se vazio, usa o canal do PI
        effective_canal = getattr(v, "canal", None) or getattr(pi, "canal", None)

        out.append({
            "id": v.id,
            "produto_id": prod.id,
            "pi_id": pi.id,
            "numero_pi": pi.numero_pi,

            "cliente": getattr(pi, "nome_anunciante", None) or getattr(pi, "razao_social_anunciante", None),
            "campanha": getattr(pi, "nome_campanha", None),

            "canal": effective_canal,
            "formato": getattr(v, "formato", None),

            "data_inicio": v.data_inicio,
            "data_fim": v.data_fim,
            "quantidade": v.quantidade,

            # compat: a UI usa 'valor'; preferimos líquido se existir
            "valor": (v.valor_liquido if v.valor_liquido is not None else v.valor_bruto),

            "produto_nome": getattr(prod, "nome", None),

            "executivo": getattr(pi, "executivo", None),
            "diretoria": getattr(pi, "diretoria", None),
            "uf_cliente": getattr(pi, "uf_cliente", None),
        })
    return out

# =========================================================
# CRUD de Anexos (PDF PI e Proposta)
# =========================================================

def anexos_list(db: Session, pi_id: int):
    return (
        db.query(PIAnexo)
        .filter(PIAnexo.pi_id == pi_id)
        .order_by(PIAnexo.uploaded_at.desc())
        .all()
    )

def anexos_add(
    db: Session,
    pi_id: int,
    *,
    tipo: str,
    filename: str,
    path: str,
    mime: Optional[str],
    size: Optional[int]
):
    pi = get_by_id(db, pi_id)
    if not pi:
        raise ValueError("PI não encontrado para anexar arquivos.")
    reg = PIAnexo(
        pi_id=pi_id,
        tipo=tipo,
        filename=filename,
        path=path,
        mime=mime,
        size=size
    )
    db.add(reg)
    db.commit()
    db.refresh(reg)
    return reg
