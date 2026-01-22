# app/database.py
import os
from pathlib import Path

from dotenv import load_dotenv

# ✅ Carrega o .env na raiz do projeto (ou no CWD atual)
# Se seu .env está em C:\Users\danie\sistema_veiculacoes\.env, isso resolve.
load_dotenv()

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models_base import Base  # NÃO importar models aqui em cima!

# Caminho base do projeto
BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "banco.db"

# Lê a URL do banco do .env
DATABASE_URL = os.getenv("DATABASE_URL")

# Decide qual engine usar
if DATABASE_URL:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
    )
    print(f"💾 Usando DATABASE_URL: {DATABASE_URL}")
else:
    engine = create_engine(
        f"sqlite:///{DB_PATH}",
        echo=False,
        connect_args={"check_same_thread": False},
    )
    print(f"⚠️ DATABASE_URL não definido. Usando SQLite em {DB_PATH}")

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def init_db():
    # Importa models só aqui pra evitar import circular
    import app.models  # noqa: F401
    import app.models_auth  # noqa: F401

    # Cria as tabelas que ainda não existirem
    Base.metadata.create_all(bind=engine)


if __name__ == "__main__":
    if not DATABASE_URL:
        if DB_PATH.exists():
            DB_PATH.unlink()
            print("🧨 Removido:", DB_PATH)
        init_db()
        print("✅ Banco SQLite criado em:", DB_PATH)
    else:
        print("⚠️ DATABASE_URL está definido. Não faz sentido apagar arquivo SQLite aqui.")
