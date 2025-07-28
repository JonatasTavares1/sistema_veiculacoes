from app.database import SessionLocal
from app.models import PI
from datetime import date

# Função para criar um novo PI
def criar_pi(
    numero_pi: str,
    numero_pi_matriz: str,
    nome_anunciante: str,
    razao_social_anunciante: str,
    cnpj_anunciante: str,
    uf_cliente: str,
    executivo: str,
    diretoria: str,
    nome_campanha: str,
    nome_agencia: str,
    razao_social_agencia: str,
    cnpj_agencia: str,
    uf_agencia: str,
    mes_venda: str,
    dia_venda: str,
    canal: str,
    perfil_anunciante: str,
    subperfil_anunciante: str,
    valor_bruto: float,
    valor_liquido: float,
    vencimento: date,
    data_emissao: date,
    observacoes: str = ""
):
    session = SessionLocal()
    try:
        # Verifica se já existe um PI com esse número
        pi_existente = session.query(PI).filter_by(numero_pi=numero_pi).first()
        if pi_existente:
            raise ValueError(f"O PI '{numero_pi}' já está cadastrado.")

        novo_pi = PI(
            numero_pi=numero_pi,
            numero_pi_matriz=numero_pi_matriz,
            nome_anunciante=nome_anunciante,
            razao_social_anunciante=razao_social_anunciante,
            cnpj_anunciante=cnpj_anunciante,
            uf_cliente=uf_cliente,
            executivo=executivo,
            diretoria=diretoria,
            nome_campanha=nome_campanha,
            nome_agencia=nome_agencia,
            razao_social_agencia=razao_social_agencia,
            cnpj_agencia=cnpj_agencia,
            uf_agencia=uf_agencia,
            mes_venda=mes_venda,
            dia_venda=dia_venda,
            canal=canal,
            perfil=perfil_anunciante,
            subperfil=subperfil_anunciante,
            valor_bruto=valor_bruto,
            valor_liquido=valor_liquido,
            vencimento=vencimento,
            data_emissao=data_emissao,
            observacoes=observacoes
        )

        session.add(novo_pi)
        session.commit()
        print("✅ PI cadastrado com sucesso!")

    except Exception as e:
        session.rollback()
        print(f"❌ Erro ao cadastrar PI: {e}")
        raise

    finally:
        session.close()


# Função para listar todos os PIs
def listar_pis():
    session = SessionLocal()
    try:
        return session.query(PI).order_by(PI.numero_pi.desc()).all()
    except Exception as e:
        print(f"❌ Erro ao listar PIs: {e}")
        return []
    finally:
        session.close()


# Filtrar por executivo
def listar_pis_por_executivo(executivo: str):
    session = SessionLocal()
    try:
        return session.query(PI).filter(PI.executivo == executivo).order_by(PI.numero_pi.desc()).all()
    except Exception as e:
        print(f"❌ Erro ao listar PIs por executivo: {e}")
        return []
    finally:
        session.close()


# Filtrar por diretoria
def listar_pis_por_diretoria(diretoria: str):
    session = SessionLocal()
    try:
        return session.query(PI).filter(PI.diretoria == diretoria).order_by(PI.numero_pi.desc()).all()
    except Exception as e:
        print(f"❌ Erro ao listar PIs por diretoria: {e}")
        return []
    finally:
        session.close()


# Listar PIs que são matriz (ou seja, que foram marcados como tal e podem receber PIs filhos)
def listar_pis_matriz_ativos():
    session = SessionLocal()
    try:
        # Retorna PIs que não estão vinculados a nenhum PI matriz
        return session.query(PI).filter((PI.numero_pi_matriz == "") | (PI.numero_pi_matriz == None)).order_by(PI.numero_pi.desc()).all()
    except Exception as e:
        print(f"❌ Erro ao listar PIs matriz: {e}")
        return []
    finally:
        session.close()
