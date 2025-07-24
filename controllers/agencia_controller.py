from app.models import Agencia
from app.database import SessionLocal
import requests

def criar_agencia(nome, razao_social, cnpj, uf):
    db = SessionLocal()
    try:
        nova = Agencia(
            nome=nome,
            razao_social=razao_social,
            cnpj=cnpj,
            uf=uf
        )
        db.add(nova)
        db.commit()
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()

def buscar_agencia_por_cnpj(cnpj):
    db = SessionLocal()
    try:
        return db.query(Agencia).filter_by(cnpj=cnpj).first()
    finally:
        db.close()

def buscar_agencia_por_nome(nome):
    db = SessionLocal()
    try:
        return db.query(Agencia).filter(Agencia.nome.ilike(f"%{nome}%")).all()
    finally:
        db.close()

def listar_agencias():
    db = SessionLocal()
    try:
        return db.query(Agencia).all()
    finally:
        db.close()

def excluir_agencia_por_cnpj(cnpj):
    db = SessionLocal()
    try:
        agencia = db.query(Agencia).filter_by(cnpj=cnpj).first()
        if agencia:
            db.delete(agencia)
            db.commit()
            return True
        return False
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()
def buscar_cnpj_na_web(cnpj):
    try:
        cnpj_limpo = ''.join(filter(str.isdigit, cnpj))
        url = f"https://brasilapi.com.br/api/cnpj/v1/{cnpj_limpo}"
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            return response.json()
        else:
            return None
    except Exception as e:
        print(f"[ERRO] buscar_cnpj_na_web: {e}")
        return None