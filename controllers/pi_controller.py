from app.database import SessionLocal
from app.models import PI
from datetime import date

def criar_pi(
    numero_pi: str,
    cliente: str,
    data_emissao: date,
    observacoes: str = "",
    tipo: str = "",
    praca: str = "",
    meio: str = "",
    peca_publicitaria: str = "",
    colocacao: str = "",
    formato: str = "",
    valor_unitario: float = 0.0,
    valor_total: float = 0.0
):
    session = SessionLocal()
    try:
        nova_pi = PI(
            numero_pi=numero_pi,
            cliente=cliente,
            data_emissao=data_emissao,
            observacoes=observacoes,
            tipo=tipo,
            praca=praca,
            meio=meio,
            peca_publicitaria=peca_publicitaria,
            colocacao=colocacao,
            formato=formato,
            valor_unitario=valor_unitario,
            valor_total=valor_total
        )
        session.add(nova_pi)
        session.commit()
        print("PI cadastrada com sucesso!")
    except Exception as e:
        session.rollback()
        print(f"Erro ao cadastrar PI: {e}")
    finally:
        session.close()

def listar_pis():
    session = SessionLocal()
    try:
        return session.query(PI).order_by(PI.id.desc()).all()
    except Exception as e:
        print(f"Erro ao listar PIs: {e}")
        return []
    finally:
        session.close()
