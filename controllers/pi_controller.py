from app.database import SessionLocal
from app.models import PI
from datetime import datetime
from sqlalchemy import func

# -----------------------------------------------------------------------------
# CRIAR PI
# -----------------------------------------------------------------------------
def criar_pi(
    numero_pi: str,
    tipo_pi: str,
    numero_pi_matriz: str = None,  # usado apenas se tipo == "Abatimento"
    numero_pi_normal: str = None,  # usado apenas se tipo == "CS"
    nome_anunciante: str = None,
    razao_social_anunciante: str = None,
    cnpj_anunciante: str = None,
    uf_cliente: str = None,
    executivo: str = None,
    diretoria: str = None,
    nome_campanha: str = None,
    nome_agencia: str = None,
    razao_social_agencia: str = None,
    cnpj_agencia: str = None,
    uf_agencia: str = None,
    mes_venda: str = None,
    dia_venda: str = None,
    canal: str = None,
    perfil_anunciante: str = None,
    subperfil_anunciante: str = None,
    valor_bruto: float = None,
    valor_liquido: float = None,
    vencimento=None,
    data_emissao=None,
    observacoes: str = ""
):
    session = SessionLocal()
    try:
        # Converte datas se vierem como string
        if isinstance(vencimento, str) and vencimento:
            vencimento = datetime.strptime(vencimento, "%d/%m/%Y").date()
        if isinstance(data_emissao, str) and data_emissao:
            data_emissao = datetime.strptime(data_emissao, "%d/%m/%Y").date()

        # Duplicidade
        if session.query(PI).filter_by(numero_pi=numero_pi).first():
            raise ValueError(f"O PI '{numero_pi}' já está cadastrado.")

        # Normaliza tipo (aceita variações de caixa)
        tipo_norm = tipo_pi.capitalize()

        # -------------------
        # Validações por tipo
        # -------------------
        if tipo_norm == "Abatimento":
            if not numero_pi_matriz:
                raise ValueError("Para cadastrar um ABATIMENTO é obrigatório informar o PI Matriz.")
            pi_matriz = session.query(PI).filter_by(numero_pi=numero_pi_matriz, tipo_pi="Matriz").first()
            if not pi_matriz:
                raise ValueError(f"PI Matriz '{numero_pi_matriz}' não encontrado.")
            # Abatimento consome saldo do Matriz
            if valor_bruto is None:
                raise ValueError("Informe o valor do abatimento.")
            saldo_restante = calcular_saldo_restante(numero_pi_matriz)
            if valor_bruto > saldo_restante:
                raise ValueError(
                    f"O valor do abatimento ({valor_bruto}) excede o saldo restante do Matriz ({saldo_restante})."
                )

        elif tipo_norm == "Cs":
            if not numero_pi_normal:
                raise ValueError("Para cadastrar um CS é obrigatório informar o PI Normal vinculado.")
            pi_normal = session.query(PI).filter_by(numero_pi=numero_pi_normal, tipo_pi="Normal").first()
            if not pi_normal:
                raise ValueError(f"PI Normal '{numero_pi_normal}' não encontrado.")

        elif tipo_norm not in ["Matriz", "Normal"]:
            raise ValueError(f"Tipo de PI inválido: {tipo_pi}")

        # Criação do PI
        novo_pi = PI(
            numero_pi=numero_pi,
            tipo_pi=tipo_norm,
            numero_pi_matriz=numero_pi_matriz if tipo_norm == "Abatimento" else None,
            numero_pi_normal=numero_pi_normal if tipo_norm == "Cs" else None,
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
            observacoes=observacoes,
            eh_matriz=(tipo_norm == "Matriz")
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

# -----------------------------------------------------------------------------
# LISTAGENS
# -----------------------------------------------------------------------------
def listar_pis():
    session = SessionLocal()
    try:
        return session.query(PI).order_by(PI.numero_pi.desc()).all()
    finally:
        session.close()

def listar_pis_por_executivo(executivo: str):
    session = SessionLocal()
    try:
        return session.query(PI).filter(PI.executivo == executivo).order_by(PI.numero_pi.desc()).all()
    finally:
        session.close()

def listar_pis_por_diretoria(diretoria: str):
    session = SessionLocal()
    try:
        return session.query(PI).filter(PI.diretoria == diretoria).order_by(PI.numero_pi.desc()).all()
    finally:
        session.close()

def listar_pis_por_data(dia: str, mes: str):
    session = SessionLocal()
    try:
        return session.query(PI).filter(PI.dia_venda == dia, PI.mes_venda == mes).order_by(PI.numero_pi.desc()).all()
    finally:
        session.close()

def listar_pis_por_tipo(tipo: str):
    session = SessionLocal()
    try:
        return session.query(PI).filter(func.lower(PI.tipo_pi) == tipo.lower()).order_by(PI.numero_pi.desc()).all()
    finally:
        session.close()

def listar_pis_matriz_ativos():
    """Matrizes com saldo > 0 (considerando apenas abatimentos)."""
    session = SessionLocal()
    try:
        todos = session.query(PI).filter(PI.tipo_pi == "Matriz").all()
        return [pi for pi in todos if calcular_saldo_restante(pi.numero_pi) > 0]
    finally:
        session.close()

def listar_pis_normal_ativos():
    """Normais para popular vínculo de CS."""
    session = SessionLocal()
    try:
        return session.query(PI).filter(PI.tipo_pi == "Normal").order_by(PI.numero_pi.desc()).all()
    finally:
        session.close()

def listar_vinculados_abatimentos(numero_pi_matriz: str):
    """Lista abatimentos de um Matriz."""
    session = SessionLocal()
    try:
        return session.query(PI).filter(
            PI.numero_pi_matriz == numero_pi_matriz,
            PI.tipo_pi == "Abatimento"
        ).order_by(PI.numero_pi.asc()).all()
    finally:
        session.close()

def listar_vinculados_cs(numero_pi_normal: str):
    """Lista CS vinculados a um Normal."""
    session = SessionLocal()
    try:
        return session.query(PI).filter(
            PI.numero_pi_normal == numero_pi_normal,
            PI.tipo_pi == "Cs"
        ).order_by(PI.numero_pi.asc()).all()
    finally:
        session.close()

# -----------------------------------------------------------------------------
# CÁLCULOS (somente abatimentos impactam saldo do Matriz)
# -----------------------------------------------------------------------------
def calcular_valor_abatido(numero_pi_matriz: str):
    session = SessionLocal()
    try:
        filhos = session.query(PI).filter(
            PI.numero_pi_matriz == numero_pi_matriz,
            PI.tipo_pi == "Abatimento"
        ).all()
        return sum(f.valor_bruto or 0 for f in filhos)
    finally:
        session.close()

def calcular_saldo_restante(numero_pi_matriz: str):
    session = SessionLocal()
    try:
        pi_matriz = session.query(PI).filter_by(numero_pi=numero_pi_matriz, tipo_pi="Matriz").first()
        if not pi_matriz:
            return 0
        valor_abatido = calcular_valor_abatido(numero_pi_matriz)
        return (pi_matriz.valor_bruto or 0) - valor_abatido
    finally:
        session.close()

# -----------------------------------------------------------------------------
# ATUALIZAR PI
# -----------------------------------------------------------------------------
def atualizar_pi(pi_id: int, **dados):
    """
    Atualização simples. Se quiser, endurecemos regras por tipo depois:
    - impedir mudar tipo sem revalidar vínculos
    - impedir abatimento > saldo
    - etc.
    """
    session = SessionLocal()
    try:
        pi = session.query(PI).get(pi_id)
        if not pi:
            raise ValueError(f"PI com ID {pi_id} não encontrado.")

        for campo, valor in dados.items():
            if hasattr(pi, campo):
                setattr(pi, campo, valor)

        # Reajusta flag de matriz
        pi.eh_matriz = (pi.tipo_pi == "Matriz")

        session.commit()
        print(f"✅ PI ID {pi_id} atualizado com sucesso.")
    except Exception as e:
        session.rollback()
        print(f"❌ Erro ao atualizar PI: {e}")
        raise
    finally:
        session.close()
