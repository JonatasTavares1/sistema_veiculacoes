# app/schemas/entrega.py
from typing import Optional, Literal
from pydantic import BaseModel, Field

EntregaStatus = Literal["Sim", "Não", "pendente"]

class EntregaBase(BaseModel):
    veiculacao_id: Optional[int] = None
    data_entrega: Optional[str] = None  # dd/mm/aaaa ou aaaa-mm-dd
    foi_entregue: Optional[EntregaStatus] = None
    motivo: Optional[str] = None

class EntregaCreate(EntregaBase):
    veiculacao_id: int = Field(..., ge=1)
    data_entrega: str = Field(..., min_length=8)  # dd/mm/aaaa ou ISO
    foi_entregue: Optional[EntregaStatus] = "pendente"
    motivo: Optional[str] = ""

class EntregaUpdate(EntregaBase):
    pass  # tudo opcional

class EntregaOut(BaseModel):
    id: int
    veiculacao_id: int
    data_entrega: str
    foi_entregue: EntregaStatus
    motivo: Optional[str] = ""

    class Config:
        from_attributes = True
