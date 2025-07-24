# controllers/executivo_controller.py
from app.database import SessionLocal
from app.models import Agencia, Anunciante

EXECUTIVOS = [
    "Rafale e Francio",
    "Rafael Rodrigo",
    "Rodrigo da Silva",
    "Juliana Madazio",
    "Flavio de Paula",
    "Lorena Fernandes",
    "Henri Marques",
    "Caio Bruno",
    "Flavia Cabral",
    "Paula Caroline",
    "Leila Santos",
    "Jessica Ribeiro",
    "Paula Campos"
]

def listar_executivos():
    return EXECUTIVOS

def buscar_por_executivo(nome_executivo):
    session = SessionLocal()
    agencias = session.query(Agencia).filter(Agencia.executivo == nome_executivo).all()
    anunciantes = session.query(Anunciante).filter(Anunciante.executivo == nome_executivo).all()
    session.close()
    return agencias, anunciantes
