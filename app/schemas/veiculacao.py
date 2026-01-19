from typing import Optional, Any
from pydantic import BaseModel, Field, field_validator


# --------- helpers de coerção ---------
def _to_optional_str(v: Any) -> Optional[str]:
    if v is None:
        return None
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
        t = v.strip().replace(".", "").replace(",", ".")
        if t.endswith("%"):
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


# --------- Schemas “core” ---------
class VeiculacaoBase(BaseModel):
    produto_id: Optional[int] = None
    pi_id: Optional[int] = None
    data_inicio: Optional[str] = None
    data_fim: Optional[str] = None
    quantidade: Optional[int] = Field(None, ge=0)

    valor_bruto: Optional[float] = Field(None, ge=0)
    desconto: Optional[float] = Field(None, ge=0)  # percentual 0..100
    valor_liquido: Optional[float] = Field(None, ge=0)

    @field_validator("data_inicio", "data_fim", mode="before")
    @classmethod
    def _v_str(cls, v):
        return _to_optional_str(v)

    @field_validator("valor_bruto", "desconto", "valor_liquido", mode="before")
    @classmethod
    def _v_float(cls, v):
        return _to_optional_float(v)

    @field_validator("quantidade", "produto_id", "pi_id", mode="before")
    @classmethod
    def _v_int(cls, v):
        return _to_optional_int(v)


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

    valor_bruto: Optional[float]
    desconto: Optional[float]
    valor_liquido: Optional[float]

    # Infos resolvidas para a UI
    produto_nome: Optional[str] = None
    numero_pi: Optional[str] = None
    cliente: Optional[str] = None
    campanha: Optional[str] = None

    # ✅ canal vem do PI (veiculação não tem canal/formato)
    canal: Optional[str] = None

    executivo: Optional[str] = None
    diretoria: Optional[str] = None
    uf_cliente: Optional[str] = None

    valor: Optional[float] = None
    em_veiculacao: Optional[bool] = None

    class Config:
        from_attributes = True


# usado em /veiculacoes/agenda
class VeiculacaoAgendaOut(BaseModel):
    id: int
    produto_id: Optional[int] = None
    pi_id: Optional[int] = None
    numero_pi: Optional[str] = None
    produto_nome: Optional[str] = None

    cliente: Optional[str] = None
    campanha: Optional[str] = None

    # ✅ canal vem do PI (veiculação não tem canal/formato)
    canal: Optional[str] = None

    data_inicio: Optional[str] = None
    data_fim: Optional[str] = None
    quantidade: Optional[int] = None

    valor_bruto: Optional[float] = None
    desconto: Optional[float] = None
    valor_liquido: Optional[float] = None
    valor: Optional[float] = None

    executivo: Optional[str] = None
    diretoria: Optional[str] = None
    uf_cliente: Optional[str] = None

    em_veiculacao: Optional[bool] = None

    class Config:
        from_attributes = True


# --------- ENTRADA flexível ---------
class VeiculacaoCreateIn(BaseModel):
    produto_id: Optional[int] = Field(None, ge=1)
    pi_id: Optional[int] = Field(None, ge=1)
    produto_nome: Optional[str] = None
    numero_pi: Optional[str] = None

    data_inicio: Optional[str] = None
    data_fim: Optional[str] = None
    quantidade: int = Field(..., ge=0)

    valor_bruto: Optional[float] = Field(None, ge=0)
    desconto: Optional[float] = Field(None, ge=0)
    valor_liquido: Optional[float] = Field(None, ge=0)

    @field_validator("produto_nome", "numero_pi", "data_inicio", "data_fim", mode="before")
    @classmethod
    def _v_str2(cls, v):
        return _to_optional_str(v)

    @field_validator("valor_bruto", "desconto", "valor_liquido", mode="before")
    @classmethod
    def _v_float2(cls, v):
        return _to_optional_float(v)

    @field_validator("quantidade", "produto_id", "pi_id", mode="before")
    @classmethod
    def _v_int2(cls, v):
        return _to_optional_int(v)
