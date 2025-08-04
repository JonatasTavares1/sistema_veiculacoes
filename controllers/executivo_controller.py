from app.models import Agencia, Anunciante
from app.database import SessionLocal

def listar_executivos():
    session = SessionLocal()
    try:
        # Busca executivos distintos das duas tabelas
        executivos_agencias = session.query(Agencia.executivo).filter(Agencia.executivo.isnot(None)).distinct().all()
        executivos_anunciantes = session.query(Anunciante.executivo).filter(Anunciante.executivo.isnot(None)).distinct().all()
        
        # Junta e remove duplicatas
        todos = {e[0] for e in executivos_agencias + executivos_anunciantes if e[0]}
        return sorted(todos)
    finally:
        session.close()

def buscar_por_executivo(nome_executivo, tipo):
    session = SessionLocal()
    resultados = []

    try:
        if tipo == "Agência":
            query = session.query(Agencia)
            if nome_executivo:
                query = query.filter(Agencia.executivo == nome_executivo)
            agencias = query.all()
            for a in agencias:
                resultados.append({
                    "ID": a.id,
                    "Nome": a.nome_agencia,
                    "Razão Social": a.razao_social_agencia,
                    "CNPJ": a.cnpj_agencia,
                    "UF": a.uf_agencia,
                    "Executivo": a.executivo
                })
        elif tipo == "Anunciante":
            query = session.query(Anunciante)
            if nome_executivo:
                query = query.filter(Anunciante.executivo == nome_executivo)
            anunciantes = query.all()
            for a in anunciantes:
                resultados.append({
                    "ID": a.id,
                    "Nome": a.nome_anunciante,
                    "Razão Social": a.razao_social_anunciante,
                    "CNPJ": a.cnpj_anunciante,
                    "UF": a.uf_cliente,
                    "Executivo": a.executivo
                })
        return resultados
    finally:
        session.close()

def editar_registro(tipo, item_id, novos_dados):
    session = SessionLocal()
    try:
        if tipo == "Agência":
            registro = session.query(Agencia).filter_by(id=item_id).first()
            registro.nome_agencia = novos_dados["Nome"]
            registro.razao_social_agencia = novos_dados["Razão Social"]
            registro.cnpj_agencia = novos_dados["CNPJ"]
            registro.uf_agencia = novos_dados["UF"]
        elif tipo == "Anunciante":
            registro = session.query(Anunciante).filter_by(id=item_id).first()
            registro.nome_anunciante = novos_dados["Nome"]
            registro.razao_social_anunciante = novos_dados["Razão Social"]
            registro.cnpj_anunciante = novos_dados["CNPJ"]
            registro.uf_cliente = novos_dados["UF"]

        session.commit()
        return True
    except Exception as e:
        print("Erro ao editar:", e)
        session.rollback()
        return False
    finally:
        session.close()
