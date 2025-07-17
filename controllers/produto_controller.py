from app.database import SessionLocal
from app.models import Produto

def criar_produto(nome: str, descricao: str, valor_unitario: float):
    session = SessionLocal()
    try:
        novo = Produto(nome=nome, descricao=descricao, valor_unitario=valor_unitario)
        session.add(novo)
        session.commit()
        print("Produto cadastrado com sucesso!")
    except Exception as e:
        session.rollback()
        print("Erro ao cadastrar produto:", e)
    finally:
        session.close()

def listar_produtos():
    session = SessionLocal()
    try:
        produtos = session.query(Produto).all()
        return produtos
    finally:
        session.close()

def atualizar_produto(id_produto: int, novo_nome=None, nova_desc=None, novo_valor=None):
    session = SessionLocal()
    try:
        produto = session.query(Produto).get(id_produto)
        if not produto:
            print("Produto não encontrado.")
            return
        if novo_nome: produto.nome = novo_nome
        if nova_desc: produto.descricao = nova_desc
        if novo_valor is not None: produto.valor_unitario = novo_valor
        session.commit()
        print("Produto atualizado com sucesso.")
    except Exception as e:
        session.rollback()
        print("Erro ao atualizar produto:", e)
    finally:
        session.close()

def deletar_produto(id_produto: int):
    session = SessionLocal()
    try:
        produto = session.query(Produto).get(id_produto)
        if not produto:
            print("Produto não encontrado.")
            return
        session.delete(produto)
        session.commit()
        print("Produto removido com sucesso.")
    except Exception as e:
        session.rollback()
        print("Erro ao deletar produto:", e)
    finally:
        session.close()
