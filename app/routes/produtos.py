# app/routes/produtos.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from pydantic import BaseModel

from app.database import SessionLocal
from app.schemas.pi import (
    ProdutoCreateIn, ProdutoUpdateIn,
    ProdutoListItemOut, ProdutoOut, VeiculacaoOut
)
from app.models import PI, Produto, Veiculacao

router = APIRouter(prefix="/produtos", tags=["produtos"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ---------- util ----------
def _parse_date(s: Optional[str]):
    from datetime import datetime
    if not s: return None
    s = s.strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    return None

# ---------- list ----------
@router.get("", response_model=List[ProdutoListItemOut])
def listar_produtos(
    pi_id: Optional[int] = Query(None),
    pi_numero: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = (
        db.query(Produto)
        .join(PI, Produto.pi_id == PI.id)
        .options(joinedload(Produto.veiculacoes), joinedload(Produto.pi))
    )
    if pi_id:
        q = q.filter(Produto.pi_id == pi_id)
    if pi_numero:
        q = q.filter(PI.numero_pi == pi_numero)

    regs = q.order_by(Produto.id.desc()).all()
    out: List[ProdutoListItemOut] = []
    for p in regs:
        total = sum((v.valor or 0.0) for v in (p.veiculacoes or []))
        out.append(ProdutoListItemOut(
            id=p.id, pi_id=p.pi_id, numero_pi=p.pi.numero_pi if getattr(p, "pi", None) else None,
            nome=p.nome, descricao=p.descricao,
            veiculacoes=len(p.veiculacoes or []),
            total_produto=round(float(total), 2),
        ))
    return out

# ---------- create ----------
@router.post("", response_model=ProdutoOut, status_code=status.HTTP_201_CREATED)
def criar_produto(body: ProdutoCreateIn, db: Session = Depends(get_db)):
    # localizar PI
    pi: Optional[PI] = None
    if body.pi_id:
        pi = db.query(PI).get(body.pi_id)
    elif body.numero_pi:
        pi = db.query(PI).filter(PI.numero_pi == body.numero_pi).first()
    if not pi:
        raise HTTPException(status_code=422, detail="PI não encontrado para vincular o produto.")

    prod = Produto(pi_id=pi.id, nome=body.nome.strip(), descricao=body.descricao)
    db.add(prod)
    db.flush()

    for v in (body.veiculacoes or []):
        veic = Veiculacao(
            produto_id=prod.id,
            canal=v.canal,
            formato=v.formato,
            data_inicio=_parse_date(v.data_inicio),
            data_fim=_parse_date(v.data_fim),
            quantidade=v.quantidade,
            valor=v.valor,
        )
        db.add(veic)

    db.commit()
    db.refresh(prod)

    veics = [
        VeiculacaoOut(
            id=v.id, canal=v.canal, formato=v.formato,
            data_inicio=v.data_inicio, data_fim=v.data_fim,
            quantidade=v.quantidade, valor=v.valor
        ) for v in (prod.veiculacoes or [])
    ]
    total_produto = sum((v.valor or 0.0) for v in (prod.veiculacoes or []))
    return ProdutoOut(
        id=prod.id, nome=prod.nome, descricao=prod.descricao,
        total_produto=round(float(total_produto), 2), veiculacoes=veics
    )

# ---------- detalhe ----------
@router.get("/{produto_id:int}/detalhe", response_model=ProdutoOut)
def detalhe_produto(produto_id: int, db: Session = Depends(get_db)):
    prod = (
        db.query(Produto)
        .options(joinedload(Produto.veiculacoes))
        .filter(Produto.id == produto_id)
        .first()
    )
    if not prod:
        raise HTTPException(status_code=404, detail="Produto não encontrado.")

    veics = [
        VeiculacaoOut(
            id=v.id, canal=v.canal, formato=v.formato,
            data_inicio=v.data_inicio, data_fim=v.data_fim,
            quantidade=v.quantidade, valor=v.valor
        ) for v in (prod.veiculacoes or [])
    ]
    total_produto = sum((v.valor or 0.0) for v in (prod.veiculacoes or []))
    return ProdutoOut(
        id=prod.id, nome=prod.nome, descricao=prod.descricao,
        total_produto=round(float(total_produto), 2), veiculacoes=veics
    )

# ---------- update (sync veiculações) ----------
@router.put("/{produto_id:int}", response_model=ProdutoOut)
def atualizar_produto(produto_id: int, body: ProdutoUpdateIn, db: Session = Depends(get_db)):
    prod = (
        db.query(Produto)
        .options(joinedload(Produto.veiculacoes))
        .filter(Produto.id == produto_id)
        .first()
    )
    if not prod:
        raise HTTPException(status_code=404, detail="Produto não encontrado.")

    prod.nome = body.nome.strip()
    prod.descricao = body.descricao

    existentes = {v.id: v for v in (prod.veiculacoes or [])}
    vistos: set[int] = set()

    for v_in in (body.veiculacoes or []):
        vid = v_in.id
        if vid and vid in existentes:
            v = existentes[vid]
            v.canal = v_in.canal
            v.formato = v_in.formato
            v.data_inicio = _parse_date(v_in.data_inicio)
            v.data_fim = _parse_date(v_in.data_fim)
            v.quantidade = v_in.quantidade
            v.valor = v_in.valor
        else:
            v = Veiculacao(
                produto_id=prod.id,
                canal=v_in.canal,
                formato=v_in.formato,
                data_inicio=_parse_date(v_in.data_inicio),
                data_fim=_parse_date(v_in.data_fim),
                quantidade=v_in.quantidade,
                valor=v_in.valor,
            )
            db.add(v)
            db.flush()
        vistos.add(v.id)

    # excluir veics que não vieram
    for v in list(prod.veiculacoes or []):
        if v.id not in vistos:
            db.delete(v)

    db.commit()
    db.refresh(prod)

    veics = [
        VeiculacaoOut(
            id=v.id, canal=v.canal, formato=v.formato,
            data_inicio=v.data_inicio, data_fim=v.data_fim,
            quantidade=v.quantidade, valor=v.valor
        ) for v in (prod.veiculacoes or [])
    ]
    total_produto = sum((v.valor or 0.0) for v in (prod.veiculacoes or []))
    return ProdutoOut(
        id=prod.id, nome=prod.nome, descricao=prod.descricao,
        total_produto=round(float(total_produto), 2), veiculacoes=veics
    )

# ---------- delete ----------
@router.delete("/{produto_id:int}")
def deletar_produto(produto_id: int, db: Session = Depends(get_db)):
    prod = db.query(Produto).filter(Produto.id == produto_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Produto não encontrado.")
    for v in list(prod.veiculacoes or []):
        db.delete(v)
    db.delete(prod)
    db.commit()
    return {"ok": True, "deleted_id": produto_id}

# ---------- opções de nomes (autocomplete no PI) ----------
@router.get("/opcoes-nome", response_model=List[str])
def opcoes_nome_produtos(db: Session = Depends(get_db)):
    rows = db.query(Produto.nome).distinct().order_by(Produto.nome.asc()).all()
    return [r[0] for r in rows if r and r[0]]
