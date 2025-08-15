# app/schemas/executivo.py
from typing import Literal, Optional
from pydantic import BaseModel, Field

TipoRegistro = Literal["Agência", "Agencia", "Anunciante"]  # aceitamos com/sem acento

class ExecNomeOut(BaseModel):
    executivo: str

class RegistroExecutivoOut(BaseModel):
    id: int
    tipo: Literal["Agência", "Anunciante"]
    nome: str
    razao_social: Optional[str] = None
    cnpj: Optional[str] = None
    uf: Optional[str] = None
    executivo: Optional[str] = None

class EditarRegistroIn(BaseModel):
    tipo: TipoRegistro
    id: int = Field(..., ge=1)
    nome: str
    razao_social: Optional[str] = None
    cnpj: Optional[str] = None
    uf: Optional[str] = None
