from app.database import SessionLocal
from app.models import PI

# Retorna todos os PIs que são matriz (numero_pi_matriz == None)
def listar_pis_matriz():
    session = SessionLocal()
    try:
        return session.query(PI).filter(PI.numero_pi_matriz == None).order_by(PI.numero_pi.desc()).all()
    except Exception as e:
        print(f"❌ Erro ao listar PIs matriz: {e}")
        return []
    finally:
        session.close()

# Retorna todos os PIs vinculados a um PI Matriz
def listar_pis_vinculados(numero_pi_matriz: str):
    session = SessionLocal()
    try:
        return session.query(PI).filter(PI.numero_pi_matriz == numero_pi_matriz).order_by(PI.numero_pi.desc()).all()
    except Exception as e:
        print(f"❌ Erro ao listar PIs vinculados: {e}")
        return []
    finally:
        session.close()

# Calcula o saldo restante de um PI Matriz
def calcular_saldo_matriz(numero_pi_matriz: str):
    session = SessionLocal()
    try:
        pi_matriz = session.query(PI).filter(PI.numero_pi == numero_pi_matriz).first()
        if not pi_matriz:
            return 0.0
        pis_vinculados = session.query(PI).filter(PI.numero_pi_matriz == numero_pi_matriz).all()
        total_utilizado = sum(pi.valor_bruto for pi in pis_vinculados)
        return max(0.0, pi_matriz.valor_bruto - total_utilizado)
    except Exception as e:
        print(f"❌ Erro ao calcular saldo: {e}")
        return 0.0
    finally:
        session.close()
