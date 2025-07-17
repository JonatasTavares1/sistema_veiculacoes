from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class Produto(Base):
    __tablename__ = 'produtos'

    id = Column(Integer, primary_key=True)
    nome = Column(String, nullable=False)
    descricao = Column(String)
    valor_unitario = Column(Float, nullable=False)

    veiculacoes = relationship("Veiculacao", back_populates="produto")

class PI(Base):
    __tablename__ = 'pis'

    id = Column(Integer, primary_key=True)
    numero_pi = Column(String, nullable=False)
    cliente = Column(String, nullable=False)
    data_emissao = Column(Date, nullable=False)
    observacoes = Column(String)

    # Novos campos conforme modelo de PI
    tipo = Column(String)             # Ex: institucional, promocional
    praca = Column(String)           # Ex: Brasília/DF
    meio = Column(String)            # Ex: digital, jornal, etc.
    titulo_peca = Column(String)     # Nome da peça
    colocacao = Column(String)       # Onde será veiculado
    formato = Column(String)         # Ex: 1080x1920, 1/2 página
    valor_bruto = Column(Float)      # Valor total
    comissao = Column(Float)         # Comissão de agência
    valor_liquido = Column(Float)    # Valor líquido final

    veiculacoes = relationship("Veiculacao", back_populates="pi")

class Veiculacao(Base):
    __tablename__ = 'veiculacoes'

    id = Column(Integer, primary_key=True)
    produto_id = Column(Integer, ForeignKey('produtos.id'), nullable=False)
    quantidade = Column(Integer, nullable=False)
    desconto_aplicado = Column(Float, default=0.0)
    data_veiculacao = Column(Date, nullable=False)
    pi_id = Column(Integer, ForeignKey('pis.id'), nullable=False)

    produto = relationship("Produto", back_populates="veiculacoes")
    pi = relationship("PI", back_populates="veiculacoes")
