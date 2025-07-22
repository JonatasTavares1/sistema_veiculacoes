from app.database import SessionLocal
from app.models import PI
from datetime import date

# Função para criar um novo PI
def criar_pi(
    numero_pi: str,
    cliente: str,
    data_emissao: date,
    observacoes: str = "",
    tipo: str = "",
    praca: str = "",
    meio: str = "",
    colocacao: str = "",
    formato: str = "",
    executivo: str = "",  # Novo campo
    diretoria: str = "",  # Novo campo
    valor_unitario: float = 0.0,
    valor_total: float = 0.0
):
    session = SessionLocal()
    try:
        # Criando a nova instância de PI com os dados fornecidos
        nova_pi = PI(
            numero_pi=numero_pi,
            cliente=cliente,
            data_emissao=data_emissao,
            observacoes=observacoes,
            tipo=tipo,
            praca=praca,
            meio=meio,
            colocacao=colocacao,
            formato=formato,
            executivo=executivo,  # Atribuindo o valor do campo "executivo"
            diretoria=diretoria,  # Atribuindo o valor do campo "diretoria"
            valor_unitario=valor_unitario,
            valor_total=valor_total
        )
        
        # Adicionando o novo PI na sessão do banco de dados
        session.add(nova_pi)
        session.commit()  # Commit para salvar as alterações no banco de dados
        print("PI cadastrada com sucesso!")
    except Exception as e:
        session.rollback()  # Caso ocorra algum erro, desfazemos a transação (rollback)
        print(f"Erro ao cadastrar PI: {e}")
    finally:
        session.close()  # Fechar a sessão com o banco de dados

# Função para listar todos os PIs cadastrados
def listar_pis():
    session = SessionLocal()
    try:
        # Consultando todos os PIs, ordenados de forma decrescente pelo ID
        return session.query(PI).order_by(PI.id.desc()).all()
    except Exception as e:
        print(f"Erro ao listar PIs: {e}")
        return []
    finally:
        session.close()

# Função para listar PIs por Executivo
def listar_pis_por_executivo(executivo: str):
    session = SessionLocal()
    try:
        # Filtrando os PIs pelo nome do executivo
        return session.query(PI).filter(PI.executivo == executivo).order_by(PI.id.desc()).all()
    except Exception as e:
        print(f"Erro ao listar PIs por Executivo: {e}")
        return []
    finally:
        session.close()

def listar_pis_por_diretoria(diretoria: str):
    session = SessionLocal()
    try:
        # Filtrando os PIs pela diretoria
        return session.query(PI).filter(PI.diretoria == diretoria).order_by(PI.id.desc()).all()
    except Exception as e:
        print(f"Erro ao listar PIs por Diretoria: {e}")
        return []
    finally:
        session.close()