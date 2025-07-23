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

    # Identificação do PI
    pi_matriz = Column(String, nullable=True)
    numero_pi = Column(String, nullable=False)

    # Anunciante
    nome_anunciante = Column(String, nullable=False)
    razao_social_anunciante = Column(String, nullable=False)
    cnpj_anunciante = Column(String, nullable=False)
    uf_cliente = Column(String, nullable=True)

    # Agência
    nome_agencia = Column(String, nullable=True)
    razao_social_agencia = Column(String, nullable=True)
    cnpj_agencia = Column(String, nullable=True)
    uf_agencia = Column(String, nullable=True)

    # Campanha
    nome_campanha = Column(String, nullable=True)
    canal = Column(String, nullable=True)
    perfil_anunciante = Column(String, nullable=True)
    subperfil_anunciante = Column(String, nullable=True)

    # Datas
    mes_venda = Column(String, nullable=True)     # Ex: "07/2025"
    dia_venda = Column(String, nullable=True)     # Ex: "23"
    vencimento = Column(Date, nullable=True)
    data_emissao = Column(Date, nullable=False)

    # Responsáveis
    executivo = Column(String, default="")
    diretoria = Column(String, default="")

    # Valores
    valor_bruto = Column(Float, default=0.0)
    valor_liquido = Column(Float, default=0.0)

    # Observações
    observacoes = Column(String)

    # Relacionamento com veiculações
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
    entregas = relationship("Entrega", back_populates="veiculacao", cascade="all, delete-orphan")


class Entrega(Base):
    __tablename__ = 'entregas'

    id = Column(Integer, primary_key=True)
    veiculacao_id = Column(Integer, ForeignKey('veiculacoes.id'), nullable=False)
    data_entrega = Column(Date, nullable=False)
    foi_entregue = Column(String, default="Não")
    motivo = Column(String)

    veiculacao = relationship("Veiculacao", back_populates="entregas")
