from typing import Optional, Literal, List
from datetime import date, datetime
from pydantic import BaseModel, Field

# ======== PI ========

TipoPI = Literal["Matriz", "Normal", "CS", "Abatimento", "Veiculação"]

class PISimpleOut(BaseModel):
    numero_pi: str
    nome_campanha: Optional[str] = None

class PIBase(BaseModel):
    # vínculos
    numero_pi_matriz: Optional[str] = None    # Abatimento e Veiculação usam
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

class PIAnexoOut(BaseModel):
    id: int
    tipo: str
    filename: str
    path: str
    mime: Optional[str] = None
    size: Optional[int] = None
    uploaded_at: datetime

    class Config:
        from_attributes = True

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

    # opcional expor anexos
    # anexos: List[PIAnexoOut] = []

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

    # ---- NOVO modelo de preços (preferencial no backend) ----
    valor_bruto: Optional[float] = None
    desconto: Optional[float] = None            # percentual 0..100
    valor_liquido: Optional[float] = None

    # ---- LEGADO para compat (rotas antigas/relatórios) ----
    valor: Optional[float] = None

class VeiculacaoOut(BaseModel):
    id: int
    canal: Optional[str] = None
    formato: Optional[str] = None
    data_inicio: Optional[date] = None
    data_fim: Optional[date] = None
    quantidade: Optional[int] = None

    # devolvemos os dois formatos para compat
    valor_bruto: Optional[float] = None
    desconto: Optional[float] = None
    valor_liquido: Optional[float] = None
    valor: Optional[float] = None  # legado (usado na tela de detalhe e agenda)

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

    # mapeia nomes do modelo para os nomes usados na API de detalhe
    anunciante: Optional[str] = Field(None, validation_alias="nome_anunciante")
    campanha: Optional[str] = Field(None, validation_alias="nome_campanha")
    emissao: Optional[date] = Field(None, validation_alias="data_emissao")

    total_pi: float = 0.0

    # lê da lista transitória criada no CRUD (_attach_produtos_to_pi)
    produtos: List[ProdutoOut] = Field(default_factory=list, validation_alias="produtos_agg")

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
