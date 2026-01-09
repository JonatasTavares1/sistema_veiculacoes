from __future__ import annotations

from typing import Any, Dict, List, Optional, Literal, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.models import PI


# Fonte do valor:
# - "pi": usa PI.valor_liquido/valor_bruto
# - "pi_prefer_liquido": usa líquido, se nulo cai no bruto
def _valor_expr(fonte: Literal["pi", "pi_prefer_liquido"] = "pi_prefer_liquido"):
    if fonte == "pi":
        return func.coalesce(PI.valor_liquido, 0.0)
    # prefer liquido, fallback bruto
    return func.coalesce(PI.valor_liquido, PI.valor_bruto, 0.0)


def resumo_vendas(
    db: Session,
    *,
    mes: Optional[str] = None,
    ano: Optional[str] = None,
    executivo: Optional[str] = None,
    diretoria: Optional[str] = None,
    tipo_pi: Optional[str] = None,
    anunciante: Optional[str] = None,
    fonte: Literal["pi", "pi_prefer_liquido"] = "pi_prefer_liquido",
    top_n: int = 10,
) -> Dict[str, Any]:
    """
    Consolida vendas com base em pis_cadastro.
    Filtros usam os campos já existentes: mes_venda, dia_venda, executivo, diretoria, tipo_pi, nome_anunciante.

    Retorna:
      - total_geral
      - por_executivo
      - por_diretoria
      - top_anunciantes
      - top_agencias
      - top_tipos
    """

    valor = _valor_expr(fonte)

    filtros = []
    if mes:
        filtros.append(PI.mes_venda == mes)
    if ano:
        # se você tiver ano separado no PI, melhor.
        # se NÃO tiver, dá para usar data_emissao.year, mas seu data_emissao é Date (ok).
        filtros.append(func.strftime("%Y", PI.data_emissao) == str(ano))
    if executivo:
        filtros.append(PI.executivo == executivo)
    if diretoria:
        filtros.append(PI.diretoria == diretoria)
    if tipo_pi:
        filtros.append(PI.tipo_pi == tipo_pi)
    if anunciante:
        filtros.append(PI.nome_anunciante.ilike(f"%{anunciante}%"))

    where_clause = and_(*filtros) if filtros else None

    # -----------------------------
    # Total geral
    # -----------------------------
    q_total = db.query(func.sum(valor))
    if where_clause is not None:
        q_total = q_total.filter(where_clause)
    total_geral = float(q_total.scalar() or 0.0)

    # -----------------------------
    # Total por executivo
    # -----------------------------
    q_exec = (
        db.query(
            PI.executivo.label("executivo"),
            func.sum(valor).label("total"),
            func.count(PI.id).label("qtd_pis"),
        )
        .group_by(PI.executivo)
        .order_by(func.sum(valor).desc())
    )
    if where_clause is not None:
        q_exec = q_exec.filter(where_clause)

    por_executivo = [
        {
            "executivo": (r.executivo or "N/A"),
            "total": float(r.total or 0.0),
            "qtd_pis": int(r.qtd_pis or 0),
        }
        for r in q_exec.all()
    ]

    # -----------------------------
    # Total por diretoria
    # -----------------------------
    q_dir = (
        db.query(
            PI.diretoria.label("diretoria"),
            func.sum(valor).label("total"),
            func.count(PI.id).label("qtd_pis"),
        )
        .group_by(PI.diretoria)
        .order_by(func.sum(valor).desc())
    )
    if where_clause is not None:
        q_dir = q_dir.filter(where_clause)

    por_diretoria = [
        {
            "diretoria": (r.diretoria or "N/A"),
            "total": float(r.total or 0.0),
            "qtd_pis": int(r.qtd_pis or 0),
        }
        for r in q_dir.all()
    ]

    # -----------------------------
    # Helpers TOP (CORREÇÃO DO ERRO)
    # IMPORTANTÍSSIMO: filter() vem ANTES de limit()/offset()
    # -----------------------------
    def _top_by(col_expr, key_name: str) -> List[Dict[str, Any]]:
        # base
        q = (
            db.query(
                col_expr.label(key_name),
                func.sum(valor).label("total"),
                func.count(PI.id).label("qtd_pis"),
            )
            .group_by(col_expr)
            .order_by(func.sum(valor).desc())
        )

        # ✅ aplica filtros antes do limit
        if where_clause is not None:
            q = q.filter(where_clause)

        # ✅ só depois limita
        if top_n and int(top_n) > 0:
            q = q.limit(int(top_n))

        rows = q.all()
        return [
            {
                key_name: (getattr(r, key_name) or "N/A"),
                "total": float(r.total or 0.0),
                "qtd_pis": int(r.qtd_pis or 0),
            }
            for r in rows
        ]

    top_anunciantes = _top_by(PI.nome_anunciante, "anunciante")
    top_agencias = _top_by(PI.nome_agencia, "agencia")
    top_tipos = _top_by(PI.tipo_pi, "tipo_pi")

    return {
        "total_geral": total_geral,
        "por_executivo": por_executivo,
        "por_diretoria": por_diretoria,
        "top_anunciantes": top_anunciantes,
        "top_agencias": top_agencias,
        "top_tipos": top_tipos,
    }


def listar_pis_do_executivo(
    db: Session,
    *,
    executivo: str,
    mes: Optional[str] = None,
    ano: Optional[str] = None,
    tipo_pi: Optional[str] = None,
    fonte: Literal["pi", "pi_prefer_liquido"] = "pi_prefer_liquido",
) -> List[Dict[str, Any]]:
    valor = _valor_expr(fonte)

    filtros = [PI.executivo == executivo]
    if mes:
        filtros.append(PI.mes_venda == mes)
    if ano:
        filtros.append(func.strftime("%Y", PI.data_emissao) == str(ano))
    if tipo_pi:
        filtros.append(PI.tipo_pi == tipo_pi)

    regs = (
        db.query(PI)
        .filter(and_(*filtros))
        .order_by(PI.data_emissao.desc().nullslast(), PI.numero_pi.desc())
        .all()
    )

    out: List[Dict[str, Any]] = []
    for pi in regs:
        vliq = float(pi.valor_liquido or 0.0)
        vbru = float(pi.valor_bruto or 0.0)
        vendido = float((vliq if pi.valor_liquido is not None else (vbru if pi.valor_bruto is not None else 0.0)) or 0.0)

        out.append(
            {
                "id": pi.id,
                "numero_pi": pi.numero_pi,
                "tipo_pi": pi.tipo_pi,
                "eh_matriz": bool(pi.eh_matriz),
                "nome_anunciante": pi.nome_anunciante,
                "diretoria": pi.diretoria,
                "mes_venda": pi.mes_venda,
                "dia_venda": pi.dia_venda,
                "data_emissao": pi.data_emissao.isoformat() if pi.data_emissao else None,
                "valor_bruto": vbru,
                "valor_liquido": vliq,
                "vendido": vendido,
            }
        )
    return out
