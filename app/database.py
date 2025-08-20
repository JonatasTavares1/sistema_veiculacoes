from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models_base import Base  # <- NÃO importar models aqui em cima!

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "banco.db"

engine = create_engine(
    f"sqlite:///{DB_PATH}",
    echo=False,
    connect_args={"check_same_thread": False},  # essencial no FastAPI + SQLite
)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

def init_db():
    import app.models  # registra tabelas sem criar ciclo
    Base.metadata.create_all(engine)

if __name__ == "__main__":
    if DB_PATH.exists():
        DB_PATH.unlink()
        print("🧨 Removido:", DB_PATH)
    init_db()
    print("✅ Banco criado em:", DB_PATH)
