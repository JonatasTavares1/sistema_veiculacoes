# app/schemas/anunciante.py
from typing import Optional
from pydantic import BaseModel, Field, EmailStr

class AnuncianteBase(BaseModel):
    razao_social_anunciante: Optional[str] = None
    cnpj_anunciante: Optional[str] = None
    uf_cliente: Optional[str] = None
    executivo: Optional[str] = None
    email_anunciante: Optional[EmailStr] = None
    data_cadastro: Optional[str] = None

class AnuncianteCreate(AnuncianteBase):
    nome_anunciante: str = Field(..., min_length=1)
    cnpj_anunciante: str = Field(..., min_length=3)
    executivo: str = Field(..., min_length=1)

class AnuncianteUpdate(AnuncianteBase):
    nome_anunciante: Optional[str] = None

class AnuncianteOut(BaseModel):
    id: int
    nome_anunciante: str
    razao_social_anunciante: Optional[str] = None
    cnpj_anunciante: str
    uf_cliente: Optional[str] = None
    executivo: str
    email_anunciante: Optional[EmailStr] = None
    data_cadastro: Optional[str] = None

    class Config:
        from_attributes = True  # (se usar Pydantic v1, use: orm_mode = True)
