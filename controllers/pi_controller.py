from app.database import SessionLocal
from app.models import PI
from datetime import date

def criar_pi(numero_pi: str, cliente: str, data_emissao: date, observacoes: str = ""):
    session = SessionLocal()
    try:
        novo = PI(numero_pi=numero_pi, cliente=cliente, data_emissao=data_emissao, observacoes=observacoes)
        session.add(novo)
        session.commit()
        print("PI cadastrada com sucesso!")
    except Exception as e:
        session.rollback()
        print("Erro ao cadastrar PI:", e)
    finally:
        session.close()

def listar_pis():
    session = SessionLocal()
    try:
        pis = session.query(PI).all()
        return pis
    finally:
        session.close()

def atualizar_pi(id_pi: int, novo_numero=None, novo_cliente=None, nova_data=None, nova_obs=None):
    session = SessionLocal()
    try:
        pi = session.query(PI).get(id_pi)
        if not pi:
            print("PI não encontrada.")
            return
        if novo_numero: pi.numero_pi = novo_numero
        if novo_cliente: pi.cliente = novo_cliente
        if nova_data: pi.data_emissao = nova_data
        if nova_obs: pi.observacoes = nova_obs
        session.commit()
        print("PI atualizada com sucesso.")
    except Exception as e:
        session.rollback()
        print("Erro ao atualizar PI:", e)
    finally:
        session.close()

def deletar_pi(id_pi: int):
    session = SessionLocal()
    try:
        pi = session.query(PI).get(id_pi)
        if not pi:
            print("PI não encontrada.")
            return
        session.delete(pi)
        session.commit()
        print("PI deletada com sucesso.")
    except Exception as e:
        session.rollback()
        print("Erro ao deletar PI:", e)
    finally:
        session.close()
