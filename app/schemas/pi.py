# app/schemas/pi.py
from typing import Optional, Literal, List
from datetime import date
from pydantic import BaseModel, Field

# ======== PI ========

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

# ======== PRODUTOS & VEICULAÇÕES ========

class VeiculacaoIn(BaseModel):
    id: Optional[int] = None           # para update (pode omitir no create)
    canal: Optional[str] = None
    formato: Optional[str] = None
    data_inicio: Optional[str] = None  # dd/mm/aaaa ou yyyy-mm-dd
    data_fim: Optional[str] = None
    quantidade: Optional[int] = None
    valor: Optional[float] = None

class VeiculacaoOut(BaseModel):
    id: int
    canal: Optional[str] = None
    formato: Optional[str] = None
    data_inicio: Optional[date] = None
    data_fim: Optional[date] = None
    quantidade: Optional[int] = None
    valor: Optional[float] = None

    class Config:
        from_attributes = True

class ProdutoIn(BaseModel):
    id: Optional[int] = None
    nome: str
    descricao: Optional[str] = None
    veiculacoes: List[VeiculacaoIn] = Field(default_factory=list)

class ProdutoOut(BaseModel):
    id: int
    nome: str
    descricao: Optional[str] = None
    total_produto: float
    veiculacoes: List[VeiculacaoOut]

    class Config:
        from_attributes = True

# criar produto pela página Produtos (vinculando ao PI)
class ProdutoCreateIn(BaseModel):
    pi_id: Optional[int] = None
    numero_pi: Optional[str] = None  # alternativa ao pi_id
    nome: str
    descricao: Optional[str] = None
    veiculacoes: List[VeiculacaoIn] = Field(default_factory=list)

class ProdutoUpdateIn(BaseModel):
    nome: str
    descricao: Optional[str] = None
    veiculacoes: List[VeiculacaoIn] = Field(default_factory=list)

class ProdutoListItemOut(BaseModel):
    id: int
    pi_id: int
    numero_pi: Optional[str] = None
    nome: str
    descricao: Optional[str] = None
    veiculacoes: int
    total_produto: float

# ======== DETALHE DO PI (leitura) ========

class PiDetalheOut(BaseModel):
    id: int
    numero_pi: str
    anunciante: Optional[str] = None
    campanha: Optional[str] = None
    emissao: Optional[date] = None
    total_pi: float
    produtos: List[ProdutoOut]

    class Config:
        from_attributes = True

# ======== AGENDA (para página de Veiculações) ========

class VeiculacaoAgendaOut(BaseModel):
    id: int
    produto_id: int
    pi_id: int
    numero_pi: str
    cliente: Optional[str] = None
    campanha: Optional[str] = None
    canal: Optional[str] = None
    formato: Optional[str] = None
    data_inicio: Optional[date] = None
    data_fim: Optional[date] = None
    quantidade: Optional[int] = None
    valor: Optional[float] = None
    produto_nome: Optional[str] = None
    executivo: Optional[str] = None
    diretoria: Optional[str] = None
    uf_cliente: Optional[str] = None
