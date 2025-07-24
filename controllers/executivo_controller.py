from app.models import Agencia, Anunciante
from app.database import SessionLocal

def listar_executivos():
    session = SessionLocal()
    executivos_agencias = session.query(Agencia.executivo).distinct().all()
    executivos_anunciantes = session.query(Anunciante.executivo).distinct().all()
    session.close()

    # Junta e remove duplicados
    executivos = {e[0] for e in executivos_agencias + executivos_anunciantes}
    return list(executivos)

def buscar_por_executivo(nome_executivo, tipo):
    session = SessionLocal()
    resultados = []

    if tipo == "Agência":
        agencias = session.query(Agencia).filter(Agencia.executivo == nome_executivo).all()
        for a in agencias:
            resultados.append({
                "ID": a.id,
                "Nome": a.nome_agencia,
                "Razão Social": a.razao_social_agencia,
                "CNPJ": a.cnpj_agencia,
                "UF": a.uf_agencia
            })
    elif tipo == "Anunciante":
        anunciantes = session.query(Anunciante).filter(Anunciante.executivo == nome_executivo).all()
        for a in anunciantes:
            resultados.append({
                "ID": a.id,
                "Nome": a.nome_anunciante,
                "Razão Social": a.razao_social_anunciante,
                "CNPJ": a.cnpj_anunciante,
                "UF": a.uf_cliente
            })

    session.close()
    return resultados
