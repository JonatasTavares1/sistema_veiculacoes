# app/models.py
from sqlalchemy.orm import relationship, foreign, remote
from sqlalchemy import Column, Integer, String, ForeignKey, Float, Date, Boolean, and_

# ✅ Use sempre o Base central (removido o import duplicado)
from app.models_base import Base


class Agencia(Base):
    __tablename__ = 'agencias'

    id = Column(Integer, primary_key=True)
    nome_agencia = Column(String, nullable=False)
    razao_social_agencia = Column(String)
    cnpj_agencia = Column(String, unique=True, nullable=False)
    uf_agencia = Column(String)
    executivo = Column(String, nullable=False)
    email_agencia = Column(String)
    data_cadastro = Column(String)

    pis = relationship("PI", back_populates="agencia")


class Anunciante(Base):
    __tablename__ = 'anunciantes'

    id = Column(Integer, primary_key=True)
    nome_anunciante = Column(String, nullable=False)
    razao_social_anunciante = Column(String)
    cnpj_anunciante = Column(String, unique=True, nullable=False)
    uf_cliente = Column(String)
    executivo = Column(String, nullable=False)
    email_anunciante = Column(String)
    data_cadastro = Column(String)

    pis = relationship("PI", back_populates="anunciante")


class PI(Base):
    __tablename__ = 'pis'

    id = Column(Integer, primary_key=True)
    numero_pi = Column(String, nullable=False, unique=True)

    # Vinculação
    numero_pi_matriz = Column(String, nullable=True)   # usado se tipo_pi == "Abatimento"
    numero_pi_normal = Column(String, nullable=True)   # usado se tipo_pi == "CS"

    # Tipo de PI
    tipo_pi = Column(String, nullable=False)  # "Matriz" | "Normal" | "CS" | "Abatimento"

    # Anunciante
    nome_anunciante = Column(String)
    razao_social_anunciante = Column(String)
    cnpj_anunciante = Column(String)
    uf_cliente = Column(String)

    # Agência
    nome_agencia = Column(String)
    razao_social_agencia = Column(String)
    cnpj_agencia = Column(String)
    uf_agencia = Column(String)

    # Responsáveis
    executivo = Column(String)
    diretoria = Column(String)

    # Campanha
    nome_campanha = Column(String)
    mes_venda = Column(String)
    dia_venda = Column(String)
    canal = Column(String)
    perfil = Column(String)
    subperfil = Column(String)

    # Valores e datas (totais do PI)
    valor_bruto = Column(Float)     # pode ser somatório das veiculações
    valor_liquido = Column(Float)   # idem
    vencimento = Column(Date)
    data_emissao = Column(Date)

    observacoes = Column(String)

    agencia_id = Column(Integer, ForeignKey('agencias.id'))
    anunciante_id = Column(Integer, ForeignKey('anunciantes.id'))

    agencia = relationship("Agencia", back_populates="pis")
    anunciante = relationship("Anunciante", back_populates="pis")

    # Veiculações deste PI
    veiculacoes = relationship("Veiculacao", back_populates="pi", cascade="all, delete-orphan")
    # Entregas deste PI
    entregas = relationship("Entrega", back_populates="pi", cascade="all, delete-orphan")

    eh_matriz = Column(Boolean, default=False, nullable=False)

    # Relacionamentos filhos (viewonly) por número de PI
    filhos_abatimento = relationship(
        "PI",
        primaryjoin=and_(
            foreign(numero_pi_matriz) == remote(numero_pi),
            tipo_pi == "Abatimento",
        ),
        viewonly=True,
    )
    filhos_cs = relationship(
        "PI",
        primaryjoin=and_(
            foreign(numero_pi_normal) == remote(numero_pi),
            tipo_pi == "CS",
        ),
        viewonly=True,
    )


class Produto(Base):
    __tablename__ = 'produtos'

    id = Column(Integer, primary_key=True)
    nome = Column(String, nullable=False)

    # Catálogo (sem preço!)
    descricao = Column(String, nullable=True)

    # 🔻 Removido: valor_unitario (preço não fica mais no produto)
    # valor_unitario = Column(Float, nullable=True)

    # Metadados de catálogo
    categoria = Column(String, nullable=True)           # ex.: PORTAL, PAINEL, RÁDIO...
    modalidade_preco = Column(String, nullable=True)    # ex.: DIARIA, SEMANAL, CPM, MENSAL...
    base_segundos = Column(Integer, nullable=True)      # ex.: 30, 60 (rádio/testemunhal/spot)
    unidade_rotulo = Column(String, nullable=True)      # ex.: "dia", "semana", "quinzena", "mês", "CPM", "spot"

    # veiculações que usam este produto
    veiculacoes = relationship("Veiculacao", back_populates="produto")


class Veiculacao(Base):
    __tablename__ = 'veiculacoes'

    id = Column(Integer, primary_key=True)

    produto_id = Column(Integer, ForeignKey('produtos.id'))
    pi_id = Column(Integer, ForeignKey('pis.id'))

    # Período (strings por compatibilidade com seu CRUD atual)
    data_inicio = Column(String)
    data_fim = Column(String)

    # Métrica de contratação
    quantidade = Column(Integer)  # dias, semanas, spots, impressões etc.

    # 💰 Preço agora é 100% aqui na veiculação
    # Interpretando:
    # - valor_bruto: total bruto da veiculação (já considerando quantidade)
    # - desconto: percentual 0..100 aplicado sobre o bruto
    # - valor_liquido: resultado pós-desconto
    valor_bruto = Column(Float, nullable=True)
    desconto = Column(Float, nullable=True)        # armazenar como percentual (0..100)
    valor_liquido = Column(Float, nullable=True)

    # 🔻 Removidos: campos de preço herdado
    # valor_unitario = Column(Float)
    # valor_total = Column(Float)

    # relacionamentos
    produto = relationship("Produto", back_populates="veiculacoes")
    pi = relationship("PI", back_populates="veiculacoes")
    entregas = relationship("Entrega", back_populates="veiculacao", cascade="all, delete-orphan")


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
