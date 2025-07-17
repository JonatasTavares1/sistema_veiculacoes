from app.database import SessionLocal
from app.models import Veiculacao, Produto, PI
from datetime import date

def criar_veiculacao(produto_id: int, quantidade: int, desconto: float,
                     data_veiculacao: date, pi_id: int):
    session = SessionLocal()
    try:
        # Verifica se Produto e PI existem
        produto = session.query(Produto).get(produto_id)
        pi = session.query(PI).get(pi_id)
        if not produto:
            print("Produto não encontrado.")
            return
        if not pi:
            print("PI não encontrada.")
            return

        nova = Veiculacao(
            produto_id=produto_id,
            quantidade=quantidade,
            desconto_aplicado=desconto,
            data_veiculacao=data_veiculacao,
            pi_id=pi_id
        )
        session.add(nova)
        session.commit()
        print("Veiculação cadastrada com sucesso!")
    except Exception as e:
        session.rollback()
        print("Erro ao cadastrar veiculação:", e)
    finally:
        session.close()


def listar_veiculacoes():
    try:
        db = SessionLocal()
        veiculacoes = db.query(Veiculacao).all()
        return veiculacoes
    except Exception as e:
        print(f"Erro ao listar veiculações: {e}")
        return []  # <- IMPORTANTE: retorna lista vazia se erro
    finally:
        db.close()


def deletar_veiculacao(id_veiculacao: int):
    session = SessionLocal()
    try:
        v = session.query(Veiculacao).get(id_veiculacao)
        if not v:
            print("Veiculação não encontrada.")
            return
        session.delete(v)
        session.commit()
        print("Veiculação removida com sucesso.")
    except Exception as e:
        session.rollback()
        print("Erro ao deletar veiculação:", e)
    finally:
        session.close()
