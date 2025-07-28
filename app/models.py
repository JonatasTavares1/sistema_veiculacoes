from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy import Column, Integer, String, ForeignKey, Float, Date

Base = declarative_base()

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
    numero_pi = Column(String, nullable=False, unique=True)
    numero_pi_matriz = Column(String, nullable=True)  # Armazena o número do PI matriz

    # ✅ Novos campos adicionados aqui 👇
    nome_anunciante = Column(String)
    razao_social_anunciante = Column(String)
    cnpj_anunciante = Column(String)
    uf_cliente = Column(String)
    nome_agencia = Column(String)
    razao_social_agencia = Column(String)
    cnpj_agencia = Column(String)
    uf_agencia = Column(String)
    executivo = Column(String)
    diretoria = Column(String)

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
    entregas = relationship("Entrega", back_populates="pi")

    filhos = relationship(
        "PI",
        primaryjoin="PI.numero_pi==foreign(PI.numero_pi_matriz)",
        viewonly=True
    )


class Produto(Base):
    __tablename__ = 'produtos'

    id = Column(Integer, primary_key=True)
    nome = Column(String, nullable=False)

    veiculacoes = relationship("Veiculacao", back_populates="produto")


class Veiculacao(Base):
    __tablename__ = 'veiculacoes'

    id = Column(Integer, primary_key=True)
    produto_id = Column(Integer, ForeignKey('produtos.id'))
    data_inicio = Column(String)
    data_fim = Column(String)
    quantidade = Column(Integer)
    valor_unitario = Column(Float)
    desconto = Column(Float)
    valor_total = Column(Float)

    pi_id = Column(Integer, ForeignKey('pis.id'))

    produto = relationship("Produto", back_populates="veiculacoes")
    pi = relationship("PI", back_populates="veiculacoes")
    entregas = relationship("Entrega", back_populates="veiculacao")


class Entrega(Base):
    __tablename__ = 'entregas'

    id = Column(Integer, primary_key=True)
    data_entrega = Column(Date, nullable=False)
    foi_entregue = Column(String, default="pendente")
    motivo = Column(String)

    veiculacao_id = Column(Integer, ForeignKey('veiculacoes.id'))
    pi_id = Column(Integer, ForeignKey('pis.id'))

    veiculacao = relationship("Veiculacao", back_populates="entregas")
    pi = relationship("PI", back_populates="entregas")
