# migrar_produtos_add_cols.py
from sqlalchemy import text
from app.database import engine

SQL_COLS = """
PRAGMA table_info(produtos);
"""

ALTERS = [
    ("descricao", "ALTER TABLE produtos ADD COLUMN descricao TEXT;"),
    ("valor_unitario", "ALTER TABLE produtos ADD COLUMN valor_unitario FLOAT;"),
]

def main():
    with engine.begin() as conn:
        # pega lista de colunas existentes
        cols = []
        res = conn.execute(text(SQL_COLS))
        for row in res:
            # PRAGMA table_info retorna: cid, name, type, notnull, dflt_value, pk
            cols.append(row[1])

        for col, ddl in ALTERS:
            if col not in cols:
                print(f"➕ Adicionando coluna '{col}'...")
                conn.execute(text(ddl))
            else:
                print(f"✔ Coluna '{col}' já existe. Pulando.")

    print("✅ Migração concluída.")

if __name__ == "__main__":
    main()
