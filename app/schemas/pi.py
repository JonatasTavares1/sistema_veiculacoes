# app/schemas/pi.py
from typing import Optional, Literal
from datetime import date
from pydantic import BaseModel, Field

TipoPI = Literal["Matriz", "Normal", "CS", "Abatimento"]

class PISimpleOut(BaseModel):
    numero_pi: str
    nome_campanha: Optional[str] = None

class PIBase(BaseModel):
    # vínculos
    numero_pi_matriz: Optional[str] = None    # Abatimento usa
    numero_pi_normal: Optional[str] = None    # CS usa

    # anunciante / agência / venda
    nome_anunciante: Optional[str] = None
    razao_social_anunciante: Optional[str] = None
    cnpj_anunciante: Optional[str] = None
    uf_cliente: Optional[str] = None
    executivo: Optional[str] = None
    diretoria: Optional[str] = None
    nome_campanha: Optional[str] = None
    nome_agencia: Optional[str] = None
    razao_social_agencia: Optional[str] = None
    cnpj_agencia: Optional[str] = None
    uf_agencia: Optional[str] = None
    mes_venda: Optional[str] = None
    dia_venda: Optional[str] = None
    canal: Optional[str] = None
    # no modelo os campos são 'perfil' e 'subperfil'; no CRUD mapeamos *_anunciante -> esses campos
    perfil_anunciante: Optional[str] = None
    subperfil_anunciante: Optional[str] = None

    # valores e datas (aceita dd/mm/aaaa ou aaaa-mm-dd via CRUD)
    valor_bruto: Optional[float] = None
    valor_liquido: Optional[float] = None
    vencimento: Optional[str] = None
    data_emissao: Optional[str] = None

    observacoes: Optional[str] = ""

class PICreate(PIBase):
    numero_pi: str = Field(..., min_length=1)
    tipo_pi: TipoPI

class PIUpdate(PIBase):
    numero_pi: Optional[str] = None
    tipo_pi: Optional[TipoPI] = None

class PIOut(BaseModel):
    # básicos
    id: int
    numero_pi: str
    tipo_pi: TipoPI

    # vínculos
    numero_pi_matriz: Optional[str] = None
    numero_pi_normal: Optional[str] = None

    # anunciante / agência
    nome_anunciante: Optional[str] = None
    razao_social_anunciante: Optional[str] = None
    cnpj_anunciante: Optional[str] = None
    uf_cliente: Optional[str] = None

    nome_agencia: Optional[str] = None
    razao_social_agencia: Optional[str] = None
    cnpj_agencia: Optional[str] = None
    uf_agencia: Optional[str] = None

    # responsáveis
    executivo: Optional[str] = None
    diretoria: Optional[str] = None

    # campanha
    nome_campanha: Optional[str] = None
    mes_venda: Optional[str] = None
    dia_venda: Optional[str] = None
    canal: Optional[str] = None
    # do modelo
    perfil: Optional[str] = None
    subperfil: Optional[str] = None

    # valores e datas
    valor_bruto: Optional[float] = None
    valor_liquido: Optional[float] = None
    vencimento: Optional[date] = None
    data_emissao: Optional[date] = None

    observacoes: Optional[str] = None
    eh_matriz: Optional[bool] = None

    class Config:
        from_attributes = True  # Pydantic v2
