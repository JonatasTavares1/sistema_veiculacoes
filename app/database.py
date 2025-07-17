from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .models import Base

# Caminho do banco (relativo à pasta onde está o script)
engine = create_engine("sqlite:///app/banco.db", echo=False)

# Cria as tabelas no banco
def init_db():
    Base.metadata.create_all(engine)

# Sessão de acesso ao banco
SessionLocal = sessionmaker(bind=engine)
