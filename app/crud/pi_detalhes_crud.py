# app/crud/pi_detalhes_crud.py
from __future__ import annotations

from typing import Dict, Any
from datetime import date, datetime

from sqlalchemy.orm import Session, joinedload

from app.models import PI, Veiculacao, Entrega, Faturamento
from app.crud import veiculacao_crud


def _parse_date(s: str | None) -> date | None:
    if not s:
        return None
    s = str(s).strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(s[:10], fmt).date()
        except ValueError:
            pass
    try:
        # ISO completo
        return datetime.fromisoformat(s.replace("Z", "+00:00")).date()
    except Exception:
        return None


def _calc_status_veiculacao(veics: list[Veiculacao]) -> Dict[str, Any]:
    """
    Determina status geral do PI baseado nas datas das veiculações:
      - NAO_INICIADO: não tem veiculação OU todas começam no futuro
      - EM_VEICULACAO: hoje está dentro do intervalo de pelo menos uma veiculação (ou intervalo aberto)
      - FINALIZADO: tinha veiculação e todas já terminaram antes de hoje
    """
    if not veics:
        return {
            "status": "NAO_INICIADO",
            "em_veiculacao": False,
            "possui_veiculacao": False,
            "data_inicio_min": None,
            "data_fim_max": None,
        }

    today = date.today()

    inicios = []
    fins = []
    em_veiculacao = False

    for v in veics:
        di = _parse_date(getattr(v, "data_inicio", None))
        df = _parse_date(getattr(v, "data_fim", None))
        if di:
            inicios.append(di)
        if df:
            fins.append(df)

        # janela aberta: se tem início mas não tem fim, considera em veiculação se já começou
        if di and not df and di <= today:
            em_veiculacao = True

        # janela completa: hoje dentro
        if di and df and di <= today <= df:
            em_veiculacao = True

        # só fim: considera em veiculação se ainda não passou
        if not di and df and today <= df:
            em_veiculacao = True

        # sem datas: não dá pra inferir, mas você pode decidir que conta como "em veiculação"
        # aqui eu vou ser conservador e não marcar.
        # if not di and not df:
        #     em_veiculacao = True

    data_inicio_min = min(inicios).isoformat() if inicios else None
    data_fim_max = max(fins).isoformat() if fins else None

    # define status geral
    if em_veiculacao:
        st = "EM_VEICULACAO"
    else:
        # se todas as veiculações são futuras (começam depois de hoje) -> NAO_INICIADO
        # se todas já terminaram -> FINALIZADO
        if inicios and min(inicios) > today:
            st = "NAO_INICIADO"
        elif fins and max(fins) < today:
            st = "FINALIZADO"
        else:
            # fallback (sem datas suficientes): assume que existe veiculação mas não está "ao vivo"
            st = "FINALIZADO"

    return {
        "status": st,
        "em_veiculacao": bool(em_veiculacao),
        "possui_veiculacao": True,
        "data_inicio_min": data_inicio_min,
        "data_fim_max": data_fim_max,
    }


def obter_detalhes_por_pi_id(db: Session, pi_id: int) -> Dict[str, Any]:
    """
    Devolve um pacote completo do PI:
      - PI (objeto)
      - Veiculações do PI (FILTRADO por pi_id)
      - Esteira (Entregas do PI via Veiculação)
      - Financeiro (Faturamentos do PI via Entrega -> Veiculação -> PI) com anexos
      - Totais e resumos
    """
    pi = db.get(PI, pi_id)
    if not pi:
        raise ValueError("PI não encontrado.")

    # 1) Veiculações (100% por pi_id)
    veics = veiculacao_crud.list_by_pi(db, pi_id)

    # 2) Esteira de produção = Entregas vinculadas às veiculações do PI
    entregas = (
        db.query(Entrega)
        .join(Veiculacao, Veiculacao.id == Entrega.veiculacao_id)
        .options(
            joinedload(Entrega.veiculacao).joinedload(Veiculacao.produto),
            joinedload(Entrega.veiculacao).joinedload(Veiculacao.pi),
        )
        .filter(Veiculacao.pi_id == pi_id)
        .order_by(Entrega.id.desc())
        .all()
    )

    # 3) Financeiro = Faturamentos do PI (join completo) + anexos
    fats = (
        db.query(Faturamento)
        .join(Entrega, Entrega.id == Faturamento.entrega_id)
        .join(Veiculacao, Veiculacao.id == Entrega.veiculacao_id)
        .options(
            joinedload(Faturamento.anexos),
            joinedload(Faturamento.entrega)
            .joinedload(Entrega.veiculacao)
            .joinedload(Veiculacao.produto),
            joinedload(Faturamento.entrega)
            .joinedload(Entrega.veiculacao)
            .joinedload(Veiculacao.pi),
        )
        .filter(Veiculacao.pi_id == pi_id)
        .order_by(Faturamento.enviado_em.desc())
        .all()
    )

    # 4) Totais veiculação
    veic_bruto = 0.0
    veic_liq = 0.0
    for v in veics:
        veic_bruto += float(v.valor_bruto or 0.0)
        veic_liq += float(v.valor_liquido if v.valor_liquido is not None else (v.valor_bruto or 0.0))

    # 5) Totais financeiro por status
    por_status_fat: Dict[str, int] = {}
    for f in fats:
        st = (f.status or "—").strip().upper()
        por_status_fat[st] = por_status_fat.get(st, 0) + 1

    # 6) Totais entregas por status (esteira)
    por_status_ent: Dict[str, int] = {}
    for e in entregas:
        st = (getattr(e, "status", None) or getattr(e, "etapa", None) or "—")
        st = str(st).strip().upper()
        por_status_ent[st] = por_status_ent.get(st, 0) + 1

    # 7) Resumo veiculação do PI
    resumo_veic = _calc_status_veiculacao(veics)

    totais = {
        "veiculacoes_total": len(veics),
        "veiculacoes_bruto": round(veic_bruto, 2),
        "veiculacoes_liquido": round(veic_liq, 2),
        "faturamentos_total": len(fats),
        "faturamentos_por_status": por_status_fat,
        "entregas_total": len(entregas),
        "entregas_por_status": por_status_ent,
    }

    return {
        "pi": pi,
        "veiculacoes": veics,
        "entregas": entregas,
        "faturamentos": fats,
        "veiculacao": resumo_veic,
        "totais": totais,
    }
