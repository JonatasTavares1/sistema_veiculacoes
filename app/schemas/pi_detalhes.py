# app/schemas/pi_detalhes.py
from typing import Optional, List, Dict
from pydantic import BaseModel

from app.schemas.veiculacao import VeiculacaoOut
from app.schemas.faturamento import FaturamentoOut
from app.schemas.pi import PIOut

# ✅ Esteira de produção (Entregas)
from app.schemas.entrega import EntregaOut  # ajuste se o nome no teu projeto for diferente


class PIVeiculacaoResumoOut(BaseModel):
    status: str = "NAO_INICIADO"  # NAO_INICIADO | EM_VEICULACAO | FINALIZADO
    em_veiculacao: bool = False
    possui_veiculacao: bool = False

    data_inicio_min: Optional[str] = None
    data_fim_max: Optional[str] = None

    class Config:
        from_attributes = True


class PIDetalhesTotaisOut(BaseModel):
    veiculacoes_total: int = 0
    veiculacoes_bruto: float = 0.0
    veiculacoes_liquido: float = 0.0

    faturamentos_total: int = 0
    faturamentos_por_status: Dict[str, int] = {}

    entregas_total: int = 0
    entregas_por_status: Dict[str, int] = {}

    class Config:
        from_attributes = True


class PIDetalhesOut(BaseModel):
    pi: PIOut

    # ✅ tudo exclusivo do PI
    veiculacoes: List[VeiculacaoOut] = []
    entregas: List[EntregaOut] = []  # ✅ esteira de produção

    # ✅ financeiro
    faturamentos: List[FaturamentoOut] = []  # já inclui anexos

    # ✅ novos resumos
    veiculacao: PIVeiculacaoResumoOut
    totais: PIDetalhesTotaisOut

    class Config:
        from_attributes = True
