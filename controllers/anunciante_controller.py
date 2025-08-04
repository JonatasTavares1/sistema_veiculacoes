from app.models import Anunciante
from app.database import SessionLocal
import requests

def criar_anunciante(nome, razao_social, cnpj, uf, executivo, email, data_cadastro):
    db = SessionLocal()
    try:
        novo = Anunciante(
            nome_anunciante=nome,
            razao_social_anunciante=razao_social,
            cnpj_anunciante=cnpj,
            uf_cliente=uf,
            executivo=executivo,
            email_anunciante=email,
            data_cadastro=data_cadastro
        )
        db.add(novo)
        db.commit()
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()

def buscar_anunciante_por_cnpj(cnpj):
    db = SessionLocal()
    try:
        return db.query(Anunciante).filter_by(cnpj_anunciante=cnpj).first()
    finally:
        db.close()

def buscar_anunciante_por_nome(nome):
    db = SessionLocal()
    try:
        return db.query(Anunciante).filter(Anunciante.nome_anunciante.ilike(f"%{nome}%")).all()
    finally:
        db.close()

def listar_anunciantes():
    db = SessionLocal()
    try:
        return db.query(Anunciante).all()
    finally:
        db.close()

def excluir_anunciante_por_cnpj(cnpj):
    db = SessionLocal()
    try:
        anunciante = db.query(Anunciante).filter_by(cnpj_anunciante=cnpj).first()
        if anunciante:
            db.delete(anunciante)
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
