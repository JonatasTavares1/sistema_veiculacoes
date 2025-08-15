# app/schemas/matriz.py
from typing import Optional, Literal, List
from pydantic import BaseModel, Field

# Saídas simples para listas
class MatrizItemOut(BaseModel):
    numero_pi: str
    nome_campanha: Optional[str] = None

    class Config:
        from_attributes = True

class AbatimentoOut(BaseModel):
    id: int
    numero_pi: str
    valor_bruto: Optional[float] = None
    nome_campanha: Optional[str] = None

    class Config:
        from_attributes = True

# Detalhe/Resumo de uma matriz
class MatrizResumoOut(BaseModel):
    id: int
    numero_pi: str
    nome_campanha: Optional[str] = None
    valor_bruto: Optional[float] = None
    valor_abatido: float
    saldo_restante: float

# Criação de uma Matriz (sem pedir tipo)
class MatrizCreate(BaseModel):
    numero_pi: str = Field(..., min_length=1)

    # anunciante
    nome_anunciante: Optional[str] = None
    razao_social_anunciante: Optional[str] = None
    cnpj_anunciante: Optional[str] = None
    uf_cliente: Optional[str] = None

    # agência
    nome_agencia: Optional[str] = None
    razao_social_agencia: Optional[str] = None
    cnpj_agencia: Optional[str] = None
    uf_agencia: Optional[str] = None

    # responsáveis e campanha
    executivo: Optional[str] = None
    diretoria: Optional[str] = None
    nome_campanha: Optional[str] = None
    mes_venda: Optional[str] = None
    dia_venda: Optional[str] = None
    canal: Optional[str] = None
    perfil_anunciante: Optional[str] = None
    subperfil_anunciante: Optional[str] = None

    # valores e datas
    valor_bruto: Optional[float] = None
    valor_liquido: Optional[float] = None
    vencimento: Optional[str] = None      # dd/mm/aaaa ou ISO
    data_emissao: Optional[str] = None    # dd/mm/aaaa ou ISO

    observacoes: Optional[str] = ""

# Criação de Abatimento vinculado à Matriz
class AbatimentoCreate(BaseModel):
    numero_pi: str = Field(..., min_length=1)  # número do PI Abatimento
    valor_bruto: float = Field(..., gt=0)

    # opcionais úteis
    valor_liquido: Optional[float] = None
    nome_campanha: Optional[str] = None
    vencimento: Optional[str] = None      # dd/mm/aaaa ou ISO
    data_emissao: Optional[str] = None    # dd/mm/aaaa ou ISO
    observacoes: Optional[str] = ""
