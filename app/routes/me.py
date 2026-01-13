# app/routes/me.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.deps import get_db
from app.deps_auth import get_current_user, require_roles
from app.models import PI, Agencia, Anunciante

router = APIRouter(prefix="/me", tags=["Me"])


def _get_exec_nome_from_user(user) -> str:
    nome = (getattr(user, "executivo_nome", None) or "").strip()
    if not nome:
        raise HTTPException(
            status_code=403,
            detail="Usuário não vinculado a executivo. Solicite ao administrador o vínculo do seu perfil.",
        )
    return nome


@router.get("")
def me_basic(user=Depends(get_current_user)):
    """Retorna dados básicos do usuário logado."""
    return {
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "nome": getattr(user, "nome", None),
        "executivo_nome": getattr(user, "executivo_nome", None),
    }


@router.get("/executivo")
def me_executivo(
    db: Session = Depends(get_db),
    user=Depends(require_roles("executivo", "admin")),
):
    exec_nome = _get_exec_nome_from_user(user)

    # carteira (contagem de agencias e anunciantes vinculados ao executivo)
    agencias = (
        db.query(func.count(Agencia.id))
        .filter(Agencia.executivo == exec_nome)
        .scalar()
        or 0
    )
    anunciantes = (
        db.query(func.count(Anunciante.id))
        .filter(Anunciante.executivo == exec_nome)
        .scalar()
        or 0
    )

    return {
        "executivo": exec_nome,
        "carteira": {"agencias": int(agencias), "anunciantes": int(anunciantes)},
        "email": user.email,
        "ativo": True,
    }


@router.get("/carteira")
def me_carteira(
    mes: int = Query(..., ge=1, le=12),
    ano: int = Query(..., ge=2000, le=2100),
    top_n: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    user=Depends(require_roles("executivo", "admin")),
):
    exec_nome = _get_exec_nome_from_user(user)

    # Base: PIs do executivo
    q_base = db.query(PI).filter(PI.executivo == exec_nome)

    # Seu PI.mes_venda é string: a gente filtra por "1".."12"
    q_base = q_base.filter(PI.mes_venda == str(mes))

    # Ano: usa data_emissao (Date)
    q_base = q_base.filter(PI.data_emissao.isnot(None))
    q_base = q_base.filter(func.strftime("%Y", PI.data_emissao) == str(ano))

    total_pis = q_base.count()
    soma_bruto = (
        q_base.with_entities(func.coalesce(func.sum(PI.valor_bruto), 0.0)).scalar()
        or 0.0
    )
    soma_liquido = (
        q_base.with_entities(func.coalesce(func.sum(PI.valor_liquido), 0.0)).scalar()
        or 0.0
    )

    top_anunciantes = (
        q_base.with_entities(
            PI.nome_anunciante.label("label"),
            func.coalesce(func.sum(PI.valor_liquido), 0.0).label("valor"),
        )
        .group_by(PI.nome_anunciante)
        .order_by(desc("valor"))
        .limit(top_n)
        .all()
    )

    top_agencias = (
        q_base.with_entities(
            PI.nome_agencia.label("label"),
            func.coalesce(func.sum(PI.valor_liquido), 0.0).label("valor"),
        )
        .group_by(PI.nome_agencia)
        .order_by(desc("valor"))
        .limit(top_n)
        .all()
    )

    pis = q_base.order_by(desc(PI.data_emissao)).limit(200).all()

    return {
        "executivo": exec_nome,
        "mes": mes,
        "ano": ano,
        "kpis": {
            "total_pis": int(total_pis),
            "valor_bruto": float(soma_bruto or 0.0),
            "valor_liquido": float(soma_liquido or 0.0),
        },
        "top_anunciantes": [
            {"label": a[0], "valor": float(a[1] or 0.0)} for a in top_anunciantes if a[0]
        ],
        "top_agencias": [
            {"label": a[0], "valor": float(a[1] or 0.0)} for a in top_agencias if a[0]
        ],
        "pis": [
            {
                "id": p.id,
                "numero_pi": p.numero_pi,
                "tipo_pi": p.tipo_pi,
                "nome_anunciante": p.nome_anunciante,
                "nome_agencia": p.nome_agencia,
                "valor_liquido": p.valor_liquido,
                "data_emissao": p.data_emissao.isoformat() if p.data_emissao else None,
            }
            for p in pis
        ],
    }
