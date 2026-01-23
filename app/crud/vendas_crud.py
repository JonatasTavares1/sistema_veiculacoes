from __future__ import annotations

from typing import Any, Dict, List, Optional, Literal
from math import isnan

from sqlalchemy import func, and_
from sqlalchemy.orm import Session

from app.models import PI


FonteResumo = Literal["pi", "pi_prefer_liquido"]


def _to_int_maybe(v: Optional[str]) -> Optional[int]:
    if v is None:
        return None
    s = str(v).strip()
    if not s:
        return None
    try:
        return int(s)
    except Exception:
        return None


def _safe_float(v: Any) -> float:
    if v is None:
        return 0.0
    try:
        x = float(v)
        if isnan(x):
            return 0.0
        return x
    except Exception:
        return 0.0


def _norm(s: Optional[str]) -> Optional[str]:
    if s is None:
        return None
    t = str(s).strip()
    return t if t else None


def resumo_vendas(
    db: Session,
    *,
    mes: Optional[str] = None,
    ano: Optional[str] = None,
    executivo: Optional[str] = None,
    diretoria: Optional[str] = None,
    tipo_pi: Optional[str] = None,
    anunciante: Optional[str] = None,
    fonte: FonteResumo = "pi_prefer_liquido",
    top_n: Optional[int] = None,
) -> Dict[str, Any]:
    mes_i = _to_int_maybe(mes)
    ano_i = _to_int_maybe(ano)

    executivo = _norm(executivo)
    diretoria = _norm(diretoria)
    tipo_pi = _norm(tipo_pi)
    anunciante = _norm(anunciante)

    # expressão de valor:
    if fonte == "pi":
        valor_expr = func.coalesce(PI.valor_liquido, 0.0)
    else:
        valor_expr = func.coalesce(PI.valor_liquido, PI.valor_bruto, 0.0)

    filtros = []

    # ✅ REGRA: PI vendido = tem data_venda preenchida
    filtros.append(PI.data_venda.isnot(None))

    # ✅ Mês/Ano agora é em cima de data_venda
    if mes_i is not None:
        filtros.append(func.extract("month", PI.data_venda) == int(mes_i))

    if ano_i is not None:
        filtros.append(func.extract("year", PI.data_venda) == int(ano_i))

    if executivo:
        filtros.append(PI.executivo == executivo)
    if diretoria:
        filtros.append(PI.diretoria == diretoria)
    if tipo_pi:
        filtros.append(PI.tipo_pi == tipo_pi)
    if anunciante:
        filtros.append(PI.nome_anunciante == anunciante)

    where_clause = and_(*filtros) if filtros else None

    def _group_sum(col):
        q = db.query(
            col.label("chave"),
            func.sum(valor_expr).label("total"),
            func.count(PI.id).label("qtd_pis"),
        )
        if where_clause is not None:
            q = q.filter(where_clause)

        q = q.group_by(col).order_by(func.sum(valor_expr).desc())

        if top_n and isinstance(top_n, int) and top_n > 0:
            q = q.limit(top_n)

        return q.all()

    # Totais gerais
    q_total = db.query(
        func.sum(valor_expr).label("total"),
        func.count(PI.id).label("qtd_pis"),
    )
    if where_clause is not None:
        q_total = q_total.filter(where_clause)

    row_total = q_total.one()
    total_geral = _safe_float(row_total.total)
    qtd_pis = int(row_total.qtd_pis or 0)

    # Agrupamentos (somente o que existe em PI)
    por_executivo = _group_sum(PI.executivo)
    por_anunciante = _group_sum(PI.nome_anunciante)
    por_diretoria = _group_sum(PI.diretoria)
    por_tipo = _group_sum(PI.tipo_pi)

    def _rows(rows, key_name: str) -> List[Dict[str, Any]]:
        out: List[Dict[str, Any]] = []
        for r in rows:
            out.append(
                {
                    key_name: (r[0] if r[0] is not None else "—"),
                    "total": _safe_float(r[1]),
                    "qtd_pis": int(r[2] or 0),
                }
            )
        return out

    return {
        "filtros": {
            "mes": mes_i,
            "ano": ano_i,
            "executivo": executivo,
            "diretoria": diretoria,
            "tipo_pi": tipo_pi,
            "anunciante": anunciante,
            "fonte": fonte,
            "top_n": top_n,
        },
        "kpis": {
            "total_geral": total_geral,
            "qtd_pis": qtd_pis,
        },
        "agrupamentos": {
            "por_executivo": _rows(por_executivo, "executivo"),
            "por_anunciante": _rows(por_anunciante, "anunciante"),
            "por_diretoria": _rows(por_diretoria, "diretoria"),
            "por_tipo_pi": _rows(por_tipo, "tipo_pi"),
        },
    }


def painel_vendas_para_front(
    db: Session,
    *,
    mes: Optional[str] = None,
    ano: Optional[str] = None,
    executivo: Optional[str] = None,
    diretoria: Optional[str] = None,
    tipo_pi: Optional[str] = None,
    anunciante: Optional[str] = None,
    fonte: FonteResumo = "pi_prefer_liquido",
    top_n: int = 10,
) -> Dict[str, Any]:
    base = resumo_vendas(
        db,
        mes=mes,
        ano=ano,
        executivo=executivo,
        diretoria=diretoria,
        tipo_pi=tipo_pi,
        anunciante=anunciante,
        fonte=fonte,
        top_n=top_n,
    )

    mes_i = base["filtros"]["mes"]
    ano_i = base["filtros"]["ano"]

    total = _safe_float(base["kpis"]["total_geral"])
    qtd_pis = int(base["kpis"]["qtd_pis"] or 0)
    ticket = (total / qtd_pis) if qtd_pis > 0 else 0.0

    ranking = []
    for r in base["agrupamentos"]["por_executivo"]:
        vendido = _safe_float(r.get("total"))
        qtd = int(r.get("qtd_pis") or 0)
        ranking.append(
            {
                "executivo": r.get("executivo") or "—",
                "diretoria": None,
                "vendido_liquido": vendido,
                "meta": 0.0,
                "pct_atingido": 0.0,
                "restante": 0.0,
                "status": "—",
                "qtd_pis": qtd,
            }
        )

    por_diretoria = []
    for r in base["agrupamentos"]["por_diretoria"]:
        por_diretoria.append(
            {
                "diretoria": r.get("diretoria") or "—",
                "total": _safe_float(r.get("total")),
                "qtd_pis": int(r.get("qtd_pis") or 0),
            }
        )

    top_anunciantes = [
        {
            "anunciante": r.get("anunciante") or "—",
            "total": _safe_float(r.get("total")),
            "qtd_pis": int(r.get("qtd_pis") or 0),
        }
        for r in base["agrupamentos"]["por_anunciante"]
    ]

    top_tipos_pi = [
        {
            "tipo_pi": r.get("tipo_pi") or "—",
            "total": _safe_float(r.get("total")),
            "qtd_pis": int(r.get("qtd_pis") or 0),
        }
        for r in base["agrupamentos"]["por_tipo_pi"]
    ]

    top_agencias: List[Dict[str, Any]] = []
    top_campanhas: List[Dict[str, Any]] = []
    top_canais: List[Dict[str, Any]] = []

    qtd_anunciantes = len(
        [
            x for x in base["agrupamentos"]["por_anunciante"]
            if (x.get("anunciante") or "").strip() and x.get("anunciante") != "—"
        ]
    )
    qtd_agencias = 0

    return {
        "mes": mes_i,
        "ano": ano_i,
        "total_vendido": total,
        "qtd_pis": qtd_pis,
        "ticket_medio": ticket,
        "qtd_anunciantes": int(qtd_anunciantes),
        "qtd_agencias": int(qtd_agencias),
        "total_metas": 0.0,
        "pct_medio": 0.0,
        "ranking": ranking,
        "por_diretoria": por_diretoria,
        "top_anunciantes": top_anunciantes,
        "top_agencias": top_agencias,
        "top_campanhas": top_campanhas,
        "top_canais": top_canais,
        "top_tipos_pi": top_tipos_pi,
    }


def listar_pis_do_executivo_para_front(
    db: Session,
    *,
    executivo: str,
    mes: Optional[str] = None,
    ano: Optional[str] = None,
    tipo_pi: Optional[str] = None,
    fonte: FonteResumo = "pi_prefer_liquido",
) -> Dict[str, Any]:
    executivo = _norm(executivo)
    if not executivo:
        return {"executivo": "", "mes": None, "ano": None, "total_vendido": 0.0, "itens": []}

    mes_i = _to_int_maybe(mes)
    ano_i = _to_int_maybe(ano)
    tipo_pi = _norm(tipo_pi)

    if fonte == "pi":
        valor_expr = func.coalesce(PI.valor_liquido, 0.0)
    else:
        valor_expr = func.coalesce(PI.valor_liquido, PI.valor_bruto, 0.0)

    filtros = [PI.executivo == executivo]

    # ✅ só vendidos
    filtros.append(PI.data_venda.isnot(None))

    if mes_i is not None:
        filtros.append(func.extract("month", PI.data_venda) == int(mes_i))

    if ano_i is not None:
        filtros.append(func.extract("year", PI.data_venda) == int(ano_i))

    if tipo_pi:
        filtros.append(PI.tipo_pi == tipo_pi)

    total_row = (
        db.query(func.sum(valor_expr).label("total"))
        .filter(and_(*filtros))
        .one()
    )
    total_vendido = _safe_float(total_row.total)

    rows = (
        db.query(
            PI.id,
            PI.numero_pi,
            PI.tipo_pi,
            PI.eh_matriz,
            PI.nome_anunciante,
            PI.diretoria,
            PI.valor_bruto,
            PI.valor_liquido,
            PI.data_emissao,
            PI.data_venda,
        )
        .filter(and_(*filtros))
        .order_by(PI.data_venda.desc().nullslast(), PI.numero_pi.desc())
        .all()
    )

    itens: List[Dict[str, Any]] = []
    for r in rows:
        itens.append(
            {
                "id": r.id,
                "numero_pi": r.numero_pi,
                "tipo_pi": r.tipo_pi,
                "eh_matriz": bool(r.eh_matriz) if r.eh_matriz is not None else False,
                "nome_anunciante": r.nome_anunciante,
                "diretoria": r.diretoria,
                "valor_bruto": _safe_float(r.valor_bruto),
                "valor_liquido": _safe_float(r.valor_liquido),
                "data_emissao": (r.data_emissao.isoformat() if r.data_emissao else None),
                # se quiser mostrar no front depois:
                # "data_venda": (r.data_venda.isoformat() if r.data_venda else None),
            }
        )

    return {
        "executivo": executivo,
        "mes": mes_i,
        "ano": ano_i,
        "total_vendido": total_vendido,
        "itens": itens,
    }
