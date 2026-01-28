# app/crud/vendas_consolidado_crud.py
from __future__ import annotations

from typing import Dict, Any, Optional
from datetime import date
from sqlalchemy.orm import Session

from app.models import PI


def _norm(s: Optional[str]) -> str:
    return (s or "").strip().lower()


def _classificar_setor(pi: PI) -> str:
    """
    Classifica setor baseado principalmente em PI.diretoria.
    Ajuste aqui se a tua regra real for outra (ex.: canal, perfil, etc).
    """
    d = _norm(getattr(pi, "diretoria", None))

    if "governo federal" in d or "federal" in d:
        return "Governo Federal"
    if "governo estadual" in d or "estadual" in d:
        return "Governo Estadual"

    # Gestão Executiva: pode ser um label direto OU o nome do diretor que você citou
    if "gest" in d or "gestão" in d or "gestao" in d or "rafael augusto" in d:
        return "Gestão Executiva"

    # fallback
    return "Privado"


def obter_consolidado(
    db: Session,
    mes: int,
    ano: int,
    *,
    executivo: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Consolidado por setor para o mês/ano, usando PI.data_venda.
    - entra somente PI com data_venda no mês/ano.
    - soma bruto/liquido do PI (não das veiculações).
    """
    if not (1 <= int(mes) <= 12):
        raise ValueError("Mês inválido.")
    if int(ano) < 2000 or int(ano) > 2100:
        raise ValueError("Ano inválido.")

    q = db.query(PI).filter(PI.data_venda.isnot(None))

    # filtra mês/ano via intervalos de data (compatível com SQLite/Postgres)
    ini = date(int(ano), int(mes), 1)
    if int(mes) == 12:
        fim = date(int(ano) + 1, 1, 1)
    else:
        fim = date(int(ano), int(mes) + 1, 1)

    q = q.filter(PI.data_venda >= ini, PI.data_venda < fim)

    if executivo and executivo.strip():
        q = q.filter(PI.executivo == executivo.strip())

    pis = q.all()

    buckets = {
        "Privado": {"setor": "Privado", "total_bruto": 0.0, "total_liquido": 0.0, "qtd_pis": 0},
        "Governo Estadual": {"setor": "Governo Estadual", "total_bruto": 0.0, "total_liquido": 0.0, "qtd_pis": 0},
        "Governo Federal": {"setor": "Governo Federal", "total_bruto": 0.0, "total_liquido": 0.0, "qtd_pis": 0},
        "Gestão Executiva": {"setor": "Gestão Executiva", "total_bruto": 0.0, "total_liquido": 0.0, "qtd_pis": 0},
    }

    total_bruto = 0.0
    total_liquido = 0.0

    for pi in pis:
        setor = _classificar_setor(pi)

        bruto = float(getattr(pi, "valor_bruto", None) or 0.0)
        liquido = getattr(pi, "valor_liquido", None)
        liquido = float(liquido) if liquido is not None else bruto

        buckets.setdefault(setor, {"setor": setor, "total_bruto": 0.0, "total_liquido": 0.0, "qtd_pis": 0})

        buckets[setor]["total_bruto"] += bruto
        buckets[setor]["total_liquido"] += liquido
        buckets[setor]["qtd_pis"] += 1

        total_bruto += bruto
        total_liquido += liquido

    por_setor = list(buckets.values())

    # ordena na ordem que você quer ver na tela
    ordem = ["Privado", "Governo Estadual", "Governo Federal", "Gestão Executiva"]
    por_setor.sort(key=lambda x: ordem.index(x["setor"]) if x["setor"] in ordem else 999)

    # arredonda
    for it in por_setor:
        it["total_bruto"] = round(float(it["total_bruto"]), 2)
        it["total_liquido"] = round(float(it["total_liquido"]), 2)

    return {
        "mes": int(mes),
        "ano": int(ano),
        "total_bruto": round(total_bruto, 2),
        "total_liquido": round(total_liquido, 2),
        "qtd_pis": len(pis),
        "por_setor": por_setor,
    }
