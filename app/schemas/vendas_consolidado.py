# app/schemas/vendas_consolidado.py
from typing import List, Optional
from pydantic import BaseModel


class ConsolidadoSetorItem(BaseModel):
    setor: str
    total_bruto: float = 0.0
    total_liquido: float = 0.0
    qtd_pis: int = 0


class VendasConsolidadoOut(BaseModel):
    mes: int
    ano: int
    total_bruto: float = 0.0
    total_liquido: float = 0.0
    qtd_pis: int = 0

    por_setor: List[ConsolidadoSetorItem] = []

    class Config:
        from_attributes = True
