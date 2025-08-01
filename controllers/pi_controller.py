from app.database import SessionLocal
from app.models import PI
from datetime import datetime
from sqlalchemy import func  # necessário para comparação case-insensitive

# Função para criar um novo PI
def criar_pi(
    numero_pi: str,
    tipo_pi: str,
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
    vencimento,
    data_emissao,
    observacoes: str = ""
):
    session = SessionLocal()
    try:
        if isinstance(vencimento, str):
            vencimento = datetime.strptime(vencimento, "%d/%m/%Y").date()
        if isinstance(data_emissao, str):
            data_emissao = datetime.strptime(data_emissao, "%d/%m/%Y").date()

        pi_existente = session.query(PI).filter_by(numero_pi=numero_pi).first()
        if pi_existente:
            raise ValueError(f"O PI '{numero_pi}' já está cadastrado.")

        eh_matriz = tipo_pi == "Matriz"

        novo_pi = PI(
            numero_pi=numero_pi,
            tipo_pi=tipo_pi,
            numero_pi_matriz=None if numero_pi_matriz == "" else numero_pi_matriz,
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
            eh_matriz=eh_matriz,
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


# Listar PIs por período de venda
def listar_pis_por_data(dia: str, mes: str):
    session = SessionLocal()
    try:
        return session.query(PI).filter(PI.dia_venda == dia, PI.mes_venda == mes).order_by(PI.numero_pi.desc()).all()
    except Exception as e:
        print(f"❌ Erro ao filtrar por data: {e}")
        return []
    finally:
        session.close()


# Listar PIs do tipo "Matriz" (para vincular com CS)
def listar_pis_matriz_ativos():
    session = SessionLocal()
    try:
        resultados = session.query(PI).filter(func.lower(PI.tipo_pi) == "matriz").order_by(PI.numero_pi.desc()).all()
        print("🔎 PIs tipo 'Matriz' encontrados:", [pi.numero_pi for pi in resultados])
        return resultados
    except Exception as e:
        print(f"❌ Erro ao listar PIs matriz: {e}")
        return []
    finally:
        session.close()


# Calcular o valor já abatido de um PI Matriz
def calcular_valor_abatido(numero_pi_matriz: str):
    session = SessionLocal()
    try:
        pis_filhos = session.query(PI).filter(PI.numero_pi_matriz == numero_pi_matriz).all()
        valor_abatido = sum(pi.valor_bruto for pi in pis_filhos if pi.valor_bruto)
        return valor_abatido
    except Exception as e:
        print(f"❌ Erro ao calcular valor abatido: {e}")
        return 0
    finally:
        session.close()


# Calcular o saldo restante de um PI Matriz
def calcular_saldo_restante(numero_pi_matriz: str):
    session = SessionLocal()
    try:
        pi_matriz = session.query(PI).filter(PI.numero_pi == numero_pi_matriz).first()
        if not pi_matriz:
            return 0
        valor_abatido = calcular_valor_abatido(numero_pi_matriz)
        return pi_matriz.valor_bruto - valor_abatido
    except Exception as e:
        print(f"❌ Erro ao calcular saldo restante: {e}")
        return 0
    finally:
        session.close()


# ✅ Função para atualizar PI existente
def atualizar_pi(pi_id: int, **dados):
    session = SessionLocal()
    try:
        pi = session.query(PI).get(pi_id)
        if not pi:
            raise ValueError(f"PI com ID {pi_id} não encontrado.")

        campos_editaveis = [
            "numero_pi", "tipo_pi", "numero_pi_matriz", "nome_anunciante", "nome_agencia",
            "data_emissao", "valor_bruto", "valor_liquido", "uf_cliente", "canal",
            "nome_campanha", "diretoria", "executivo", "dia_venda", "mes_venda", "observacoes"
        ]

        for campo in campos_editaveis:
            if campo in dados:
                setattr(pi, campo, dados[campo])

        # Atualiza campo booleano
        pi.eh_matriz = dados.get("tipo_pi", pi.tipo_pi) == "Matriz"

        session.commit()
        print(f"✅ PI ID {pi_id} atualizado com sucesso.")
    except Exception as e:
        session.rollback()
        print(f"❌ Erro ao atualizar PI: {e}")
        raise
    finally:
        session.close()
