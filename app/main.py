from .database import init_db

if __name__ == "__main__":
    init_db()
    print("Banco de dados criado com sucesso em 'app/banco.db'!")
