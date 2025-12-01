# app/models.py
from datetime import datetime
from sqlalchemy.orm import relationship, foreign, remote
from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    Float,
    Date,
    Boolean,
    and_,
    DateTime,
)

# ✅ Base central
from app.models_base import Base


class Agencia(Base):
    __tablename__ = "agencias"

    id = Column(Integer, primary_key=True)
    nome_agencia = Column(String, nullable=False)
    razao_social_agencia = Column(String)
    cnpj_agencia = Column(String, unique=True, nullable=False)
    uf_agencia = Column(String)
    executivo = Column(String, nullable=False)
    email_agencia = Column(String)
    data_cadastro = Column(String)

    # === campos novos (básicos) ===
    grupo_empresarial = Column(String, nullable=True)
    codinome = Column(String, unique=True, index=True, nullable=True)
    site = Column(String, nullable=True)
    linkedin = Column(String, nullable=True)
    instagram = Column(String, nullable=True)

    # === campos novos (endereço / negócio / telefones) ===
    endereco = Column(String, nullable=True)  # complemento / observações
    logradouro = Column(String, nullable=True)
    bairro = Column(String, nullable=True)
    cep = Column(String, nullable=True)
    segmento = Column(String, nullable=True)
    subsegmento = Column(String, nullable=True)
    telefone_socio1 = Column(String, nullable=True)
    telefone_socio2 = Column(String, nullable=True)

    # relação com PI (tabela pis_cadastro)
    pis = relationship("PI", back_populates="agencia")


class Anunciante(Base):
    __tablename__ = "anunciantes"

    id = Column(Integer, primary_key=True)
    nome_anunciante = Column(String, nullable=False)
    razao_social_anunciante = Column(String)
    cnpj_anunciante = Column(String, unique=True, nullable=False)
    uf_cliente = Column(String)
    executivo = Column(String, nullable=False)
    email_anunciante = Column(String)
    data_cadastro = Column(String)

    # --- novos: endereço (cartão CNPJ / site) ---
    logradouro = Column(String, nullable=True)   # Rua / Avenida
    numero = Column(String, nullable=True)       # Número do endereço
    complemento = Column(String, nullable=True)  # Complemento do endereço oficial
    bairro = Column(String, nullable=True)
    municipio = Column(String, nullable=True)
    cep = Column(String, nullable=True)

    # campo mais genérico para complemento / observações / endereço alternativo
    endereco = Column(String, nullable=True)

    # --- novos: telefones do sócio / contato principal ---
    telefone_socio1 = Column(String, nullable=True)
    telefone_socio2 = Column(String, nullable=True)

    # --- novos: negócio / segmentação ---
    segmento = Column(String, nullable=True)
    subsegmento = Column(String, nullable=True)

    # --- novos: dados de negócio / digitais ---
    grupo_empresarial = Column(String, nullable=True)
    codinome = Column(String, unique=True, index=True, nullable=True)
    site = Column(String, nullable=True)
    linkedin = Column(String, nullable=True)
    instagram = Column(String, nullable=True)

    # relação com PI (tabela pis_cadastro)
    pis = relationship("PI", back_populates="anunciante")


class PI(Base):
    # 👇 aqui é a tabela REAL que você quer usar
    __tablename__ = "pis_cadastro"

    id = Column(Integer, primary_key=True)
    numero_pi = Column(String, nullable=False, unique=True)

    # Vinculação
    numero_pi_matriz = Column(
        String, nullable=True
    )  # usado se tipo_pi in {"Abatimento","Veiculação"}
    numero_pi_normal = Column(
        String, nullable=True
    )  # usado se tipo_pi == "CS"

    # Tipo de PI
    # "Matriz" | "Normal" | "CS" | "Abatimento" | "Veiculação"
    tipo_pi = Column(String, nullable=False)

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
    canal = Column(String)  # canal “macro” do PI (ok manter)
    perfil = Column(String)
    subperfil = Column(String)

    # Valores e datas (totais do PI)
    valor_bruto = Column(Float)  # pode ser somatório das veiculações
    valor_liquido = Column(Float)  # idem
    vencimento = Column(Date)
    data_emissao = Column(Date)

    observacoes = Column(String)

    agencia_id = Column(Integer, ForeignKey("agencias.id"))
    anunciante_id = Column(Integer, ForeignKey("anunciantes.id"))

    agencia = relationship("Agencia", back_populates="pis")
    anunciante = relationship("Anunciante", back_populates="pis")

    # Produtos relacionados (catálogo global pode existir sem PI; não apagar em cascata)
    produtos = relationship(
        "Produto",
        back_populates="pi",
        cascade="save-update, merge",
        passive_deletes=True,
    )

    # Veiculações deste PI (para consultas globais por PI)
    veiculacoes = relationship(
        "Veiculacao", back_populates="pi", cascade="all, delete-orphan"
    )

    # Entregas deste PI
    entregas = relationship(
        "Entrega", back_populates="pi", cascade="all, delete-orphan"
    )

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

    # NOVO: anexos (PDF do PI e Proposta)
    anexos = relationship(
        "PIAnexo", back_populates="pi", cascade="all, delete-orphan"
    )


class PIAnexo(Base):
    __tablename__ = "pi_anexos"

    id = Column(Integer, primary_key=True)
    pi_id = Column(
        Integer, ForeignKey("pis_cadastro.id", ondelete="CASCADE"), nullable=False
    )

    # tipo: "pi_pdf" ou "proposta_pdf"
    tipo = Column(String, nullable=False)
    filename = Column(String, nullable=False)  # nome original
    path = Column(String, nullable=False)      # caminho salvo (relativo/absoluto)
    mime = Column(String, nullable=True)
    size = Column(Integer, nullable=True)
    uploaded_at = Column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    pi = relationship("PI", back_populates="anexos")


class Produto(Base):
    __tablename__ = "produtos"

    id = Column(Integer, primary_key=True)
    nome = Column(String, nullable=False, unique=True)

    pi_id = Column(
        Integer, ForeignKey("pis_cadastro.id", ondelete="SET NULL"), nullable=True
    )

    descricao = Column(String, nullable=True)

    categoria = Column(String, nullable=True)
    modalidade_preco = Column(String, nullable=True)
    base_segundos = Column(Integer, nullable=True)
    unidade_rotulo = Column(String, nullable=True)

    pi = relationship("PI", back_populates="produtos")
    veiculacoes = relationship(
        "Veiculacao", back_populates="produto", cascade="all, delete-orphan"
    )


class Veiculacao(Base):
    __tablename__ = "veiculacoes"

    id = Column(Integer, primary_key=True)

    produto_id = Column(Integer, ForeignKey("produtos.id"))
    pi_id = Column(Integer, ForeignKey("pis_cadastro.id"))

    canal = Column(String, nullable=True)
    formato = Column(String, nullable=True)

    data_inicio = Column(String)  # "YYYY-MM-DD"
    data_fim = Column(String)     # "YYYY-MM-DD" ou None

    quantidade = Column(Integer)

    valor_bruto = Column(Float, nullable=True)
    desconto = Column(Float, nullable=True)  # percentual (0..100)
    valor_liquido = Column(Float, nullable=True)

    produto = relationship("Produto", back_populates="veiculacoes")
    pi = relationship("PI", back_populates="veiculacoes")
    entregas = relationship(
        "Entrega", back_populates="veiculacao", cascade="all, delete-orphan"
    )


class Entrega(Base):
    __tablename__ = "entregas"

    id = Column(Integer, primary_key=True)
    data_entrega = Column(Date, nullable=False)
    foi_entregue = Column(String, default="pendente")
    motivo = Column(String)

    veiculacao_id = Column(Integer, ForeignKey("veiculacoes.id"))
    pi_id = Column(Integer, ForeignKey("pis_cadastro.id"))

    veiculacao = relationship("Veiculacao", back_populates="entregas")
    pi = relationship("PI", back_populates="entregas")
