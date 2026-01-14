# app/routes/matrizes.py
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List

from app.database import SessionLocal
from app.crud import matriz_crud as mc
from app.schemas.matriz import (
    MatrizItemOut,
    MatrizResumoOut,
    AbatimentoOut,
    MatrizCreate,
    AbatimentoCreate,
)
from app.deps_auth import require_roles, _role_of  # _role_of existe no deps_auth ajustado acima

router = APIRouter(prefix="/matrizes", tags=["matrizes"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _exec_nome(user) -> str:
    return (getattr(user, "executivo_nome", None) or "").strip()


def _assert_ownership_if_needed(user, mat_obj):
    """
    Se role=executivo, só pode acessar matriz vinculada ao próprio executivo_nome.
    """
    role = (getattr(user, "role", "") or "").lower().strip()
    if role == "admin":
        return

    if role != "executivo":
        raise HTTPException(status_code=403, detail="Permissão insuficiente para esta ação.")

    exec_nome = _exec_nome(user)
    if not exec_nome:
        raise HTTPException(
            status_code=403,
            detail="Usuário não vinculado a executivo. Solicite ao administrador o vínculo do seu perfil.",
        )

    # tenta ler o campo executivo do objeto da matriz (PI Matriz)
    mat_exec = (getattr(mat_obj, "executivo", None) or "").strip()

    # Se seu model não tiver 'executivo', você precisa me avisar — eu ajusto para buscar via PI.
    if not mat_exec:
        # Segurança: se não conseguimos validar ownership, não liberamos.
        raise HTTPException(
            status_code=403,
            detail="Não foi possível validar o vínculo da matriz ao executivo (campo 'executivo' ausente).",
        )

    if mat_exec != exec_nome:
        # 404 para não “vazar” existência de matrizes de outros executivos
        raise HTTPException(status_code=404, detail="PI Matriz não encontrado.")


def _filter_list_by_exec_if_needed(user, rows: list):
    role = (getattr(user, "role", "") or "").lower().strip()
    if role == "admin":
        return rows

    exec_nome = _exec_nome(user)
    if not exec_nome:
        return []

    out = []
    for r in rows:
        r_exec = (getattr(r, "executivo", None) or "").strip()
        if r_exec and r_exec == exec_nome:
            out.append(r)
    return out


# ---------- Listas ----------
@router.get("", response_model=List[MatrizItemOut])
def listar_matrizes(
    order: str = Query("asc", description="Ordenação por numero_pi (asc|desc)"),
    db: Session = Depends(get_db),
    user=Depends(require_roles("executivo", "admin")),
):
    regs = mc.list_all(db, order=order)
    regs = _filter_list_by_exec_if_needed(user, regs)

    return [MatrizItemOut(numero_pi=r.numero_pi, nome_campanha=r.nome_campanha) for r in regs]


@router.get("/ativos", response_model=List[MatrizItemOut])
def listar_matrizes_ativas(
    order: str | None = Query(None, description="saldo_desc | numero_desc | numero_asc | asc"),
    db: Session = Depends(get_db),
    user=Depends(require_roles("executivo", "admin")),
):
    regs = mc.list_ativos(db, order=order)

    # mc.list_ativos parece devolver dict (r["numero_pi"] etc.)
    # então tentamos filtrar por "executivo" se vier no dict; se não vier, não expomos.
    role = (getattr(user, "role", "") or "").lower().strip()
    if role != "admin":
        exec_nome = _exec_nome(user)
        if not exec_nome:
            regs = []
        else:
            filtered = []
            for r in regs:
                r_exec = (r.get("executivo") or "").strip() if isinstance(r, dict) else ""
                if r_exec and r_exec == exec_nome:
                    filtered.append(r)
            regs = filtered

    return [MatrizItemOut(numero_pi=r["numero_pi"], nome_campanha=r.get("nome_campanha")) for r in regs]


# ---------- Detalhe / Resumo ----------
@router.get("/{numero_pi}", response_model=MatrizResumoOut)
def obter_resumo(
    numero_pi: str,
    db: Session = Depends(get_db),
    user=Depends(require_roles("executivo", "admin")),
):
    mat = mc.get_by_numero(db, numero_pi)
    if not mat:
        raise HTTPException(status_code=404, detail="PI Matriz não encontrado.")

    _assert_ownership_if_needed(user, mat)

    abatido = mc.calcular_valor_abatido(db, numero_pi)
    saldo = mc.calcular_saldo_restante(db, numero_pi)

    return MatrizResumoOut(
        id=mat.id,
        numero_pi=mat.numero_pi,
        nome_campanha=mat.nome_campanha,
        valor_bruto=mat.valor_bruto,
        valor_abatido=float(abatido),
        saldo_restante=float(saldo),
    )


@router.get("/{numero_pi}/abatimentos", response_model=List[AbatimentoOut])
def listar_abatimentos(
    numero_pi: str,
    db: Session = Depends(get_db),
    user=Depends(require_roles("executivo", "admin")),
):
    mat = mc.get_by_numero(db, numero_pi)
    if not mat:
        raise HTTPException(status_code=404, detail="PI Matriz não encontrado.")

    _assert_ownership_if_needed(user, mat)

    filhos = mc.list_abatimentos(db, numero_pi, order="asc")
    return [AbatimentoOut.model_validate(f) for f in filhos]


@router.get("/{numero_pi}/saldo")
def saldo(
    numero_pi: str,
    db: Session = Depends(get_db),
    user=Depends(require_roles("executivo", "admin")),
):
    mat = mc.get_by_numero(db, numero_pi)
    if not mat:
        raise HTTPException(status_code=404, detail="PI Matriz não encontrado.")

    _assert_ownership_if_needed(user, mat)

    return {
        "numero_pi_matriz": numero_pi,
        "valor_abatido": mc.calcular_valor_abatido(db, numero_pi),
        "saldo_restante": mc.calcular_saldo_restante(db, numero_pi),
    }


# ---------- Criação (RECOMENDO: só admin; se você quiser executivo criar, me avisa) ----------
@router.post("", response_model=MatrizResumoOut, status_code=status.HTTP_201_CREATED)
def criar_matriz(
    body: MatrizCreate,
    db: Session = Depends(get_db),
    _user=Depends(require_roles("admin")),
):
    try:
        novo = mc.create_matriz(db, body.dict())
        return MatrizResumoOut(
            id=novo.id,
            numero_pi=novo.numero_pi,
            nome_campanha=novo.nome_campanha,
            valor_bruto=novo.valor_bruto,
            valor_abatido=0.0,
            saldo_restante=float(novo.valor_bruto or 0.0),
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/{numero_pi}/abatimentos", response_model=AbatimentoOut, status_code=status.HTTP_201_CREATED)
def criar_abatimento(
    numero_pi: str,
    body: AbatimentoCreate,
    db: Session = Depends(get_db),
    _user=Depends(require_roles("admin")),
):
    try:
        novo = mc.create_abatimento(db, numero_pi, body.dict())
        return AbatimentoOut.model_validate(novo)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


# ---------- Exclusões (somente admin) ----------
@router.delete("/{numero_pi}")
def deletar_matriz(
    numero_pi: str,
    db: Session = Depends(get_db),
    _user=Depends(require_roles("admin")),
):
    mat = mc.get_by_numero(db, numero_pi)
    if not mat:
        raise HTTPException(status_code=404, detail="PI Matriz não encontrado.")
    try:
        mc.delete_matriz(db, mat.id)
        return {"ok": True, "deleted_numero_pi": numero_pi}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
