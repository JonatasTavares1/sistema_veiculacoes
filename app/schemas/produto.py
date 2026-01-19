# app/schemas/produto.py
from typing import Optional, Literal
from pydantic import BaseModel, Field


# Se quiser manter livre, troque Literal[...] por Optional[str]
ModalidadePreco = Literal["DIA", "SPOT", "CPM", "PACOTE"]


class ProdutoBase(BaseModel):
    descricao: Optional[str] = None
    categoria: Optional[str] = None

    # ✅ trava nos valores esperados (combina com seu front e seu CRUD)
    modalidade_preco: Optional[ModalidadePreco] = None

    base_segundos: Optional[int] = Field(None, ge=0)
    unidade_rotulo: Optional[str] = None

    # ✅ preço de tabela do catálogo
    valor_unitario: Optional[float] = Field(None, ge=0)


class ProdutoCreate(ProdutoBase):
    nome: str = Field(..., min_length=1)


class ProdutoUpdate(ProdutoBase):
    nome: Optional[str] = None


class ProdutoOut(BaseModel):
    id: int
    nome: str
    descricao: Optional[str] = None
    categoria: Optional[str] = None
    modalidade_preco: Optional[ModalidadePreco] = None
    base_segundos: Optional[int] = None
    unidade_rotulo: Optional[str] = None
    valor_unitario: Optional[float] = None

    class Config:
        from_attributes = True
