from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Base

# Caminho do banco (relativo à pasta onde está o script)
engine = create_engine("sqlite:///app/banco.db", echo=False)

# Cria as tabelas no banco
def init_db():
    Base.metadata.create_all(engine)

# Sessão de acesso ao banco
SessionLocal = sessionmaker(bind=engine)
if __name__ == "__main__":
    import os

    caminho_banco = "app/banco.db"

    if os.path.exists(caminho_banco):
        os.remove(caminho_banco)
        print("🧨 Banco de dados antigo removido com sucesso.")
    else:
        print("ℹ️ Banco de dados não encontrado. Criando novo...")

    init_db()
    print("✅ Banco de dados recriado com sucesso.")
