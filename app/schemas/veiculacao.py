# app/schemas/veiculacao.py
from typing import Optional
from pydantic import BaseModel, Field

class VeiculacaoBase(BaseModel):
    produto_id: Optional[int] = None
    pi_id: Optional[int] = None
    data_inicio: Optional[str] = None  # strings mesmo (seu model usa String)
    data_fim: Optional[str] = None
    quantidade: Optional[int] = Field(None, ge=0)
    valor_unitario: Optional[float] = Field(None, ge=0)
    desconto: Optional[float] = Field(None, ge=0)  # 0..1 (fração) ou 0..100 (%)

class VeiculacaoCreate(VeiculacaoBase):
    produto_id: int = Field(..., ge=1)
    pi_id: int = Field(..., ge=1)
    quantidade: int = Field(..., ge=0, description="Quantidade de peças/insersões")

class VeiculacaoUpdate(VeiculacaoBase):
    pass  # tudo opcional

class VeiculacaoOut(BaseModel):
    id: int
    produto_id: int
    pi_id: int
    data_inicio: Optional[str]
    data_fim: Optional[str]
    quantidade: Optional[int]
    valor_unitario: Optional[float]
    desconto: Optional[float]   # fração (0..1)
    valor_total: Optional[float]

    # extras úteis pra UI (nome do produto e número do PI)
    produto_nome: Optional[str] = None
    numero_pi: Optional[str] = None

    class Config:
        from_attributes = True
