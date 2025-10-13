# app/schemas/anunciante.py
from typing import Optional
from pydantic import BaseModel, Field, EmailStr, field_validator

class AnuncianteBase(BaseModel):
    # existentes
    razao_social_anunciante: Optional[str] = None
    cnpj_anunciante: Optional[str] = None
    uf_cliente: Optional[str] = None
    executivo: Optional[str] = None
    email_anunciante: Optional[EmailStr] = None
    data_cadastro: Optional[str] = None

    # novos
    grupo_empresarial: Optional[str] = None
    codinome: Optional[str] = None
    site: Optional[str] = None
    linkedin: Optional[str] = None
    instagram: Optional[str] = None

    # ===== validators =====
    @field_validator("email_anunciante", mode="before")
    @classmethod
    def empty_email_to_none(cls, v):
        if isinstance(v, str) and v.strip() == "":
            return None
        return v

    @field_validator("grupo_empresarial", "codinome", "site", "linkedin", "instagram", mode="before")
    @classmethod
    def empty_str_to_none(cls, v):
        if isinstance(v, str):
            v = v.strip()
            if v == "":
                return None
        return v

class AnuncianteCreate(AnuncianteBase):
    nome_anunciante: str = Field(..., min_length=1)
    cnpj_anunciante: str = Field(..., min_length=3)
    executivo: str = Field(..., min_length=1)

class AnuncianteUpdate(AnuncianteBase):
    nome_anunciante: Optional[str] = None

class AnuncianteOut(BaseModel):
    id: int
    nome_anunciante: str

    # existentes
    razao_social_anunciante: Optional[str] = None
    cnpj_anunciante: str
    uf_cliente: Optional[str] = None
    executivo: str
    email_anunciante: Optional[EmailStr] = None
    data_cadastro: Optional[str] = None

    # novos
    grupo_empresarial: Optional[str] = None
    codinome: Optional[str] = None
    site: Optional[str] = None
    linkedin: Optional[str] = None
    instagram: Optional[str] = None

    class Config:
        from_attributes = True  # (se usar Pydantic v1, use: orm_mode = True)
