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

class Anunciante(Base):
    __tablename__ = 'anunciantes'

    id = Column(Integer, primary_key=True)
    nome_anunciante = Column(String, nullable=False)
    razao_social_anunciante = Column(String)
    cnpj_anunciante = Column(String, unique=True, nullable=False)
    uf_cliente = Column(String)

    pis = relationship("PI", back_populates="anunciante")


class Agencia(Base):
    __tablename__ = 'agencias'

    id = Column(Integer, primary_key=True)
    nome_agencia = Column(String, nullable=False)
    razao_social_agencia = Column(String)
    cnpj_agencia = Column(String, unique=True, nullable=False)
    uf_agencia = Column(String)

    pis = relationship("PI", back_populates="agencia")


class PI(Base):
    __tablename__ = 'pis'

    numero_pi = Column(String, primary_key=True)  # PI será a chave primária
    pi_matriz = Column(String)

    # Relacionamento com Anunciante
    anunciante_id = Column(Integer, ForeignKey('anunciantes.id'), nullable=False)
    anunciante = relationship("Anunciante", back_populates="pis")

    # Relacionamento com Agência
    agencia_id = Column(Integer, ForeignKey('agencias.id'), nullable=False)
    agencia = relationship("Agencia", back_populates="pis")

    nome_campanha = Column(String)
    canal = Column(String)
    perfil_anunciante = Column(String)
    subperfil_anunciante = Column(String)

    mes_venda = Column(String)
    dia_venda = Column(String)
    vencimento = Column(Date)
    data_emissao = Column(Date)

    executivo = Column(String)
    diretoria = Column(String)
    valor_bruto = Column(Float)
    valor_liquido = Column(Float)

    observacoes = Column(String)

    veiculacoes = relationship("Veiculacao", back_populates="pi", cascade="all, delete-orphan")

class Veiculacao(Base):
    __tablename__ = 'veiculacoes'

    id = Column(Integer, primary_key=True)
    produto_id = Column(Integer, ForeignKey('produtos.id'), nullable=False)
    quantidade = Column(Integer, nullable=False)
    desconto_aplicado = Column(Float, default=0.0)
    data_veiculacao = Column(Date, nullable=False)
    pi_id = Column(String, ForeignKey('pis.numero_pi'), nullable=False)

    produto = relationship("Produto", back_populates="veiculacoes")
    pi = relationship("PI", back_populates="veiculacoes")
    entregas = relationship("Entrega", back_populates="veiculacao", cascade="all, delete-orphan")

class Entrega(Base):
    __tablename__ = 'entregas'

    id = Column(Integer, primary_key=True)
    veiculacao_id = Column(Integer, ForeignKey('veiculacoes.id'), nullable=False)
    data_entrega = Column(Date, nullable=False)
    foi_entregue = Column(String, default="Não")
    motivo = Column(String)

    veiculacao = relationship("Veiculacao", back_populates="entregas")
