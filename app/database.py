# app/database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Base

engine = create_engine("sqlite:///app/banco.db", echo=False)

def init_db():
    Base.metadata.create_all(engine)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Remova a linha: session = SessionLocal()
# E mantenha o bloco __main__ se você usa para recriar o banco manualmente
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
