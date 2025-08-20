# app/schemas/produto.py
from typing import Optional
from pydantic import BaseModel, Field

class ProdutoBase(BaseModel):
    descricao: Optional[str] = None
    valor_unitario: Optional[float] = Field(None, ge=0)
    categoria: Optional[str] = None
    modalidade_preco: Optional[str] = None   # <- string livre
    base_segundos: Optional[int] = Field(None, ge=0)
    unidade_rotulo: Optional[str] = None

class ProdutoCreate(ProdutoBase):
    nome: str = Field(..., min_length=1)

class ProdutoUpdate(ProdutoBase):
    nome: Optional[str] = None

class ProdutoOut(BaseModel):
    id: int
    nome: str
    descricao: Optional[str] = None
    valor_unitario: Optional[float] = None
    categoria: Optional[str] = None
    modalidade_preco: Optional[str] = None   # <- string livre
    base_segundos: Optional[int] = None
    unidade_rotulo: Optional[str] = None

    class Config:
        from_attributes = True
