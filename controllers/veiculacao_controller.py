from app.database import SessionLocal
from app.models import Veiculacao, Produto, PI
from sqlalchemy.orm import joinedload


def criar_veiculacao(produto_id: int, data_inicio: str, data_fim: str, pi_id: int):
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
            data_inicio=data_inicio,
            data_fim=data_fim,
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
    session = SessionLocal()
    try:
        veiculacoes = session.query(Veiculacao)\
            .options(joinedload(Veiculacao.produto), joinedload(Veiculacao.pi))\
            .all()
        return veiculacoes
    except Exception as e:
        print(f"Erro ao listar veiculações: {e}")
        return []
    finally:
        session.close()


def excluir_veiculacao(id_veiculacao: int):
    session = SessionLocal()
    try:
        veiculacao = session.query(Veiculacao).get(id_veiculacao)
        if not veiculacao:
            print("Veiculação não encontrada.")
            return
        session.delete(veiculacao)
        session.commit()
        print("Veiculação removida com sucesso.")
    except Exception as e:
        session.rollback()
        print("Erro ao deletar veiculação:", e)
    finally:
        session.close()
