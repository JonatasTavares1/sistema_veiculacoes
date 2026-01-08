from typing import Optional, List, Literal
from pydantic import BaseModel

FaturamentoStatus = Literal["ENVIADO", "EM_FATURAMENTO", "FATURADO", "PAGO"]


class PIResumoOut(BaseModel):
    id: int
    numero_pi: Optional[str] = None
    tipo_pi: Optional[str] = None
    numero_pi_matriz: Optional[str] = None
    numero_pi_normal: Optional[str] = None

    nome_anunciante: Optional[str] = None
    razao_social_anunciante: Optional[str] = None
    cnpj_anunciante: Optional[str] = None

    nome_agencia: Optional[str] = None
    razao_social_agencia: Optional[str] = None
    cnpj_agencia: Optional[str] = None

    nome_campanha: Optional[str] = None

    executivo: Optional[str] = None
    diretoria: Optional[str] = None
    uf_cliente: Optional[str] = None
    canal: Optional[str] = None

    valor_bruto: Optional[float] = None
    valor_liquido: Optional[float] = None

    vencimento: Optional[str] = None
    data_emissao: Optional[str] = None

    class Config:
        from_attributes = True


class FaturamentoAnexoOut(BaseModel):
    id: int
    tipo: str
    filename: str
    path: str
    mime: Optional[str] = None
    size: Optional[int] = None
    uploaded_at: str

    class Config:
        from_attributes = True


class FaturamentoOut(BaseModel):
    id: int
    entrega_id: int
    status: str

    enviado_em: str
    em_faturamento_em: Optional[str] = None
    faturado_em: Optional[str] = None
    pago_em: Optional[str] = None

    nf_numero: Optional[str] = None
    observacao: Optional[str] = None

    # ✅ NOVO
    pi: Optional[PIResumoOut] = None

    anexos: List[FaturamentoAnexoOut] = []

    class Config:
        from_attributes = True


class FaturamentoStatusUpdate(BaseModel):
    status: FaturamentoStatus
    nf_numero: Optional[str] = None
    observacao: Optional[str] = None
