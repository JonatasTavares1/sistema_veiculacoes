# app/crud/executivo_crud.py
from __future__ import annotations
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.models import Agencia, Anunciante
from app.crud import agencia_crud, anunciante_crud
from app.utils.cnpj import only_digits

def _tipo_norm(tipo: str) -> str:
    t = (tipo or "").strip().lower()
    if t in ("agencia", "agência"):
        return "Agência"
    return "Anunciante"

def listar_executivos(db: Session) -> List[str]:
    execs_ag = db.query(Agencia.executivo).filter(Agencia.executivo.isnot(None)).distinct().all()
    execs_an = db.query(Anunciante.executivo).filter(Anunciante.executivo.isnot(None)).distinct().all()
    todos = {e[0] for e in (execs_ag + execs_an) if e and e[0]}
    return sorted(todos)

def buscar_por_executivo(db: Session, nome_executivo: str | None, tipo: str | None) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    tipo_n = _tipo_norm(tipo) if tipo else None

    if tipo_n in (None, "Agência"):
        q = db.query(Agencia)
        if nome_executivo:
            q = q.filter(Agencia.executivo == nome_executivo)
        for a in q.all():
            out.append({
                "id": a.id,
                "tipo": "Agência",
                "nome": a.nome_agencia,
                "razao_social": a.razao_social_agencia,
                "cnpj": a.cnpj_agencia,
                "uf": a.uf_agencia,
                "executivo": a.executivo,
            })

    if tipo_n in (None, "Anunciante"):
        q = db.query(Anunciante)
        if nome_executivo:
            q = q.filter(Anunciante.executivo == nome_executivo)
        for a in q.all():
            out.append({
                "id": a.id,
                "tipo": "Anunciante",
                "nome": a.nome_anunciante,
                "razao_social": a.razao_social_anunciante,
                "cnpj": a.cnpj_anunciante,
                "uf": a.uf_cliente,
                "executivo": a.executivo,
            })

    return out

def editar_registro(db: Session, tipo: str, item_id: int, novos: Dict[str, Any]) -> Dict[str, Any]:
    """
    Atualiza registro de Agência ou Anunciante reaproveitando os CRUDs respectivos.
    Espera chaves: Nome, Razão Social, CNPJ, UF (compatível com seu controller antigo).
    """
    tipo_n = _tipo_norm(tipo)
    dados_update: Dict[str, Any] = {}

    # mapear nomes genéricos -> campos reais
    if "Nome" in novos and novos["Nome"] is not None:
        if tipo_n == "Agência":
            dados_update["nome_agencia"] = novos["Nome"]
        else:
            dados_update["nome_anunciante"] = novos["Nome"]

    if "Razão Social" in novos and novos["Razão Social"] is not None:
        if tipo_n == "Agência":
            dados_update["razao_social_agencia"] = novos["Razão Social"]
        else:
            dados_update["razao_social_anunciante"] = novos["Razão Social"]

    if "CNPJ" in novos and novos["CNPJ"] is not None:
        cnpj_limp = only_digits(novos["CNPJ"])
        if tipo_n == "Agência":
            dados_update["cnpj_agencia"] = cnpj_limp
        else:
            dados_update["cnpj_anunciante"] = cnpj_limp

    if "UF" in novos and novos["UF"] is not None:
        if tipo_n == "Agência":
            dados_update["uf_agencia"] = novos["UF"]
        else:
            dados_update["uf_cliente"] = novos["UF"]

    if tipo_n == "Agência":
        reg = agencia_crud.update(db, item_id, dados_update)
        return {
            "id": reg.id, "tipo": "Agência", "nome": reg.nome_agencia,
            "razao_social": reg.razao_social_agencia, "cnpj": reg.cnpj_agencia,
            "uf": reg.uf_agencia, "executivo": reg.executivo,
        }
    else:
        reg = anunciante_crud.update(db, item_id, dados_update)
        return {
            "id": reg.id, "tipo": "Anunciante", "nome": reg.nome_anunciante,
            "razao_social": reg.razao_social_anunciante, "cnpj": reg.cnpj_anunciante,
            "uf": reg.uf_cliente, "executivo": reg.executivo,
        }
