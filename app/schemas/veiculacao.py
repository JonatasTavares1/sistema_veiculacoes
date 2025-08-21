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
        return int(float(v))
    except (TypeError, ValueError):
        return None

# --------- Schemas ---------
class VeiculacaoBase(BaseModel):
    produto_id: Optional[int] = None
    pi_id: Optional[int] = None
    data_inicio: Optional[str] = None
    data_fim: Optional[str] = None
    quantidade: Optional[int] = Field(None, ge=0)

    # 💰 novo modelo de preço
    valor_bruto: Optional[float] = Field(None, ge=0)
    desconto: Optional[float] = Field(None, ge=0)        # guarda PERCENTUAL 0..100
    valor_liquido: Optional[float] = Field(None, ge=0)   # calculado no CRUD (ignorado se vier)

    # coerções
    @field_validator("data_inicio", "data_fim", mode="before")
    @classmethod
    def _v_str(cls, v): return _to_optional_str(v)

    @field_validator("valor_bruto", "desconto", "valor_liquido", mode="before")
    @classmethod
    def _v_float(cls, v): return _to_optional_float(v)

    @field_validator("quantidade", "produto_id", "pi_id", mode="before")
    @classmethod
    def _v_int(cls, v): return _to_optional_int(v)

class VeiculacaoCreate(VeiculacaoBase):
    produto_id: int = Field(..., ge=1)
    pi_id: int = Field(..., ge=1)
    quantidade: int = Field(..., ge=0)
    # valor_bruto pode ser 0 (ex.: bonificação) mas recomendável enviar

class VeiculacaoUpdate(VeiculacaoBase):
    pass

class VeiculacaoOut(BaseModel):
    id: int
    produto_id: int
    pi_id: int
    data_inicio: Optional[str]
    data_fim: Optional[str]
    quantidade: Optional[int]

    # novo pricing
    valor_bruto: Optional[float]
    desconto: Optional[float]       # PERCENTUAL 0..100
    valor_liquido: Optional[float]

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

    # novo pricing
    valor_bruto: Optional[float] = None
    desconto: Optional[float] = None        # PERCENTUAL 0..100
    valor_liquido: Optional[float] = None

    executivo: Optional[str] = None
    diretoria: Optional[str] = None
    uf_cliente: Optional[str] = None

    class Config:
        from_attributes = True
