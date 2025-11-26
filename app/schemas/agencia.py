# app/schemas/agencia.py
from typing import Optional
from pydantic import BaseModel, Field, EmailStr, field_validator


class AgenciaBase(BaseModel):
    # === campos existentes ===
    razao_social_agencia: Optional[str] = None
    cnpj_agencia: Optional[str] = None
    uf_agencia: Optional[str] = None
    executivo: Optional[str] = None
    email_agencia: Optional[EmailStr] = None
    data_cadastro: Optional[str] = None

    # === campos novos (básicos) ===
    grupo_empresarial: Optional[str] = None
    codinome: Optional[str] = None
    site: Optional[str] = None
    linkedin: Optional[str] = None
    instagram: Optional[str] = None

    # === campos novos (endereço / negócio / telefones) ===
    endereco: Optional[str] = None           # complemento / observações
    logradouro: Optional[str] = None
    bairro: Optional[str] = None
    cep: Optional[str] = None
    segmento: Optional[str] = None
    subsegmento: Optional[str] = None
    telefone_socio1: Optional[str] = None
    telefone_socio2: Optional[str] = None

    # ===== validators =====

    # permite enviar "" no e-mail (tratamos como None)
    @field_validator("email_agencia", mode="before")
    @classmethod
    def empty_email_to_none(cls, v):
        if isinstance(v, str) and v.strip() == "":
            return None
        return v

    @field_validator(
        "grupo_empresarial",
        "codinome",
        "site",
        "linkedin",
        "instagram",
        "endereco",
        "logradouro",
        "bairro",
        "cep",
        "segmento",
        "subsegmento",
        "telefone_socio1",
        "telefone_socio2",
        mode="before",
    )
    @classmethod
    def empty_str_to_none(cls, v):
        if isinstance(v, str):
            v = v.strip()
            if v == "":
                return None
        return v


class AgenciaCreate(AgenciaBase):
    nome_agencia: str = Field(..., min_length=1)
    cnpj_agencia: str = Field(..., min_length=3)
    executivo: str = Field(..., min_length=1)


class AgenciaUpdate(AgenciaBase):
    nome_agencia: Optional[str] = None


class AgenciaOut(BaseModel):
    id: int
    nome_agencia: str

    # existentes
    razao_social_agencia: Optional[str] = None
    cnpj_agencia: str
    uf_agencia: Optional[str] = None
    executivo: str
    email_agencia: Optional[EmailStr] = None
    data_cadastro: Optional[str] = None

    # novos (básicos)
    grupo_empresarial: Optional[str] = None
    codinome: Optional[str] = None
    site: Optional[str] = None
    linkedin: Optional[str] = None
    instagram: Optional[str] = None

    # novos (endereço / negócio / telefones)
    endereco: Optional[str] = None
    logradouro: Optional[str] = None
    bairro: Optional[str] = None
    cep: Optional[str] = None
    segmento: Optional[str] = None
    subsegmento: Optional[str] = None
    telefone_socio1: Optional[str] = None
    telefone_socio2: Optional[str] = None

    class Config:
        # Pydantic v2; se estiver no v1 troque por: orm_mode = True
        from_attributes = True
