# app/seeds/seed_produtos.py

from __future__ import annotations

import math
import re
from typing import Dict, List, Optional

from sqlalchemy import text
from app.database import SessionLocal
from app.seeds.produtos_data import PRODUTOS_TSV


def _norm(s: Optional[str]) -> str:
    return (s or "").strip()


def _parse_brl_money(s: str) -> Optional[float]:
    """
    Converte:
      "R$ 120.000,00" -> 120000.0
      "R$ 80,00"      -> 80.0
      "" / "-"        -> None
    """
    raw = _norm(s)
    if not raw or raw in {"-", "—"}:
        return None

    raw = raw.replace("R$", "").strip()
    raw = raw.replace(".", "").replace(",", ".")

    try:
        val = float(raw)
    except ValueError:
        return None

    # evita NaN/inf derrubando JSON depois
    if math.isnan(val) or math.isinf(val):
        return None
    return val


def _parse_tsv(tsv: str) -> List[Dict]:
    """
    Espera linhas no formato:
      TIPO \t PRODUTO \t VALOR
    """
    itens: List[Dict] = []
    for line in tsv.splitlines():
        line = line.strip()
        if not line:
            continue

        parts = [p.strip() for p in line.split("\t")]
        if len(parts) < 3:
            # tenta fallback por múltiplos espaços
            parts = re.split(r"\s{2,}", line)
            parts = [p.strip() for p in parts if p.strip()]

        if len(parts) < 3:
            print(f"⚠️ Linha ignorada (formato inválido): {line}")
            continue

        categoria = _norm(parts[0])
        nome = _norm(parts[1])
        valor = _parse_brl_money(parts[2])

        if not nome:
            print(f"⚠️ Linha ignorada (sem nome): {line}")
            continue

        itens.append(
            {
                "nome": nome,
                "categoria": categoria if categoria else None,
                "valor_unitario": valor,
            }
        )

    return itens


def seed_produtos() -> None:
    db = SessionLocal()
    try:
        itens = _parse_tsv(PRODUTOS_TSV)
        if not itens:
            print("⚠️ Nenhum produto encontrado em PRODUTOS_TSV.")
            return

        # seu model tem UNIQUE(nome) — então o UPSERT deve ser por "nome"
        sql = text("""
            INSERT INTO produtos (nome, categoria, valor_unitario)
            VALUES (:nome, :categoria, :valor_unitario)
            ON CONFLICT (nome)
            DO UPDATE SET
                categoria = EXCLUDED.categoria,
                valor_unitario = EXCLUDED.valor_unitario
        """)

        for item in itens:
            db.execute(sql, item)

        db.commit()
        print(f"✅ Seed de produtos finalizado. Processados: {len(itens)}")

    except Exception as e:
        db.rollback()
        print("❌ Erro no seed_produtos:", e)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_produtos()
