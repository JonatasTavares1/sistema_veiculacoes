from app.database import SessionLocal
from app.models import Entrega
from datetime import date

def criar_entrega(veiculacao_id, data_entrega, foi_entregue="Não", motivo=""):
    db = SessionLocal()
    try:
        nova_entrega = Entrega(
            veiculacao_id=veiculacao_id,
            data_entrega=data_entrega,
            foi_entregue=foi_entregue,
            motivo=motivo
        )
        db.add(nova_entrega)
        db.commit()
        db.refresh(nova_entrega)
        return nova_entrega
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


def listar_entregas():
    db = SessionLocal()
    try:
        entregas = db.query(Entrega).order_by(Entrega.data_entrega.desc()).all()
        return entregas
    finally:
        db.close()


def entregas_por_veiculacao(veiculacao_id):
    db = SessionLocal()
    try:
        entregas = db.query(Entrega).filter(Entrega.veiculacao_id == veiculacao_id).order_by(Entrega.data_entrega.desc()).all()
        return entregas
    finally:
        db.close()


def entregas_pendentes():
    db = SessionLocal()
    hoje = date.today()
    try:
        pendentes = db.query(Entrega).filter(
            Entrega.foi_entregue == "Não",
            Entrega.data_entrega < hoje
        ).order_by(Entrega.data_entrega).all()
        return pendentes
    finally:
        db.close()


def marcar_como_entregue(entrega_id):
    db = SessionLocal()
    try:
        entrega = db.query(Entrega).get(entrega_id)
        if entrega:
            entrega.foi_entregue = "Sim"
            entrega.motivo = ""
            db.commit()
            return entrega
        return None
    finally:
        db.close()


def atualizar_motivo(entrega_id, novo_motivo):
    db = SessionLocal()
    try:
        entrega = db.query(Entrega).get(entrega_id)
        if entrega:
            entrega.motivo = novo_motivo
            db.commit()
            return entrega
        return None
    finally:
        db.close()
