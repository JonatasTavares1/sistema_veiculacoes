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


def _pick(obj, attr: str, default=None):
    return getattr(obj, attr, default)


def _safe_str(v) -> str:
    return (v or "").strip()


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

    # Seu PI.mes_venda é string: filtra por "1".."12"
    q_base = q_base.filter(PI.mes_venda == str(mes))

    # Ano: usa data_emissao (Date)
    q_base = q_base.filter(PI.data_emissao.isnot(None))

    # ✅ PostgreSQL: extrai ano (evita strftime do SQLite)
    q_base = q_base.filter(func.extract("year", PI.data_emissao) == ano)

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
            {"label": _safe_str(a[0]), "valor": float(a[1] or 0.0)}
            for a in top_anunciantes
            if _safe_str(a[0])
        ],
        "top_agencias": [
            {"label": _safe_str(a[0]), "valor": float(a[1] or 0.0)}
            for a in top_agencias
            if _safe_str(a[0])
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


# ==========================================================
# ✅ NOVO: Carteira completa do executivo (listas + busca + paginação)
# ==========================================================

@router.get("/carteira/agencias")
def me_carteira_agencias(
    q: str | None = Query(default=None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user=Depends(require_roles("executivo", "admin")),
):
    exec_nome = _get_exec_nome_from_user(user)

    base = db.query(Agencia).filter(Agencia.executivo == exec_nome)

    # Busca (case-insensitive) por nome
    if q and q.strip():
        qq = f"%{q.strip().lower()}%"
        if hasattr(Agencia, "nome_agencia"):
            base = base.filter(func.lower(Agencia.nome_agencia).like(qq))
        elif hasattr(Agencia, "nome"):
            base = base.filter(func.lower(Agencia.nome).like(qq))

    total = int(base.count() or 0)

    # Ordenação segura (nome > id)
    if hasattr(Agencia, "nome_agencia"):
        order_col = Agencia.nome_agencia
    elif hasattr(Agencia, "nome"):
        order_col = Agencia.nome
    else:
        order_col = Agencia.id

    rows = base.order_by(order_col).offset(offset).limit(limit).all()

    items = []
    for a in rows:
        items.append(
            {
                "id": _pick(a, "id"),
                "nome": _safe_str(_pick(a, "nome_agencia", _pick(a, "nome", ""))),
                "cnpj": _pick(a, "cnpj_agencia", _pick(a, "cnpj", None)),
                "uf": _pick(a, "uf_agencia", _pick(a, "uf", None)),
                "executivo": _pick(a, "executivo", exec_nome),
            }
        )

    # Remove entradas vazias (nome vazio)
    items = [i for i in items if _safe_str(i.get("nome"))]

    return {
        "executivo": exec_nome,
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": items,
    }


@router.get("/carteira/anunciantes")
def me_carteira_anunciantes(
    q: str | None = Query(default=None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user=Depends(require_roles("executivo", "admin")),
):
    exec_nome = _get_exec_nome_from_user(user)

    base = db.query(Anunciante).filter(Anunciante.executivo == exec_nome)

    # Busca (case-insensitive) por nome
    if q and q.strip():
        qq = f"%{q.strip().lower()}%"
        if hasattr(Anunciante, "nome_anunciante"):
            base = base.filter(func.lower(Anunciante.nome_anunciante).like(qq))
        elif hasattr(Anunciante, "nome"):
            base = base.filter(func.lower(Anunciante.nome).like(qq))

    total = int(base.count() or 0)

    # Ordenação segura (nome > id)
    if hasattr(Anunciante, "nome_anunciante"):
        order_col = Anunciante.nome_anunciante
    elif hasattr(Anunciante, "nome"):
        order_col = Anunciante.nome
    else:
        order_col = Anunciante.id

    rows = base.order_by(order_col).offset(offset).limit(limit).all()

    items = []
    for x in rows:
        items.append(
            {
                "id": _pick(x, "id"),
                "nome": _safe_str(_pick(x, "nome_anunciante", _pick(x, "nome", ""))),
                "cnpj": _pick(x, "cnpj_anunciante", _pick(x, "cnpj", None)),
                "uf": _pick(x, "uf_cliente", _pick(x, "uf", None)),
                "executivo": _pick(x, "executivo", exec_nome),
            }
        )

    # Remove entradas vazias (nome vazio)
    items = [i for i in items if _safe_str(i.get("nome"))]

    return {
        "executivo": exec_nome,
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": items,
    }
