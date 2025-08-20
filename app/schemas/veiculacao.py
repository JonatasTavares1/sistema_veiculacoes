# app/schemas/veiculacao.py
from typing import Optional, Any
from pydantic import BaseModel, Field, field_validator

# --------- helpers de coerção ---------
def _to_optional_str(v: Any) -> Optional[str]:
    if v is None: return None
    if isinstance(v, str):
        t = v.strip()
        return t or None
    return str(v)

def _to_optional_float(v: Any) -> Optional[float]:
    if v is None or (isinstance(v, str) and v.strip() == ""):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        t = v.strip().replace(".", "").replace(",", ".")  # pt-BR -> ponto decimal
        if t.endswith("%"):                                # "10%" -> "10"
            t = t[:-1]
        try:
            return float(t)
        except ValueError:
            return None
    return None

def _to_optional_int(v: Any) -> Optional[int]:
    if v is None or (isinstance(v, str) and v.strip() == ""):
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None

# --------- Schemas ---------
class VeiculacaoBase(BaseModel):
    produto_id: Optional[int] = None
    pi_id: Optional[int] = None
    data_inicio: Optional[str] = None   # string (seu model usa String)
    data_fim: Optional[str] = None
    quantidade: Optional[int] = Field(None, ge=0)
    valor_unitario: Optional[float] = Field(None, ge=0)
    desconto: Optional[float] = Field(None, ge=0)  # aceita 10 => 10%, 0.1 => 10%

    # coerções
    @field_validator("data_inicio", "data_fim", mode="before")
    @classmethod
    def _v_str(cls, v): return _to_optional_str(v)

    @field_validator("valor_unitario", "desconto", mode="before")
    @classmethod
    def _v_float(cls, v): return _to_optional_float(v)

    @field_validator("quantidade", "produto_id", "pi_id", mode="before")
    @classmethod
    def _v_int(cls, v): return _to_optional_int(v)

class VeiculacaoCreate(VeiculacaoBase):
    produto_id: int = Field(..., ge=1)
    pi_id: int = Field(..., ge=1)
    quantidade: int = Field(..., ge=0)

class VeiculacaoUpdate(VeiculacaoBase):
    pass

class VeiculacaoOut(BaseModel):
    id: int
    produto_id: int
    pi_id: int
    data_inicio: Optional[str]
    data_fim: Optional[str]
    quantidade: Optional[int]
    valor_unitario: Optional[float]
    desconto: Optional[float]     # fração 0..1 (o CRUD normaliza)
    valor_total: Optional[float]

    # extras pra UI
    produto_nome: Optional[str] = None
    numero_pi: Optional[str] = None

    class Config:
        from_attributes = True

# usado em /veiculacoes/agenda
class VeiculacaoAgendaOut(BaseModel):
    id: int
    numero_pi: Optional[str] = None
    produto_nome: Optional[str] = None
    canal: Optional[str] = None
    data_inicio: Optional[str] = None
    data_fim: Optional[str] = None
    quantidade: Optional[int] = None
    valor_unitario: Optional[float] = None
    desconto: Optional[float] = None    # fração 0..1
    valor_total: Optional[float] = None
    executivo: Optional[str] = None
    diretoria: Optional[str] = None
    uf_cliente: Optional[str] = None
