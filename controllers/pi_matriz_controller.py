from app.database import SessionLocal
from app.models import PI

# -------------------------------------------------------------------
# Listar PIs do tipo Matriz
# -------------------------------------------------------------------
def listar_pis_matriz():
    session = SessionLocal()
    try:
        return session.query(PI).filter(PI.tipo_pi == "Matriz").order_by(PI.numero_pi.asc()).all()
    except Exception as e:
        print(f"❌ Erro ao listar PIs Matriz: {e}")
        return []
    finally:
        session.close()

# -------------------------------------------------------------------
# Listar PIs Matriz com saldo restante > 0
# -------------------------------------------------------------------
def listar_pis_matriz_ativos():
    session = SessionLocal()
    try:
        todos = session.query(PI).filter(PI.tipo_pi == "Matriz").all()
        return [pi for pi in todos if calcular_saldo_restante(pi.numero_pi) > 0]
    except Exception as e:
        print(f"❌ Erro ao listar PIs ativos: {e}")
        return []
    finally:
        session.close()

# -------------------------------------------------------------------
# Listar apenas abatimentos vinculados a um Matriz
# -------------------------------------------------------------------
def listar_abatimentos(numero_pi_matriz: str):
    session = SessionLocal()
    try:
        return session.query(PI).filter(
            PI.numero_pi_matriz == numero_pi_matriz,
            PI.tipo_pi == "Abatimento"
        ).order_by(PI.numero_pi.asc()).all()
    except Exception as e:
        print(f"❌ Erro ao listar abatimentos: {e}")
        return []
    finally:
        session.close()

# -------------------------------------------------------------------
# Calcular o valor total já abatido
# -------------------------------------------------------------------
def calcular_valor_abatido(numero_pi_matriz: str):
    session = SessionLocal()
    try:
        filhos = session.query(PI).filter(
            PI.numero_pi_matriz == numero_pi_matriz,
            PI.tipo_pi == "Abatimento"
        ).all()
        return sum(f.valor_bruto or 0 for f in filhos)
    except Exception as e:
        print(f"❌ Erro ao calcular valor abatido: {e}")
        return 0
    finally:
        session.close()

# -------------------------------------------------------------------
# Calcular saldo restante do Matriz
# -------------------------------------------------------------------
def calcular_saldo_matriz(numero_pi_matriz: str):
    session = SessionLocal()
    try:
        pi_matriz = session.query(PI).filter(PI.numero_pi == numero_pi_matriz, PI.tipo_pi == "Matriz").first()
        if not pi_matriz:
            return 0
        valor_abatido = calcular_valor_abatido(numero_pi_matriz)
        return (pi_matriz.valor_bruto or 0) - valor_abatido
    except Exception as e:
        print(f"❌ Erro ao calcular saldo do PI matriz: {e}")
        return 0
    finally:
        session.close()

# -------------------------------------------------------------------
# Wrapper para facilitar uso em views
# -------------------------------------------------------------------
def calcular_saldo_restante(numero_pi_matriz: str):
    return calcular_saldo_matriz(numero_pi_matriz)

# -------------------------------------------------------------------
# Criar PI (genérico, mas normalmente chamamos o pi_controller)
# -------------------------------------------------------------------
def criar_pi(**kwargs):
    session = SessionLocal()
    try:
        novo_pi = PI(**kwargs)
        session.add(novo_pi)
        session.commit()
    except Exception as e:
        session.rollback()
        raise Exception(f"❌ Erro ao criar PI: {e}")
    finally:
        session.close()
