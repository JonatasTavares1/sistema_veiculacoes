from sqlalchemy.orm import declarative_base
Base = declarative_base()

from sqlalchemy import Column, Integer, String, ForeignKey, Float
from sqlalchemy.orm import relationship

class Agencia(Base):
    __tablename__ = 'agencias'

    id = Column(Integer, primary_key=True)
    nome_agencia = Column(String, nullable=False)
    razao_social_agencia = Column(String)
    cnpj_agencia = Column(String, unique=True, nullable=False)
    uf_agencia = Column(String)
    executivo = Column(String, nullable=False)

    pis = relationship("PI", back_populates="agencia")


class Anunciante(Base):
    __tablename__ = 'anunciantes'

    id = Column(Integer, primary_key=True)
    nome_anunciante = Column(String, nullable=False)
    razao_social_anunciante = Column(String)
    cnpj_anunciante = Column(String, unique=True, nullable=False)
    uf_cliente = Column(String)
    executivo = Column(String, nullable=False)

    pis = relationship("PI", back_populates="anunciante")


class PI(Base):
    __tablename__ = 'pis'

    id = Column(Integer, primary_key=True)
    numero_pi = Column(String, nullable=False)
    numero_pi_matriz = Column(String)
    nome_campanha = Column(String)
    mes_venda = Column(String)
    dia_venda = Column(String)
    canal = Column(String)
    perfil = Column(String)
    subperfil = Column(String)
    valor_bruto = Column(Float)
    valor_liquido = Column(Float)
    vencimento = Column(String)
    data_emissao = Column(String)
    observacoes = Column(String)

    agencia_id = Column(Integer, ForeignKey('agencias.id'))
    anunciante_id = Column(Integer, ForeignKey('anunciantes.id'))

    agencia = relationship("Agencia", back_populates="pis")
    anunciante = relationship("Anunciante", back_populates="pis")
    veiculacoes = relationship("Veiculacao", back_populates="pi")


class Produto(Base):
    __tablename__ = 'produtos'

    id = Column(Integer, primary_key=True)
    nome = Column(String, nullable=False)


class Veiculacao(Base):
    __tablename__ = 'veiculacoes'

    id = Column(Integer, primary_key=True)
    produto = Column(String)
    data_inicio = Column(String)
    data_fim = Column(String)
    quantidade = Column(Integer)
    valor_unitario = Column(Float)
    desconto = Column(Float)
    valor_total = Column(Float)

    pi_id = Column(Integer, ForeignKey('pis.id'))
    pi = relationship("PI", back_populates="veiculacoes")


class Entrega(Base):
    __tablename__ = 'entregas'

    id = Column(Integer, primary_key=True)
    produto = Column(String, nullable=False)
    data_entrega = Column(String, nullable=False)
    status = Column(String, default="pendente")  # ou entregue

    pi_id = Column(Integer, ForeignKey('pis.id'))
    pi = relationship("PI", backref="entregas")    
